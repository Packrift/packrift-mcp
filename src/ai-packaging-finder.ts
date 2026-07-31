import { APPROVED_CATALOG, type ApprovedCatalogItem } from "./effective-approved-catalog.js";
import { parseDimensions, fitScore, type Dimensions } from "./dimensions.js";
import { isMcpCommerceHeldSku } from "./mcp-commerce-holds.js";
import { PURCHASE_READY_SKUS } from "./purchase-ready-skus.js";
import type { UcpStarterCatalogRuntime } from "./ucp-starter-catalog.js";

export const PACKRIFT_AI_PACKAGING_FINDER_RELEASE = "PACKRIFT-AI-PACKAGING-FINDER-R01";

const BASE = "https://mcp.packrift.com";
const PACKRIFT_SITE = "https://packrift.com";
const MCP_ENDPOINT = `${BASE}/mcp`;
const STOREFRONT_MCP_ENDPOINT = `${PACKRIFT_SITE}/api/mcp`;
const NATIVE_UCP_ENDPOINT = "https://packrift.myshopify.com/api/ucp/mcp";
const GLOBAL_UCP_BUSINESS = "https://catalog.shopify.com";
const SOURCE_CONTEXT = "owned_packrift_finder";
const INSTALL_TARGET = "packrift_site";
const RESULT_SET_ID = "packrift_ai_packaging_finder_20260627";

const PURCHASE_READY_SET = new Set(PURCHASE_READY_SKUS.map((sku) => sku.toUpperCase()));
const APPROVED_BY_SKU = new Map(APPROVED_CATALOG.map((item) => [item.sku.toUpperCase(), item]));

const USE_CASE_LABELS: Record<string, string> = {
  ecommerce: "Ecommerce order",
  apparel: "Apparel or soft goods",
  fragile: "Fragile item",
  warehouse: "Warehouse replenishment",
  packing_station: "Packing station supply",
};

