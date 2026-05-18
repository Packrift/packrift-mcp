#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT = "https://mcp.packrift.com/mcp";
const DEFAULT_SKU = "1066";
const DEFAULT_QTY = 1;
const OUT_ROOT = resolve(process.cwd(), "outputs/mcp-cart-handoff-smoke");

const args = parseArgs(process.argv.slice(2));
const endpoint = stringArg("endpoint") ?? process.env.MCP_ENDPOINT ?? DEFAULT_ENDPOINT;
const sku = stringArg("sku") ?? DEFAULT_SKU;
const qty = intArg("qty") ?? DEFAULT_QTY;
const verifyFinalCart = Boolean(args.flags["verify-final-cart"]);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags };
}

function stringArg(name) {
  const value = args.flags[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function intArg(name) {
  const value = stringArg(name);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

async function rpc(method, params = undefined) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Packrift-MCP-Cart-Handoff-Smoke/1.0 (+https://mcp.packrift.com/mcp)",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  return { status: response.status, ok: response.ok && !parsed?.error, parsed };
}

async function callTool(name, toolArgs) {
  const response = await rpc("tools/call", {
    name,
    arguments: {
      ...toolArgs,
      suppress_analytics: true,
      analytics_context: { synthetic: true, source: "mcp_cart_handoff_smoke" },
    },
  });
  return {
    ...response,
    structured: response.parsed?.result?.structuredContent ?? null,
    isToolError: Boolean(response.parsed?.result?.isError),
    toolErrorText: response.parsed?.result?.content?.map((row) => row.text || "").join("\n") ?? "",
  };
}

function check(name, pass, details = {}) {
  return { name, pass, ...details };
}

function candidateItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.candidates)) return payload.candidates;
  return [];
}

async function head(url) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "manual",
    headers: {
      "User-Agent": "Packrift-MCP-Cart-Handoff-Smoke/1.0 (+https://mcp.packrift.com/mcp)",
    },
  });
  return {
    status: response.status,
    ok: response.ok || (response.status >= 300 && response.status < 400),
    location: response.headers.get("location"),
    cartLandingShim: response.headers.get("x-packrift-cart-landing-shim"),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const initialize = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "packrift-cart-handoff-smoke", version: "1" },
  });
  const toolsList = await rpc("tools/list");
  const toolNames = toolsList.parsed?.result?.tools?.map((tool) => tool.name) ?? [];

  const candidates = await callTool("get_cart_handoff_candidates", { sku, limit: 1 });
  const candidate = candidateItems(candidates.structured)[0] ?? null;
  const variantId = candidate?.variant_id ?? candidate?.create_cart_url_arguments?.items?.[0]?.variant_id ?? null;
  const handle = candidate?.handle ?? candidate?.selected_handle ?? candidate?.create_cart_url_arguments?.selected_handle ?? null;

  const product = handle ? await callTool("get_product", { handle }) : null;
  const pricing = variantId
    ? await callTool("get_pricing", { variant_ids: [variantId], quantity: qty, selected_sku: sku, selected_handle: handle })
    : null;
  const inventory = variantId
    ? await callTool("check_inventory", { variant_ids: [variantId], selected_sku: sku, selected_handle: handle })
    : null;
  const cart = variantId
    ? await callTool("create_cart_url", {
        items: [{ variant_id: variantId, qty }],
        selected_sku: sku,
        selected_handle: handle,
        match_type: "smoke_cart_handoff",
        ref: "mcp",
        source_context: "smoke_test",
      })
    : null;

  const cartUrl = cart?.structured?.url ?? null;
  const finalCartUrl = cart?.structured?.final_cart_url ?? null;
  const cartLandingHead = cartUrl ? await head(cartUrl) : null;
  const finalCartHead = verifyFinalCart && finalCartUrl ? await head(finalCartUrl) : null;

  const checks = [
    check("initialize_ok", initialize.ok, { status: initialize.status, server: initialize.parsed?.result?.serverInfo ?? null }),
    check("tools_list_ok", toolsList.ok && toolNames.length >= 14, { status: toolsList.status, tool_count: toolNames.length }),
    check("candidate_found", Boolean(candidate && variantId), { sku, variant_id: variantId, handle }),
    check("candidate_requires_live_confirmation", Array.isArray(candidate?.live_confirmation_required), {
      live_confirmation_required: candidate?.live_confirmation_required ?? null,
    }),
    check("product_ok", Boolean(product?.ok && !product.isToolError && product.structured?.handle === handle), {
      status: product?.status ?? null,
      observed_handle: product?.structured?.handle ?? null,
    }),
    check("pricing_ok", Boolean(pricing?.ok && !pricing.isToolError && pricing.structured?.[0]?.available), {
      status: pricing?.status ?? null,
      unit_price: pricing?.structured?.[0]?.unit_price ?? null,
      currency: pricing?.structured?.[0]?.currency ?? null,
    }),
    check("inventory_ok", Boolean(inventory?.ok && !inventory.isToolError && inventory.structured?.[0]?.in_stock), {
      status: inventory?.status ?? null,
      available: inventory?.structured?.[0]?.available ?? null,
    }),
    check("cart_url_ok", Boolean(cart?.ok && !cart.isToolError && cartUrl && finalCartUrl), {
      status: cart?.status ?? null,
      url: cartUrl,
      final_cart_url: finalCartUrl,
    }),
    check("cart_landing_ok", Boolean(cartLandingHead?.ok && cartLandingHead.cartLandingShim), cartLandingHead ?? {}),
  ];
  if (verifyFinalCart) {
    checks.push(check("final_cart_redirect_ok", Boolean(finalCartHead?.ok && finalCartHead.location), finalCartHead ?? {}));
  }

  const pass = checks.every((row) => row.pass);
  const output = {
    created_at: startedAt,
    endpoint,
    mode: "synthetic_read_only_cart_handoff_smoke",
    live_endpoint_checked: true,
    live_systems_mutated: false,
    final_cart_head_verified: verifyFinalCart,
    sku,
    quantity: qty,
    pass,
    checks,
    selected: {
      sku,
      variant_id: variantId,
      handle,
      title: candidate?.title ?? product?.structured?.title ?? null,
      cart_url: cartUrl,
      final_cart_url: finalCartUrl,
    },
  };

  const stamp = startedAt.replace(/[:.]/g, "-");
  const outDir = resolve(OUT_ROOT, stamp);
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, "cart-handoff-smoke.json");
  const mdPath = resolve(outDir, "cart-handoff-smoke.md");
  writeFileSync(jsonPath, JSON.stringify(output, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(output, null, 2) + "\n");
  const markdown =
    [
      "# MCP Cart Handoff Smoke",
      "",
      `- Endpoint: \`${endpoint}\``,
      `- SKU: \`${sku}\``,
      `- Quantity: \`${qty}\``,
      `- Pass: \`${pass}\``,
      `- Final cart HEAD verified: \`${verifyFinalCart}\``,
      "",
      "## Checks",
      ...checks.map((row) => `- ${row.pass ? "PASS" : "FAIL"} \`${row.name}\``),
      "",
      "## Selected Handoff",
      `- Variant ID: \`${variantId ?? ""}\``,
      `- Handle: \`${handle ?? ""}\``,
      `- MCP cart URL: \`${cartUrl ?? ""}\``,
      `- Final Shopify cart URL: \`${finalCartUrl ?? ""}\``,
      "",
      `JSON: \`${jsonPath}\``,
    ].join("\n") + "\n";
  writeFileSync(mdPath, markdown);
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdown);

  console.log(JSON.stringify(output, null, 2));
  process.exitCode = pass ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
