#!/usr/bin/env node
// Live smoke test for the Packrift MCP 1.0 buyer path against the hosted
// endpoint: initialize, tools/list, search, product detail, checkout link,
// the checkout redirect, the held-SKU guard and the legacy WebMCP path.
// Read-only: nothing is ordered. Writes evidence to outputs/mcp-cart-handoff-smoke/.
//   npm run smoke:cart-handoff -- --sku 1066 --qty 1
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT = "https://mcp.packrift.com/mcp";
const OUT_ROOT = resolve(process.cwd(), "outputs/mcp-cart-handoff-smoke");
const HELD_SKUS = ["12104", "CRR40W", "FWUPS116S24P"];
const V1_TOOLS = ["search_products", "find_packaging_for_item", "get_product", "get_shipping_estimate", "create_cart_url", "get_bulk_quote_link"];

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : null;
};
const endpoint = flag("endpoint") ?? process.env.MCP_ENDPOINT ?? DEFAULT_ENDPOINT;
const sku = flag("sku") ?? "1066";
const qty = Number.parseInt(flag("qty") ?? "1", 10);
if (!Number.isFinite(qty) || qty < 1) throw new Error("--qty must be a positive integer");

let sessionId = null;
let rpcId = 0;
async function rpc(method, params) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "packrift-cart-handoff-smoke/1.0" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, ...(params ? { params } : {}) }) });
  sessionId = response.headers.get("mcp-session-id") ?? sessionId;
  const parsed = JSON.parse((await response.text()) || "null");
  return { status: response.status, ok: response.ok && !parsed?.error, parsed };
}

async function callTool(name, args) {
  const response = await rpc("tools/call", { name, arguments: { ...args, suppress_analytics: true, analytics_context: { synthetic: true, source: "mcp_cart_handoff_smoke" } } });
  const result = response.parsed?.result ?? {};
  return {
    ...response,
    structured: result.structuredContent ?? null,
    text: (result.content ?? []).map((row) => row.text ?? "").join("\n"),
    isToolError: Boolean(result.isError),
  };
}

const check = (name, pass, details = {}) => ({ name, pass: Boolean(pass), ...details });

async function main() {
  const initialize = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "packrift-cart-handoff-smoke", version: "1" } });
  const toolsList = await rpc("tools/list");
  const tools = toolsList.parsed?.result?.tools ?? [];
  const toolNames = tools.map((tool) => tool.name);
  const search = await callTool("search_products", { query: `SKU ${sku}`, limit: 1 });
  const product = await callTool("get_product", { sku, quantity: qty });
  const cart = await callTool("create_cart_url", { items: [{ sku, quantity: qty }] });
  const checkoutUrl = cart.structured?.checkout_url ?? null;
  const redirect = checkoutUrl ? await fetch(checkoutUrl, { redirect: "manual", headers: { "user-agent": "packrift-cart-handoff-smoke/1.0" } }) : null;
  const location = redirect?.headers.get("location") ?? "";
  const held = await Promise.all(HELD_SKUS.map(async (heldSku) => ({ sku: heldSku, cart: await callTool("create_cart_url", { items: [{ sku: heldSku, quantity: 1 }] }) })));
  const legacy = await callTool("compare_alternatives", { requested_spec: "12x12x12 boxes", limit: 1 });
  let legacyBest = null;
  try {
    legacyBest = JSON.parse(legacy.text).results?.[0] ?? null;
  } catch {
    legacyBest = null;
  }

  const checks = [
    check("initialize_ok", initialize.ok && initialize.parsed?.result?.serverInfo?.version, { server: initialize.parsed?.result?.serverInfo ?? null }),
    check("tools_list_is_v1", toolsList.ok && V1_TOOLS.every((name) => toolNames.includes(name)) && toolNames.length === V1_TOOLS.length, { tools: toolNames }),
    check("tools_annotated", tools.every((tool) => tool.title && tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false)),
    check("search_finds_sku", !search.isToolError && search.structured?.results?.some((row) => row.sku === sku), { text: search.text.slice(0, 200) }),
    check("product_live", !product.isToolError && product.structured?.sku === sku && typeof product.structured?.price === "number", { price: product.structured?.price ?? null, in_stock: product.structured?.in_stock ?? null }),
    check("checkout_link", !cart.isToolError && typeof checkoutUrl === "string" && checkoutUrl.startsWith("https://mcp.packrift.com/c/"), { checkout_url: checkoutUrl }),
    check("checkout_redirects_to_cart", redirect?.status === 302 && location.startsWith("https://packrift.com/cart/") && location.includes("utm_medium=mcp_tool"), { status: redirect?.status ?? null, location: location.slice(0, 200) }),
    check("held_skus_blocked", held.every((row) => row.cart.isToolError && /quote/i.test(row.cart.text)), { held: held.map((row) => ({ sku: row.sku, blocked: row.cart.isToolError })) }),
    check("legacy_webmcp_path", Boolean(legacyBest?.sku && legacyBest?.title && legacyBest?.product_url && legacyBest?.variant_id), { sku: legacyBest?.sku ?? null }),
  ];
  const pass = checks.every((row) => row.pass);
  const output = { generated_at: new Date().toISOString(), endpoint, sku, qty, pass, checks };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(OUT_ROOT, stamp);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "cart-handoff-smoke.json"), JSON.stringify(output, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(output, null, 2) + "\n");
  const markdown = ["# MCP Cart Handoff Smoke", "", `- Endpoint: \`${endpoint}\``, `- SKU: \`${sku}\` x ${qty}`, `- Pass: \`${pass}\``, "", "## Checks", ...checks.map((row) => `- ${row.pass ? "PASS" : "FAIL"} \`${row.name}\``), ""].join("\n");
  writeFileSync(resolve(outDir, "cart-handoff-smoke.md"), markdown);
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdown);
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = pass ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
