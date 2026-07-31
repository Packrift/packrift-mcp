import { APPROVED_CATALOG, type ApprovedCatalogItem } from "./effective-approved-catalog.js";
import { isMcpCommerceHeldSku, MCP_COMMERCE_HELD_SKUS, MCP_COMMERCE_HOLD_REASON } from "./mcp-commerce-holds.js";
import { PURCHASE_READY_SKUS } from "./purchase-ready-skus.js";

export interface UcpStarterCatalogRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const PACKRIFT_SITE = "https://packrift.com";
const GLOBAL_UCP_BUSINESS = "https://catalog.shopify.com";
const DEFAULT_SOURCE = "curated_ucp_storefront";
const DEFAULT_TARGET = "generic_streamable_http";

const PURCHASE_READY_SET = new Set(PURCHASE_READY_SKUS.map((sku) => sku.toUpperCase()));
const APPROVED_CATALOG_BY_SKU = new Map(APPROVED_CATALOG.map((item) => [item.sku.toUpperCase(), item]));

export const UCP_STARTER_CATALOG_SOURCE_SLUGS = [
  "curated_ucp_storefront",
  "stack412_style_storefront",
  "plugthatshop_style_embed",
  "open_scout_shopping_agent",
  "upsonic_ucp_agent_framework",
  "agorio_shopping_agent_sdk",
] as const;

