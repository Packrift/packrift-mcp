import { mcpUcpStarterCatalogPayload, type UcpStarterCatalogRuntime } from "./ucp-starter-catalog.js";

const PACKRIFT_SITE = "https://packrift.com";
const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.json";
const MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.md";
const HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-collection-map.html";
const STARTER_KIT_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.json";
const IMPORT_FEED_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json";
const SHELF_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.html";
const RELEASE = "PACKRIFT-UCP-SHIPPING-SUPPLIES-COLLECTION-MAP-R02";

const COLLECTION_ROWS = [
  {
    intent: "shipping boxes",
    query_class: "generic_head",
    status: "approval_required_missing_handle",
    target_handle: "shipping-boxes",
    live_handle: "corrugated-boxes",
    live_title: "Corrugated Boxes",
    live_products_count: 2244,
    seed_skus: ["10103", "10108", "1054", "1066", "1074", "1086"],
    fallback_note: "Use corrugated-boxes today; create shipping-boxes only after approval if a broader buyer-facing alias is needed.",
  },
  {
    intent: "corrugated boxes",
    query_class: "head_mid",
    status: "live_seed_covered",
    target_handle: "corrugated-boxes",
    live_handle: "corrugated-boxes",
    live_title: "Corrugated Boxes",
    live_products_count: 2244,
    seed_skus: ["10103", "10108", "1054", "1066", "1074", "1086"],
    fallback_note: "Use directly for corrugated-box and ECT-32 box shelves.",
  },
  {
    intent: "cardboard boxes",
    query_class: "generic_head",
    status: "approval_required_missing_handle",
    target_handle: "cardboard-boxes",
    live_handle: "corrugated-boxes",
    live_title: "Corrugated Boxes",
    live_products_count: 2244,
    seed_skus: ["10103", "10108", "1054", "1066", "1074", "1086"],
    fallback_note: "Use corrugated-boxes today; create cardboard-boxes only after approval if the alias is needed for head-term routing.",
  },
  {
    intent: "mailer boxes",
    query_class: "mid_tail",
    status: "live_seed_gap",
    target_handle: "mailer-boxes",
    live_handle: "mailer-boxes",
    live_title: "Mailer Boxes",
    live_products_count: 644,
    seed_skus: ["MFL1295"],
    missing_seed_skus: ["MFL1295"],
    fallback_handle: "literature-mailers",
    fallback_note: "Mailer Boxes exists, but the starter corrugated literature mailer seed currently routes through literature-mailers.",
  },
  {
    intent: "bubble mailers",
    query_class: "mid_tail",
    status: "live_seed_covered",
    target_handle: "bubble-mailers",
    live_handle: "bubble-mailers",
    live_title: "Bubble Mailers",
    live_products_count: 148,
    seed_skus: ["B829", "B852SSRTT"],
    fallback_note: "Use directly for bubble-mailer shelves.",
  },
  {
    intent: "poly mailers",
    query_class: "mid_tail",
    status: "live_seed_covered",
    target_handle: "poly-mailers",
    live_handle: "poly-mailers",
    live_title: "Poly Mailers",
    live_products_count: 69,
    seed_skus: ["B867", "B874"],
    fallback_note: "Use directly for apparel and lightweight-goods shelves.",
  },
  {
    intent: "padded mailers",
    query_class: "mid_tail",
    status: "approval_required_missing_handle",
    target_handle: "padded-mailers",
    live_handle: "mailers-envelopes",
    live_title: "Mailers & Envelopes",
    live_products_count: null,
    seed_skus: ["B803SS25PK", "B805SS"],
    fallback_note: "Use mailers-envelopes today; create padded-mailers only after approval if the dedicated route is needed.",
  },
  {
    intent: "poly bags",
    query_class: "mid_tail",
    status: "live_seed_covered",
    target_handle: "poly-bags",
    live_handle: "poly-bags",
    live_title: "Poly Bags",
    live_products_count: 2615,
    seed_skus: ["AB205", "AB211", "AB213", "PB10108"],
    fallback_note: "Use directly for poly-bag, clear-bag, flat-bag, and pre-opened bag shelves.",
  },
  {
    intent: "packing list envelopes",
    query_class: "mid_tail",
    status: "live_seed_covered",
    target_handle: "packing-list-envelopes",
    live_handle: "packing-list-envelopes",
    live_title: "Packing List Envelopes",
    live_products_count: 137,
    seed_skus: ["GSA20EL", "PL1", "PL100"],
    fallback_note: "Use directly for document-envelope and packing-list-envelope shelves.",
  },
  {
    intent: "shipping labels",
    query_class: "generic_head",
    status: "approval_required_missing_handle",
    target_handle: "shipping-labels",
    live_handle: "labels-tags",
    live_title: "Labels & Tags",
    live_products_count: null,
    seed_skus: ["LL251WR", "DL1058", "DL1261"],
    fallback_note: "Use labels-tags today; split true carrier-printer labels from handling and warehouse labels before changing collections.",
  },
  {
    intent: "packing tape",
    query_class: "mid_tail",
    status: "approval_required_missing_handle",
    target_handle: "packing-tape",
    live_handle: "carton-sealing-tape",
    live_title: "Carton Sealing Tape",
    live_products_count: null,
    seed_skus: ["T155000", "T901220", "T902220"],
    fallback_note: "Use carton-sealing-tape today; create packing-tape only after approval if the simpler buyer alias is needed.",
  },
  {
    intent: "void fill",
    query_class: "mid_tail",
    status: "approval_required_missing_handle",
    target_handle: "void-fill",
    live_handle: "cushioning",
    live_title: "Cushioning",
    live_products_count: 360,
    seed_skus: ["12BNUTS", "45NUTDIS", "BD1212AS", "FD1424", "FR2472"],
    fallback_note: "Use cushioning today; create void-fill only after approval if agents need a narrower route.",
  },
  {
    intent: "stretch wrap",
    query_class: "mid_tail",
    status: "approval_required_missing_handle",
    target_handle: "stretch-wrap",
    live_handle: "stretch-film-strapping",
    live_title: "Stretch Film & Strapping",
    live_products_count: null,
    seed_skus: ["MSF2060B", "MSF2060C", "SF188", "SF208"],
    fallback_note: "Use stretch-film-strapping today; create stretch-wrap only after approval if the buyer alias is needed.",
  },
  {
    intent: "pallet covers",
    query_class: "mid_tail",
    status: "live_seed_covered",
    target_handle: "pallet-covers-liners",
    live_handle: "pallet-covers-liners",
    live_title: "Pallet Covers & Liners",
    live_products_count: null,
    seed_skus: ["BL4024", "MSF2060B", "SF208", "EP252530120B", "EP3312225BX"],
    fallback_note: "Use directly for pallet-cover, pallet-wrap, and load-protection shelves.",
  },
  {
    intent: "cold chain packaging",
    query_class: "mid_tail",
    status: "approval_required_missing_handle",
    target_handle: "cold-chain-packaging",
    live_handle: "ecommerce-fulfillment",
    live_title: "E-Commerce & Fulfillment",
    live_products_count: 4512,
    seed_skus: ["IB12BPD", "10108", "PL1", "T902220"],
    fallback_note: "Use ecommerce-fulfillment today with exact cold-pack MCP SKU checks; create a cold-chain route only after approval.",
  },
  {
    intent: "packing supplies",
    query_class: "generic_head",
    status: "approval_required_missing_handle",
    target_handle: "packing-supplies",
    live_handle: "ecommerce-fulfillment",
    live_title: "E-Commerce & Fulfillment",
    live_products_count: 4512,
    seed_skus: ["12BNUTS", "BD1212AS", "AB205", "PL1", "T901220"],
    fallback_note: "Use ecommerce-fulfillment today; create packing-supplies only after approval if a broad packing-station route is needed.",
  },
  {
    intent: "shipping supplies",
    query_class: "generic_head",
    status: "approval_required_missing_handle",
    target_handle: "shipping-supplies",
    live_handle: "ecommerce-fulfillment",
    live_title: "E-Commerce & Fulfillment",
    live_products_count: 4512,
    seed_skus: [
      "10103",
      "10108",
      "1054",
      "1066",
      "1074",
      "1086",
      "B803SS25PK",
      "B805SS",
      "B829",
      "B852SSRTT",
      "B867",
      "B874",
      "MFL1295",
      "GSA20EL",
      "PL1",
      "PL100",
      "AB205",
      "AB211",
      "AB213",
      "PB10108",
      "MSF2060B",
      "MSF2060C",
      "SF188",
      "SF208",
      "BL4024",
      "IB12BPD",
      "T155000",
      "T901220",
      "T902220",
      "12BNUTS",
      "45NUTDIS",
      "BD1212AS",
      "FD1424",
      "FR2472",
    ],
    fallback_note: "Use ecommerce-fulfillment today; create shipping-supplies only after approval if Packrift wants a first-class broad category URL.",
  },
] as const;

