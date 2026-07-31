#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT = "https://mcp.packrift.com/mcp";
const DEFAULT_SKU = "1066";
const DEFAULT_QTY = 1;
const DEFAULT_SOURCE = "smoke_cart_handoff";
const DEFAULT_TARGET = "generic_streamable_http";
const OUT_ROOT = resolve(process.cwd(), "outputs/mcp-cart-handoff-smoke");
const HELD_SKUS = ["12104", "CRR40W", "FWUPS116S24P"];

const args = parseArgs(process.argv.slice(2));
const endpointInput = stringArg("endpoint") ?? process.env.MCP_ENDPOINT ?? DEFAULT_ENDPOINT;
const source = normalizedSlug(stringArg("source") ?? process.env.MCP_SOURCE ?? DEFAULT_SOURCE);
const target = normalizedSlug(stringArg("target") ?? process.env.MCP_TARGET ?? DEFAULT_TARGET);
const endpoint = sourceAwareEndpoint(endpointInput, source, target);
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

function normalizedSlug(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (!slug || !/^[a-z0-9_]{2,80}$/.test(slug)) {
    throw new Error(`Invalid source/target slug: ${value}`);
  }
  return slug;
}

function sourceAwareEndpoint(value, sourceSlug, targetSlug) {
  const url = new URL(value);
  if (!url.searchParams.get("packrift_mcp_source") && !url.searchParams.get("mcp_source")) {
    url.searchParams.set("packrift_mcp_source", sourceSlug);
  }
  if (!url.searchParams.get("packrift_mcp_target") && !url.searchParams.get("mcp_target")) {
    url.searchParams.set("packrift_mcp_target", targetSlug);
  }
  return url.toString();
}