const UCP_STARTER_BUNDLES = [
  {
    id: "ecommerce_shipping_starter",
    title: "Ecommerce shipping starter",
    storefront_intent: "General shipping-supplies storefronts that need boxes, mailers, bags, tape, documents, and void fill in one Packrift lane.",
    ucp_queries: [
      "Packrift shipping boxes",
      "Packrift corrugated boxes",
      "Packrift bubble mailers",
      "Packrift poly bags",
      "Packrift packing tape",
      "Packrift packing list envelopes",
      "Packrift packing peanuts",
      "10x6x6 ECT 32 Packrift boxes",
      "10x10x3 Packrift corrugated boxes",
      "6x10 Kraft Self-Seal Padded Mailers Packrift",
      "4.5x6 Orange Packing List Enclosed Packrift",
    ],
    mcp_prompts: [
      "Build an ecommerce shipping supplies shelf with Packrift boxes, bubble mailers, poly bags, carton sealing tape, packing list envelopes, and void fill. Use exact SKUs only for purchase handoff.",
      "Find Packrift packaging for a small ecommerce warehouse starter kit. Return exact SKU, title, product URL, live price check, and measured cart handoff only after buyer confirmation.",
    ],
    skus: ["1066", "10103", "1054", "MFL1295", "B803SS25PK", "B805SS", "AB205", "PL1", "T901220", "12BNUTS"],
  },
  {
    id: "warehouse_replenishment",
    title: "Warehouse replenishment",
    storefront_intent: "Fulfillment and operations storefronts that need repeatable supplies for boxes, tape, film, documents, void fill, and load protection.",
    ucp_queries: [
      "Packrift warehouse shipping supplies",
      "Packrift fulfillment packaging supplies",
      "Packrift stretch film",
      "Packrift water activated tape",
      "Packrift packing list envelopes",
      "Packrift edge protectors",
      "10x10x8 Packrift boxes",
      "20 x 60 gauge machine stretch film Packrift",
      "1.5 x 500 kraft water activated tape Packrift",
    ],
    mcp_prompts: [
      "Create a warehouse replenishment shelf from Packrift with corrugated boxes, machine stretch film, hand stretch film, water activated tape, document envelopes, void fill, and edge protectors.",
      "For each Packrift warehouse supply, keep exact SKU matching strict and use prepare_purchase_handoff with source attribution before returning any cart URL.",
    ],
    skus: ["10108", "1086", "MSF2060B", "MSF2060C", "SF208", "T155000", "T902220", "PL100", "45NUTDIS", "EP252530120B"],
  },
  {
    id: "apparel_and_light_goods",
    title: "Apparel and light goods",
    storefront_intent: "Apparel, accessories, and lightweight-goods storefronts that need poly mailers, bubble mailers, poly bags, and labels.",
    ucp_queries: [
      "Packrift poly mailers",
      "Packrift bubble mailers",
      "Packrift clear poly bags",
      "Packrift weather resistant labels",
      "10x13 white poly mailers Packrift",
      "10x5 bubble lined poly mailers Packrift",
      "5x8 pre-opened poly bags Packrift",
    ],
    mcp_prompts: [
      "Build an apparel shipping shelf using Packrift poly mailers, bubble mailers, clear poly bags, and labels. Do not use generic head-term winners when an exact Packrift SKU is needed.",
      "Use Packrift MCP to compare mailer dimensions and closure types, then confirm live price and inventory before a measured cart handoff.",
    ],
    skus: ["B867", "B874", "B829", "B852SSRTT", "AB211", "AB213", "PB10108", "LL251WR"],
  },
  {
    id: "fragile_item_shipping",
    title: "Fragile item shipping",
    storefront_intent: "Stores that curate protective packaging for glass, ceramics, cosmetics, collectibles, electronics, and other damage-sensitive orders.",
    ucp_queries: [
      "Packrift fragile shipping supplies",
      "Packrift bubble dispenser",
      "Packrift air foam roll",
      "Packrift foam roll",
      "Packrift literature mailer",
      "Packrift water activated tape",
      "12 x 9 x 5 white corrugated literature mailer Packrift",
      "1/2 x 12 anti static bubble dispenser Packrift",
    ],
    mcp_prompts: [
      "Build a fragile item shipping shelf from Packrift with protective wrap, foam, literature mailers, boxes, water activated tape, and shipping labels.",
      "When the buyer gives item dimensions, call find_packaging_for_item or pack_calculator first, then use exact SKU confirmation before cart handoff.",
    ],
    skus: ["BD1212AS", "FD1424", "FR2472", "MFL1295", "10108", "1074", "T155000", "DL1261"],
  },
  {
    id: "packing_station_operations",
    title: "Packing station operations",
    storefront_intent: "Ops-storefront shelves for the supplies a packer touches all day: envelopes, tape, void fill, film, labels, and load protection.",
    ucp_queries: [
      "Packrift packing station supplies",
      "Packrift shipping station supplies",
      "Packrift document envelopes",
      "Packrift carton sealing tape",
      "Packrift hand stretch film",
      "Packrift edge protectors",
      "4.5x6 orange packing list envelopes Packrift",
      "2 inch clear acrylic carton sealing tape Packrift",
    ],
    mcp_prompts: [
      "Create a packing station shelf from Packrift with packing list envelopes, carton sealing tape, void fill, hand stretch film, and edge protectors.",
      "For every Packrift line item, preserve exact SKU and measured MCP source attribution in prepare_purchase_handoff.",
    ],
    skus: ["PL1", "GSA20EL", "PL100", "T901220", "T902220", "12BNUTS", "SF188", "EP3312225BX"],
  },
  {
    id: "pallet_load_protection",
    title: "Pallet and load protection",
    storefront_intent: "Warehouse and 3PL storefront shelves for pallet covers, stretch wrap, edge protectors, and load-stabilization supplies.",
    ucp_queries: [
      "Packrift pallet covers",
      "Packrift pallet protection",
      "Packrift pallet wrap",
      "Packrift stretch wrap",
      "40x24x72 Packrift pallet covers",
      "20 x 60 gauge machine stretch film Packrift",
      "2.5 x 2.5 x 30 edge protectors Packrift",
    ],
    mcp_prompts: [
      "Build a pallet and load-protection shelf from Packrift with pallet covers, machine stretch film, hand stretch film, and fibreboard edge protectors. Keep exact SKU matching strict before cart handoff.",
      "Find Packrift pallet covers and stretch wrap for a warehouse replenishment shelf. Return exact SKU, dimensions, product URL, live price check, and measured handoff only after buyer confirmation.",
    ],
    skus: ["BL4024", "MSF2060B", "SF208", "EP252530120B", "EP3312225BX"],
  },
  {
    id: "cold_chain_shipping",
    title: "Cold-chain shipping",
    storefront_intent: "Temperature-sensitive shipping shelves for cold packs plus the supporting box, tape, and document-envelope workflow.",
    ucp_queries: [
      "Packrift cold packs",
      "Packrift cold chain packaging",
      "Packrift refrigerated shipping supplies",
      "Packrift gel cold packs",
      "6x5.75x1 Packrift cold packs",
      "Packrift insulated shipping supplies",
    ],
    mcp_prompts: [
      "Build a cold-chain shipping shelf from Packrift with gel cold packs, cartons, carton sealing tape, and packing-list envelopes. Do not claim duration or compliance beyond the product page.",
      "Find Packrift cold packs for temperature-sensitive shipments, then verify the exact SKU, live price, inventory, and supporting packaging before buyer-confirmed cart handoff.",
    ],
    skus: ["IB12BPD", "10108", "PL1", "T902220"],
  },
] as const;

