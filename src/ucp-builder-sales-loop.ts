import { UCP_STARTER_CATALOG_SOURCE_SLUGS, type UcpStarterCatalogRuntime } from "./ucp-starter-catalog.js";

const BASE = "https://mcp.packrift.com";
const SALES_LOOP_JSON = `${BASE}/ai/packrift-ucp-builder-sales-loop.json`;
const SALES_LOOP_MD = `${BASE}/ai/packrift-ucp-builder-sales-loop.md`;
const SALES_LOOP_HTML = `${BASE}/ai/packrift-ucp-builder-sales-loop.html`;
const STARTER_KIT_HTML = `${BASE}/ai/packrift-ucp-shipping-supplies-starter-kit.html`;
const STARTER_KIT_JSON = `${BASE}/ai/packrift-ucp-shipping-supplies-starter-kit.json`;
const STOREFRONT_TEMPLATE_HTML = `${BASE}/ai/packrift-ucp-shipping-supplies-storefront-template.html`;
const COLLECTION_MAP_HTML = `${BASE}/ai/packrift-ucp-shipping-supplies-collection-map.html`;
const COLLECTION_MAP_JSON = `${BASE}/ai/packrift-ucp-shipping-supplies-collection-map.json`;
const IMPORT_FEED_JSON = `${BASE}/ai/mcp-ucp-storefront-import.json`;
const SHELF_SCRIPT = `${BASE}/ai/packrift-ucp-shelf.js`;
const LAUNCHPAD_HTML = `${BASE}/ai/packrift-ucp-builder-launchpad.html`;
const ACTIVATION_HANDOFF_HTML = `${BASE}/ai/mcp-ucp-builder-activation-handoff.html`;
const INTEGRATION_PACK_HTML = `${BASE}/ai/packrift-ucp-builder-integration-pack.html`;
const APPROVAL_PACKET_HTML = `${BASE}/ai/packrift-ucp-builder-approval-packet.html`;
const PR_ACTIVATION_PACK_HTML = `${BASE}/ai/packrift-ucp-builder-pr-activation-pack.html`;
const SOURCE_QUEUE_JSON = `${BASE}/ai/mcp-source-activation-queue.json`;
const FUNNEL_PROOF_JSON = `${BASE}/ai/mcp-ga4-funnel-proof.json`;
const MCP_ENDPOINT = `${BASE}/mcp`;

const POST_SALES_LOOP_BASELINE = {
  captured_at: "2026-06-27T02:43:18.349Z",
  status: "not_proven",
  external_send_done: false,
  baseline_name: "post_sales_loop_pre_external_action",
  global_funnel_baseline: {
    qualified_external_mcp_session_starts: 130,
    qualified_external_cart_landings: 28,
    first_party_mcp_orders: 0,
    first_party_mcp_order_revenue: 0,
  },
  source_baselines: [
    {
      source_slug: "stack412_style_storefront",
      status: "not_proven",
      source_signal_total: 1,
      ga4_cart_landing_event_count: 0,
      ga4_ai_event_count: 0,
      first_party_mcp_orders: 0,
      first_party_mcp_order_revenue: 0,
      recommended_first_link: `${BASE}/ai/packrift-ucp-stack412-shipping-supplies-aisle.html`,
    },
    {
      source_slug: "agorio_shopping_agent_sdk",
      status: "not_proven",
      source_signal_total: 0,
      ga4_cart_landing_event_count: 0,
      ga4_ai_event_count: 0,
      first_party_mcp_orders: 0,
      first_party_mcp_order_revenue: 0,
      recommended_first_link: `${BASE}/ai/packrift-ucp-builder-integration-pack/agorio_shopping_agent_sdk.html`,
    },
  ],
  proof_boundary:
    "Treat this as the pre-send baseline for actions approved after the builder sales-loop launch. A source-signal delta is only a follow-up trigger; sales success requires external builder install/embed/use plus source-attributed MCP/cart/order continuity.",
};

