// Live smoke test for the v1 tool surface. Drives the real Hono app in-process
// against live Shopify (read-only calls plus draftOrderCalculate, which creates
// nothing). Nothing is deployed and no order is placed.
//   npm run build && node scripts/v1-live-smoke.mjs [--quiet]
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import app from "../dist/index.js";

const QUIET = process.argv.includes("--quiet");
// Token: SHOPIFY_PACKRIFT_TOKEN, or an env file named by SHOPIFY_ENV_FILE.
const envFilePath = process.env.SHOPIFY_ENV_FILE ?? `${homedir()}/Downloads/env-shopify-packrift.txt`;
const token =
  process.env.SHOPIFY_PACKRIFT_TOKEN ??
  readFileSync(envFilePath, "utf8").match(/^\s*SHOPIFY_PACKRIFT_TOKEN\s*=\s*"?([^"\n]+)"?/m)?.[1];
if (!token) throw new Error("Set SHOPIFY_PACKRIFT_TOKEN (or SHOPIFY_ENV_FILE) to run the live smoke test.");

const store = new Map();
const kv = {
  async get(key, type) {
    const value = store.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  },
  async put(key, value) {
    if (!key.startsWith("events/")) store.set(key, value);
  },
  async delete(key) {
    store.delete(key);
  },
  async list() {
    return { keys: [], list_complete: true };
  },
};
const env = {
  SHOPIFY_STORE_DOMAIN: "packrift.myshopify.com",
  SHOPIFY_API_VERSION: "2025-04",
  STOREFRONT_DOMAIN: "packrift.com",
  SHOPIFY_PACKRIFT_TOKEN: token,
  CATALOG_CACHE: kv,
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

let rpcId = 0;
async function rpc(method, params, sessionId) {
  const headers = { "content-type": "application/json", "user-agent": "packrift-v1-smoke/1.0" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const started = Date.now();
  const res = await app.fetch(
    new Request("https://mcp.packrift.com/mcp", { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) }),
    env,
    ctx
  );
  const body = await res.json();
  return { ms: Date.now() - started, body, sessionId: res.headers.get("mcp-session-id") };
}

const results = [];
function report(label, call) {
  const result = call.body.result ?? {};
  const text = (result.content ?? []).map((c) => c.text ?? "").join("\n");
  const structured = JSON.stringify(result.structuredContent ?? {});
  const tokens = Math.round((text.length + structured.length) / 4);
  results.push({ label, ms: call.ms, tokens, isError: Boolean(result.isError || call.body.error) });
  console.log(`\n### ${label}  |  ${call.ms} ms  |  ~${tokens} tokens (text ${text.length} ch, structured ${structured.length} ch)${result.isError ? "  |  ERROR" : ""}`);
  if (call.body.error) console.log("RPC ERROR:", JSON.stringify(call.body.error));
  if (!QUIET) console.log(text.slice(0, 1800));
  return { text, structured: result.structuredContent };
}

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-ai", version: "0.1.0" } });
const session = init.sessionId;
console.log("session id:", session, "| instructions chars:", init.body.result.instructions.length);
const list = await rpc("tools/list", {}, session);
const tools = list.body.result.tools;
console.log("tools/list:", tools.map((t) => t.name).join(", "), `| ${JSON.stringify(tools).length} ch`);
for (const t of tools) {
  const a = t.annotations ?? {};
  if (!t.title || a.readOnlyHint === undefined || a.destructiveHint === undefined) console.log("MISSING ANNOTATIONS:", t.name);
  if (t.description.length > 2048) console.log("DESCRIPTION TOO LONG:", t.name, t.description.length);
}

const call = (name, args) => rpc("tools/call", { name, arguments: args }, session);

report("search 12x12x12 boxes", await call("search_products", { query: "12x12x12 shipping boxes" }));
report("search 10x13 poly mailers", await call("search_products", { query: "10x13 poly mailers" }));
report("search packing tape 3 inch", await call("search_products", { query: "3 inch clear packing tape" }));
report("search no exact 12x12x13 box", await call("search_products", { query: "12x12x13 box" }));
report("search SKU 1066", await call("search_products", { query: "SKU 1066", limit: 1 }));
report("search bubble mailers 6x10", await call("search_products", { query: "6x10 bubble mailers" }));
report("fit mug fragile", await call("find_packaging_for_item", { item_length_in: 4.5, item_width_in: 3.5, item_depth_in: 4, item_weight_lb: 1, use_case: "ceramic mug" }));
report("fit t-shirt apparel", await call("find_packaging_for_item", { item_length_in: 12, item_width_in: 10, item_depth_in: 1.5, item_weight_lb: 0.5, use_case: "folded t-shirt" }));
report("fit laptop electronics", await call("find_packaging_for_item", { item_length_in: 14, item_width_in: 9.5, item_depth_in: 1, item_weight_lb: 4, use_case: "laptop" }));
report("fit book", await call("find_packaging_for_item", { item_length_in: 9, item_width_in: 6, item_depth_in: 1.5, item_weight_lb: 1.5, use_case: "hardcover book" }));
report("fit heavy part", await call("find_packaging_for_item", { item_length_in: 14, item_width_in: 10, item_depth_in: 8, item_weight_lb: 45, use_case: "auto parts" }));
report("fit poster tube", await call("find_packaging_for_item", { item_length_in: 24, item_width_in: 2, item_depth_in: 2, item_weight_lb: 0.5, use_case: "rolled poster" }));
report("product 1066 x40", await call("get_product", { sku: "1066", quantity: 40 }));
report("shipping 6x1066 to 75201", await call("get_shipping_estimate", { destination_postal_code: "75201", items: [{ sku: "1066", quantity: 6 }] }));
report("shipping 20x1066 to 10001", await call("get_shipping_estimate", { destination_postal_code: "10001", items: [{ sku: "1066", quantity: 20 }] }));
const cart = report("cart 1066x6 + CV1013100PK x2", await call("create_cart_url", { items: [{ sku: "1066", quantity: 6 }, { sku: "CV1013100PK", quantity: 2 }] }));
report("quote bulk printed", await call("get_bulk_quote_link", { requested_spec: "2,000 18x12x12 ECT-44 boxes, printed 1 color", quantity: "2000" }));
report("error: unknown sku", await call("get_product", { sku: "NOPE-123" }));
report("error: bad args", await call("find_packaging_for_item", { item_length_in: "abc" }));

// Legacy path used by the WebMCP tools on packrift.com: JSON text with results[0].sku etc.
const legacy = report("legacy compare_alternatives", await call("compare_alternatives", { requested_spec: "S-4344 12x12x12 200# boxes", limit: 1 }));
try {
  const parsed = JSON.parse(legacy.text);
  const best = parsed.results?.[0];
  console.log("legacy parse ok:", Boolean(best?.sku && best?.title && best?.product_url && best?.variant_id), best?.sku, best?.match?.confidence);
} catch (error) {
  console.log("LEGACY PARSE FAILED:", error.message);
}
const legacyInv = report("legacy inventory_status", await call("inventory_status", { sku: "1066" }));
console.log("supplier name present in legacy inventory output:", /box ?partners|\bBP - /i.test(legacyInv.text));

// Checkout link redirect
const checkout = cart.structured?.checkout_url;
if (checkout) {
  const res = await app.fetch(new Request(checkout, { headers: { "user-agent": "packrift-v1-smoke/1.0" } }), env, ctx);
  console.log("\ncheckout link:", checkout, "->", res.status, res.headers.get("location")?.slice(0, 200));
}
for (const path of ["/ai/mcp-funnel-snapshot.json", "/events/ai-sales/summary", "/ai/mcp-usage-snapshot.json", "/llms.txt", "/start"]) {
  const res = await app.fetch(new Request(`https://mcp.packrift.com${path}`, { headers: { "user-agent": "packrift-v1-smoke/1.0" } }), env, ctx);
  console.log("route", path, "->", res.status);
}
const resources = await rpc("resources/list", {}, session);
console.log("resources/list:", resources.body.result.resources.length, "entries,", JSON.stringify(resources.body.result).length, "ch");

console.log("\n=== summary ===");
for (const r of results) console.log(`${r.isError ? "ERR" : "ok "} ${String(r.ms).padStart(5)} ms  ~${String(r.tokens).padStart(5)} tok  ${r.label}`);