function requireStarterItem(sku: string): ApprovedCatalogItem {
  const normalized = sku.toUpperCase();
  const item = APPROVED_CATALOG_BY_SKU.get(normalized);
  if (!item) throw new Error(`UCP starter catalog SKU ${normalized} is not in the approved catalog.`);
  if (!PURCHASE_READY_SET.has(normalized)) throw new Error(`UCP starter catalog SKU ${normalized} is not purchase ready.`);
  if (isMcpCommerceHeldSku(normalized)) {
    throw new Error(`UCP starter catalog SKU ${normalized} is held from MCP commerce: ${MCP_COMMERCE_HOLD_REASON}`);
  }
  return item;
}

function productUrl(item: ApprovedCatalogItem): string {
  return `${PACKRIFT_SITE}/products/${item.handle}`;
}

function mcpSkuResourceUrl(sku: string, format: "json" | "md"): string {
  return `https://mcp.packrift.com/ai/sku/${encodeURIComponent(sku)}.${format}`;
}

function sourceAwareEndpoint(source: string, target = DEFAULT_TARGET): string {
  return `${MCP_ENDPOINT}?packrift_mcp_source=${encodeURIComponent(source)}&packrift_mcp_target=${encodeURIComponent(target)}`;
}

function sourceLinks(source: string, target = DEFAULT_TARGET) {
  const encodedSource = encodeURIComponent(source);
  const encodedTarget = encodeURIComponent(target);
  return {
    source,
    target,
    endpoint: sourceAwareEndpoint(source, target),
    tracked_start_url: `https://mcp.packrift.com/r/start/${encodedSource}`,
    tracked_config_url: `https://mcp.packrift.com/r/config/${encodedSource}`,
    tracked_install_url: `https://mcp.packrift.com/r/install/${encodedSource}/${encodedTarget}?format=html`,
    tracked_install_json_url: `https://mcp.packrift.com/r/install/${encodedSource}/${encodedTarget}?format=json`,
    tracked_first_run_url: `https://mcp.packrift.com/r/run/${encodedSource}/${encodedTarget}?format=html`,
    tracked_first_run_shell_url: `https://mcp.packrift.com/r/run/${encodedSource}/${encodedTarget}?format=sh`,
    tracked_order_handoff_url: `https://mcp.packrift.com/r/order/${encodedSource}?format=html`,
    tracked_order_handoff_json_url: `https://mcp.packrift.com/r/order/${encodedSource}?format=json`,
    source_activation_json: `https://mcp.packrift.com/ai/mcp-source-activation/${encodedSource}.json`,
    eval_pack_json: `https://mcp.packrift.com/ai/mcp-eval-pack.json?source=${encodedSource}`,
  };
}