const FINDER_SKUS = [
  { sku: "1066", role: "corrugated_box", use_cases: ["ecommerce", "warehouse", "fragile"] },
  { sku: "10103", role: "corrugated_box", use_cases: ["ecommerce", "apparel", "fragile"] },
  { sku: "1054", role: "corrugated_box", use_cases: ["ecommerce"] },
  { sku: "10108", role: "corrugated_box", use_cases: ["ecommerce", "warehouse", "fragile"] },
  { sku: "1086", role: "corrugated_box", use_cases: ["warehouse", "fragile"] },
  { sku: "1074", role: "corrugated_box", use_cases: ["ecommerce", "fragile"] },
  { sku: "1075", role: "corrugated_box", use_cases: ["ecommerce", "warehouse"] },
  { sku: "1094", role: "corrugated_box", use_cases: ["warehouse"] },
  { sku: "1096", role: "corrugated_box", use_cases: ["warehouse"] },
  { sku: "1098", role: "corrugated_box", use_cases: ["warehouse"] },
  { sku: "12104", role: "corrugated_box", use_cases: ["warehouse", "fragile"] },
  { sku: "B852SSRTT", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B803SS25PK", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B805SS", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B806SS", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B807SS25PK", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B858WSS", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B857SSR", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B810", role: "bubble_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B867", role: "poly_mailer", use_cases: ["apparel", "ecommerce"] },
  { sku: "B874", role: "poly_mailer", use_cases: ["apparel", "ecommerce"] },
] as const;

const SUPPORTING_SUPPLY_SKUS = [
  { sku: "MFL1295", role: "label", use_cases: ["ecommerce", "fragile", "warehouse", "packing_station"] },
  { sku: "LL251WR", role: "label", use_cases: ["apparel", "ecommerce", "packing_station"] },
  { sku: "PL1", role: "packing_list_envelope", use_cases: ["ecommerce", "warehouse", "packing_station"] },
  { sku: "PL100", role: "packing_list_envelope", use_cases: ["warehouse", "packing_station"] },
  { sku: "T901220", role: "carton_sealing_tape", use_cases: ["ecommerce", "packing_station"] },
  { sku: "T902220", role: "carton_sealing_tape", use_cases: ["warehouse", "packing_station"] },
  { sku: "T155000", role: "water_activated_tape", use_cases: ["fragile", "warehouse"] },
  { sku: "AB205", role: "protective_wrap", use_cases: ["fragile", "ecommerce"] },
  { sku: "AB211", role: "protective_wrap", use_cases: ["fragile", "apparel"] },
  { sku: "BD1212AS", role: "protective_wrap", use_cases: ["fragile"] },
  { sku: "FD1424", role: "foam_roll", use_cases: ["fragile"] },
  { sku: "FR2472", role: "foam_roll", use_cases: ["fragile"] },
  { sku: "12BNUTS", role: "void_fill", use_cases: ["ecommerce", "fragile", "packing_station"] },
  { sku: "45NUTDIS", role: "void_fill", use_cases: ["warehouse", "packing_station"] },
  { sku: "GSA20EL", role: "dispenser", use_cases: ["packing_station"] },
  { sku: "MSF2060B", role: "machine_stretch_film", use_cases: ["warehouse"] },
  { sku: "MSF2060C", role: "machine_stretch_film", use_cases: ["warehouse"] },
  { sku: "SF208", role: "hand_stretch_film", use_cases: ["warehouse", "packing_station"] },
  { sku: "EP252530120B", role: "edge_protector", use_cases: ["warehouse"] },
] as const;

const EXAMPLE_REQUESTS = [
  { id: "small_ecommerce_order", label: "8 x 5 x 2 ecommerce item", use_case: "ecommerce", item_length_in: 8, item_width_in: 5, item_depth_in: 2, item_weight_lb: 1 },
  { id: "folded_apparel", label: "12 x 9 x 1.5 folded apparel", use_case: "apparel", item_length_in: 12, item_width_in: 9, item_depth_in: 1.5, item_weight_lb: 1 },
  { id: "fragile_sample", label: "7 x 7 x 4 fragile item", use_case: "fragile", item_length_in: 7, item_width_in: 7, item_depth_in: 4, item_weight_lb: 2 },
] as const;

type FinderSpec = (typeof FINDER_SKUS)[number] | (typeof SUPPORTING_SUPPLY_SKUS)[number];

function approvedPurchaseReadyItem(sku: string): ApprovedCatalogItem | null {
  const normalized = sku.toUpperCase();
  if (!PURCHASE_READY_SET.has(normalized)) return null;
  if (isMcpCommerceHeldSku(normalized)) return null;
  return APPROVED_BY_SKU.get(normalized) ?? null;
}

function productUrl(item: ApprovedCatalogItem): string {
  return `${PACKRIFT_SITE}/products/${item.handle}`;
}

function skuResourceUrl(sku: string, format: "json" | "md"): string {
  return `${BASE}/ai/sku/${encodeURIComponent(sku)}.${format}`;
}

function orderHandoffUrl(): string {
  return `${BASE}/r/order/${SOURCE_CONTEXT}?format=html`;
}

function trackedCartUrl(sku: string, quantity: number | "{buyer_selected_quantity}", useCase: string) {
  const encodedSku = encodeURIComponent(sku);
  const encodedUseCase = encodeURIComponent(useCase);
  return `${BASE}/r/cart/${encodedSku}?ref=mcp&qty=${encodeURIComponent(String(quantity))}&utm_source=packrift_ai_packaging_finder&utm_medium=owned_agentic_finder&utm_campaign=packrift_ai_packaging_finder_20260627&utm_content=confirm_cart&utm_term=${encodedSku}&packrift_ai_id=${RESULT_SET_ID}_${encodedSku}&ai_commerce_id=${RESULT_SET_ID}_${encodedSku}&mcp_key=${encodedSku}&mcp_journey=ai_packaging_finder%3A${encodedSku}%3A${encodedUseCase}%3Acart&mcp_result_set=${RESULT_SET_ID}&mcp_source_context=${SOURCE_CONTEXT}&mcp_install_target=${INSTALL_TARGET}&match_type=buyer_dimension_fit`;
}

function jsonRpcToolCall(id: string, name: string, args: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };
}