type CollectionRow = (typeof COLLECTION_ROWS)[number];
type StarterPayload = ReturnType<typeof mcpUcpStarterCatalogPayload>;
type StarterItem = StarterPayload["starter_items"][number];

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

function collectionUrl(handle: string): string {
  return `${PACKRIFT_SITE}/collections/${handle}`;
}

function fallbackHandle(row: CollectionRow): string | undefined {
  return "fallback_handle" in row ? row.fallback_handle : undefined;
}

function sourceAwareMcpEndpoint(source: string, target = "generic_streamable_http"): string {
  const url = new URL(MCP_ENDPOINT);
  url.searchParams.set("packrift_mcp_source", source);
  url.searchParams.set("packrift_mcp_target", target);
  return url.toString();
}

function skuMap(payload: StarterPayload): Map<string, StarterItem> {
  return new Map(payload.starter_items.map((item) => [item.sku, item]));
}

function seedItems(row: CollectionRow, items: Map<string, StarterItem>) {
  return row.seed_skus.map((sku) => items.get(sku)).filter((item): item is StarterItem => Boolean(item));
}

function enrichedCollectionRows(payload: StarterPayload) {
  const items = skuMap(payload);
  return COLLECTION_ROWS.map((row) => {
    const seeds = seedItems(row, items).map((item) => ({
      sku: item.sku,
      title: item.title,
      family: item.family,
      product_url: item.product_url,
      mcp_sku_json: item.mcp_sku_json,
      mcp_sku_markdown: item.mcp_sku_markdown,
    }));
    return {
      ...row,
      live_collection_url: collectionUrl(row.live_handle),
      proposed_collection_url: collectionUrl(row.target_handle),
      fallback_collection_url: fallbackHandle(row) ? collectionUrl(fallbackHandle(row) ?? row.live_handle) : collectionUrl(row.live_handle),
      seed_items: seeds,
      builder_rule:
        row.status === "live_seed_covered"
          ? `Use ${row.live_handle} as the Packrift source route for "${row.intent}" shelves.`
          : row.status === "live_seed_gap"
            ? `Use ${fallbackHandle(row) ?? row.live_handle} for starter SKUs now; review ${row.target_handle} membership before changing collections.`
            : `Use ${row.live_handle} now; create or map ${row.target_handle} only after approval.`,
    };
  });
}