const SOURCE_ATTRIBUTED_CART_SMOKE_PROOF = {
  release: "PACKRIFT-SOURCE-ATTRIBUTED-CART-HANDOFF-SMOKE-R01",
  status: "pass",
  mode: "synthetic_no_order_readiness_check",
  no_order_created: true,
  proof_boundary:
    "This proves source-preserving cart handoff readiness only. It does not count as external adoption or sales proof until a real external builder or buyer produces source-attributed cart/order continuity.",
  proof_rows: [
    {
      source_slug: "stack412_style_storefront",
      install_target: "generic_streamable_http",
      checked_at: "2026-06-27T03:24:03.399Z",
      endpoint: `${MCP_ENDPOINT}?packrift_mcp_source=stack412_style_storefront&packrift_mcp_target=generic_streamable_http`,
      selected_sku: "1066",
      tool_count: 16,
      live_price: { unit_price: 14, currency: "USD" },
      inventory_available: 500,
      measured_cart_url_prefix: `${BASE}/r/cart/1066`,
      cart_landing_shim: "PACKRIFT-MCP-CART-LANDING-SHIM-R02",
      prepare_purchase_handoff_confirmed_cart: true,
      cart_url_source_attribution_ok: true,
      final_shopify_cart_source_attributes_ok: true,
      replay_without_order: `${BASE}/r/run/stack412_style_storefront/generic_streamable_http?format=html`,
    },
    {
      source_slug: "agorio_shopping_agent_sdk",
      install_target: "generic_streamable_http",
      checked_at: "2026-06-27T03:24:08.184Z",
      endpoint: `${MCP_ENDPOINT}?packrift_mcp_source=agorio_shopping_agent_sdk&packrift_mcp_target=generic_streamable_http`,
      selected_sku: "1066",
      tool_count: 16,
      live_price: { unit_price: 14, currency: "USD" },
      inventory_available: 500,
      measured_cart_url_prefix: `${BASE}/r/cart/1066`,
      cart_landing_shim: "PACKRIFT-MCP-CART-LANDING-SHIM-R02",
      prepare_purchase_handoff_confirmed_cart: true,
      cart_url_source_attribution_ok: true,
      final_shopify_cart_source_attributes_ok: true,
      replay_without_order: `${BASE}/r/run/agorio_shopping_agent_sdk/generic_streamable_http?format=html`,
    },
  ],
  required_sequence:
    "Use the source-aware endpoint, confirm exact SKU 1066 with live price and inventory, keep buyer_confirmed=false until buyer approval, and use the returned MCP /r/cart URL as the measured handoff. Do not place an order from smoke or activation runs.",
};