function ucpCatalogCommand(business: string, query: string): string {
  return `ucp catalog search --business ${business} --input '${JSON.stringify({ query })}'`;
}

function twoDimScore(item: { length_in: number; width_in: number }, packageDims: Dimensions): number | null {
  const itemDims = [item.length_in, item.width_in].sort((a, b) => b - a);
  const packageValues = [packageDims.length_in, packageDims.width_in].sort((a, b) => b - a);
  const pads: number[] = [];
  for (let index = 0; index < itemDims.length; index += 1) {
    const itemValue = itemDims[index];
    const packageValue = packageValues[index];
    if (itemValue === undefined || packageValue === undefined) return null;
    const pad = packageValue - itemValue;
    if (pad < 0.25) return null;
    pads.push(pad);
  }
  const slack = pads.reduce((sum, pad) => sum + Math.max(0, pad - 2), 0);
  const tightness = pads.reduce((sum, pad) => sum + Math.min(pad, 2), 0);
  return slack * 2 + (4 - tightness);
}

function scoreCandidateForItem(
  item: { length_in: number; width_in: number; depth_in: number; use_case: string },
  candidate: { dimensions: Dimensions | null; family: string; role: string; use_cases: readonly string[] }
): number | null {
  if (!candidate.use_cases.includes(item.use_case)) return null;
  if (!candidate.dimensions) return null;
  if (candidate.dimensions.depth_in !== null) {
    return fitScore(
      {
        length_in: item.length_in,
        width_in: item.width_in,
        depth_in: item.depth_in,
      },
      candidate.dimensions
    );
  }
  if (candidate.family === "mailers" || candidate.role.includes("mailer")) {
    return twoDimScore({ length_in: item.length_in, width_in: item.width_in }, candidate.dimensions);
  }
  return null;
}

function candidateRecord(spec: FinderSpec, kind: "fit_candidate" | "supporting_supply") {
  const item = approvedPurchaseReadyItem(spec.sku);
  if (!item) return null;
  const dimensions = parseDimensions(item.title);
  return {
    sku: item.sku,
    title: item.title,
    family: item.family,
    role: spec.role,
    kind,
    use_cases: [...spec.use_cases],
    use_case_labels: spec.use_cases.map((useCase) => USE_CASE_LABELS[useCase] ?? useCase),
    dimensions,
    product_id: item.productId,
    variant_id: item.variantId,
    handle: item.handle,
    product_url: productUrl(item),
    mcp_sku_json: skuResourceUrl(item.sku, "json"),
    mcp_sku_markdown: skuResourceUrl(item.sku, "md"),
    cart_url_qty_1: trackedCartUrl(item.sku, 1, spec.use_cases[0] ?? "ecommerce"),
    cart_url_template: trackedCartUrl(item.sku, "{buyer_selected_quantity}", "{buyer_use_case}"),
    order_handoff_url: orderHandoffUrl(),
    prepare_purchase_handoff_confirmed_template: {
      sku: item.sku,
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: "packrift_ai_packaging_finder",
      mcp_source_context: SOURCE_CONTEXT,
      mcp_install_target: INSTALL_TARGET,
      journey_id: `ai_packaging_finder_${item.sku}_{buyer_use_case}`,
      result_set_id: RESULT_SET_ID,
    },
  };
}

function finderCandidates() {
  return FINDER_SKUS.map((spec) => candidateRecord(spec, "fit_candidate")).filter((record): record is NonNullable<typeof record> => record !== null);
}

function supportingSupplies() {
  return SUPPORTING_SUPPLY_SKUS.map((spec) => candidateRecord(spec, "supporting_supply")).filter((record): record is NonNullable<typeof record> => record !== null);
}