export function packriftUcpShippingSuppliesCollectionMapPayload(runtime: UcpStarterCatalogRuntime) {
  const starterPayload = mcpUcpStarterCatalogPayload(runtime);
  const routes = enrichedCollectionRows(starterPayload);
  const liveRoutes = routes.filter((route) => route.status === "live_seed_covered");
  const approvalRequired = routes.filter((route) => route.status !== "live_seed_covered");
  return {
    release: RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Builder-facing Packrift shipping-supplies collection route map for curated UCP storefronts and shopping agents. It tells builders which live Packrift collection URLs to use now and which buyer-intent aliases require approval before Shopify collection changes.",
    canonical_urls: {
      json: JSON_URL,
      markdown: MARKDOWN_URL,
      html: HTML_URL,
      starter_kit_json: STARTER_KIT_URL,
      storefront_import_json: IMPORT_FEED_URL,
      storefront_shelf_html: SHELF_URL,
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    policy: {
      no_shopify_collection_write_performed: true,
      no_shopify_product_or_category_write_performed: true,
      no_merchant_center_upload_performed: true,
      buyer_confirmed_cart_handoff_required: true,
      source_attribution_required: true,
    },
    source_aware_mcp: {
      default_source: "curated_ucp_storefront",
      endpoint: sourceAwareMcpEndpoint("curated_ucp_storefront"),
      first_run_url: "https://mcp.packrift.com/r/run/curated_ucp_storefront/generic_streamable_http?format=html",
      order_handoff_url: "https://mcp.packrift.com/r/order/curated_ucp_storefront?format=html",
    },
    summary: {
      target_intents: routes.length,
      live_seed_covered: liveRoutes.length,
      approval_required_or_seed_gap: approvalRequired.length,
      starter_seed_skus: starterPayload.starter_items.length,
      existing_live_handles: Array.from(new Set(routes.map((route) => route.live_handle))).sort(),
      approval_required_target_handles: approvalRequired.map((route) => route.target_handle),
    },
    route_selection_rules: [
      "For generic head terms, do not rely on Shopify global catalog search alone to pick Packrift.",
      "Use this map to hard-route packaging and shipping-supplies shelves to Packrift live collection URLs.",
      "Use starter SKUs and MCP exact-spec checks for product cards, live price, inventory, fit, and measured cart handoff.",
      "Do not create missing Shopify collection handles or change collection membership without owner approval.",
      "Preserve packrift_mcp_source and packrift_mcp_target through MCP install, first run, and buyer-confirmed order handoff.",
    ],
    collection_routes: routes,
    approval_required_collection_packet: approvalRequired.map((route) => ({
      target_handle: route.target_handle,
      target_url: route.proposed_collection_url,
      current_safe_route: route.fallback_collection_url,
      status: route.status,
      seed_skus: route.seed_skus,
      approval_reason: route.fallback_note,
    })),
  };
}

export function packriftUcpShippingSuppliesCollectionMapMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpShippingSuppliesCollectionMapPayload(runtime);
  const routeRows = payload.collection_routes
    .map(
      (route) =>
        `| ${escapeMarkdown(route.intent)} | ${escapeMarkdown(route.status)} | [${escapeMarkdown(route.live_handle)}](${route.live_collection_url}) | ${escapeMarkdown(route.target_handle)} | ${escapeMarkdown(route.seed_skus.join(", "))} |`
    )
    .join("\n");
  const approvalRows = payload.approval_required_collection_packet
    .map(
      (route) =>
        `| ${escapeMarkdown(route.target_handle)} | ${escapeMarkdown(route.status)} | [current route](${route.current_safe_route}) | ${escapeMarkdown(route.seed_skus.join(", "))} |`
    )
    .join("\n");
  return [
    "# Packrift UCP Shipping-Supplies Collection Map",
    "",
    `Release: \`${payload.release}\``,
    "",
    payload.purpose,
    "",
    "## Policy",
    "",
    "- No Shopify collection write was performed.",
    "- No Shopify product/category write was performed.",
    "- No Merchant Center upload was performed.",
    "- Cart handoff still requires buyer-confirmed exact SKU and source attribution.",
    "",
    "## Route Summary",
    "",
    `- Target intents: \`${payload.summary.target_intents}\``,
    `- Live seed-covered routes: \`${payload.summary.live_seed_covered}\``,
    `- Approval-required or seed-gap routes: \`${payload.summary.approval_required_or_seed_gap}\``,
    `- Starter seed SKUs: \`${payload.summary.starter_seed_skus}\``,
    "",
    "## Collection Routes",
    "",
    "| Intent | Status | Current live route | Target handle | Seed SKUs |",
    "| --- | --- | --- | --- | --- |",
    routeRows,
    "",
    "## Approval-Required Collection Packet",
    "",
    "| Target handle | Status | Current safe route | Seed SKUs |",
    "| --- | --- | --- | --- |",
    approvalRows,
    "",
    "## Builder Rule",
    "",
    "Use the current live route for each intent today. Treat the target handle as a Shopify collection creation or membership-change request only after owner approval.",
    "",
    "## Source-Aware MCP",
    "",
    `- Endpoint: ${payload.source_aware_mcp.endpoint}`,
    `- First run: ${payload.source_aware_mcp.first_run_url}`,
    `- Order handoff: ${payload.source_aware_mcp.order_handoff_url}`,
    "",
  ].join("\n");
}