function toolCall(id: string, name: string, args: Record<string, unknown>) {
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

function protocolRequest(id: string, method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

function ucpCliExample(query: string): string {
  return `ucp catalog search --business ${GLOBAL_UCP_BUSINESS} --input '${JSON.stringify({ query })}'`;
}

function starterSkuRecord(sku: string, bundleId: string) {
  const item = requireStarterItem(sku);
  return {
    sku: item.sku,
    title: item.title,
    family: item.family,
    handle: item.handle,
    product_id: item.productId,
    variant_id: item.variantId,
    product_url: productUrl(item),
    mcp_sku_json: mcpSkuResourceUrl(item.sku, "json"),
    mcp_sku_markdown: mcpSkuResourceUrl(item.sku, "md"),
    global_ucp_queries: [
      `Packrift ${item.sku}`,
      `Packrift ${item.title}`,
      `${item.sku} Packrift`,
    ],
    mcp_prepare_purchase_handoff_unconfirmed: {
      sku: item.sku,
      quantity: 1,
      buyer_confirmed: false,
      source_context: "mcp_ucp_starter_catalog",
      mcp_source_context: DEFAULT_SOURCE,
      mcp_install_target: DEFAULT_TARGET,
      journey_id: `mcp_ucp_starter_catalog_${bundleId}_${item.sku}`,
      result_set_id: bundleId,
    },
    mcp_prepare_purchase_handoff_confirmed_template: {
      sku: item.sku,
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: "mcp_ucp_starter_catalog",
      mcp_source_context: "{source_slug}",
      mcp_install_target: "{install_target}",
      journey_id: `mcp_ucp_starter_catalog_${bundleId}_${item.sku}`,
      result_set_id: bundleId,
    },
  };
}

function bundleRecord(bundle: (typeof UCP_STARTER_BUNDLES)[number]) {
  const items = bundle.skus.map((sku) => starterSkuRecord(sku, bundle.id));
  return {
    ...bundle,
    ucp_cli_examples: bundle.ucp_queries.map((query) => ({ query, command: ucpCliExample(query) })),
    items,
    json_rpc_sequence_unconfirmed_exact_sku: items.slice(0, 3).map((item) =>
      toolCall(`prepare-${item.sku}`, "prepare_purchase_handoff", {
        ...item.mcp_prepare_purchase_handoff_unconfirmed,
      })
    ),
  };
}

function uniqueStarterItems(bundles: ReturnType<typeof bundleRecord>[]) {
  const bySku = new Map<string, ReturnType<typeof starterSkuRecord>>();
  for (const bundle of bundles) {
    for (const item of bundle.items) bySku.set(item.sku, item);
  }
  return Array.from(bySku.values()).sort((a, b) => a.family.localeCompare(b.family) || a.sku.localeCompare(b.sku));
}

function sourcePlaybooks() {
  return UCP_STARTER_CATALOG_SOURCE_SLUGS.map((source) => {
    const links = sourceLinks(source);
    const useWhen: Record<(typeof UCP_STARTER_CATALOG_SOURCE_SLUGS)[number], string> = {
      curated_ucp_storefront:
        "General curated UCP storefronts that need Packrift to appear as the packaging and shipping-supplies merchant.",
      stack412_style_storefront:
        "Stack412-style storefronts that assemble Shopify global-catalog results into themed automated storefronts.",
      plugthatshop_style_embed:
        "PlugThatShop-style contextual shopping embeds that need a Packrift packaging shelf or packaging upsell.",
      open_scout_shopping_agent:
        "Open Scout-style shopping agents that answer buyer intents across chat, web, SMS, or WhatsApp and need exact-spec packaging with cart handoff.",
      upsonic_ucp_agent_framework:
        "Upsonic-style multi-agent UCP frameworks that coordinate intent analysis, product fetching, filtering, and cart-ready purchase handoff.",
      agorio_shopping_agent_sdk:
        "Agorio-style UCP/ACP shopping-agent SDK builders that need a realistic packaging merchant example with MCP live checks and buyer-confirmed handoff.",
    };
    return {
      ...links,
      use_when: useWhen[source],
      first_run_check: [
        protocolRequest(`tools-list-${source}`, "tools/list"),
        toolCall(`starter-search-${source}`, "search_products", {
          query: "10x6x6 ECT 32 corrugated boxes",
          family: "boxes",
          limit: 5,
          source_context: "mcp_ucp_starter_catalog",
          mcp_source_context: source,
          mcp_install_target: DEFAULT_TARGET,
        }),
        toolCall(`prepare-1066-${source}`, "prepare_purchase_handoff", {
          sku: "1066",
          quantity: 1,
          buyer_confirmed: false,
          source_context: "mcp_ucp_starter_catalog",
          mcp_source_context: source,
          mcp_install_target: DEFAULT_TARGET,
        }),
      ],
    };
  });
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
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

function htmlShell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root{color-scheme:light;--ink:#18221d;--muted:#5e6b62;--line:#d7ded8;--paper:#f6f7f2;--panel:#fff;--green:#0f684d;--blue:#245f9b;--amber:#8c5a12}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.2rem);line-height:.98;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    h3{margin:0 0 6px;font-size:1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links,.tags{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.tags span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:14px}
    article,.rules,.source,.sequence{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:15px}
    .source{border-left:5px solid var(--amber)}
    ul,ol{margin:8px 0 0;padding-left:20px;color:var(--muted)}
    li{margin:5px 0}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.86rem}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
    th,td{text-align:left;border-bottom:1px solid var(--line);padding:9px;vertical-align:top}
    th{font-size:.85rem;color:var(--muted);font-weight:700}
    tr:last-child td{border-bottom:0}
    @media (max-width:760px){.button{width:100%;justify-content:center}table,thead,tbody,tr,th,td{display:block}thead{display:none}td{border-bottom:0;padding:7px 9px}tr{border-bottom:1px solid var(--line)}}
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function mcpUcpStarterCatalogPayload(runtime: UcpStarterCatalogRuntime) {
  const bundles = UCP_STARTER_BUNDLES.map(bundleRecord);
  const starterItems = uniqueStarterItems(bundles);
  return {
    release: "PACKRIFT-MCP-UCP-STARTER-CATALOG-R03",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    global_ucp_business: GLOBAL_UCP_BUSINESS,
    purpose:
      "Builder-ready Packrift starter catalog for curated UCP storefronts, agentic-commerce shelves, and contextual storefront embeds that need a packaging and shipping-supplies merchant.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    distribution_thesis:
      "Generic Shopify global-catalog head terms often route to older merchant authorities. Curated storefront builders can still pull Packrift reliably by using Packrift-branded UCP queries, exact spec queries, and the Packrift MCP as the source of truth for exact SKU lookup, pricing, inventory, and measured cart handoff.",
    who_should_use_this: [
      "curated UCP storefront builders",
      "Stack412-style automated storefront builders",
      "PlugThatShop-style shoppable embed builders",
      "Open Scout-style shopping-agent builders",
      "Upsonic-style UCP agent framework builders",
      "shipping-supplies and fulfillment marketplace curators",
      "agent builders that need exact-spec packaging with live cart handoff",
    ],
    coverage_policy: [
      "Use Packrift-branded UCP queries for inclusion when generic head terms hide Packrift behind higher-authority merchants.",
      "Use exact dimension, material, closure, pack-count, and SKU queries for product-level UCP discovery.",
      "Use Packrift MCP for exact-spec filtering, live price, live inventory, no-match recovery, and measured cart handoff.",
      "Do not mass-retitle products to chase generic UCP rank.",
      "Do not return direct checkout or cart URLs until a buyer confirms exact SKU and quantity.",
      `Exclude MCP commerce-held SKUs from starter shelves: ${MCP_COMMERCE_HELD_SKUS.join(", ")}.`,
    ],
    starter_catalog_summary: {
      bundle_count: bundles.length,
      unique_sku_count: starterItems.length,
      source_slugs: UCP_STARTER_CATALOG_SOURCE_SLUGS,
      default_source: DEFAULT_SOURCE,
      default_install_target: DEFAULT_TARGET,
    },
    source_playbooks: sourcePlaybooks(),
    bundles,
    starter_items: starterItems,
    global_ucp_query_strategy: {
      business: GLOBAL_UCP_BUSINESS,
      broad_queries_that_need_packrift_branding: [
        "Packrift shipping boxes",
        "Packrift corrugated boxes",
        "Packrift packaging supplies",
        "Packrift shipping supplies",
        "Packrift mailers",
        "Packrift poly bags",
      "Packrift packing tape",
      "Packrift stretch film",
      "Packrift pallet covers",
      "Packrift cold packs",
      "Packrift cold chain packaging",
    ],
      exact_queries_to_seed_product_cards: bundles.flatMap((bundle) => bundle.ucp_queries).slice(0, 40),
      cli_template: `ucp catalog search --business ${GLOBAL_UCP_BUSINESS} --input '{"query":"Packrift shipping boxes"}'`,
      fallback_when_packrift_is_absent:
        "If a generic query such as shipping boxes or corrugated boxes does not surface Packrift, re-query with Packrift plus the intent or exact spec, then use MCP search_products or prepare_purchase_handoff for the line item.",
    },
    mcp_builder_recipe: [
      "Install or call Packrift MCP with a source-aware endpoint from source_playbooks.",
      "Use a Packrift-branded UCP query to make Packrift visible in the global catalog shelf.",
      "For each selected item, use the MCP SKU resource or search_products to keep exact SKU and product URL stable.",
      "Use prepare_purchase_handoff with buyer_confirmed=false to verify product, live price, and inventory.",
      "Only after exact SKU and quantity are confirmed, call prepare_purchase_handoff with buyer_confirmed=true and preserve mcp_source_context plus mcp_install_target.",
    ],
    proof_urls: {
      mcp_endpoint: MCP_ENDPOINT,
      starter_catalog_json: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",
      starter_catalog_markdown: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.md",
      starter_catalog_html: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.html",
      source_activation_curated_ucp: "https://mcp.packrift.com/ai/mcp-source-activation/curated_ucp_storefront.json",
      source_activation_stack412_style: "https://mcp.packrift.com/ai/mcp-source-activation/stack412_style_storefront.json",
      source_activation_plugthatshop_style: "https://mcp.packrift.com/ai/mcp-source-activation/plugthatshop_style_embed.json",
      source_activation_open_scout_style: "https://mcp.packrift.com/ai/mcp-source-activation/open_scout_shopping_agent.json",
      source_activation_upsonic_style: "https://mcp.packrift.com/ai/mcp-source-activation/upsonic_ucp_agent_framework.json",
      source_activation_agorio_style: "https://mcp.packrift.com/ai/mcp-source-activation/agorio_shopping_agent_sdk.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      product_corpus: "https://mcp.packrift.com/ai/packrift-ai-approved-products.jsonl",
      purchase_paths: "https://mcp.packrift.com/ai/purchase-paths.jsonl",
      mcp_tools: "https://mcp.packrift.com/ai/mcp-tools.json",
    },
  };
}

export function mcpUcpStarterCatalogMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStarterCatalogPayload(runtime);
  const sourceRows = payload.source_playbooks
    .map((source) => `| ${source.source} | ${source.target} | ${source.use_when} | ${source.tracked_install_url} | ${source.tracked_first_run_url} |`)
    .join("\n");
  const bundleRows = payload.bundles
    .map((bundle) => `| ${escapeMarkdown(bundle.title)} | ${escapeMarkdown(bundle.storefront_intent)} | ${bundle.skus.map((sku) => `\`${sku}\``).join(", ")} |`)
    .join("\n");
  const itemRows = payload.starter_items
    .map((item) => `| ${item.sku} | ${escapeMarkdown(item.title)} | ${item.family} | ${item.product_url} |`)
    .join("\n");
  return [
    "# Packrift UCP Starter Catalog",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical MCP endpoint: ${payload.canonical_endpoint}`,
    `Global UCP business: ${payload.global_ucp_business}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Distribution Thesis",
    "",
    payload.distribution_thesis,
    "",
    "## Coverage Policy",
    "",
    payload.coverage_policy.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Source-Aware Builder Paths",
    "",
    "| Source | Target | Use when | Install link | First run link |",
    "| --- | --- | --- | --- | --- |",
    sourceRows,
    "",
    "## Starter Bundles",
    "",
    "| Bundle | Storefront intent | SKUs |",
    "| --- | --- | --- |",
    bundleRows,
    "",
    "## Starter Items",
    "",
    "| SKU | Product | Family | Product URL |",
    "| --- | --- | --- | --- |",
    itemRows,
    "",
    "## Global UCP Query Strategy",
    "",
    fencedJson(payload.global_ucp_query_strategy),
    "",
    "## MCP Builder Recipe",
    "",
    payload.mcp_builder_recipe.map((step) => `- ${step}`).join("\n"),
    "",
    "## Example Source Playbook",
    "",
    fencedJson(payload.source_playbooks[0]),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",
    "",
  ].join("\n");
}

export function mcpUcpStarterCatalogHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStarterCatalogPayload(runtime);
  const sourceCards = payload.source_playbooks
    .map(
      (source) => `<article class="source">
        <h3>${escapeHtml(source.source)}</h3>
        <p>${escapeHtml(source.use_when)}</p>
        <p><code>${escapeHtml(source.endpoint)}</code></p>
        <div class="links">
          <a class="button primary" href="${escapeHtml(source.tracked_install_url)}">Install</a>
          <a class="button" href="${escapeHtml(source.tracked_first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(source.source_activation_json)}">Activation JSON</a>
        </div>
      </article>`
    )
    .join("");
  const bundleCards = payload.bundles
    .map(
      (bundle) => `<article>
        <h3>${escapeHtml(bundle.title)}</h3>
        <p>${escapeHtml(bundle.storefront_intent)}</p>
        <div class="tags">${bundle.skus.map((sku) => `<span>${escapeHtml(sku)}</span>`).join("")}</div>
        <pre>${escapeHtml(bundle.ucp_cli_examples.slice(0, 3).map((example) => example.command).join("\n"))}</pre>
      </article>`
    )
    .join("");
  const itemRows = payload.starter_items
    .map(
      (item) => `<tr>
        <td><code>${escapeHtml(item.sku)}</code></td>
        <td><a href="${escapeHtml(item.product_url)}">${escapeHtml(item.title)}</a></td>
        <td>${escapeHtml(item.family)}</td>
        <td><a href="${escapeHtml(item.mcp_sku_json)}">SKU JSON</a></td>
      </tr>`
    )
    .join("");
  const links = ([
    ["Start MCP", "https://mcp.packrift.com/start"],
    ["JSON", payload.proof_urls.starter_catalog_json],
    ["Markdown", payload.proof_urls.starter_catalog_markdown],
    ["Cart activation", payload.proof_urls.cart_activation],
    ["Product corpus", payload.proof_urls.product_corpus],
  ] satisfies Array<[string, string]>)
    .map(([label, url], index) => `<a class="button${index === 0 ? " primary" : ""}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
    .join("");
  return htmlShell(
    "Packrift UCP Starter Catalog",
    payload.purpose,
    `<header>
      <h1>Packrift UCP Starter Catalog</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.starter_catalog_summary.bundle_count} bundles</span>
        <span>${payload.starter_catalog_summary.unique_sku_count} SKUs</span>
        <span>${payload.runtime.tools_count} tools</span>
      </div>
      <div class="links">${links}</div>
    </header>
    <section>
      <h2>Distribution Thesis</h2>
      <div class="rules"><p>${escapeHtml(payload.distribution_thesis)}</p><ul>${payload.coverage_policy.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></div>
    </section>
    <section>
      <h2>Source-Aware Builder Paths</h2>
      <div class="grid">${sourceCards}</div>
    </section>
    <section>
      <h2>Starter Bundles</h2>
      <div class="grid">${bundleCards}</div>
    </section>
    <section>
      <h2>Starter Items</h2>
      <table>
        <thead><tr><th>SKU</th><th>Product</th><th>Family</th><th>MCP</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </section>
    <section>
      <h2>MCP Builder Recipe</h2>
      <div class="sequence"><ol>${payload.mcp_builder_recipe.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>
    </section>`
  );
}