function exampleRecommendations(candidates: ReturnType<typeof finderCandidates>) {
  return EXAMPLE_REQUESTS.map((request) => {
    const scoringInput = {
      length_in: request.item_length_in,
      width_in: request.item_width_in,
      depth_in: request.item_depth_in,
      use_case: request.use_case,
    };
    const ranked = candidates
      .map((candidate) => ({
        sku: candidate.sku,
        title: candidate.title,
        role: candidate.role,
        family: candidate.family,
        score: scoreCandidateForItem(scoringInput, candidate),
        cart_url: trackedCartUrl(candidate.sku, 1, request.use_case),
      }))
      .filter((candidate): candidate is Omit<typeof candidate, "score"> & { score: number } => candidate.score !== null)
      .sort((a, b) => a.score - b.score || a.sku.localeCompare(b.sku))
      .slice(0, 5);
    return {
      ...request,
      top_matches: ranked,
    };
  });
}

export function packriftAiPackagingFinderPayload(runtime: UcpStarterCatalogRuntime) {
  const candidates = finderCandidates();
  const supplies = supportingSupplies();
  return {
    release: PACKRIFT_AI_PACKAGING_FINDER_RELEASE,
    generated_at: new Date().toISOString(),
    status: "live_owned_conversion_surface",
    purpose:
      "Turn packaging/shipping-supplies intent into Packrift-owned, source-attributed cart handoffs without waiting for generic Global Catalog rank movement.",
    proof_boundary:
      "This creates an attributable buyer path. It is not a placed order, not spend, and not evidence that Shopify Global Catalog generic head-term rank changed.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    canonical_urls: {
      html: `${BASE}/ai/packrift-ai-packaging-finder.html`,
      json: `${BASE}/ai/packrift-ai-packaging-finder.json`,
      markdown: `${BASE}/ai/packrift-ai-packaging-finder.md`,
      mcp_endpoint: MCP_ENDPOINT,
      storefront_mcp_endpoint: STOREFRONT_MCP_ENDPOINT,
      native_ucp_endpoint: NATIVE_UCP_ENDPOINT,
      source_aware_mcp_endpoint: `${MCP_ENDPOINT}?packrift_mcp_source=${SOURCE_CONTEXT}&packrift_mcp_target=${INSTALL_TARGET}`,
      order_handoff: orderHandoffUrl(),
    },
    attribution_contract: {
      source_context: SOURCE_CONTEXT,
      mcp_source_context: SOURCE_CONTEXT,
      mcp_install_target: INSTALL_TARGET,
      result_set_id: RESULT_SET_ID,
      measured_cart_route: `${BASE}/r/cart/{sku}`,
      cart_links_preserve: [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "packrift_ai_id",
        "ai_commerce_id",
        "mcp_key",
        "mcp_journey",
        "mcp_result_set",
        "mcp_source_context",
        "mcp_install_target",
        "match_type",
      ],
    },
    buyer_input_contract: {
      item_length_in: "number",
      item_width_in: "number",
      item_depth_in: "number",
      item_weight_lb: "number optional",
      quantity: "positive integer",
      use_case: Object.keys(USE_CASE_LABELS),
      required_gate: "Only send the buyer to cart after the buyer confirms the recommended SKU and quantity.",
    },
    agent_tool_sequence: [
      {
        step: "dimension_fit",
        request: jsonRpcToolCall("finder-fit-1", "find_packaging_for_item", {
          item_length_in: "{item_length_in}",
          item_width_in: "{item_width_in}",
          item_depth_in: "{item_depth_in}",
          item_weight_lb: "{item_weight_lb}",
          use_case: "{use_case}",
          limit: 5,
          source_context: "packrift_ai_packaging_finder",
          mcp_source_context: SOURCE_CONTEXT,
          mcp_install_target: INSTALL_TARGET,
        }),
      },
      {
        step: "price_check",
        request: jsonRpcToolCall("finder-price-1", "get_pricing", {
          sku: "{selected_sku}",
          source_context: "packrift_ai_packaging_finder",
          mcp_source_context: SOURCE_CONTEXT,
          mcp_install_target: INSTALL_TARGET,
        }),
      },
      {
        step: "inventory_check",
        request: jsonRpcToolCall("finder-inventory-1", "check_inventory", {
          sku: "{selected_sku}",
          source_context: "packrift_ai_packaging_finder",
          mcp_source_context: SOURCE_CONTEXT,
          mcp_install_target: INSTALL_TARGET,
        }),
      },
      {
        step: "buyer_confirmed_cart_handoff",
        request: jsonRpcToolCall("finder-handoff-1", "prepare_purchase_handoff", {
          sku: "{selected_sku}",
          quantity: "{buyer_selected_quantity}",
          buyer_confirmed: true,
          source_context: "packrift_ai_packaging_finder",
          mcp_source_context: SOURCE_CONTEXT,
          mcp_install_target: INSTALL_TARGET,
          journey_id: "ai_packaging_finder_{selected_sku}_{use_case}",
          result_set_id: RESULT_SET_ID,
        }),
      },
    ],
    discovery_queries: [
      {
        query: "shipping boxes",
        owned_command: ucpCatalogCommand(PACKRIFT_SITE, "shipping boxes"),
        global_command: ucpCatalogCommand(GLOBAL_UCP_BUSINESS, "Packrift shipping boxes"),
      },
      {
        query: "corrugated boxes",
        owned_command: ucpCatalogCommand(PACKRIFT_SITE, "corrugated boxes"),
        global_command: ucpCatalogCommand(GLOBAL_UCP_BUSINESS, "Packrift corrugated boxes"),
      },
      {
        query: "find packaging for an 8 x 5 x 2 item",
        owned_command: ucpCatalogCommand(PACKRIFT_SITE, "Packrift packaging for an 8 x 5 x 2 ecommerce item"),
        global_command: ucpCatalogCommand(GLOBAL_UCP_BUSINESS, "Packrift packaging for an 8 x 5 x 2 ecommerce item"),
      },
    ],
    candidates,
    supporting_supplies: supplies,
    example_recommendations: exampleRecommendations(candidates),
    short_term_growth_move:
      "Use this URL as the owned experience in ads, docs, PRs, UCP builder examples, directory listings, and outreach. It gives builders and buyers a reason to click Packrift even when generic Shopify Global Catalog head terms are still controlled by older merchants.",
  };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function packriftAiPackagingFinderMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftAiPackagingFinderPayload(runtime);
  const rows = payload.candidates
    .slice(0, 18)
    .map(
      (candidate) =>
        `| ${escapeMarkdown(candidate.sku)} | ${escapeMarkdown(candidate.title)} | ${escapeMarkdown(candidate.role)} | ${escapeMarkdown(candidate.use_cases.join(", "))} | ${candidate.cart_url_qty_1} |`
    )
    .join("\n");
  return `# Packrift AI Packaging Finder

Release: ${payload.release}

Use this owned Packrift route when a buyer or agent asks for packaging by item dimensions, shipping use case, or starter replenishment need. It returns Packrift SKUs and source-attributed cart handoffs without requiring a generic Shopify Global Catalog ranking win first.

Canonical routes:

- HTML: ${payload.canonical_urls.html}
- JSON: ${payload.canonical_urls.json}
- Packrift MCP: ${payload.canonical_urls.mcp_endpoint}
- Source-aware MCP endpoint: ${payload.canonical_urls.source_aware_mcp_endpoint}
- Order handoff: ${payload.canonical_urls.order_handoff}

Buyer input contract:

- item_length_in, item_width_in, item_depth_in
- optional item_weight_lb
- use_case: ${Object.keys(USE_CASE_LABELS).join(", ")}
- quantity
- buyer confirmation before cart handoff

Recommended MCP sequence:

1. Call find_packaging_for_item with the buyer dimensions and use case.
2. Call get_pricing for the selected SKU.
3. Call check_inventory for the selected SKU.
4. After buyer confirmation, call prepare_purchase_handoff with mcp_source_context=${SOURCE_CONTEXT}, mcp_install_target=${INSTALL_TARGET}, and result_set_id=${RESULT_SET_ID}.

Starter candidate SKUs:

| SKU | Title | Role | Use cases | Cart qty 1 |
| --- | --- | --- | --- | --- |
${rows}

Proof boundary: ${payload.proof_boundary}
`;
}

export function packriftAiPackagingFinderHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftAiPackagingFinderPayload(runtime);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift AI Packaging Finder</title>
  <meta name="description" content="Find Packrift packaging by item dimensions and send buyers to source-attributed cart handoffs.">
  <link rel="canonical" href="${payload.canonical_urls.html}">
  <style>
    :root {
      color-scheme: light;
      --ink: #17212b;
      --muted: #5f6f7c;
      --line: #d9e2e8;
      --paper: #ffffff;
      --wash: #f5f8fa;
      --accent: #0f766e;
      --accent-dark: #0b5f59;
      --warn: #8a5a00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--wash);
      line-height: 1.45;
    }
    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 42px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
      gap: 22px;
      align-items: end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 48px);
      line-height: 1.02;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 20px;
      letter-spacing: 0;
    }
    p { margin: 0; color: var(--muted); }
    form, .panel, .result, .supply {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    form { padding: 16px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #31424f;
    }
    input, select {
      width: 100%;
      min-height: 42px;
      border: 1px solid #becbd3;
      border-radius: 6px;
      padding: 9px 10px;
      color: var(--ink);
      background: #fff;
      font: inherit;
    }
    button, .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      border: 1px solid var(--accent-dark);
      border-radius: 6px;
      padding: 10px 14px;
      color: #fff;
      background: var(--accent);
      text-decoration: none;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover, .button:hover { background: var(--accent-dark); }
    .button.secondary {
      color: var(--accent-dark);
      background: #eef9f7;
    }
    .button.secondary:hover { background: #dcefeb; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 18px;
      align-items: start;
    }
    .panel { padding: 16px; }
    .results {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    .result {
      display: grid;
      gap: 12px;
      padding: 14px;
    }
    .result-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }
    .sku {
      font-size: 13px;
      font-weight: 900;
      color: var(--accent-dark);
    }
    .title {
      margin-top: 2px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 8px;
      background: #f8fbfc;
    }
    .score {
      min-width: 72px;
      text-align: right;
      font-weight: 900;
      color: #24323d;
    }
    .supplies {
      display: grid;
      gap: 8px;
    }
    .supply {
      padding: 10px;
    }
    .supply strong { display: block; overflow-wrap: anywhere; }
    .small {
      font-size: 12px;
      color: var(--muted);
    }
    .notice {
      margin-top: 12px;
      padding: 10px 12px;
      border-left: 4px solid var(--warn);
      background: #fff8e8;
      color: #44330b;
      font-size: 13px;
    }
    @media (max-width: 860px) {
      header, .layout, .grid { grid-template-columns: 1fr; }
      main { width: min(100vw - 24px, 720px); padding-top: 18px; }
      .result-top { grid-template-columns: 1fr; }
      .score { text-align: left; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Packrift AI Packaging Finder</h1>
        <p>Enter item dimensions, pick a shipping use case, and send the buyer to a measured Packrift cart after SKU confirmation.</p>
      </div>
      <div class="panel">
        <div class="small">Source attribution</div>
        <strong>${SOURCE_CONTEXT}</strong>
        <p class="small">Cart links preserve MCP source, result set, campaign, and SKU context.</p>
      </div>
    </header>

    <div class="layout">
      <section>
        <form id="finder-form">
          <h2>Find packaging</h2>
          <div class="grid">
            <label>Length in <input name="length" inputmode="decimal" type="number" min="0.1" step="0.1" value="8" required></label>
            <label>Width in <input name="width" inputmode="decimal" type="number" min="0.1" step="0.1" value="5" required></label>
            <label>Depth in <input name="depth" inputmode="decimal" type="number" min="0.1" step="0.1" value="2" required></label>
            <label>Qty <input name="quantity" inputmode="numeric" type="number" min="1" step="1" value="1" required></label>
            <label>Weight lb <input name="weight" inputmode="decimal" type="number" min="0" step="0.1" value="1"></label>
            <label>Use case
              <select name="useCase">
                ${Object.entries(USE_CASE_LABELS)
                  .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
                  .join("")}
              </select>
            </label>
          </div>
          <div class="actions">
            <button type="submit">Find matches</button>
            <a class="button secondary" href="${escapeHtml(payload.canonical_urls.json)}">JSON</a>
            <a class="button secondary" href="${escapeHtml(payload.canonical_urls.order_handoff)}">Order handoff</a>
          </div>
          <div class="notice">Cart buttons are buyer handoffs. They do not place an order.</div>
        </form>
        <div id="results" class="results"></div>
      </section>
      <aside class="panel">
        <h2>Supporting supplies</h2>
        <div id="supplies" class="supplies"></div>
      </aside>
    </div>
  </main>
  <script>
    const candidates = ${safeScriptJson(payload.candidates)};
    const supportingSupplies = ${safeScriptJson(payload.supporting_supplies)};
    const sourceContext = ${JSON.stringify(SOURCE_CONTEXT)};
    const installTarget = ${JSON.stringify(INSTALL_TARGET)};
    const resultSetId = ${JSON.stringify(RESULT_SET_ID)};

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function sortedDesc(values) {
      return values.slice().sort((a, b) => b - a);
    }

    function scoreThreeDim(item, dims) {
      if (!dims || dims.depth_in === null) return null;
      const itemDims = sortedDesc([item.length, item.width, item.depth]);
      const boxDims = sortedDesc([dims.length_in, dims.width_in, dims.depth_in]);
      const pads = itemDims.map((value, index) => boxDims[index] - value);
      if (pads.some((value) => value < 0.5)) return null;
      const slack = pads.reduce((sum, value) => sum + Math.max(0, value - 2), 0);
      const tightness = pads.reduce((sum, value) => sum + Math.min(value, 2), 0);
      return slack * 2 + (6 - tightness);
    }

    function scoreTwoDim(item, dims) {
      if (!dims) return null;
      const itemDims = sortedDesc([item.length, item.width]);
      const packageDims = sortedDesc([dims.length_in, dims.width_in]);
      const pads = itemDims.map((value, index) => packageDims[index] - value);
      if (pads.some((value) => value < 0.25)) return null;
      const slack = pads.reduce((sum, value) => sum + Math.max(0, value - 2), 0);
      const tightness = pads.reduce((sum, value) => sum + Math.min(value, 2), 0);
      return slack * 2 + (4 - tightness);
    }

    function cartUrl(candidate, quantity, useCase) {
      const sku = encodeURIComponent(candidate.sku);
      const params = new URLSearchParams({
        ref: "mcp",
        qty: String(quantity),
        utm_source: "packrift_ai_packaging_finder",
        utm_medium: "owned_agentic_finder",
        utm_campaign: "packrift_ai_packaging_finder_20260627",
        utm_content: "confirm_cart",
        utm_term: candidate.sku,
        packrift_ai_id: resultSetId + "_" + candidate.sku,
        ai_commerce_id: resultSetId + "_" + candidate.sku,
        mcp_key: candidate.sku,
        mcp_journey: "ai_packaging_finder:" + candidate.sku + ":" + useCase + ":cart",
        mcp_result_set: resultSetId,
        mcp_source_context: sourceContext,
        mcp_install_target: installTarget,
        match_type: "buyer_dimension_fit"
      });
      return "${BASE}/r/cart/" + sku + "?" + params.toString();
    }

    function rankCandidates(item) {
      return candidates
        .filter((candidate) => candidate.use_cases.includes(item.useCase))
        .map((candidate) => {
          const threeDimScore = scoreThreeDim(item, candidate.dimensions);
          const score = threeDimScore === null && (candidate.family === "mailers" || candidate.role.includes("mailer"))
            ? scoreTwoDim(item, candidate.dimensions)
            : threeDimScore;
          return { ...candidate, score };
        })
        .filter((candidate) => candidate.score !== null)
        .sort((a, b) => a.score - b.score || a.sku.localeCompare(b.sku))
        .slice(0, 6);
    }

    function renderResults(matches, item) {
      const root = document.getElementById("results");
      if (!matches.length) {
        root.innerHTML = '<div class="panel"><h2>No safe fit from this starter set</h2><p>Use Packrift MCP find_packaging_for_item for a broader live catalog pass, or try a larger box requirement.</p><div class="actions"><a class="button" href="${BASE}/r/run/${SOURCE_CONTEXT}/${INSTALL_TARGET}?format=html">Run MCP live check</a></div></div>';
        return;
      }
      root.innerHTML = matches.map((candidate, index) => {
        const dims = candidate.dimensions ? [candidate.dimensions.length_in, candidate.dimensions.width_in, candidate.dimensions.depth_in].filter((value) => value !== null).join(" x ") + " in" : "dimension unavailable";
        return '<article class="result">' +
          '<div class="result-top">' +
            '<div><div class="sku">' + escapeHtml(candidate.sku) + '</div><div class="title">' + escapeHtml(candidate.title) + '</div></div>' +
            '<div class="score">#' + (index + 1) + '<br><span class="small">score ' + candidate.score.toFixed(2) + '</span></div>' +
          '</div>' +
          '<div class="meta"><span class="pill">' + escapeHtml(candidate.role.replaceAll("_", " ")) + '</span><span class="pill">' + escapeHtml(dims) + '</span><span class="pill">' + escapeHtml(candidate.family) + '</span></div>' +
          '<div class="actions">' +
            '<a class="button" href="' + escapeHtml(cartUrl(candidate, item.quantity, item.useCase)) + '">Confirm cart</a>' +
            '<a class="button secondary" href="' + escapeHtml(candidate.product_url) + '">Product</a>' +
            '<a class="button secondary" href="' + escapeHtml(candidate.mcp_sku_json) + '">SKU JSON</a>' +
          '</div>' +
        '</article>';
      }).join("");
    }

    function renderSupplies(useCase) {
      const root = document.getElementById("supplies");
      const rows = supportingSupplies.filter((supply) => supply.use_cases.includes(useCase)).slice(0, 8);
      root.innerHTML = rows.map((supply) =>
        '<div class="supply"><div class="sku">' + escapeHtml(supply.sku) + '</div><strong>' + escapeHtml(supply.title) + '</strong><div class="small">' + escapeHtml(supply.role.replaceAll("_", " ")) + '</div><div class="actions"><a class="button secondary" href="' + escapeHtml(supply.cart_url_qty_1) + '">Cart qty 1</a></div></div>'
      ).join("");
    }

    document.getElementById("finder-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const item = {
        length: Number(data.get("length")),
        width: Number(data.get("width")),
        depth: Number(data.get("depth")),
        weight: Number(data.get("weight") || 0),
        quantity: Math.max(1, Math.floor(Number(data.get("quantity") || 1))),
        useCase: String(data.get("useCase") || "ecommerce")
      };
      renderResults(rankCandidates(item), item);
      renderSupplies(item.useCase);
    });

    document.getElementById("finder-form").dispatchEvent(new Event("submit", { cancelable: true }));
  </script>
</body>
</html>`;
}