export function packriftUcpShippingSuppliesCollectionMapHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpShippingSuppliesCollectionMapPayload(runtime);
  const routeCards = payload.collection_routes
    .map(
      (route) => `<article>
        <div class="status">${escapeHtml(route.status)}</div>
        <h2>${escapeHtml(route.intent)}</h2>
        <p>${escapeHtml(route.builder_rule)}</p>
        <div class="links">
          <a class="button primary" href="${escapeHtml(route.live_collection_url)}">Use ${escapeHtml(route.live_handle)}</a>
          <a class="button" href="${escapeHtml(route.proposed_collection_url)}">Target ${escapeHtml(route.target_handle)}</a>
        </div>
        <p class="small">Seed SKUs: ${escapeHtml(route.seed_skus.join(", "))}</p>
      </article>`
    )
    .join("\n");
  const approvalCards = payload.approval_required_collection_packet
    .map(
      (route) => `<article>
        <div class="status">${escapeHtml(route.status)}</div>
        <h2>${escapeHtml(route.target_handle)}</h2>
        <p>${escapeHtml(route.approval_reason)}</p>
        <a class="button" href="${escapeHtml(route.current_safe_route)}">Current safe route</a>
      </article>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Shipping-Supplies Collection Map</title>
  <meta name="description" content="Live Packrift collection route map for UCP and agentic storefront builders adding shipping-supplies shelves.">
  <style>
    :root{color-scheme:light;--ink:#18211c;--muted:#59685f;--line:#d6ded8;--paper:#f6f7f2;--panel:#fff;--green:#12634c;--blue:#245f9b;--amber:#8c5a12}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 56px}
    header{display:grid;gap:12px;padding-bottom:20px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.2rem,5vw,4.2rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.05rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    .chips,.links{display:flex;flex-wrap:wrap;gap:8px}
    .chips span,.status{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.86rem;color:var(--muted);width:max-content}
    section{padding:24px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px}
    article{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;display:grid;gap:10px}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    .small{font-size:.88rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fbfcf8;padding:12px}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Shipping-supplies collection map</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="chips">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.summary.live_seed_covered} live seed-covered routes</span>
        <span>${payload.summary.approval_required_or_seed_gap} approval-required or seed-gap routes</span>
        <span>no Shopify writes</span>
      </div>
      <div class="links">
        <a class="button" href="${JSON_URL}">JSON</a>
        <a class="button" href="${MARKDOWN_URL}">Markdown</a>
        <a class="button primary" href="${payload.source_aware_mcp.first_run_url}">Run MCP check</a>
        <a class="button" href="${payload.source_aware_mcp.order_handoff_url}">Order handoff</a>
      </div>
    </header>
    <section>
      <h2>Live collection routes for builders</h2>
      <div class="grid">${routeCards}</div>
    </section>
    <section>
      <h2>Approval-required collection packet</h2>
      <p>Create or change these collection handles only after owner approval.</p>
      <div class="grid">${approvalCards}</div>
    </section>
    <section>
      <h2>Source-aware MCP endpoint</h2>
      <pre>${escapeHtml(payload.source_aware_mcp.endpoint)}</pre>
    </section>
  </main>
</body>
</html>`;
}