function sourceAwareToolArgs(toolArgs) {
  return {
    ...toolArgs,
    ...(!toolArgs.mcp_source_context && !toolArgs.packrift_mcp_source && !toolArgs.mcp_source && !toolArgs.source_slug
      ? { mcp_source_context: source }
      : {}),
    ...(!toolArgs.mcp_install_target && !toolArgs.packrift_mcp_target && !toolArgs.mcp_target ? { mcp_install_target: target } : {}),
  };
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
      ...sourceAwareToolArgs(toolArgs),
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

function cartAttributePresent(url, key) {
  if (!url) return false;
  const encodedKey = encodeURIComponent(`attributes[${key}]`);
  const rawKey = `attributes[${key}]`;
  return url.includes(`${encodedKey}=`) || url.includes(`${rawKey}=`);
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
  const skuCartArguments = candidate?.create_cart_url_sku_arguments
    ? { ...candidate.create_cart_url_sku_arguments, quantity: qty }
    : null;
  const explicitCartArguments = variantId
    ? {
        items: [{ variant_id: variantId, qty }],
        selected_sku: sku,
        selected_handle: handle,
      }
    : null;
  const cartArguments = skuCartArguments ?? explicitCartArguments;

  const product = handle ? await callTool("get_product", { handle }) : null;
  const pricing = variantId
    ? await callTool("get_pricing", { variant_ids: [variantId], quantity: qty, selected_sku: sku, selected_handle: handle })
    : null;
  const inventory = variantId
    ? await callTool("check_inventory", { variant_ids: [variantId], selected_sku: sku, selected_handle: handle })
    : null;
  const preparedUnconfirmed = await callTool("prepare_purchase_handoff", {
    sku,
    quantity: qty,
    buyer_confirmed: false,
    source_context: `${source}_smoke_cart_handoff`.slice(0, 80),
    mcp_source_context: source,
    mcp_install_target: target,
  });
  const preparedConfirmed = await callTool("prepare_purchase_handoff", {
    sku,
    quantity: qty,
    buyer_confirmed: true,
    source_context: `${source}_smoke_cart_handoff`.slice(0, 80),
    mcp_source_context: source,
    mcp_install_target: target,
  });
  const cart = cartArguments
    ? await callTool("create_cart_url", {
        ...cartArguments,
        match_type: "smoke_cart_handoff",
        ref: "mcp",
        source_context: "smoke_test",
      })
    : null;
  const heldSkuResults = await Promise.all(
    HELD_SKUS.map(async (heldSku) => {
      const heldCandidates = await callTool("get_cart_handoff_candidates", { sku: heldSku, limit: 1 });
      const heldPrepare = await callTool("prepare_purchase_handoff", {
        sku: heldSku,
        quantity: 1,
        buyer_confirmed: true,
        source_context: "smoke_cart_handoff",
      });
      const heldCart = await callTool("create_cart_url", {
        sku: heldSku,
        quantity: 1,
        source_context: "smoke_cart_handoff",
      });
      return { sku: heldSku, candidates: heldCandidates, prepare: heldPrepare, cart: heldCart };
    })
  );

  const cartUrl = cart?.structured?.url ?? null;
  const finalCartUrl = cart?.structured?.final_cart_url ?? null;
  const cartLandingHead = cartUrl ? await head(cartUrl) : null;
  const finalCartHead = verifyFinalCart && finalCartUrl ? await head(finalCartUrl) : null;

  const checks = [
    check("initialize_ok", initialize.ok, { status: initialize.status, server: initialize.parsed?.result?.serverInfo ?? null }),
    check("tools_list_ok", toolsList.ok && toolNames.length >= 15 && toolNames.includes("prepare_purchase_handoff"), {
      status: toolsList.status,
      tool_count: toolNames.length,
      has_prepare_purchase_handoff: toolNames.includes("prepare_purchase_handoff"),
    }),
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
    check(
      "prepare_purchase_handoff_unconfirmed_guard",
      Boolean(
        preparedUnconfirmed?.ok &&
          !preparedUnconfirmed.isToolError &&
          preparedUnconfirmed.structured?.status === "live_confirmed_awaiting_buyer_confirmation" &&
          preparedUnconfirmed.structured?.cart === null &&
          preparedUnconfirmed.structured?.cart_arguments_if_buyer_confirms?.mcp_source_context === source &&
          preparedUnconfirmed.structured?.cart_arguments_if_buyer_confirms?.mcp_install_target === target
      ),
      {
        status: preparedUnconfirmed?.status ?? null,
        handoff_status: preparedUnconfirmed?.structured?.status ?? null,
        cart_present: Boolean(preparedUnconfirmed?.structured?.cart),
        source_attribution: preparedUnconfirmed?.structured?.source_attribution ?? null,
      }
    ),
    check(
      "prepare_purchase_handoff_confirmed_cart",
      Boolean(
        preparedConfirmed?.ok &&
          !preparedConfirmed.isToolError &&
          preparedConfirmed.structured?.status === "cart_handoff_ready" &&
          preparedConfirmed.structured?.cart?.url?.startsWith("https://mcp.packrift.com/r/cart/") &&
          preparedConfirmed.structured?.cart_handoff?.primary_url === preparedConfirmed.structured?.cart?.url &&
          preparedConfirmed.structured?.cart?.url?.includes(`mcp_source_context=${source}`) &&
          preparedConfirmed.structured?.cart?.url?.includes(`mcp_install_target=${target}`) &&
          preparedConfirmed.structured?.cart_handoff?.attribution_required?.mcp_source_context === source &&
          preparedConfirmed.structured?.cart_handoff?.attribution_required?.mcp_install_target === target
      ),
      {
        status: preparedConfirmed?.status ?? null,
        handoff_status: preparedConfirmed?.structured?.status ?? null,
        cart_url: preparedConfirmed?.structured?.cart?.url ?? null,
        cart_handoff_primary_url: preparedConfirmed?.structured?.cart_handoff?.primary_url ?? null,
        source_attribution: preparedConfirmed?.structured?.source_attribution ?? null,
      }
    ),
    check("cart_url_ok", Boolean(cart?.ok && !cart.isToolError && cartUrl && finalCartUrl), {
      status: cart?.status ?? null,
      url: cartUrl,
      final_cart_url: finalCartUrl,
    }),
    check(
      "cart_url_source_attribution_ok",
      Boolean(
        cartUrl?.includes(`mcp_source_context=${source}`) &&
          cartUrl?.includes(`mcp_install_target=${target}`) &&
          cart?.structured?.cart_tracking?.mcp_source_context === source &&
          cart?.structured?.cart_tracking?.mcp_install_target === target &&
          cart?.structured?.cart_handoff?.attribution_required?.mcp_source_context === source &&
          cart?.structured?.cart_handoff?.attribution_required?.mcp_install_target === target
      ),
      {
        source,
        target,
        cart_url: cartUrl,
        cart_tracking: cart?.structured?.cart_tracking ?? null,
        attribution_required: cart?.structured?.cart_handoff?.attribution_required ?? null,
      }
    ),
    check(
      "final_cart_source_attributes_ok",
      Boolean(
        cartAttributePresent(finalCartUrl, "packrift_mcp_source_context") &&
          cartAttributePresent(finalCartUrl, "packrift_mcp_install_target")
      ),
      { source, target, final_cart_url: finalCartUrl }
    ),
    check(
      "final_cart_ai_commerce_attributes_ok",
      Boolean(
        cartAttributePresent(finalCartUrl, "packrift_ai_id") &&
          cartAttributePresent(finalCartUrl, "ai_commerce_id") &&
          cartAttributePresent(finalCartUrl, "packrift_packrift_ai_id") &&
          cartAttributePresent(finalCartUrl, "packrift_ai_commerce_id")
      ),
      { final_cart_url: finalCartUrl }
    ),
    check(
      "cart_handoff_primary_url_ok",
      Boolean(
        cart?.structured?.cart_handoff?.primary_url === cartUrl &&
          cart?.structured?.cart_handoff?.primary_url_role === "measured_mcp_cart_landing" &&
          cart?.structured?.cart_handoff?.landing_records_event === true &&
          cart?.structured?.primary_buyer_handoff?.primary_url === cartUrl
      ),
      {
        cart_handoff: cart?.structured?.cart_handoff ?? null,
        primary_buyer_handoff: cart?.structured?.primary_buyer_handoff ?? null,
      }
    ),
    check(
      "mcp_handoff_id_ok",
      Boolean(
        cart?.structured?.mcp_handoff_id &&
          String(cart.structured.mcp_handoff_id).startsWith("mcp_handoff_") &&
          cartUrl?.includes(`mcp_handoff_id=${encodeURIComponent(cart.structured.mcp_handoff_id)}`) &&
          cart?.structured?.cart_handoff?.mcp_handoff_id === cart.structured.mcp_handoff_id
      ),
      {
        mcp_handoff_id: cart?.structured?.mcp_handoff_id ?? null,
        cart_handoff_id: cart?.structured?.cart_handoff?.mcp_handoff_id ?? null,
        cart_url: cartUrl,
      }
    ),
    check("cart_continuity_ok", Boolean(cart?.structured?.cart_continuity?.validated && cart?.structured?.cart_continuity?.selected_sku === sku), {
      cart_continuity: cart?.structured?.cart_continuity ?? null,
    }),
    check("cart_landing_ok", Boolean(cartLandingHead?.ok && cartLandingHead.cartLandingShim), cartLandingHead ?? {}),
    ...heldSkuResults.flatMap((held) => [
      check(
        `held_${held.sku}_candidate_blocked`,
        Boolean(held.candidates?.ok && !held.candidates.isToolError && held.candidates.structured?.result_count === 0),
        {
          status: held.candidates?.status ?? null,
          result_count: held.candidates?.structured?.result_count ?? null,
          items: held.candidates?.structured?.items ?? null,
        }
      ),
      check(
        `held_${held.sku}_prepare_blocks_cart`,
        Boolean(held.prepare?.ok && !held.prepare.isToolError && held.prepare.structured?.status === "blocked_by_mcp_commerce_hold" && held.prepare.structured?.cart === null),
        {
          status: held.prepare?.status ?? null,
          handoff_status: held.prepare?.structured?.status ?? null,
          cart_present: Boolean(held.prepare?.structured?.cart),
        }
      ),
      check(
        `held_${held.sku}_create_cart_blocks`,
        Boolean(held.cart?.ok && held.cart.isToolError && held.cart.toolErrorText.includes(`MCP commerce hold blocked ${held.sku}`)),
        {
          status: held.cart?.status ?? null,
          is_tool_error: held.cart?.isToolError ?? null,
          error_text: held.cart?.toolErrorText ?? null,
        }
      ),
    ]),
  ];
  if (verifyFinalCart) {
    checks.push(check("final_cart_redirect_ok", Boolean(finalCartHead?.ok && finalCartHead.location), finalCartHead ?? {}));
  }

  const pass = checks.every((row) => row.pass);
  const output = {
    created_at: startedAt,
    endpoint,
    endpoint_input: endpointInput,
    source,
    target,
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
      prepared_purchase_handoff_status: preparedConfirmed?.structured?.status ?? null,
      prepared_purchase_handoff_cart_url: preparedConfirmed?.structured?.cart?.url ?? null,
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
      `- Source: \`${source}\``,
      `- Target: \`${target}\``,
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