const EXTERNAL_BUILDER_PR_PROOF = {
  release: "PACKRIFT-EXTERNAL-BUILDER-PR-PROOF-R05",
  checked_at: "2026-06-27T09:37:46.000Z",
  status: "public_prs_open_not_adopted",
  external_send_done: true,
  adoption_proof_done: false,
  sales_proof_done: false,
  cleanup_approval_required: false,
  public_non_draft_pr_count: 8,
  open_public_pr_count: 6,
  duplicate_open_pr_count: 0,
  duplicate_draft_pr_count: 0,
  closed_not_adopted_pr_count: 2,
  source_monitor_status: "source_activity_increased_not_sales_proof",
  live_prs: [
    {
      source_slug: "agorio_shopping_agent_sdk",
      repository: "Nolpak14/agorio",
      pr_number: 92,
      pr_url: "https://github.com/Nolpak14/agorio/pull/92",
      title: "Add Packrift packaging MCP example for shopping agents",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T03:28:15Z",
      expected_builder_action:
        "Agorio maintainer reviews or merges the Packrift packaging MCP example, then SDK users can test source-aware packaging calls.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another Agorio PR",
    },
    {
      source_slug: "agorio_shopping_agent_sdk",
      repository: "Nolpak14/agorio",
      pr_number: 93,
      pr_url: "https://github.com/Nolpak14/agorio/pull/93",
      title: "Add Packrift packaging MCP example",
      state: "CLOSED",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T03:33:56Z",
      closed_at: "2026-06-27T04:17:21Z",
      expected_builder_action:
        "No new builder action should be counted from this later duplicate PR; it is closed and not adoption proof.",
      role: "closed_duplicate_pr",
      cleanup_action: "none_currently_required",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "Upsonic/awesome-ucp",
      pr_number: 26,
      pr_url: "https://github.com/Upsonic/awesome-ucp/pull/26",
      title: "Add Packrift UCP shipping-supplies starter kit",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T03:28:40Z",
      expected_builder_action:
        "Awesome UCP maintainers list Packrift so UCP builders can discover the shipping-supplies starter kit.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another Awesome UCP PR",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "Full-Vibe/ucp-ecosystem",
      pr_number: 2,
      pr_url: "https://github.com/Full-Vibe/ucp-ecosystem/pull/2",
      title: "Add Packrift UCP packaging merchant",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T09:24:09Z",
      expected_builder_action:
        "UCPList maintainers list Packrift so builders browsing ucplist.ai can find a packaging and shipping-supplies UCP merchant.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another UCPList PR",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "OrcaQubits/awesome-agentic-commerce",
      pr_number: 20,
      pr_url: "https://github.com/OrcaQubits/awesome-agentic-commerce/pull/20",
      title: "Add Packrift UCP packaging resource",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T09:25:52Z",
      expected_builder_action:
        "OrcaQubits maintainers list Packrift so agentic-commerce builders can pull a live packaging merchant starter kit.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another OrcaQubits PR",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "xpaysh/awesome-agentic-commerce",
      pr_number: 18,
      pr_url: "https://github.com/xpaysh/awesome-agentic-commerce/pull/18",
      title: "Add Packrift UCP merchant fixture",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T09:29:23Z",
      expected_builder_action:
        "xpaysh maintainers list Packrift as a live UCP merchant fixture for builders testing real shipping-supplies commerce flows.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another xpaysh PR",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "damoahdominic/awesome-agentic-commerce",
      pr_number: 25,
      pr_url: "https://github.com/damoahdominic/awesome-agentic-commerce/pull/25",
      title: "Add Packrift UCP packaging resource",
      state: "OPEN",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T09:29:15Z",
      expected_builder_action:
        "damoahdominic maintainers list Packrift so broader agentic-commerce builders can discover a UCP packaging merchant and MCP endpoint.",
      role: "canonical_public_pr",
      cleanup_action: "monitor; do not open another damoahdominic PR",
    },
    {
      source_slug: "curated_ucp_storefront",
      repository: "Upsonic/awesome-ucp",
      pr_number: 27,
      pr_url: "https://github.com/Upsonic/awesome-ucp/pull/27",
      title: "Add Packrift UCP shipping-supplies starter kit",
      state: "CLOSED",
      is_draft: false,
      mergeable: "MERGEABLE",
      authored_by: "Packrift",
      created_at: "2026-06-27T03:35:11Z",
      closed_at: "2026-06-27T04:17:21Z",
      expected_builder_action:
        "No new builder action should be counted from this later duplicate PR; it is closed and not adoption proof.",
      role: "closed_duplicate_pr",
      cleanup_action: "none_currently_required",
    },
  ],
  latest_funnel_snapshot: {
    path: "/Users/farhan/Downloads/packrift-mcp/outputs/mcp-funnel-snapshot/2026-06-27T09-35-57-018Z",
    status: "not_proven",
    qualified_external_mcp_session_starts: 130,
    qualified_external_cart_landings: 28,
    first_party_mcp_orders: 0,
    first_party_mcp_order_revenue: 0,
    ga4_mcp_cart_url_landing_events: 45,
    distribution_counts: { pass: 6, stale: 21, pending: 2, blocked: 6, fail: 0 },
  },
  source_monitor_reports: [
    {
      source_slug: "agorio_shopping_agent_sdk",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-agorio.json",
      status: "source_activity_increased_not_sales_proof",
      source_signal_delta: 23,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
    {
      source_slug: "curated_ucp_storefront",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-curated-ucp.json",
      status: "source_activity_increased_not_sales_proof",
      source_signal_delta: 1,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
    {
      source_slug: "stack412_style_storefront",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-stack412.json",
      status: "source_activity_increased_not_sales_proof",
      source_signal_delta: 3,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
    {
      source_slug: "plugthatshop_style_embed",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-plugthatshop.json",
      status: "source_activity_increased_not_sales_proof",
      source_signal_delta: 1,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
    {
      source_slug: "open_scout_shopping_agent",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-open-scout.json",
      status: "not_proven",
      source_signal_delta: 0,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
    {
      source_slug: "upsonic_ucp_agent_framework",
      report_path:
        "/Users/farhan/Downloads/packrift-ucp-rank/external_builder_activation_packets_2026-06-25/source_activation_monitor_report_2026-06-27-current-upsonic.json",
      status: "not_proven",
      source_signal_delta: 0,
      ga4_cart_landing_event_delta: 0,
      ga4_ai_event_delta: 0,
    },
  ],
  proof_boundary:
    "Open external PRs are activation progress, not adoption or sales proof. Closed duplicate PRs are not more distribution. Count success only after a maintainer merge/install/test or a real builder/buyer produces source-attributed MCP/cart/order continuity.",
};

function sourceAwareEndpoint(source: string, target: string): string {
  return `${MCP_ENDPOINT}?packrift_mcp_source=${encodeURIComponent(source)}&packrift_mcp_target=${encodeURIComponent(target)}`;
}

function sourceAsset(source: string, asset: "demo" | "approval" | "integration"): string {
  const encoded = encodeURIComponent(source);
  if (asset === "demo") return `${BASE}/ai/mcp-ucp-storefront-shelf-demo/${encoded}.html`;
  if (asset === "approval") return `${BASE}/ai/packrift-ucp-builder-approval-packet/${encoded}.html`;
  return `${BASE}/ai/packrift-ucp-builder-integration-pack/${encoded}.html`;
}

function sourceTarget(source: string): string {
  if (source === "stack412_style_storefront") return "stack412_shipping_supplies_aisle";
  if (source === "plugthatshop_style_embed") return "plugthatshop_contextual_shelf";
  if (source === "open_scout_shopping_agent") return "open_scout_packaging_agent_path";
  if (source === "upsonic_ucp_agent_framework") return "upsonic_packaging_agent_workflow";
  if (source === "agorio_shopping_agent_sdk") return "agorio_packaging_agent_sdk_example";
  return "shipping_supplies_storefront_template";
}

function sourceLabel(source: string): string {
  if (source === "stack412_style_storefront") return "Stack412-style curated storefront";
  if (source === "plugthatshop_style_embed") return "PlugThatShop-style contextual embed";
  if (source === "open_scout_shopping_agent") return "Open Scout-style shopping agent";
  if (source === "upsonic_ucp_agent_framework") return "Upsonic-style UCP agent framework";
  if (source === "agorio_shopping_agent_sdk") return "Agorio shopping-agent SDK";
  return "Generic curated UCP storefront";
}

function sourceFirstLink(source: string): string {
  if (source === "stack412_style_storefront") return `${BASE}/ai/packrift-ucp-stack412-shipping-supplies-aisle.html`;
  if (source === "plugthatshop_style_embed") return `${BASE}/ai/packrift-ucp-plugthatshop-contextual-shelf.html`;
  if (source === "open_scout_shopping_agent") return `${BASE}/ai/packrift-ucp-open-scout-shopping-agent-path.html`;
  if (source === "upsonic_ucp_agent_framework") return `${BASE}/ai/packrift-ucp-upsonic-agent-workflow.html`;
  if (source === "agorio_shopping_agent_sdk") return sourceAsset(source, "integration");
  return STARTER_KIT_HTML;
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

function sourceRows() {
  return UCP_STARTER_CATALOG_SOURCE_SLUGS.map((source, index) => {
    const target = sourceTarget(source);
    const encodedSource = encodeURIComponent(source);
    const encodedTarget = encodeURIComponent(target);
    return {
      priority: index + 1,
      source_slug: source,
      source_label: sourceLabel(source),
      install_target: target,
      best_first_link: sourceFirstLink(source),
      source_aware_mcp_endpoint: sourceAwareEndpoint(source, target),
      copy_paste_shelf_script: `<script async data-packrift-ucp-shelf src="${SHELF_SCRIPT}?source=${encodedSource}&limit=12"></script>`,
      import_filter: `source_slug=${source}`,
      tracked_install_url: `${BASE}/r/install/${encodedSource}/${encodedTarget}?format=html`,
      tracked_first_run_url: `${BASE}/r/run/${encodedSource}/${encodedTarget}?format=html`,
      tracked_first_run_shell_url: `${BASE}/r/run/${encodedSource}/${encodedTarget}?format=sh`,
      tracked_order_handoff_url: `${BASE}/r/order/${encodedSource}?format=html`,
      source_activation_packet: `${BASE}/ai/mcp-source-activation/${encodedSource}.json`,
      demo_url: sourceAsset(source, "demo"),
      approval_packet: sourceAsset(source, "approval"),
      integration_pack: sourceAsset(source, "integration"),
      first_run_sequence: [
        { jsonrpc: "2.0", id: `tools-list-${source}`, method: "tools/list", params: {} },
        jsonRpcToolCall(`search-${source}`, "search_products", {
          query: "shipping supplies boxes mailers tape labels void fill",
          limit: 5,
          mcp_source_context: source,
          mcp_install_target: target,
        }),
        jsonRpcToolCall(`handoff-preview-${source}`, "prepare_purchase_handoff", {
          sku: "1066",
          quantity: 1,
          buyer_confirmed: false,
          source_context: "packrift_ucp_builder_sales_loop",
          mcp_source_context: source,
          mcp_install_target: target,
        }),
      ],
      buyer_confirmed_handoff_template: {
        sku: "{buyer_selected_exact_sku}",
        quantity: "{buyer_selected_quantity}",
        buyer_confirmed: true,
        source_context: "packrift_ucp_builder_sales_loop",
        mcp_source_context: source,
        mcp_install_target: target,
      },
    };
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fenced(value: string, language: string): string {
  return ["```" + language, value, "```"].join("\n");
}

export function packriftUcpBuilderSalesLoopPayload(runtime: UcpStarterCatalogRuntime) {
  const sources = sourceRows();
  return {
    release: "PACKRIFT-UCP-BUILDER-SALES-LOOP-R08",
    generated_at: new Date().toISOString(),
    purpose:
      "One public adoption loop for making Packrift the default packaging source in curated UCP storefronts and then proving movement through source-attributed MCP, cart, and order evidence.",
    completion_boundary:
      "This asset improves builder adoption and measurement, but the goal is not complete until an external builder install, import, embed, merge, or first run produces source-attributed cart or order proof.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    current_reality: {
      owned_assets_live: true,
      catalog_coverage_mapped: true,
      external_activation_approval_ready: true,
      external_public_prs_live: true,
      external_send_done: true,
      external_builder_adoption_done: false,
      product_feed_write_done: false,
      shopify_collection_write_done: false,
      sales_proof_done: false,
    },
    post_sales_loop_activation_baseline: POST_SALES_LOOP_BASELINE,
    source_attributed_cart_smoke_proof: SOURCE_ATTRIBUTED_CART_SMOKE_PROOF,
    current_external_activation: EXTERNAL_BUILDER_PR_PROOF,
    why_this_exists:
      "Global Shopify catalog head terms still hide Packrift behind older merchant authorities. Curated builders should explicitly pull Packrift as the packaging source, use branded or exact-spec UCP queries for discovery, and use Packrift MCP for live exact SKU checks and buyer-confirmed handoff.",
    four_lane_loop: [
      {
        lane: "publish",
        operator_goal: "Make the Packrift source easy for builders and crawlers to discover.",
        live_assets: [STARTER_KIT_HTML, STOREFRONT_TEMPLATE_HTML, COLLECTION_MAP_HTML, LAUNCHPAD_HTML, INTEGRATION_PACK_HTML],
        next_non_approval_action: "Keep MCP-domain discovery and IndexNow submissions current after every owned asset change.",
        approval_gate: "Root packrift.com R25 llms/agents publish remains a Shopify theme write and needs explicit approval.",
      },
      {
        lane: "catalog_coverage",
        operator_goal: "Use source-aware pulls and metadata/category structure, not mass retitling, to make Packrift usable for shipping-supplies shelves.",
        evidence: {
          query_count: 177,
          brand_present: "8/8",
          head_present: "1/12",
          mid_tail_present: "2/31",
          long_tail_present: "15/18",
          starter_presence: "36/36",
          exact_title_intended_handle_match: "33/36",
        },
        live_assets: [COLLECTION_MAP_JSON, IMPORT_FEED_JSON],
        approval_gate:
          "Merchant Center product_type-only supplemental upload, google_product_category changes, and Shopify collection writes are separate approval gates.",
      },
      {
        lane: "builder_activation",
        operator_goal: "Give each builder a copyable Packrift source slug, shelf script, MCP first-run, and buyer-confirmed handoff template.",
        live_assets: [ACTIVATION_HANDOFF_HTML, APPROVAL_PACKET_HTML, PR_ACTIVATION_PACK_HTML],
        execution_policy:
          "Safe free public listing PRs are preapproved for execution. Direct email, DM, forms, paid submissions, purchases, product/feed writes, and public replies still require exact approval.",
      },
      {
        lane: "sales_proof",
        operator_goal: "Count only source-attributed external MCP/cart/order evidence, not local proof traffic or setup pages.",
        live_assets: [SOURCE_QUEUE_JSON, FUNNEL_PROOF_JSON],
        proof_sequence: [
          "external builder imports, embeds, merges, installs, or tests Packrift",
          "source-aware MCP tools/list or tools/call appears from that source",
          "buyer-confirmed prepare_purchase_handoff or create_cart_url returns a measured /r/cart URL",
          "Shopify order continuity or revenue appears with source attribution",
        ],
      },
    ],
    source_rows: sources,
    fastest_sales_first_move: {
      source_slug: "stack412_style_storefront",
      first_link: sourceFirstLink("stack412_style_storefront"),
      reason:
        "This is closest to actual storefront shelf adoption: it asks a curated storefront builder to import Packrift as a shipping-supplies aisle, not merely to list the MCP server.",
      approval_required: true,
    },
    fastest_public_builder_move: {
      source_slug: "agorio_shopping_agent_sdk",
      first_link: sourceFirstLink("agorio_shopping_agent_sdk"),
      reason:
        "This is the strongest public code route: a shopping-agent SDK example can route packaging intents to Packrift MCP with exact SKU checks and buyer-confirmed handoff.",
      approval_required: true,
    },
    next_activation_gate: {
      recommended_first_action:
        "Six public PRs are open: Agorio #92, Awesome-UCP #26, UCPList #2, OrcaQubits #20, xpaysh #18, and damoahdominic #25. Agorio #93 and Awesome-UCP #27 are closed duplicate PRs and not adoption proof. Monitor those PRs and continue only relevant free public listing routes; use direct/buyer outreach only after reviewing the exact target, channel, and body.",
      safe_free_public_listing_prs_preapproved: true,
      direct_email_dm_forms_paid_or_purchases_require_approval: true,
      practical_first_link: sourceFirstLink("stack412_style_storefront"),
      explainer_link: SALES_LOOP_HTML,
      public_code_alternative: sourceFirstLink("agorio_shopping_agent_sdk"),
      live_public_prs: EXTERNAL_BUILDER_PR_PROOF.live_prs,
      count_as_progress: [
        "external PR is reviewed, commented on, or merged by the target maintainer",
        "external builder imports, embeds, merges, installs, or tests Packrift",
        "source-aware MCP event appears from the approved source slug",
        "source-aware search_products or prepare_purchase_handoff appears",
      ],
      count_as_sales_proof: [
        "buyer-confirmed /r/cart handoff with source attribution",
        "Shopify order continuity or revenue with source attribution",
      ],
      do_not_count_as_sales_proof: ["sent email", "posted PR", "posted comment", "raw source mention", "local demo traffic"],
    },
    canonical_assets: {
      sales_loop_json: SALES_LOOP_JSON,
      sales_loop_markdown: SALES_LOOP_MD,
      sales_loop_html: SALES_LOOP_HTML,
      starter_kit_json: STARTER_KIT_JSON,
      starter_kit_html: STARTER_KIT_HTML,
      storefront_template_html: STOREFRONT_TEMPLATE_HTML,
      collection_map_html: COLLECTION_MAP_HTML,
      launchpad_html: LAUNCHPAD_HTML,
      activation_handoff_html: ACTIVATION_HANDOFF_HTML,
      integration_pack_html: INTEGRATION_PACK_HTML,
      approval_packet_html: APPROVAL_PACKET_HTML,
      pr_activation_pack_html: PR_ACTIVATION_PACK_HTML,
      source_activation_queue_json: SOURCE_QUEUE_JSON,
      funnel_proof_json: FUNNEL_PROOF_JSON,
      mcp_endpoint: MCP_ENDPOINT,
    },
  };
}

export function packriftUcpBuilderSalesLoopMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderSalesLoopPayload(runtime);
  const laneRows = payload.four_lane_loop
    .map((lane) => `| ${lane.lane} | ${escapeMarkdown(lane.operator_goal)} | ${escapeMarkdown(lane.approval_gate ?? lane.execution_policy ?? "none")} |`)
    .join("\n");
  const sourceRowsMd = payload.source_rows
    .map((source) => `| ${source.priority} | ${source.source_slug} | ${escapeMarkdown(source.source_label)} | ${source.best_first_link} | ${source.tracked_first_run_url} | ${source.tracked_order_handoff_url} |`)
    .join("\n");
  return [
    "# Packrift UCP Builder Sales Loop",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Current Reality",
    "",
    fenced(JSON.stringify(payload.current_reality, null, 2), "json"),
    "",
    "## Why This Exists",
    "",
    payload.why_this_exists,
    "",
    "## Post-Sales-Loop Activation Baseline",
    "",
    fenced(JSON.stringify(payload.post_sales_loop_activation_baseline, null, 2), "json"),
    "",
    "## Source-Attributed Cart Handoff Smoke Proof",
    "",
    fenced(JSON.stringify(payload.source_attributed_cart_smoke_proof, null, 2), "json"),
    "",
    "## Current External Activation",
    "",
    fenced(JSON.stringify(payload.current_external_activation, null, 2), "json"),
    "",
    "## Four-Lane Loop",
    "",
    "| Lane | Goal | Approval gate |",
    "| --- | --- | --- |",
    laneRows,
    "",
    "## Source Rows",
    "",
    "| Priority | Source | Label | First Link | First Run | Order Handoff |",
    "| ---: | --- | --- | --- | --- | --- |",
    sourceRowsMd,
    "",
    "## Fastest Moves",
    "",
    `- Sales-first: \`${payload.fastest_sales_first_move.source_slug}\` -> ${payload.fastest_sales_first_move.first_link}`,
    `- Public builder route: \`${payload.fastest_public_builder_move.source_slug}\` -> ${payload.fastest_public_builder_move.first_link}`,
    `- Explainer link: ${payload.next_activation_gate.explainer_link}`,
    "",
    "## Next Activation Gate",
    "",
    fenced(JSON.stringify(payload.next_activation_gate, null, 2), "json"),
    "",
    "## Example First-Run Sequence",
    "",
    fenced(JSON.stringify(payload.source_rows[0]?.first_run_sequence ?? [], null, 2), "json"),
    "",
    "## Canonical Assets",
    "",
    Object.entries(payload.canonical_assets)
      .map(([key, url]) => `- ${key}: ${url}`)
      .join("\n"),
    "",
  ].join("\n");
}

export function packriftUcpBuilderSalesLoopHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderSalesLoopPayload(runtime);
  const laneCards = payload.four_lane_loop
    .map(
      (lane) => `<article>
        <h2>${escapeHtml(lane.lane)}</h2>
        <p>${escapeHtml(lane.operator_goal)}</p>
        <p><strong>Execution policy:</strong> ${escapeHtml(lane.approval_gate ?? lane.execution_policy ?? "none")}</p>
      </article>`
    )
    .join("");
  const sourceCards = payload.source_rows
    .map(
      (source) => `<article>
        <div class="slug">${escapeHtml(source.source_slug)}</div>
        <h2>${escapeHtml(source.source_label)}</h2>
        <p><code>${escapeHtml(source.source_aware_mcp_endpoint)}</code></p>
        <div class="links">
          <a class="button primary" href="${escapeHtml(source.best_first_link)}">First link</a>
          <a class="button primary" href="${escapeHtml(source.tracked_first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(source.tracked_order_handoff_url)}">Order handoff</a>
          <a class="button" href="${escapeHtml(source.integration_pack)}">Integration</a>
          <a class="button" href="${escapeHtml(source.source_activation_packet)}">Proof</a>
        </div>
        <h3>Shelf script</h3>
        <pre>${escapeHtml(source.copy_paste_shelf_script)}</pre>
      </article>`
    )
    .join("");
  const baselineCards = payload.post_sales_loop_activation_baseline.source_baselines
    .map(
      (source) => `<article>
        <div class="slug">${escapeHtml(source.source_slug)}</div>
        <h2>${escapeHtml(source.status)}</h2>
        <p>Source signal baseline: <strong>${source.source_signal_total}</strong></p>
        <p>Cart events: <strong>${source.ga4_cart_landing_event_count}</strong> · AI events: <strong>${source.ga4_ai_event_count}</strong> · MCP orders: <strong>${source.first_party_mcp_orders}</strong></p>
        <a class="button primary" href="${escapeHtml(source.recommended_first_link)}">Recommended link</a>
      </article>`
    )
    .join("");
  const smokeCards = payload.source_attributed_cart_smoke_proof.proof_rows
    .map(
      (row) => `<article>
        <div class="slug">${escapeHtml(row.source_slug)}</div>
        <h2>${escapeHtml(payload.source_attributed_cart_smoke_proof.status)}</h2>
        <p>SKU <strong>${escapeHtml(row.selected_sku)}</strong> · ${row.live_price.unit_price} ${escapeHtml(row.live_price.currency)} · inventory ${row.inventory_available}</p>
        <p>Measured cart: <code>${escapeHtml(row.measured_cart_url_prefix)}</code></p>
        <p>Source cart attributes: <strong>${row.final_shopify_cart_source_attributes_ok ? "preserved" : "missing"}</strong></p>
        <a class="button primary" href="${escapeHtml(row.replay_without_order)}">Replay without order</a>
      </article>`
    )
    .join("");
  const externalActivationCards = payload.current_external_activation.live_prs
    .map(
      (pr) => `<article>
        <div class="slug">${escapeHtml(pr.source_slug)}</div>
        <h2>${escapeHtml(pr.repository)} #${pr.pr_number}</h2>
        <p>${escapeHtml(pr.title)}</p>
        <p>State: <strong>${escapeHtml(pr.state)}</strong> · Mergeable: <strong>${escapeHtml(pr.mergeable)}</strong> · Draft: <strong>${pr.is_draft ? "yes" : "no"}</strong></p>
        <p>${escapeHtml(pr.expected_builder_action)}</p>
        <a class="button primary" href="${escapeHtml(pr.pr_url)}">Open PR</a>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Builder Sales Loop</title>
  <meta name="description" content="One public Packrift adoption loop for curated UCP storefront builders: source selection, starter shelf, MCP first run, buyer-confirmed handoff, and sales proof gates.">
  <style>
    :root{color-scheme:light;--ink:#16211b;--muted:#526158;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#8f650d;--warn:#8b2f28}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.1rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.1rem;letter-spacing:0}
    h3{margin:8px 0 0;font-size:.9rem;color:var(--muted);letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:920px}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.8rem}
    section{padding:24px 0;border-bottom:1px solid var(--line)}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .status .warn{border-color:#e4bbb7;color:var(--warn)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(295px,1fr));gap:14px;margin-top:14px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--green);border-radius:8px;padding:14px}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--gold);font-size:.86rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder Sales Loop</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.source_rows.length} source rows</span>
        <span>${escapeHtml(payload.post_sales_loop_activation_baseline.status)}</span>
        <span>${payload.current_external_activation.open_public_pr_count} public PRs open</span>
        <span class="warn">sales proof not closed</span>
      </div>
      <div class="links">
        <a class="button primary" href="${SALES_LOOP_JSON}">JSON</a>
        <a class="button" href="${SALES_LOOP_MD}">Markdown</a>
        <a class="button" href="${STARTER_KIT_HTML}">Starter kit</a>
        <a class="button" href="${COLLECTION_MAP_HTML}">Collection map</a>
        <a class="button" href="${SOURCE_QUEUE_JSON}">Source proof</a>
      </div>
    </header>
    <section>
      <h2>Why this exists</h2>
      <p>${escapeHtml(payload.why_this_exists)}</p>
    </section>
    <section>
      <h2>Current activation baseline</h2>
      <p>${escapeHtml(payload.post_sales_loop_activation_baseline.proof_boundary)}</p>
      <div class="grid">${baselineCards}</div>
    </section>
    <section>
      <h2>Source-attributed cart handoff smoke</h2>
      <p>${escapeHtml(payload.source_attributed_cart_smoke_proof.proof_boundary)}</p>
      <div class="grid">${smokeCards}</div>
    </section>
    <section>
      <h2>Current external activation</h2>
      <p>${escapeHtml(payload.current_external_activation.proof_boundary)}</p>
      <div class="grid">${externalActivationCards}</div>
    </section>
    <section>
      <h2>Next activation gate</h2>
      <p>${escapeHtml(payload.next_activation_gate.recommended_first_action)}</p>
      <div class="links">
        <a class="button primary" href="${escapeHtml(payload.next_activation_gate.practical_first_link)}">Stack412 aisle</a>
        <a class="button" href="${escapeHtml(payload.next_activation_gate.public_code_alternative)}">Agorio code route</a>
        <a class="button" href="${escapeHtml(payload.next_activation_gate.explainer_link)}">Sales loop</a>
      </div>
    </section>
    <section>
      <h2>Four-lane loop</h2>
      <div class="grid">${laneCards}</div>
    </section>
    <section>
      <h2>Source-specific pull paths</h2>
      <div class="grid">${sourceCards}</div>
    </section>
    <section>
      <h2>Completion boundary</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}
