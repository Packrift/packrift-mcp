import { mcpUcpStarterCatalogPayload, UCP_STARTER_CATALOG_SOURCE_SLUGS, type UcpStarterCatalogRuntime } from "./ucp-starter-catalog.js";

const JSON_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json";
const JSONL_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.jsonl";
const CSV_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.csv";
const MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.md";
const HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.html";
const SHELF_JSON_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.json";
const SHELF_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.md";
const SHELF_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf.html";
const SHELF_EMBED_JS_URL = "https://mcp.packrift.com/ai/packrift-ucp-shelf.js";
const SHELF_ADOPTION_JSON_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.json";
const SHELF_ADOPTION_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.md";
const SHELF_ADOPTION_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-adoption.html";
const BUILDER_HANDOFF_JSON_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.json";
const BUILDER_HANDOFF_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.md";
const BUILDER_HANDOFF_HTML_URL = "https://mcp.packrift.com/ai/mcp-ucp-builder-activation-handoff.html";
const BUILDER_LAUNCHPAD_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-launchpad.json";
const BUILDER_LAUNCHPAD_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-launchpad.md";
const BUILDER_LAUNCHPAD_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-launchpad.html";
const BUILDER_APPROVAL_PACKET_BASE_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet";
const BUILDER_APPROVAL_PACKET_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet.json";
const BUILDER_APPROVAL_PACKET_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet.md";
const BUILDER_APPROVAL_PACKET_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-approval-packet.html";
const BUILDER_INTEGRATION_PACK_BASE_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack";
const BUILDER_INTEGRATION_PACK_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack.json";
const BUILDER_INTEGRATION_PACK_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack.md";
const BUILDER_INTEGRATION_PACK_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-integration-pack.html";
const BUILDER_PR_ACTIVATION_PACK_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-pr-activation-pack.json";
const BUILDER_PR_ACTIVATION_PACK_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-pr-activation-pack.md";
const BUILDER_PR_ACTIVATION_PACK_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-pr-activation-pack.html";
const BUILDER_SALES_LOOP_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.json";
const BUILDER_SALES_LOOP_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.md";
const BUILDER_SALES_LOOP_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-builder-sales-loop.html";
const SHIPPING_SUPPLIES_STARTER_KIT_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.json";
const SHIPPING_SUPPLIES_STARTER_KIT_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.md";
const SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-starter-kit.html";
const SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.json";
const SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.md";
const SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-shipping-supplies-storefront-template.html";
const STACK412_SHIPPING_SUPPLIES_AISLE_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-stack412-shipping-supplies-aisle.json";
const STACK412_SHIPPING_SUPPLIES_AISLE_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-stack412-shipping-supplies-aisle.md";
const STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-stack412-shipping-supplies-aisle.html";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-plugthatshop-contextual-shelf.json";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-plugthatshop-contextual-shelf.md";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-plugthatshop-contextual-shelf.html";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-open-scout-shopping-agent-path.json";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-open-scout-shopping-agent-path.md";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-open-scout-shopping-agent-path.html";
const UPSONIC_AGENT_WORKFLOW_JSON_URL = "https://mcp.packrift.com/ai/packrift-ucp-upsonic-agent-workflow.json";
const UPSONIC_AGENT_WORKFLOW_MARKDOWN_URL = "https://mcp.packrift.com/ai/packrift-ucp-upsonic-agent-workflow.md";
const UPSONIC_AGENT_WORKFLOW_HTML_URL = "https://mcp.packrift.com/ai/packrift-ucp-upsonic-agent-workflow.html";
const SHELF_DEMO_BASE_URL = "https://mcp.packrift.com/ai/mcp-ucp-storefront-shelf-demo";
const DEFAULT_TARGET = "generic_streamable_http";
const SHIPPING_SUPPLIES_TEMPLATE_SOURCE = "curated_ucp_storefront";
const SHIPPING_SUPPLIES_TEMPLATE_TARGET = "shipping_supplies_storefront_template";
const SHIPPING_SUPPLIES_TEMPLATE_RELEASE = "PACKRIFT-UCP-SHIPPING-SUPPLIES-STOREFRONT-TEMPLATE-R01";
const STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE = "stack412_style_storefront";
const STACK412_SHIPPING_SUPPLIES_AISLE_TARGET = "stack412_shipping_supplies_aisle";
const STACK412_SHIPPING_SUPPLIES_AISLE_RELEASE = "PACKRIFT-UCP-STACK412-SHIPPING-SUPPLIES-AISLE-R01";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE = "plugthatshop_style_embed";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET = "plugthatshop_contextual_shelf";
const PLUGTHATSHOP_CONTEXTUAL_SHELF_RELEASE = "PACKRIFT-UCP-PLUGTHATSHOP-CONTEXTUAL-SHELF-R01";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE = "open_scout_shopping_agent";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET = "open_scout_packaging_agent_path";
const OPEN_SCOUT_SHOPPING_AGENT_PATH_RELEASE = "PACKRIFT-UCP-OPEN-SCOUT-SHOPPING-AGENT-PATH-R01";
const UPSONIC_AGENT_WORKFLOW_SOURCE = "upsonic_ucp_agent_framework";
const UPSONIC_AGENT_WORKFLOW_TARGET = "upsonic_packaging_agent_workflow";
const UPSONIC_AGENT_WORKFLOW_RELEASE = "PACKRIFT-UCP-UPSONIC-AGENT-WORKFLOW-R01";
const AGORIO_SHOPPING_AGENT_SDK_SOURCE = "agorio_shopping_agent_sdk";
const SHIPPING_SUPPLIES_STARTER_KIT_RELEASE = "PACKRIFT-UCP-SHIPPING-SUPPLIES-STARTER-KIT-R01";
const BUILDER_PR_ACTIVATION_PACK_RELEASE = "PACKRIFT-UCP-BUILDER-PR-ACTIVATION-PACK-R15";
const BUILDER_APPROVAL_PACKET_RELEASE = "PACKRIFT-UCP-BUILDER-APPROVAL-PACKET-R04";

const BUILDER_PR_POST_SALES_LOOP_BASELINE = {
  captured_at: "2026-06-27T02:43:18.349Z",
  status: "not_proven",
  baseline_name: "post_sales_loop_pre_external_action",
  baseline_sources: [
    {
      source_slug: "stack412_style_storefront",
      source_signal_total: 1,
      ga4_cart_landing_event_count: 0,
      ga4_ai_event_count: 0,
      first_party_mcp_orders: 0,
      first_party_mcp_order_revenue: 0,
    },
    {
      source_slug: "agorio_shopping_agent_sdk",
      source_signal_total: 0,
      ga4_cart_landing_event_count: 0,
      ga4_ai_event_count: 0,
      first_party_mcp_orders: 0,
      first_party_mcp_order_revenue: 0,
    },
  ],
  global_funnel_baseline: {
    qualified_external_mcp_session_starts: 130,
    qualified_external_cart_landings: 28,
    first_party_mcp_orders: 0,
    first_party_mcp_order_revenue: 0,
  },
  measurement_rule:
    "Use this as the no-send baseline for actions approved after the builder sales-loop launch. Source-signal deltas trigger follow-up, but only source-attributed cart/order continuity is sales proof.",
};

const SOURCE_ATTRIBUTED_CART_SMOKE_PROOF = {
  release: "PACKRIFT-SOURCE-ATTRIBUTED-CART-HANDOFF-SMOKE-R01",
  status: "pass",
  mode: "synthetic_no_order_readiness_check",
  no_order_created: true,
  proof_boundary:
    "This proves source-preserving cart handoff readiness only. External adoption and sales proof still require a real external builder or buyer to use the source-aware endpoint and produce source-attributed cart/order continuity.",
  proof_rows: [
    {
      source_slug: "stack412_style_storefront",
      install_target: DEFAULT_TARGET,
      checked_at: "2026-06-27T03:24:03.399Z",
      endpoint: "https://mcp.packrift.com/mcp?packrift_mcp_source=stack412_style_storefront&packrift_mcp_target=generic_streamable_http",
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      tool_count: 16,
      live_price: { unit_price: 14, currency: "USD" },
      inventory_available: 500,
      measured_cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
      cart_landing_shim: "PACKRIFT-MCP-CART-LANDING-SHIM-R02",
      prepare_purchase_handoff_confirmed_cart: true,
      cart_url_source_attribution_ok: true,
      final_shopify_cart_source_attributes_ok: true,
      replay_without_order: "https://mcp.packrift.com/r/run/stack412_style_storefront/generic_streamable_http?format=html",
    },
    {
      source_slug: "agorio_shopping_agent_sdk",
      install_target: DEFAULT_TARGET,
      checked_at: "2026-06-27T03:24:08.184Z",
      endpoint: "https://mcp.packrift.com/mcp?packrift_mcp_source=agorio_shopping_agent_sdk&packrift_mcp_target=generic_streamable_http",
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      tool_count: 16,
      live_price: { unit_price: 14, currency: "USD" },
      inventory_available: 500,
      measured_cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
      cart_landing_shim: "PACKRIFT-MCP-CART-LANDING-SHIM-R02",
      prepare_purchase_handoff_confirmed_cart: true,
      cart_url_source_attribution_ok: true,
      final_shopify_cart_source_attributes_ok: true,
      replay_without_order: "https://mcp.packrift.com/r/run/agorio_shopping_agent_sdk/generic_streamable_http?format=html",
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

type StarterPayload = ReturnType<typeof mcpUcpStarterCatalogPayload>;
type StarterBundle = StarterPayload["bundles"][number];
type StarterItem = StarterBundle["items"][number];
type SourcePlaybook = StarterPayload["source_playbooks"][number];

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

function csvCell(value: unknown): string {
  const text = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function fenced(value: string, language: string): string {
  return ["```" + language, value, "```"].join("\n");
}

function sourceLabel(source: string): string {
  if (source === "stack412_style_storefront") return "Stack412-style storefront";
  if (source === "plugthatshop_style_embed") return "PlugThatShop-style embed";
  if (source === "open_scout_shopping_agent") return "Open Scout-style shopping agent";
  if (source === "upsonic_ucp_agent_framework") return "Upsonic-style UCP agent framework";
  if (source === "agorio_shopping_agent_sdk") return "Agorio shopping-agent SDK";
  return "Curated UCP storefront";
}

function sourceShelfLabel(source: string): string {
  if (source === "stack412_style_storefront") return "Packaging and fulfillment supplies";
  if (source === "plugthatshop_style_embed") return "Packrift shipping and packing supplies";
  if (source === "open_scout_shopping_agent") return "Packrift packaging agent path";
  if (source === "upsonic_ucp_agent_framework") return "Packrift agent workflow supplies";
  if (source === "agorio_shopping_agent_sdk") return "Packrift packaging SDK route";
  return "Shipping supplies by Packrift";
}

function sourcePlacementContext(source: string): string {
  if (source === "stack412_style_storefront") return "shipping supplies aisle for an automated category storefront";
  if (source === "plugthatshop_style_embed") return "contextual packaging upsell for ecommerce, fulfillment, logistics, moving, or small business content";
  if (source === "open_scout_shopping_agent") return "shopping-agent answer path for exact-spec packaging requests with live MCP checks and measured cart handoff";
  if (source === "upsonic_ucp_agent_framework") return "multi-agent UCP commerce workflow for packaging discovery, filtering, live checks, and cart-ready handoff";
  if (source === "agorio_shopping_agent_sdk") return "AI commerce SDK example route for packaging, procurement, and exact-spec shopping-agent tasks";
  return "default packaging shelf for ecommerce shipping, warehouse, fulfillment, moving, or packing-station storefronts";
}

function sourceAwareShelfEmbedJsUrl(source: string, limit = 12): string {
  const url = new URL(SHELF_EMBED_JS_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

function sourceAwareShelfDemoUrl(source: string): string {
  return `${SHELF_DEMO_BASE_URL}/${encodeURIComponent(source)}.html`;
}

function sourceAwareBuilderLaunchpadUrl(source: string): string {
  return `${BUILDER_LAUNCHPAD_HTML_URL}#${encodeURIComponent(source)}`;
}

function sourceAwareApprovalPacketUrl(source: string, format: "json" | "md" | "html" = "html"): string {
  return `${BUILDER_APPROVAL_PACKET_BASE_URL}/${encodeURIComponent(source)}.${format}`;
}

function sourceAwareIntegrationPackUrl(source: string, format: "json" | "md" | "html" = "html"): string {
  return `${BUILDER_INTEGRATION_PACK_BASE_URL}/${encodeURIComponent(source)}.${format}`;
}

function sourceAwareMcpEndpoint(source: string, target = DEFAULT_TARGET): string {
  const url = new URL("https://mcp.packrift.com/mcp");
  url.searchParams.set("packrift_mcp_source", source);
  url.searchParams.set("packrift_mcp_target", target);
  return url.toString();
}

function explicitShelfEmbedSnippet(source: string, limit = 12): string {
  return `<div data-packrift-ucp-shelf data-source="${source}" data-limit="${limit}"></div>\n<script async src="${sourceAwareShelfEmbedJsUrl(source, limit)}"></script>`;
}

function oneLineShelfScriptSnippet(source: string, limit = 12): string {
  return `<script async data-packrift-ucp-shelf src="${sourceAwareShelfEmbedJsUrl(source, limit)}"></script>`;
}

function shippingSuppliesStorefrontTemplateHtmlDocument(): string {
  const source = SHIPPING_SUPPLIES_TEMPLATE_SOURCE;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shipping Supplies Storefront by Packrift</title>
  <meta name="description" content="Copy-ready UCP shipping-supplies storefront template using Packrift as the source-aware packaging catalog.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#52645a;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#9b6a16}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:28px 16px 52px}
    header{display:grid;gap:14px;padding:22px 0 24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.2rem,6vw,4.5rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.15rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:820px}
    .actions,.chips{display:flex;flex-wrap:wrap;gap:8px}
    .chips span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:22px 0;border-bottom:1px solid var(--line)}
    .route-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px}
    .route{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;display:grid;gap:6px}
    .route strong{font-size:1rem}
    .route span{color:var(--muted);font-size:.92rem}
    .packrift-template-note{font-size:.86rem;color:var(--muted);margin-top:10px}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Shipping supplies</h1>
      <p>Boxes, mailers, tape, labels, packing-list envelopes, stretch film, void fill, and fulfillment supplies from Packrift's UCP-native packaging catalog.</p>
      <div class="chips">
        <span>${SHIPPING_SUPPLIES_TEMPLATE_RELEASE}</span>
        <span>source=${source}</span>
        <span>target=${SHIPPING_SUPPLIES_TEMPLATE_TARGET}</span>
        <span>buyer-confirmed cart handoff only</span>
      </div>
      <div class="actions">
        <a class="button" href="${SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL}">Template JSON</a>
        <a class="button" href="${SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_MARKDOWN_URL}">Markdown</a>
        <a class="button primary" href="https://mcp.packrift.com/r/run/${source}/${SHIPPING_SUPPLIES_TEMPLATE_TARGET}?format=html">Run live MCP check</a>
        <a class="button" href="https://mcp.packrift.com/r/order/${source}?format=html">Buyer-confirmed order handoff</a>
        <a class="button" href="${BUILDER_INTEGRATION_PACK_HTML_URL}">Builder integration pack</a>
      </div>
    </header>
    <section aria-label="Packrift shelf">
      <div data-packrift-ucp-shelf data-source="${source}" data-limit="12"></div>
      <script async src="${sourceAwareShelfEmbedJsUrl(source, 12)}"></script>
      <p class="packrift-template-note">This storefront template is designed for UCP and agentic storefront builders. Keep the source and target values intact so Packrift can measure external installs, MCP first runs, cart handoffs, and orders.</p>
    </section>
    <section aria-label="Intent routes">
      <h2>Packaging intents to route to Packrift</h2>
      <div class="route-grid">
        <div class="route"><strong>Shipping boxes</strong><span>Corrugated cartons by dimensions, strength, style, and pack count.</span></div>
        <div class="route"><strong>Mailers</strong><span>Poly, bubble, stay-flat, rigid, and apparel shipping mailers.</span></div>
        <div class="route"><strong>Tape and labels</strong><span>Carton sealing tape, dispensers, direct thermal labels, and label protection.</span></div>
        <div class="route"><strong>Warehouse supplies</strong><span>Stretch film, packing-list envelopes, tags, strapping, and void fill.</span></div>
        <div class="route"><strong>Pallet protection</strong><span>Pallet covers, stretch wrap, and edge protectors for warehouse load protection.</span></div>
        <div class="route"><strong>Cold-chain shipping</strong><span>Cold packs plus supporting boxes, tape, and document-envelope workflows.</span></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function integrationProtocolRequest(id: string, method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

function integrationToolCall(id: string, name: string, args: Record<string, unknown>) {
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

function bundlePrimaryQuery(bundle: StarterBundle): string {
  return bundle.ucp_queries[0] || "Packrift shipping supplies";
}

function sourcePlaybookBySource(payload: StarterPayload): Map<string, SourcePlaybook> {
  return new Map(payload.source_playbooks.map((playbook) => [playbook.source, playbook]));
}

function storefrontImportRows(payload: StarterPayload) {
  const playbooks = sourcePlaybookBySource(payload);
  const rows = [];
  for (const source of payload.starter_catalog_summary.source_slugs) {
    const playbook = playbooks.get(source);
    for (const bundle of payload.bundles) {
      for (const item of bundle.items) {
        rows.push({
          source_slug: source,
          source_label: sourceLabel(source),
          shelf_label: sourceShelfLabel(source),
          placement_context: sourcePlacementContext(source),
          bundle_id: bundle.id,
          bundle_title: bundle.title,
          storefront_intent: bundle.storefront_intent,
          primary_ucp_query: bundlePrimaryQuery(bundle),
          exact_ucp_queries: item.global_ucp_queries,
          sku: item.sku,
          title: item.title,
          family: item.family,
          handle: item.handle,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_url: item.product_url,
          mcp_sku_json: item.mcp_sku_json,
          mcp_sku_markdown: item.mcp_sku_markdown,
          mcp_endpoint: playbook?.endpoint || "https://mcp.packrift.com/mcp",
          tracked_start_url: playbook?.tracked_start_url || `https://mcp.packrift.com/r/start/${source}`,
          tracked_install_url: playbook?.tracked_install_url || `https://mcp.packrift.com/r/install/${source}/${DEFAULT_TARGET}?format=html`,
          tracked_first_run_url: playbook?.tracked_first_run_url || `https://mcp.packrift.com/r/run/${source}/${DEFAULT_TARGET}?format=html`,
          tracked_order_handoff_url: playbook?.tracked_order_handoff_url || `https://mcp.packrift.com/r/order/${source}?format=html`,
          source_activation_json: playbook?.source_activation_json || `https://mcp.packrift.com/ai/mcp-source-activation/${source}.json`,
          eval_pack_json: playbook?.eval_pack_json || `https://mcp.packrift.com/ai/mcp-eval-pack.json?source=${source}`,
          prepare_purchase_handoff_unconfirmed: {
            ...item.mcp_prepare_purchase_handoff_unconfirmed,
            mcp_source_context: source,
            mcp_install_target: DEFAULT_TARGET,
          },
          prepare_purchase_handoff_confirmed_template: {
            ...item.mcp_prepare_purchase_handoff_confirmed_template,
            mcp_source_context: source,
            mcp_install_target: DEFAULT_TARGET,
          },
        });
      }
    }
  }
  return rows;
}

export function mcpUcpStorefrontImportPayload(runtime: UcpStarterCatalogRuntime) {
  const starter = mcpUcpStarterCatalogPayload(runtime);
  const rows = storefrontImportRows(starter);
  return {
    release: "PACKRIFT-MCP-UCP-STOREFRONT-IMPORT-R03",
    generated_at: new Date().toISOString(),
    purpose:
      "Flat import feed for UCP storefront builders that want to add Packrift as a packaging, shipping-supplies, fulfillment, or contextual upsell shelf without manually unpacking the starter catalog.",
    source: {
      starter_catalog: starter.proof_urls.starter_catalog_json,
      builder_kit: "https://mcp.packrift.com/ai/mcp-ucp-builder-kit.json",
      canonical_mcp_endpoint: starter.canonical_endpoint,
      global_ucp_business: starter.global_ucp_business,
    },
    row_count: rows.length,
    unique_sku_count: starter.starter_catalog_summary.unique_sku_count,
    source_slug_count: starter.starter_catalog_summary.source_slugs.length,
    source_slugs: starter.starter_catalog_summary.source_slugs,
    bundle_count: starter.starter_catalog_summary.bundle_count,
    formats: {
      json: JSON_URL,
      jsonl: JSONL_URL,
      csv: CSV_URL,
      markdown: MARKDOWN_URL,
      html: HTML_URL,
    },
    activation_assets: {
      shelf_json: SHELF_JSON_URL,
      shelf_markdown: SHELF_MARKDOWN_URL,
      shelf_html: SHELF_HTML_URL,
      embed_js: SHELF_EMBED_JS_URL,
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_markdown: SHELF_ADOPTION_MARKDOWN_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
      shelf_demo_template: `${SHELF_DEMO_BASE_URL}/{source}.html`,
    },
    import_rules: [
      "Render one shelf per source_slug or pick the source_slug matching the host context.",
      "Use primary_ucp_query and exact_ucp_queries to seed Shopify Global Catalog discovery.",
      "Use mcp_sku_json or mcp_sku_markdown for crawler-safe exact product facts.",
      "Use prepare_purchase_handoff_unconfirmed for proof and live checks before presenting any cart handoff.",
      "Use prepare_purchase_handoff_confirmed_template only after the buyer confirms exact SKU and quantity.",
      "Preserve source_slug as mcp_source_context in all MCP calls so starts, first runs, cart handoffs, and orders can be attributed.",
    ],
    rows,
  };
}

export function mcpUcpStorefrontImportJsonl(runtime: UcpStarterCatalogRuntime): string {
  return mcpUcpStorefrontImportPayload(runtime).rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

export function mcpUcpStorefrontImportCsv(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontImportPayload(runtime);
  const fields = [
    "source_slug",
    "source_label",
    "shelf_label",
    "placement_context",
    "bundle_id",
    "bundle_title",
    "storefront_intent",
    "primary_ucp_query",
    "exact_ucp_queries",
    "sku",
    "title",
    "family",
    "handle",
    "product_url",
    "mcp_sku_json",
    "mcp_endpoint",
    "tracked_start_url",
    "tracked_install_url",
    "tracked_first_run_url",
    "tracked_order_handoff_url",
    "source_activation_json",
    "prepare_purchase_handoff_unconfirmed",
    "prepare_purchase_handoff_confirmed_template",
  ];
  return [fields.join(","), ...payload.rows.map((row) => fields.map((field) => csvCell(row[field as keyof typeof row])).join(","))].join("\n") + "\n";
}

export function mcpUcpStorefrontShelfPayload(runtime: UcpStarterCatalogRuntime) {
  const payload = mcpUcpStorefrontImportPayload(runtime);
  const shelves = payload.source_slugs.map((source) => {
    const rows = payload.rows.filter((row) => row.source_slug === source);
    const first = rows[0];
    const bundles = Array.from(new Set(rows.map((row) => row.bundle_id))).map((bundleId) => {
      const bundleRows = rows.filter((row) => row.bundle_id === bundleId);
      const bundleFirst = bundleRows[0];
      return {
        bundle_id: bundleId,
        bundle_title: bundleFirst?.bundle_title ?? bundleId,
        storefront_intent: bundleFirst?.storefront_intent ?? "",
        primary_ucp_query: bundleFirst?.primary_ucp_query ?? "Packrift shipping supplies",
        items: bundleRows.map((row) => ({
          sku: row.sku,
          title: row.title,
          family: row.family,
          handle: row.handle,
          product_url: row.product_url,
          mcp_sku_json: row.mcp_sku_json,
          mcp_sku_markdown: row.mcp_sku_markdown,
          order_handoff_url: row.tracked_order_handoff_url,
          live_check_tool_call: row.prepare_purchase_handoff_unconfirmed,
        })),
      };
    });
    return {
      source_slug: source,
      source_label: first?.source_label ?? sourceLabel(source),
      shelf_label: first?.shelf_label ?? sourceShelfLabel(source),
      placement_context: first?.placement_context ?? sourcePlacementContext(source),
      row_count: rows.length,
      tracked_start_url: first?.tracked_start_url ?? `https://mcp.packrift.com/r/start/${source}`,
      tracked_install_url: first?.tracked_install_url ?? `https://mcp.packrift.com/r/install/${source}/${DEFAULT_TARGET}?format=html`,
      tracked_first_run_url: first?.tracked_first_run_url ?? `https://mcp.packrift.com/r/run/${source}/${DEFAULT_TARGET}?format=html`,
      tracked_order_handoff_url: first?.tracked_order_handoff_url ?? `https://mcp.packrift.com/r/order/${source}?format=html`,
      source_activation_json: first?.source_activation_json ?? `https://mcp.packrift.com/ai/mcp-source-activation/${source}.json`,
      source_aware_embed_js_url: sourceAwareShelfEmbedJsUrl(source),
      demo_url: sourceAwareShelfDemoUrl(source),
      embed_snippet: explicitShelfEmbedSnippet(source),
      one_line_script_snippet: oneLineShelfScriptSnippet(source),
      bundles,
    };
  });
  return {
    release: "PACKRIFT-MCP-UCP-STOREFRONT-SHELF-R03",
    generated_at: payload.generated_at,
    purpose:
      "Copy-paste Packrift storefront shelf payload and JavaScript renderer for UCP storefront builders that want a live packaging shelf without building their own importer first.",
    source: {
      import_feed: JSON_URL,
      starter_catalog: payload.source.starter_catalog,
      builder_kit: payload.source.builder_kit,
      canonical_mcp_endpoint: payload.source.canonical_mcp_endpoint,
    },
    default_embed_snippet: explicitShelfEmbedSnippet("curated_ucp_storefront"),
    default_one_line_script_snippet: oneLineShelfScriptSnippet("curated_ucp_storefront"),
    embed_contract: {
      script_url: SHELF_EMBED_JS_URL,
      source_aware_script_template: `${SHELF_EMBED_JS_URL}?source={source}&limit=12`,
      container_selector: "[data-packrift-ucp-shelf]",
      data_attributes: {
        "data-source": payload.source_slugs,
        "data-bundle": "Optional bundle id, such as ecommerce_shipping_starter or fragile_item_shipping.",
        "data-limit": "Optional maximum product cards to render. Default 12.",
      },
      script_query_parameters: {
        source: "Optional source slug used when a container does not set data-source. Preserve this for attribution.",
        bundle: "Optional bundle id used when a container does not set data-bundle.",
        limit: "Optional maximum product cards used when a container does not set data-limit.",
        title: "Optional shelf title used when a container does not set data-title.",
      },
      one_line_script:
        "If a builder adds data-packrift-ucp-shelf to the script tag, the script creates the shelf container itself and still preserves the source query parameter.",
      order_policy:
        "The shelf links to Packrift product records and source-aware order handoff pages only. Use Packrift MCP live checks before showing a cart URL.",
    },
    row_count: payload.row_count,
    unique_sku_count: payload.unique_sku_count,
    source_slug_count: payload.source_slug_count,
    source_slugs: payload.source_slugs,
    formats: {
      json: SHELF_JSON_URL,
      markdown: SHELF_MARKDOWN_URL,
      html: SHELF_HTML_URL,
      embed_js: SHELF_EMBED_JS_URL,
      import_json: JSON_URL,
      import_csv: CSV_URL,
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_markdown: SHELF_ADOPTION_MARKDOWN_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
    },
    shelves,
  };
}

export function mcpUcpStorefrontShelfMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontShelfPayload(runtime);
  const sourceRows = payload.shelves
    .map(
      (shelf) =>
        `| ${shelf.source_slug} | ${escapeMarkdown(shelf.shelf_label)} | ${shelf.row_count} | ${shelf.tracked_first_run_url} | ${shelf.tracked_order_handoff_url} |`
    )
    .join("\n");
  return [
    "# Packrift UCP Storefront Shelf",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    "## Copy-Paste Embed",
    "",
    fenced(payload.default_embed_snippet, "html"),
    "",
    "## One-Line Script Option",
    "",
    fenced(payload.default_one_line_script_snippet, "html"),
    "",
    "## Formats",
    "",
    Object.entries(payload.formats)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Source-Aware Shelves",
    "",
    "| Source | Shelf | Rows | First Run | Order Handoff |",
    "| --- | --- | ---: | --- | --- |",
    sourceRows,
    "",
    "## Rules",
    "",
    "- Preserve `data-source` and `mcp_source_context` so Packrift can attribute starts, first runs, cart handoffs, and orders.",
    "- For the lowest-friction embed, use the source-aware script URL query parameter or the one-line script option.",
    "- Link buyers to product pages, SKU resources, or source-aware order handoff pages from the shelf.",
    "- Use Packrift MCP live checks before presenting a cart URL.",
    "",
  ].join("\n");
}

function compactShelfData(runtime: UcpStarterCatalogRuntime) {
  return mcpUcpStorefrontShelfPayload(runtime).shelves.map((shelf) => ({
    source_slug: shelf.source_slug,
    shelf_label: shelf.shelf_label,
    placement_context: shelf.placement_context,
    tracked_order_handoff_url: shelf.tracked_order_handoff_url,
    bundles: shelf.bundles.map((bundle) => ({
      bundle_id: bundle.bundle_id,
      bundle_title: bundle.bundle_title,
      primary_ucp_query: bundle.primary_ucp_query,
      items: bundle.items.map((item) => ({
        sku: item.sku,
        title: item.title,
        family: item.family,
        product_url: item.product_url,
        mcp_sku_json: item.mcp_sku_json,
        order_handoff_url: item.order_handoff_url,
      })),
    })),
  }));
}

export function mcpUcpStorefrontShelfEmbedJs(runtime: UcpStarterCatalogRuntime): string {
  const data = compactShelfData(runtime);
  return `(() => {
  const SHELVES = ${JSON.stringify(data)};
  const STYLE_ID = "packrift-ucp-shelf-style";
  const DEFAULT_SOURCE = "curated_ucp_storefront";

  function currentScriptConfig() {
    const script = document.currentScript || Array.from(document.scripts).find((entry) => (entry.src || "").includes("packrift-ucp-shelf.js"));
    const config = { script, source: "", bundle: "", limit: "", title: "", auto: false };
    if (!script) return config;
    config.auto = script.hasAttribute("data-packrift-ucp-shelf") || script.getAttribute("data-auto") === "1";
    config.source = script.getAttribute("data-source") || "";
    config.bundle = script.getAttribute("data-bundle") || "";
    config.limit = script.getAttribute("data-limit") || "";
    config.title = script.getAttribute("data-title") || "";
    try {
      const params = new URL(script.src).searchParams;
      config.source = config.source || params.get("source") || "";
      config.bundle = config.bundle || params.get("bundle") || "";
      config.limit = config.limit || params.get("limit") || "";
      config.title = config.title || params.get("title") || "";
    } catch {}
    return config;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = ".packrift-ucp-shelf{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#17211b;border:1px solid #d9dfda;border-radius:8px;background:#fff;padding:16px;line-height:1.45}.packrift-ucp-shelf__head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:10px;border-bottom:1px solid #d9dfda;padding-bottom:12px;margin-bottom:12px}.packrift-ucp-shelf h2{font-size:1.15rem;margin:0;letter-spacing:0}.packrift-ucp-shelf p{margin:.25rem 0 0;color:#58685f}.packrift-ucp-shelf__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.packrift-ucp-shelf__item{border:1px solid #d9dfda;border-radius:8px;padding:11px;background:#f7f8f4;display:grid;gap:8px}.packrift-ucp-shelf__sku{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;color:#58685f}.packrift-ucp-shelf__title{font-weight:700}.packrift-ucp-shelf__links{display:flex;flex-wrap:wrap;gap:8px}.packrift-ucp-shelf a{color:#245f9b;text-decoration-thickness:1px;text-underline-offset:3px}.packrift-ucp-shelf__button{display:inline-flex;align-items:center;min-height:34px;border:1px solid #17211b;border-radius:6px;padding:6px 9px;text-decoration:none;color:#17211b;background:#fff;font-weight:650}.packrift-ucp-shelf__button--primary{background:#116149;border-color:#116149;color:#fff}.packrift-ucp-shelf__empty{color:#8b2f28}";
    document.head.appendChild(style);
  }

  function text(parent, tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value;
    parent.appendChild(el);
    return el;
  }

  function link(parent, label, href, className) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    if (className) a.className = className;
    parent.appendChild(a);
    return a;
  }

  function flattenItems(shelf, bundleId) {
    return shelf.bundles
      .filter((bundle) => !bundleId || bundle.bundle_id === bundleId)
      .flatMap((bundle) => bundle.items.map((item) => ({ ...item, bundle_title: bundle.bundle_title })));
  }

  function ensureAutoContainer(config) {
    if (!config.auto || !config.script || document.querySelector("[data-packrift-ucp-shelf]:not(script)")) return;
    const container = document.createElement("div");
    container.setAttribute("data-packrift-ucp-shelf", "");
    if (config.source) container.setAttribute("data-source", config.source);
    if (config.bundle) container.setAttribute("data-bundle", config.bundle);
    if (config.limit) container.setAttribute("data-limit", config.limit);
    if (config.title) container.setAttribute("data-title", config.title);
    config.script.parentNode.insertBefore(container, config.script);
  }

  function render(container, defaults) {
    ensureStyle();
    const source = container.getAttribute("data-source") || defaults.source || DEFAULT_SOURCE;
    const bundleId = container.getAttribute("data-bundle") || defaults.bundle || "";
    const limit = Number.parseInt(container.getAttribute("data-limit") || defaults.limit || "12", 10);
    const maxItems = Number.isFinite(limit) && limit > 0 ? limit : 12;
    const shelf = SHELVES.find((entry) => entry.source_slug === source) || SHELVES[0];
    const items = flattenItems(shelf, bundleId).slice(0, maxItems);
    container.innerHTML = "";
    const root = document.createElement("section");
    root.className = "packrift-ucp-shelf";
    const head = document.createElement("div");
    head.className = "packrift-ucp-shelf__head";
    const titleBlock = document.createElement("div");
    text(titleBlock, "h2", "", container.getAttribute("data-title") || defaults.title || shelf.shelf_label);
    text(titleBlock, "p", "", shelf.placement_context);
    head.appendChild(titleBlock);
    link(head, "Packrift order handoff", shelf.tracked_order_handoff_url, "packrift-ucp-shelf__button packrift-ucp-shelf__button--primary");
    root.appendChild(head);
    if (!items.length) {
      text(root, "p", "packrift-ucp-shelf__empty", "No Packrift shelf rows matched this source and bundle.");
      container.appendChild(root);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "packrift-ucp-shelf__grid";
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "packrift-ucp-shelf__item";
      text(card, "div", "packrift-ucp-shelf__sku", item.sku + " · " + item.family);
      text(card, "div", "packrift-ucp-shelf__title", item.title);
      text(card, "div", "", item.bundle_title);
      const links = document.createElement("div");
      links.className = "packrift-ucp-shelf__links";
      link(links, "Product", item.product_url, "packrift-ucp-shelf__button packrift-ucp-shelf__button--primary");
      link(links, "SKU JSON", item.mcp_sku_json, "packrift-ucp-shelf__button");
      link(links, "Order handoff", item.order_handoff_url, "packrift-ucp-shelf__button");
      card.appendChild(links);
      grid.appendChild(card);
    }
    root.appendChild(grid);
    container.appendChild(root);
  }

  function renderAll() {
    const defaults = currentScriptConfig();
    ensureAutoContainer(defaults);
    document.querySelectorAll("[data-packrift-ucp-shelf]:not(script)").forEach((container) => render(container, defaults));
  }

  window.PackriftUcpShelf = { renderAll, data: SHELVES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderAll);
  else renderAll();
})();`;
}

export function mcpUcpStorefrontShelfHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontShelfPayload(runtime);
  const sourceSections = payload.shelves
    .map((shelf) => {
      const sampleItems = shelf.bundles
        .flatMap((bundle) => bundle.items.map((item) => ({ ...item, bundle_title: bundle.bundle_title })))
        .slice(0, 8)
        .map(
          (item) => `<article>
            <div class="sku">${escapeHtml(item.sku)} · ${escapeHtml(item.family)}</div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.bundle_title)}</p>
            <div class="links">
              <a class="button primary" href="${escapeHtml(item.product_url)}">Product</a>
              <a class="button" href="${escapeHtml(item.mcp_sku_json)}">SKU JSON</a>
              <a class="button" href="${escapeHtml(item.order_handoff_url)}">Order handoff</a>
            </div>
          </article>`
        )
        .join("");
      return `<section>
        <h2>${escapeHtml(shelf.shelf_label)}</h2>
        <p>${escapeHtml(shelf.placement_context)}</p>
        <div class="status">
          <span>${escapeHtml(shelf.source_slug)}</span>
          <span>${shelf.row_count} rows</span>
          <span>${shelf.bundles.length} bundles</span>
        </div>
        <pre>${escapeHtml(shelf.embed_snippet)}</pre>
        <div class="grid">${sampleItems}</div>
      </section>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Storefront Shelf</title>
  <meta name="description" content="Copy-paste Packrift shelf renderer for UCP storefront builders adding packaging products.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:30px 0 8px;font-size:1.25rem;letter-spacing:0}
    h3{margin:0;font-size:1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:14px}
    article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:13px;display:grid;gap:8px}
    .sku{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;color:var(--muted)}
    .button{display:inline-flex;align-items:center;min-height:34px;border:1px solid var(--ink);border-radius:6px;padding:6px 9px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px;color:var(--ink);font-size:.84rem;margin:12px 0 0}
    @media (max-width:760px){.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Storefront Shelf</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${payload.row_count} rows</span>
        <span>${payload.unique_sku_count} unique SKUs</span>
        <span>${payload.source_slug_count} source slugs</span>
      </div>
      <div class="links">
        <a class="button primary" href="${SHELF_EMBED_JS_URL}">Embed JS</a>
        <a class="button" href="${SHELF_JSON_URL}">JSON</a>
        <a class="button" href="${CSV_URL}">CSV import</a>
      </div>
      <pre>${escapeHtml(payload.default_embed_snippet)}</pre>
    </header>
    ${sourceSections}
  </main>
</body>
</html>`;
}

export function mcpUcpStorefrontShelfAdoptionPayload(runtime: UcpStarterCatalogRuntime) {
  const shelf = mcpUcpStorefrontShelfPayload(runtime);
  const sourceAdoption = shelf.shelves.map((entry) => ({
    source_slug: entry.source_slug,
    source_label: entry.source_label,
    shelf_label: entry.shelf_label,
    row_count: entry.row_count,
    demo_url: entry.demo_url,
    source_aware_embed_js_url: entry.source_aware_embed_js_url,
    explicit_embed_snippet: entry.embed_snippet,
    one_line_script_snippet: entry.one_line_script_snippet,
    tracked_start_url: entry.tracked_start_url,
    tracked_install_url: entry.tracked_install_url,
    tracked_first_run_url: entry.tracked_first_run_url,
    tracked_order_handoff_url: entry.tracked_order_handoff_url,
    source_activation_json: entry.source_activation_json,
  }));
  return {
    release: "PACKRIFT-MCP-UCP-STOREFRONT-ADOPTION-R03",
    generated_at: shelf.generated_at,
    purpose:
      "Source-aware adoption kit for storefront builders that want to add Packrift packaging shelves quickly while preserving attribution into MCP starts, first runs, cart handoffs, and buyer-approved orders.",
    assets: {
      shelf_json: SHELF_JSON_URL,
      shelf_html: SHELF_HTML_URL,
      import_json: JSON_URL,
      import_csv: CSV_URL,
      embed_js: SHELF_EMBED_JS_URL,
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_markdown: SHELF_ADOPTION_MARKDOWN_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
      demo_template: `${SHELF_DEMO_BASE_URL}/{source}.html`,
    },
    script_contract: shelf.embed_contract,
    source_slug_count: shelf.source_slug_count,
    source_slugs: shelf.source_slugs,
    unique_sku_count: shelf.unique_sku_count,
    row_count: shelf.row_count,
    default_source: "curated_ucp_storefront",
    source_adoption: sourceAdoption,
    acceptance_gates: [
      "External builder page includes a Packrift shelf snippet with a source slug that matches the partner or storefront.",
      "Packrift receives a source-attributed script/resource read, start, install/config, or first-run event from that external surface.",
      "Buyer clicks use the source-aware order handoff URL and preserve mcp_source_context into MCP live checks and measured cart URLs.",
      "Goal completion still requires external builder inclusion plus source-attributed cart/order proof; hosted demos alone are not completion proof.",
    ],
  };
}

export function mcpUcpStorefrontShelfAdoptionMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontShelfAdoptionPayload(runtime);
  const rows = payload.source_adoption
    .map((entry) => `| ${entry.source_slug} | ${escapeMarkdown(entry.shelf_label)} | ${entry.demo_url} | ${entry.tracked_order_handoff_url} |`)
    .join("\n");
  return [
    "# Packrift UCP Storefront Adoption Kit",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    "## Fastest Embed",
    "",
    fenced(payload.source_adoption[0]?.one_line_script_snippet ?? oneLineShelfScriptSnippet("curated_ucp_storefront"), "html"),
    "",
    "## Source-Aware Adoption URLs",
    "",
    "| Source | Shelf | Demo | Order Handoff |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    "## Acceptance Gates",
    "",
    payload.acceptance_gates.map((gate) => `- ${gate}`).join("\n"),
    "",
  ].join("\n");
}

export function mcpUcpStorefrontShelfAdoptionHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontShelfAdoptionPayload(runtime);
  const cards = payload.source_adoption
    .map(
      (entry) => `<article>
        <div class="slug">${escapeHtml(entry.source_slug)}</div>
        <h2>${escapeHtml(entry.shelf_label)}</h2>
        <p>${escapeHtml(entry.source_label)} · ${entry.row_count} rows</p>
        <pre>${escapeHtml(entry.one_line_script_snippet)}</pre>
        <div class="links">
          <a class="button primary" href="${escapeHtml(entry.demo_url)}">Live demo</a>
          <a class="button" href="${escapeHtml(entry.tracked_first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(entry.tracked_order_handoff_url)}">Order handoff</a>
        </div>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Storefront Adoption Kit</title>
  <meta name="description" content="Source-aware Packrift UCP storefront shelf snippets and demos for curated agentic storefront builders.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1120px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:12px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.1rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:860px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);font-size:.85rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.82rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Storefront Adoption Kit</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${payload.source_slug_count} source slugs</span>
        <span>${payload.unique_sku_count} SKUs</span>
        <span>${payload.row_count} shelf rows</span>
      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

export function mcpUcpStorefrontShelfDemoHtml(runtime: UcpStarterCatalogRuntime, source: string): string | null {
  if (!UCP_STARTER_CATALOG_SOURCE_SLUGS.includes(source as (typeof UCP_STARTER_CATALOG_SOURCE_SLUGS)[number])) return null;
  const payload = mcpUcpStorefrontShelfPayload(runtime);
  const shelf = payload.shelves.find((entry) => entry.source_slug === source);
  if (!shelf) return null;
  const demoLinks: Array<{ label: string; href: string; className: string }> = [
    { label: "Builder handoff", href: BUILDER_HANDOFF_HTML_URL, className: "primary" },
    { label: "Order handoff", href: shelf.tracked_order_handoff_url, className: "primary" },
    { label: "First run", href: shelf.tracked_first_run_url, className: "" },
    { label: "Source proof", href: shelf.source_activation_json, className: "" },
    { label: "Adoption kit", href: SHELF_ADOPTION_HTML_URL, className: "" },
  ];
  const visibleLinks = demoLinks
    .map((link) => `<a class="button ${link.className}" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Shelf Demo - ${escapeHtml(shelf.source_label)}</title>
  <meta name="description" content="Live source-aware Packrift UCP storefront shelf demo for ${escapeHtml(shelf.source_label)}.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1100px;margin:0 auto;padding:30px 18px 54px}
    header{display:grid;gap:12px;margin-bottom:18px}
    h1{margin:0;font-size:clamp(2rem,5vw,3.6rem);line-height:1;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:860px}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;font-size:.82rem}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted)}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(shelf.shelf_label)}</h1>
      <p>${escapeHtml(shelf.placement_context)}</p>
      <div class="status">
        <span>${escapeHtml(shelf.source_slug)}</span>
        <span>${shelf.row_count} rows</span>
        <span>${shelf.bundles.length} bundles</span>
      </div>
      <div class="links">${visibleLinks}</div>
      <pre>${escapeHtml(shelf.one_line_script_snippet)}</pre>
    </header>
    <script async data-packrift-ucp-shelf src="${escapeHtml(sourceAwareShelfEmbedJsUrl(source, 8))}"></script>
  </main>
</body>
</html>`;
}

export function mcpUcpBuilderActivationHandoffPayload(runtime: UcpStarterCatalogRuntime) {
  const adoption = mcpUcpStorefrontShelfAdoptionPayload(runtime);
  const sourceBySlug = new Map(adoption.source_adoption.map((entry) => [entry.source_slug, entry]));
  const sourceTargets = [
    {
      priority: 1,
      target_name: "PlugThatShop / Nikunj",
      source_slug: "plugthatshop_style_embed",
      target_type: "contextual embedded shop builder",
	      why_it_matters:
	        "Plug-style embeds can make Packrift the default shipping-supplies upsell block for ecommerce, Shopify, fulfillment, moving, warehouse, 3PL, or small-business pages.",
	      best_first_link: sourceAwareBuilderLaunchpadUrl("plugthatshop_style_embed"),
	      approval_needed_message: [
	        "Built a Packrift packaging shelf for UCP builders: boxes, mailers, bags, tape, stretch film, envelopes, and void fill with source-aware MCP handoff.",
	        "",
	        "For Plug-style embeds, this could be the default shipping-supplies upsell block for ecommerce, Shopify, fulfillment, moving, warehouse, or small-business pages.",
	        "",
	        `Start here: ${sourceAwareBuilderLaunchpadUrl("plugthatshop_style_embed")}`,
	        "",
	        `Live Plug-style demo: ${sourceAwareShelfDemoUrl("plugthatshop_style_embed")}`,
	        "",
	        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
	        "",
	        "Full embed block:",
	        explicitShelfEmbedSnippet("plugthatshop_style_embed", 12),
	      ].join("\n"),
	    },
    {
      priority: 2,
      target_name: "Open Scout / UCP shopping-agent builders",
      source_slug: "open_scout_shopping_agent",
      target_type: "consumer shopping-agent and messaging commerce surface",
	      why_it_matters:
	        "Open Scout-style agents can answer packaging and shipping-supply intents directly across chat, web, SMS, or WhatsApp, then route exact Packrift SKUs through MCP live checks and measured cart handoff.",
	      best_first_link: sourceAwareBuilderLaunchpadUrl("open_scout_shopping_agent"),
	      approval_needed_message: [
	        "Built a Packrift packaging path for UCP shopping agents: exact boxes, mailers, bags, tape, stretch film, labels, envelopes, and void fill with live MCP price/inventory checks.",
	        "",
	        "For Open Scout-style agents, this can be the packaging supplier path when a buyer asks for shipping supplies, warehouse replenishment, ecommerce packing materials, fragile-item shipping, or moving supplies.",
	        "",
	        `Start here: ${sourceAwareBuilderLaunchpadUrl("open_scout_shopping_agent")}`,
	        "",
	        `Live agent-path demo: ${sourceAwareShelfDemoUrl("open_scout_shopping_agent")}`,
	        "",
	        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
	        "",
	        "First-run proof link:",
	        `https://mcp.packrift.com/r/run/open_scout_shopping_agent/${DEFAULT_TARGET}?format=html`,
	        "",
	        "Full embed block for any companion web surface:",
	        explicitShelfEmbedSnippet("open_scout_shopping_agent", 12),
	      ].join("\n"),
	    },
    {
      priority: 3,
      target_name: "Agorio shopping-agent SDK",
      source_slug: "agorio_shopping_agent_sdk",
      target_type: "UCP/ACP shopping-agent SDK and commerce agent toolkit",
      why_it_matters:
        "Agorio ships a UCP/MCP-aware shopping-agent SDK with real merchant discovery, product search, MCP client support, and example agents, so Packrift can become the packaging vertical example for SDK users building purchase-capable agents.",
      best_first_link: sourceAwareBuilderLaunchpadUrl("agorio_shopping_agent_sdk"),
      approval_needed_message: [
        "Built a Packrift packaging integration path for Agorio-style shopping agents: exact boxes, mailers, tape, labels, stretch film, warehouse replenishment, and buyer-confirmed MCP handoff.",
        "",
        "For Agorio SDK examples, Packrift is a strong vertical because packaging requests need exact dimensions, material, pack count, live price/inventory checks, and safe buyer confirmation before checkout.",
        "",
        `Start here: ${sourceAwareBuilderLaunchpadUrl("agorio_shopping_agent_sdk")}`,
        "",
        `Live SDK demo shelf: ${sourceAwareShelfDemoUrl("agorio_shopping_agent_sdk")}`,
        "",
        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
        "",
        "First-run proof link:",
        `https://mcp.packrift.com/r/run/agorio_shopping_agent_sdk/${DEFAULT_TARGET}?format=html`,
        "",
        "Full embed block for docs, demo UI, or examples:",
        explicitShelfEmbedSnippet("agorio_shopping_agent_sdk", 12),
      ].join("\n"),
    },
    {
      priority: 4,
      target_name: "Upsonic-style Shopify UCP agent frameworks",
      source_slug: "upsonic_ucp_agent_framework",
      target_type: "multi-agent UCP framework, demo, or example app",
	      why_it_matters:
	        "Upsonic-style UCP agents can use Packrift as a concrete packaging vertical example for product discovery, structured filtering, price/inventory confirmation, and buyer-confirmed cart handoff.",
	      best_first_link: sourceAwareBuilderLaunchpadUrl("upsonic_ucp_agent_framework"),
	      approval_needed_message: [
	        "Built a Packrift packaging workflow for UCP agent frameworks: 5 starter bundles, 36 purchase-ready SKUs, exact SKU resources, and MCP live checks before cart handoff.",
	        "",
	        "For Shopify UCP agent examples, Packrift is a stronger vertical than generic apparel or wellness because packaging buyers ask with exact dimensions, materials, pack counts, and replenishment needs.",
	        "",
	        `Start here: ${sourceAwareBuilderLaunchpadUrl("upsonic_ucp_agent_framework")}`,
	        "",
	        `Live framework demo: ${sourceAwareShelfDemoUrl("upsonic_ucp_agent_framework")}`,
	        "",
	        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
	        "",
	        "First-run proof link:",
	        `https://mcp.packrift.com/r/run/upsonic_ucp_agent_framework/${DEFAULT_TARGET}?format=html`,
	        "",
	        "Full embed block for demo UI or docs:",
	        explicitShelfEmbedSnippet("upsonic_ucp_agent_framework", 12),
	      ].join("\n"),
	    },
    {
      priority: 5,
      target_name: "Stack412-style storefront builders",
      source_slug: "stack412_style_storefront",
      target_type: "curated UCP category storefront operator",
	      why_it_matters:
	        "Stack412-style sites prove the themed storefront pattern. Packrift should be pitched as a ready shipping-supplies or fulfillment-supplies category, not as a wellness-store placement.",
	      best_first_link: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
	      approval_needed_message: [
	        "If you build more UCP storefronts, Packrift has a ready shipping-supplies aisle: boxes, mailers, poly bags, tape, stretch film, envelopes, and void fill.",
	        "",
	        `Start here: ${STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL}`,
	        "",
	        `Live demo: ${sourceAwareShelfDemoUrl("stack412_style_storefront")}`,
	        "",
	        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
	        "",
	        "Full embed block:",
	        explicitShelfEmbedSnippet("stack412_style_storefront", 12),
	      ].join("\n"),
	    },
    {
      priority: 6,
      target_name: "Generic curated UCP storefront builders",
      source_slug: "curated_ucp_storefront",
      target_type: "shipping-supplies, fulfillment, ecommerce ops, warehouse, moving, or packing-station storefront builder",
	      why_it_matters:
	        "Generic UCP storefront builders can pull Packrift directly for packaging shelves instead of waiting for Packrift to win generic global-catalog head terms.",
	      best_first_link: sourceAwareBuilderLaunchpadUrl("curated_ucp_storefront"),
	      approval_needed_message: [
	        "Packrift has a ready UCP packaging shelf for storefront builders: 5 bundles, 36 purchase-ready SKUs, exact SKU resources, live MCP price/inventory checks, and source-aware cart handoff.",
	        "",
	        `Start here: ${sourceAwareBuilderLaunchpadUrl("curated_ucp_storefront")}`,
	        "",
	        `Adoption kit: ${SHELF_ADOPTION_HTML_URL}`,
	        "",
	        "Full embed block:",
	        explicitShelfEmbedSnippet("curated_ucp_storefront", 12),
	      ].join("\n"),
	    },
  ].map((target) => {
    const sourceSlug = target.source_slug as (typeof UCP_STARTER_CATALOG_SOURCE_SLUGS)[number];
    const source = sourceBySlug.get(sourceSlug);
    return {
	      ...target,
	      launchpad_url: sourceAwareBuilderLaunchpadUrl(sourceSlug),
	      approval_packet_json: sourceAwareApprovalPacketUrl(sourceSlug, "json"),
	      approval_packet_markdown: sourceAwareApprovalPacketUrl(sourceSlug, "md"),
	      approval_packet_html: sourceAwareApprovalPacketUrl(sourceSlug, "html"),
	      embed_snippet: source?.explicit_embed_snippet || explicitShelfEmbedSnippet(sourceSlug, 12),
	      explicit_embed_snippet: source?.explicit_embed_snippet || explicitShelfEmbedSnippet(sourceSlug, 12),
	      one_line_script: source?.one_line_script_snippet || oneLineShelfScriptSnippet(sourceSlug, 12),
	      demo_url: source?.demo_url || sourceAwareShelfDemoUrl(sourceSlug),
      tracked_first_run_url: source?.tracked_first_run_url || `https://mcp.packrift.com/r/run/${sourceSlug}/${DEFAULT_TARGET}?format=html`,
      tracked_order_handoff_url: source?.tracked_order_handoff_url || `https://mcp.packrift.com/r/order/${sourceSlug}?format=html`,
      source_activation_json: source?.source_activation_json || `https://mcp.packrift.com/ai/mcp-source-activation/${sourceSlug}.json`,
      proof_signals_to_watch: [
        `mcp_source_context=${sourceSlug}`,
        "non-local shelf script/resource reads",
        "source-aware MCP install or first-run events",
        "buyer-approved cart URLs or /r/cart landings with source continuity",
        "Shopify order attributes containing the source slug",
      ],
    };
  });

	  return {
	    release: "PACKRIFT-MCP-UCP-BUILDER-ACTIVATION-HANDOFF-R05",
    generated_at: new Date().toISOString(),
    purpose:
      "Public self-serve handoff for curated UCP storefront and agentic-storefront builders to add Packrift as the default packaging shelf while preserving source attribution.",
    completion_boundary:
      "This handoff is an activation surface, not sales proof. The distribution goal remains open until a real external builder installs, embeds, or uses Packrift and source-attributed MCP/cart/order proof exists.",
    outreach_policy: {
      external_send_requires_farhan_approval: true,
      do_not_claim_default_supplier_until_external_proof: true,
      no_purchases_or_paid_submissions: true,
    },
    live_assets: {
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
      adoption_markdown: SHELF_ADOPTION_MARKDOWN_URL,
	      builder_handoff_json: BUILDER_HANDOFF_JSON_URL,
	      builder_handoff_markdown: BUILDER_HANDOFF_MARKDOWN_URL,
	      builder_handoff_html: BUILDER_HANDOFF_HTML_URL,
	      builder_launchpad_json: BUILDER_LAUNCHPAD_JSON_URL,
	      builder_launchpad_markdown: BUILDER_LAUNCHPAD_MARKDOWN_URL,
	      builder_launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
	      builder_approval_packet_json: BUILDER_APPROVAL_PACKET_JSON_URL,
	      builder_approval_packet_markdown: BUILDER_APPROVAL_PACKET_MARKDOWN_URL,
	      builder_approval_packet_html: BUILDER_APPROVAL_PACKET_HTML_URL,
	      builder_integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
	      builder_integration_pack_markdown: BUILDER_INTEGRATION_PACK_MARKDOWN_URL,
	      builder_integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
	      import_feed_json: JSON_URL,
      shelf_payload_json: SHELF_JSON_URL,
      shelf_embed_js: SHELF_EMBED_JS_URL,
      demo_template: `${SHELF_DEMO_BASE_URL}/{source}.html`,
      mcp_endpoint: "https://mcp.packrift.com/mcp",
    },
    proof_surfaces: {
      funnel_snapshot_json: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      source_activation_queue_json: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      agent_adoption_progress_json: "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json",
      ga4_funnel_proof_json: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      distribution_check_artifact: "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
    },
    current_proof_gate: {
      status: "not_proven_until_external_builder_or_order_proof",
      required_external_events: [
        "external builder shelf embed or install",
        "source-attributed MCP tool call",
        "buyer-approved measured cart URL or /r/cart landing",
        "Shopify order with source-attributed MCP continuity",
      ],
    },
    source_targets: sourceTargets,
    operator_workflow: [
      "Pick one target and source slug.",
      "Get Farhan approval for the exact outbound message before sending.",
      "Use only source-specific links and scripts in the message.",
      "After any external handoff, refresh npm run snapshot:funnel and npm run check:distribution.",
      "Count progress only when non-local events show up under the source slug.",
      "Count completion only when source-attributed cart/order proof exists.",
    ],
  };
}

export function mcpUcpBuilderActivationHandoffMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpBuilderActivationHandoffPayload(runtime);
  const targets = payload.source_targets
    .map(
      (target) => [
        `### ${target.priority}. ${target.target_name}`,
        "",
	        `- Source slug: \`${target.source_slug}\``,
	        `- Target type: ${target.target_type}`,
	        `- Best first link: ${target.best_first_link}`,
	        `- Launchpad card: ${target.launchpad_url}`,
	        `- Approval packet: ${target.approval_packet_html}`,
	        `- Demo: ${target.demo_url}`,
	        `- One-line script: \`${target.one_line_script.replace(/`/g, "\\`")}\``,
	        `- First run: ${target.tracked_first_run_url}`,
	        `- Order handoff: ${target.tracked_order_handoff_url}`,
	        "",
	        target.why_it_matters,
	        "",
	        "Full embed block:",
	        "",
	        fenced(target.embed_snippet, "html"),
	        "",
	        "Approval-needed message:",
	        "",
	        fenced(target.approval_needed_message, "text"),
        "",
        "Proof signals to watch:",
        "",
        target.proof_signals_to_watch.map((signal) => `- ${signal}`).join("\n"),
      ].join("\n")
    )
    .join("\n\n");
  return [
    "# Packrift UCP Builder Activation Handoff",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Live Assets",
    "",
    Object.entries(payload.live_assets)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Proof Surfaces",
    "",
    Object.entries(payload.proof_surfaces)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Priority Builder Targets",
    "",
    targets,
    "",
    "## Operator Workflow",
    "",
    payload.operator_workflow.map((step) => `- ${step}`).join("\n"),
    "",
  ].join("\n");
}

export function mcpUcpBuilderActivationHandoffHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpBuilderActivationHandoffPayload(runtime);
  const cards = payload.source_targets
    .map(
      (target) => `<article>
        <div class="slug">${escapeHtml(target.source_slug)}</div>
        <h2>${escapeHtml(target.target_name)}</h2>
        <p>${escapeHtml(target.why_it_matters)}</p>
	        <div class="links">
	          <a class="button primary" href="${escapeHtml(target.best_first_link)}">Start here</a>
	          <a class="button primary" href="${escapeHtml(target.launchpad_url)}">Launchpad card</a>
	          <a class="button primary" href="${escapeHtml(target.approval_packet_html)}">Approval packet</a>
	          <a class="button" href="${escapeHtml(target.demo_url)}">Demo</a>
	          <a class="button" href="${escapeHtml(target.tracked_first_run_url)}">First run</a>
	          <a class="button" href="${escapeHtml(target.tracked_order_handoff_url)}">Order handoff</a>
	        </div>
	        <h3>Full embed block</h3>
	        <pre>${escapeHtml(target.embed_snippet)}</pre>
	        <h3>One-line script</h3>
	        <pre>${escapeHtml(target.one_line_script)}</pre>
	        <h3>Approval-needed message</h3>
	        <pre>${escapeHtml(target.approval_needed_message)}</pre>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Builder Activation Handoff</title>
  <meta name="description" content="Self-serve Packrift UCP storefront builder handoff with source-aware shelf scripts, demo links, proof gates, and approval-needed outreach copy.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--warn:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1120px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:12px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,3.8rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.2rem;letter-spacing:0}
    h3{margin:4px 0 0;font-size:.95rem;letter-spacing:0;color:var(--muted)}
    p{margin:0;color:var(--muted);max-width:900px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted)}
    .status .warn{border-color:#e5c56d;color:var(--warn)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted);font-size:.85rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.82rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder Activation Handoff</h1>
      <p>${escapeHtml(payload.purpose)}</p>
	      <div class="status">
	        <span>${escapeHtml(payload.release)}</span>
	        <span>${payload.source_targets.length} target paths</span>
	        <span class="warn">outreach requires approval</span>
        <span>goal not proven until external cart/order proof</span>
      </div>
	      <div class="links">
	        <a class="button primary" href="${BUILDER_LAUNCHPAD_HTML_URL}">Builder launchpad</a>
	        <a class="button" href="${SHELF_ADOPTION_HTML_URL}">Adoption kit</a>
	        <a class="button" href="${BUILDER_HANDOFF_JSON_URL}">JSON</a>
	        <a class="button" href="${BUILDER_HANDOFF_MARKDOWN_URL}">Markdown</a>
	      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

export function packriftUcpBuilderLaunchpadPayload(runtime: UcpStarterCatalogRuntime) {
  const starter = mcpUcpStarterCatalogPayload(runtime);
  const adoption = mcpUcpStorefrontShelfAdoptionPayload(runtime);
  const handoff = mcpUcpBuilderActivationHandoffPayload(runtime);
  const sourceTargets = new Map(handoff.source_targets.map((target) => [target.source_slug, target]));
  const launchpad_sources = adoption.source_adoption.map((source) => {
    const target = sourceTargets.get(source.source_slug);
    return {
      source_slug: source.source_slug,
      source_label: source.source_label,
	      target_name: target?.target_name ?? source.source_label,
	      target_type: target?.target_type ?? "curated UCP storefront builder",
	      launchpad_url: target?.launchpad_url ?? sourceAwareBuilderLaunchpadUrl(source.source_slug),
	      approval_packet_json: target?.approval_packet_json ?? sourceAwareApprovalPacketUrl(source.source_slug, "json"),
	      approval_packet_markdown: target?.approval_packet_markdown ?? sourceAwareApprovalPacketUrl(source.source_slug, "md"),
	      approval_packet_html: target?.approval_packet_html ?? sourceAwareApprovalPacketUrl(source.source_slug, "html"),
	      integration_pack_json: sourceAwareIntegrationPackUrl(source.source_slug, "json"),
	      integration_pack_markdown: sourceAwareIntegrationPackUrl(source.source_slug, "md"),
	      integration_pack_html: sourceAwareIntegrationPackUrl(source.source_slug, "html"),
	      shelf_label: source.shelf_label,
      row_count: source.row_count,
	      demo_url: source.demo_url,
	      one_line_script: source.one_line_script_snippet,
	      embed_snippet: source.explicit_embed_snippet,
	      explicit_embed_snippet: source.explicit_embed_snippet,
	      import_feed_json: JSON_URL,
      import_feed_jsonl: JSONL_URL,
      import_feed_csv: CSV_URL,
      install_url: source.tracked_install_url,
      first_run_url: source.tracked_first_run_url,
      order_handoff_url: source.tracked_order_handoff_url,
      source_activation_json: source.source_activation_json,
      eval_pack_json: `https://mcp.packrift.com/ai/mcp-eval-pack.json?source=${source.source_slug}`,
      mcp_endpoint: starter.canonical_endpoint,
      buyer_prompt:
        `Use Packrift for packaging and shipping supplies. Source is ${source.source_slug}. Search boxes, mailers, poly bags, tape, stretch film, packing-list envelopes, void fill, and labels. Run live MCP price/inventory checks before cart handoff.`,
      acceptance_checklist: [
        `Embed or import uses source_slug=${source.source_slug}`,
        "External page fetches the shelf script or import feed outside local Packrift tests",
        "First run calls Packrift MCP tools/list and at least one live product or pricing tool",
        "Order handoff preserves mcp_source_context into measured cart URLs",
        "Completion requires external-source cart/order proof, not this launchpad view",
      ],
    };
  });
  return {
	    release: "PACKRIFT-UCP-BUILDER-LAUNCHPAD-R06",
    generated_at: new Date().toISOString(),
    purpose:
      "Self-serve conversion launchpad for curated UCP storefront and embedded-shop builders to add Packrift as their default packaging shelf with source-aware attribution.",
    audience: [
      "curated UCP storefront builders",
      "Stack412-style category storefront operators",
      "PlugThatShop-style contextual embed builders",
      "Open Scout-style shopping-agent builders",
      "Upsonic-style UCP agent framework builders",
      "Agorio-style UCP/ACP shopping-agent SDK builders",
      "agentic storefront builders adding shipping, fulfillment, warehouse, moving, or packing-station supplies",
    ],
    completion_boundary:
      "This launchpad is designed to create external builder adoption. It does not prove sales until external source-attributed MCP/cart/order evidence exists.",
    fast_path: [
      "Pick the source row matching the builder or storefront.",
      "Copy the one-line script or import feed URL into the builder's storefront.",
      "Run the source-specific first-run URL to verify MCP live product, pricing, and inventory calls.",
      "Use the source-specific order handoff only after a buyer confirms exact SKU and quantity.",
      "Refresh the funnel snapshot and require non-local source-attributed events before counting progress.",
    ],
    assets: {
      launchpad_json: BUILDER_LAUNCHPAD_JSON_URL,
      launchpad_markdown: BUILDER_LAUNCHPAD_MARKDOWN_URL,
      launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
      builder_handoff_json: BUILDER_HANDOFF_JSON_URL,
      builder_handoff_html: BUILDER_HANDOFF_HTML_URL,
      builder_approval_packet_json: BUILDER_APPROVAL_PACKET_JSON_URL,
      builder_approval_packet_markdown: BUILDER_APPROVAL_PACKET_MARKDOWN_URL,
      builder_approval_packet_html: BUILDER_APPROVAL_PACKET_HTML_URL,
      builder_integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
      builder_integration_pack_markdown: BUILDER_INTEGRATION_PACK_MARKDOWN_URL,
      builder_integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      shipping_supplies_storefront_template_json: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL,
      shipping_supplies_storefront_template_markdown: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_MARKDOWN_URL,
      shipping_supplies_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
      import_json: JSON_URL,
      import_jsonl: JSONL_URL,
      import_csv: CSV_URL,
      shelf_payload_json: SHELF_JSON_URL,
      shelf_embed_js: SHELF_EMBED_JS_URL,
      mcp_endpoint: starter.canonical_endpoint,
    },
    starter_catalog_summary: starter.starter_catalog_summary,
    launchpad_source_count: launchpad_sources.length,
    launchpad_sources,
    proof_surfaces: handoff.proof_surfaces,
    proof_gate: handoff.current_proof_gate,
  };
}

export function packriftUcpBuilderLaunchpadMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderLaunchpadPayload(runtime);
  const rows = payload.launchpad_sources
    .map((source) => `| ${source.source_slug} | ${escapeMarkdown(source.target_name)} | ${source.demo_url} | ${source.first_run_url} | ${source.order_handoff_url} |`)
    .join("\n");
  const sourceBlocks = payload.launchpad_sources
    .map(
      (source) => [
        `### ${source.target_name}`,
        "",
        `- Source slug: \`${source.source_slug}\``,
	        `- Launchpad card: ${source.launchpad_url}`,
	        `- Approval packet: ${source.approval_packet_html}`,
	        `- Integration pack: ${source.integration_pack_html}`,
	        `- Demo: ${source.demo_url}`,
        `- Install: ${source.install_url}`,
        `- First run: ${source.first_run_url}`,
        `- Order handoff: ${source.order_handoff_url}`,
        `- Import JSON: ${source.import_feed_json}`,
        `- Import CSV: ${source.import_feed_csv}`,
        "",
	        "One-line shelf script:",
	        "",
	        fenced(source.one_line_script, "html"),
	        "",
	        "Full embed block:",
	        "",
	        fenced(source.embed_snippet, "html"),
	        "",
	        "Buyer prompt:",
	        "",
	        fenced(source.buyer_prompt, "text"),
      ].join("\n")
    )
    .join("\n\n");
  return [
    "# Packrift UCP Builder Launchpad",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Fast Path",
    "",
    payload.fast_path.map((step) => `- ${step}`).join("\n"),
    "",
    "## Source Rows",
    "",
    "| Source | Target | Demo | First Run | Order Handoff |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Copy Blocks",
    "",
    sourceBlocks,
    "",
  ].join("\n");
}

export function packriftUcpBuilderLaunchpadHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderLaunchpadPayload(runtime);
  const cards = payload.launchpad_sources
    .map(
	      (source) => `<article id="${escapeHtml(source.source_slug)}">
	        <div class="slug">${escapeHtml(source.source_slug)}</div>
        <h2>${escapeHtml(source.target_name)}</h2>
        <p>${escapeHtml(source.target_type)}</p>
        <div class="metric">${source.row_count} source-aware rows</div>
        <div class="links">
          <a class="button primary" href="${escapeHtml(source.demo_url)}">Demo</a>
          <a class="button primary" href="${escapeHtml(source.first_run_url)}">First run</a>
          <a class="button primary" href="${escapeHtml(source.approval_packet_html)}">Approval packet</a>
          <a class="button primary" href="${escapeHtml(source.integration_pack_html)}">Integration pack</a>
          <a class="button" href="${escapeHtml(source.install_url)}">Install</a>
          <a class="button" href="${escapeHtml(source.order_handoff_url)}">Order handoff</a>
          <a class="button" href="${escapeHtml(source.source_activation_json)}">Source proof</a>
	        </div>
	        <h3>One-line script</h3>
	        <pre>${escapeHtml(source.one_line_script)}</pre>
	        <h3>Full embed block</h3>
	        <pre>${escapeHtml(source.embed_snippet)}</pre>
	        <h3>Prompt</h3>
        <pre>${escapeHtml(source.buyer_prompt)}</pre>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Builder Launchpad</title>
  <meta name="description" content="Self-serve Packrift launchpad for UCP storefront builders adding source-aware packaging shelves, imports, MCP first runs, and order handoffs.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#9b6a16}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.1rem,5vw,4.2rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.16rem;letter-spacing:0}
    h3{margin:8px 0 0;font-size:.9rem;letter-spacing:0;color:var(--muted)}
    p{margin:0;color:var(--muted);max-width:900px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.metric{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted);width:max-content}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(315px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--green);border-radius:8px;padding:14px}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--gold);font-size:.86rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.8rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    .asset-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder Launchpad</h1>
      <p>${escapeHtml(payload.purpose)}</p>
	      <div class="status">
	        <span>${escapeHtml(payload.release)}</span>
	        <span>${payload.starter_catalog_summary.unique_sku_count} starter SKUs</span>
	        <span>${payload.starter_catalog_summary.bundle_count} bundles</span>
        <span>${payload.launchpad_source_count} source slugs</span>
      </div>
      <div class="asset-row">
        <a class="button primary" href="${BUILDER_LAUNCHPAD_JSON_URL}">JSON</a>
        <a class="button" href="${BUILDER_LAUNCHPAD_MARKDOWN_URL}">Markdown</a>
        <a class="button" href="${JSON_URL}">Import feed</a>
        <a class="button" href="${SHELF_EMBED_JS_URL}">Shelf JS</a>
        <a class="button" href="${BUILDER_INTEGRATION_PACK_HTML_URL}">Integration pack</a>
        <a class="button" href="${BUILDER_APPROVAL_PACKET_HTML_URL}">Approval packet</a>
        <a class="button" href="${BUILDER_HANDOFF_HTML_URL}">Builder handoff</a>
      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

function sourceDefaultInstallTarget(source: string): string {
  if (source === SHIPPING_SUPPLIES_TEMPLATE_SOURCE) return SHIPPING_SUPPLIES_TEMPLATE_TARGET;
  if (source === STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE) return STACK412_SHIPPING_SUPPLIES_AISLE_TARGET;
  if (source === PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE) return PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET;
  if (source === OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE) return OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET;
  if (source === UPSONIC_AGENT_WORKFLOW_SOURCE) return UPSONIC_AGENT_WORKFLOW_TARGET;
  if (source === AGORIO_SHOPPING_AGENT_SDK_SOURCE) return "agorio_packaging_agent_sdk_example";
  return DEFAULT_TARGET;
}

function starterKitStorefrontConfig(source: string): string {
  return JSON.stringify(
    {
      storefront_name: "Shipping supplies by Packrift",
      catalog_role: "default_packaging_source",
      source_slug: source,
      mcp_install_target: sourceDefaultInstallTarget(source),
      import_feed_json: JSON_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(source, 12),
      mcp_endpoint: sourceAwareMcpEndpoint(source, sourceDefaultInstallTarget(source)),
      query_groups: [
        "shipping boxes",
        "corrugated boxes",
        "poly mailers",
        "bubble mailers",
        "packing tape",
        "shipping labels",
        "stretch film",
        "void fill",
        "packing list envelopes",
        "warehouse supplies",
      ],
      cart_handoff_policy: {
        require_exact_sku: true,
        require_buyer_confirmed_quantity: true,
        preserve_mcp_source_context: true,
        preserve_mcp_install_target: true,
      },
    },
    null,
    2
  );
}

function starterKitAgentPrompt(source: string): string {
  return [
    "Use Packrift as the default packaging catalog for shipping-supplies, ecommerce fulfillment, warehouse, moving, and packing-station intents.",
    `Set mcp_source_context=${source} and mcp_install_target=${sourceDefaultInstallTarget(source)} on every Packrift MCP call.`,
    "Route generic packaging requests to Packrift shelves first, then run live Packrift MCP checks before presenting pricing, inventory, or cart actions.",
    "Do not create a cart URL until the buyer confirms an exact Packrift SKU and quantity.",
    "If no exact SKU matches the buyer's size, material, color, strength, printer type, adhesive type, or pack count, return no exact match and route to quote/reorder/exact-spec discovery.",
  ].join("\n");
}

function starterKitAgorioExample(source: string): string {
  return [
    'import { ShoppingAgent, McpClient } from "@agorio/shopping-agent-sdk";',
    "",
    `const packrift = new McpClient("${sourceAwareMcpEndpoint(source, sourceDefaultInstallTarget(source))}");`,
    "const agent = new ShoppingAgent({",
    '  name: "Packrift shipping-supplies route",',
    "  tools: [packrift],",
    "  instructions: " + JSON.stringify(starterKitAgentPrompt(source)),
    "});",
    "",
    'await packrift.call("search_products", {',
    '  query: "shipping boxes mailers tape labels packing supplies",',
    `  mcp_source_context: "${source}",`,
    `  mcp_install_target: "${sourceDefaultInstallTarget(source)}",`,
    "});",
  ].join("\n");
}

export function packriftUcpShippingSuppliesStarterKitPayload(runtime: UcpStarterCatalogRuntime) {
  const starter = mcpUcpStarterCatalogPayload(runtime);
  const launchpad = packriftUcpBuilderLaunchpadPayload(runtime);
  const defaultSource = launchpad.launchpad_sources.find((source) => source.source_slug === SHIPPING_SUPPLIES_TEMPLATE_SOURCE) ?? launchpad.launchpad_sources[0];
  const source_routes = launchpad.launchpad_sources.map((source) => ({
    source_slug: source.source_slug,
    label: source.source_label,
    target_name: source.target_name,
    target_type: source.target_type,
    placement_context: sourcePlacementContext(source.source_slug),
    default_mcp_install_target: sourceDefaultInstallTarget(source.source_slug),
    one_line_script: source.one_line_script,
    embed_snippet: source.embed_snippet,
    import_feed_json: source.import_feed_json,
    demo_url: source.demo_url,
    launchpad_url: source.launchpad_url,
    integration_pack_json: source.integration_pack_json,
    integration_pack_html: source.integration_pack_html,
    approval_packet_json: source.approval_packet_json,
    approval_packet_html: source.approval_packet_html,
    first_run_url: source.first_run_url,
    order_handoff_url: source.order_handoff_url,
    mcp_endpoint: sourceAwareMcpEndpoint(source.source_slug, sourceDefaultInstallTarget(source.source_slug)),
    row_count: source.row_count,
  }));
  const selectedDefaultSource = defaultSource?.source_slug ?? SHIPPING_SUPPLIES_TEMPLATE_SOURCE;
  return {
    release: SHIPPING_SUPPLIES_STARTER_KIT_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Public, copy-ready starter kit for making Packrift the default packaging catalog inside curated UCP storefronts, shopping-agent SDK examples, contextual commerce embeds, and shipping-supplies aggregators.",
    execution_goal:
      "Turn Packrift from a catalog that agents can find into the packaging source that agent storefront builders copy, import, embed, and route buyer handoffs through.",
    completion_boundary:
      "This Packrift-owned starter kit is distribution infrastructure. It does not prove the channel until an external builder imports, embeds, installs, or calls it and Packrift records non-local source-attributed MCP, cart, or order evidence.",
    safe_action_boundary: {
      no_external_messages_or_public_posts_without_owner_approval: true,
      no_purchases_or_paid_submissions: true,
      no_product_pricing_inventory_feed_or_checkout_writes: true,
      cart_urls_only_after_buyer_confirmed_exact_sku_and_quantity: true,
    },
    four_part_execution_loop: [
      "Own the packaging reference implementation so builders have a working shelf to copy.",
      "Seed the places builders copy from: MCP resources, llms.txt, registries, UCP examples, shopping-agent SDK examples, and curated-storefront repos.",
      "Make adoption self-serve through source-aware import feeds, shelf scripts, first-run links, and integration packs.",
      "Run a weekly distribution cadence and only count progress when source-attributed external MCP/cart/order proof appears.",
    ],
    canonical_urls: {
      starter_kit_json: SHIPPING_SUPPLIES_STARTER_KIT_JSON_URL,
      starter_kit_markdown: SHIPPING_SUPPLIES_STARTER_KIT_MARKDOWN_URL,
      starter_kit_html: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      builder_launchpad_json: BUILDER_LAUNCHPAD_JSON_URL,
      builder_launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
      storefront_template_json: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL,
      storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      import_feed_json: JSON_URL,
      import_feed_jsonl: JSONL_URL,
      import_feed_csv: CSV_URL,
      shelf_payload_json: SHELF_JSON_URL,
      shelf_embed_js: SHELF_EMBED_JS_URL,
      starter_catalog_json: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",
      integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
      approval_packet_json: BUILDER_APPROVAL_PACKET_JSON_URL,
      pr_activation_pack_json: BUILDER_PR_ACTIVATION_PACK_JSON_URL,
      mcp_endpoint: starter.canonical_endpoint,
    },
    starter_catalog_summary: starter.starter_catalog_summary,
    source_slug_count: launchpad.launchpad_source_count,
    source_slugs: launchpad.launchpad_sources.map((source) => source.source_slug),
    default_source_slug: selectedDefaultSource,
    quick_start: [
      "Choose the source slug that matches the builder or storefront.",
      "Copy the one-line shelf script or import_feed_json into the storefront.",
      "Use the source-aware MCP endpoint for live product, pricing, and inventory checks.",
      "Run the first_run_url as the smoke test.",
      "Use order_handoff_url only after buyer confirmation of exact SKU and quantity.",
      "Refresh funnel proof and require non-local source-attributed evidence before counting the channel.",
    ],
    copy_paste_assets: {
      default_one_line_script: defaultSource?.one_line_script ?? oneLineShelfScriptSnippet(selectedDefaultSource, 12),
      default_embed_snippet: defaultSource?.embed_snippet ?? explicitShelfEmbedSnippet(selectedDefaultSource, 12),
      storefront_config_json: starterKitStorefrontConfig(selectedDefaultSource),
      agent_prompt: starterKitAgentPrompt(selectedDefaultSource),
      agorio_mcp_client_ts: starterKitAgorioExample(AGORIO_SHOPPING_AGENT_SDK_SOURCE),
    },
    source_routes,
    first_distribution_targets: [
      {
        surface: "Stack412-style curated UCP storefronts",
        source_slug: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
        first_link: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
        execution_move: "Offer a ready shipping-supplies aisle, not a generic Packrift listing.",
      },
      {
        surface: "PlugThatShop-style embedded shopping contexts",
        source_slug: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
        first_link: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
        execution_move: "Offer contextual packaging shelf blocks for ecommerce, fulfillment, logistics, and moving content.",
      },
      {
        surface: "Open Scout-style shopping agents",
        source_slug: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
        first_link: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
        execution_move: "Offer a packaging route with live Packrift MCP checks and buyer-confirmed handoff policy.",
      },
      {
        surface: "Upsonic-style Shopify UCP agent frameworks",
        source_slug: UPSONIC_AGENT_WORKFLOW_SOURCE,
        first_link: UPSONIC_AGENT_WORKFLOW_HTML_URL,
        execution_move: "Offer a multi-step UCP workflow for packaging discovery, filtering, live checks, and cart handoff.",
      },
      {
        surface: "Agorio-style shopping-agent SDKs",
        source_slug: AGORIO_SHOPPING_AGENT_SDK_SOURCE,
        first_link: sourceAwareIntegrationPackUrl(AGORIO_SHOPPING_AGENT_SDK_SOURCE, "html"),
        execution_move: "Offer a concrete SDK route and McpClient example for packaging/procurement intents.",
      },
    ],
    proof_gate: {
      local_packrift_owned_surfaces_count_as_setup: true,
      external_builder_install_embed_import_or_first_run_required: true,
      external_source_attributed_cart_landing_required_for_activation: true,
      first_party_mcp_order_required_for_sales_proof: true,
    },
  };
}

export function packriftUcpShippingSuppliesStarterKitMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpShippingSuppliesStarterKitPayload(runtime);
  const sourceRows = payload.source_routes
    .map((source) => `| ${source.source_slug} | ${escapeMarkdown(source.target_name)} | ${source.row_count} | ${source.demo_url} | ${source.first_run_url} |`)
    .join("\n");
  const targetRows = payload.first_distribution_targets
    .map((target) => `| ${escapeMarkdown(target.surface)} | ${target.source_slug} | ${target.first_link} | ${escapeMarkdown(target.execution_move)} |`)
    .join("\n");
  return [
    "# Packrift UCP Shipping Supplies Starter Kit",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Execution goal: ${payload.execution_goal}`,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Four-Part Execution Loop",
    "",
    payload.four_part_execution_loop.map((step) => `- ${step}`).join("\n"),
    "",
    "## Quick Start",
    "",
    payload.quick_start.map((step) => `- ${step}`).join("\n"),
    "",
    "## Canonical URLs",
    "",
    Object.entries(payload.canonical_urls)
      .map(([key, url]) => `- ${key}: ${url}`)
      .join("\n"),
    "",
    "## Source Routes",
    "",
    "| Source | Target | Rows | Demo | First Run |",
    "| --- | --- | ---: | --- | --- |",
    sourceRows,
    "",
    "## First Distribution Targets",
    "",
    "| Surface | Source | First Link | Move |",
    "| --- | --- | --- | --- |",
    targetRows,
    "",
    "## Copy Blocks",
    "",
    "One-line shelf script:",
    "",
    fenced(payload.copy_paste_assets.default_one_line_script, "html"),
    "",
    "Full embed block:",
    "",
    fenced(payload.copy_paste_assets.default_embed_snippet, "html"),
    "",
    "UCP storefront config:",
    "",
    fenced(payload.copy_paste_assets.storefront_config_json, "json"),
    "",
    "Agent prompt:",
    "",
    fenced(payload.copy_paste_assets.agent_prompt, "text"),
    "",
    "Agorio-style MCP client example:",
    "",
    fenced(payload.copy_paste_assets.agorio_mcp_client_ts, "ts"),
    "",
  ].join("\n");
}

export function packriftUcpShippingSuppliesStarterKitHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpShippingSuppliesStarterKitPayload(runtime);
  const sourceCards = payload.source_routes
    .map(
      (source) => `<article id="${escapeHtml(source.source_slug)}">
        <div class="slug">${escapeHtml(source.source_slug)}</div>
        <h2>${escapeHtml(source.target_name)}</h2>
        <p>${escapeHtml(source.placement_context)}</p>
        <div class="metric">${source.row_count} import rows</div>
        <div class="links">
          <a class="button primary" href="${escapeHtml(source.demo_url)}">Demo</a>
          <a class="button primary" href="${escapeHtml(source.first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(source.integration_pack_html)}">Integration pack</a>
          <a class="button" href="${escapeHtml(source.approval_packet_html)}">Approval packet</a>
          <a class="button" href="${escapeHtml(source.order_handoff_url)}">Order handoff</a>
        </div>
        <h3>One-line script</h3>
        <pre>${escapeHtml(source.one_line_script)}</pre>
      </article>`
    )
    .join("");
  const targetRows = payload.first_distribution_targets
    .map(
      (target) => `<tr>
        <td>${escapeHtml(target.surface)}</td>
        <td><code>${escapeHtml(target.source_slug)}</code></td>
        <td><a href="${escapeHtml(target.first_link)}">first link</a></td>
        <td>${escapeHtml(target.execution_move)}</td>
      </tr>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Shipping Supplies Starter Kit</title>
  <meta name="description" content="Copy-ready Packrift starter kit for curated UCP storefronts, shopping-agent SDKs, and embedded agentic commerce shelves.">
  <style>
    :root{color-scheme:light;--ink:#16211b;--muted:#516258;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#9b6a16}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.12rem;letter-spacing:0}
    h3{margin:8px 0 0;font-size:.9rem;color:var(--muted);letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    .actions,.links,.status{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.metric{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem;width:max-content}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:24px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px;margin-top:14px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--green);border-radius:8px;padding:14px}
    .slug,code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--gold);font-size:.86rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.8rem}
    table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line)}
    th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:9px;font-size:.92rem}
    th{color:var(--muted);font-weight:650}
    @media (max-width:760px){.button{width:100%}table,tbody,tr,td,th{display:block}thead{display:none}tr{border-bottom:1px solid var(--line)}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Shipping Supplies Starter Kit</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.starter_catalog_summary.unique_sku_count} starter SKUs</span>
        <span>${payload.starter_catalog_summary.bundle_count} bundles</span>
        <span>${payload.source_slug_count} source slugs</span>
      </div>
      <div class="actions">
        <a class="button primary" href="${SHIPPING_SUPPLIES_STARTER_KIT_JSON_URL}">JSON</a>
        <a class="button" href="${SHIPPING_SUPPLIES_STARTER_KIT_MARKDOWN_URL}">Markdown</a>
        <a class="button" href="${BUILDER_LAUNCHPAD_HTML_URL}">Launchpad</a>
        <a class="button" href="${SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL}">Storefront template</a>
        <a class="button" href="${JSON_URL}">Import feed</a>
        <a class="button" href="${SHELF_EMBED_JS_URL}">Shelf script</a>
      </div>
    </header>
    <section>
      <h2>Quick Start</h2>
      <p>${escapeHtml(payload.execution_goal)}</p>
      <pre>${escapeHtml(payload.quick_start.map((step, index) => `${index + 1}. ${step}`).join("\n"))}</pre>
    </section>
    <section>
      <h2>Copy Blocks</h2>
      <h3>One-line shelf script</h3>
      <pre>${escapeHtml(payload.copy_paste_assets.default_one_line_script)}</pre>
      <h3>UCP storefront config</h3>
      <pre>${escapeHtml(payload.copy_paste_assets.storefront_config_json)}</pre>
      <h3>Agent prompt</h3>
      <pre>${escapeHtml(payload.copy_paste_assets.agent_prompt)}</pre>
    </section>
    <section>
      <h2>Source Routes</h2>
      <div class="grid">${sourceCards}</div>
    </section>
    <section>
      <h2>First Distribution Targets</h2>
      <table>
        <thead><tr><th>Surface</th><th>Source</th><th>First link</th><th>Move</th></tr></thead>
        <tbody>${targetRows}</tbody>
      </table>
    </section>
    <section>
      <h2>Proof Gate</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function packriftUcpShippingSuppliesStorefrontTemplatePayload(runtime: UcpStarterCatalogRuntime) {
  const starter = mcpUcpStarterCatalogPayload(runtime);
  const source = SHIPPING_SUPPLIES_TEMPLATE_SOURCE;
  const templateHtml = shippingSuppliesStorefrontTemplateHtmlDocument();
  const firstRunUrl = `https://mcp.packrift.com/r/run/${source}/${SHIPPING_SUPPLIES_TEMPLATE_TARGET}?format=html`;
  const installUrl = `https://mcp.packrift.com/r/install/${source}/${SHIPPING_SUPPLIES_TEMPLATE_TARGET}?format=html`;
  const orderHandoffUrl = `https://mcp.packrift.com/r/order/${source}?format=html`;
  return {
    release: SHIPPING_SUPPLIES_TEMPLATE_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Copy-ready shipping-supplies storefront scaffold that makes Packrift the default packaging catalog for curated UCP and agentic storefront builders.",
    completion_boundary:
      "This template removes adoption friction but is not sales proof until an external builder deploys it or adapts it and source-attributed MCP/cart/order evidence exists.",
    source_slug: source,
    mcp_install_target: SHIPPING_SUPPLIES_TEMPLATE_TARGET,
    policy: {
      no_purchases_or_paid_submissions: true,
      no_product_pricing_inventory_or_feed_writes: true,
      do_not_generate_cart_url_until_buyer_confirms_exact_sku_and_quantity: true,
      preserve_mcp_source_context_and_mcp_install_target: true,
    },
    assets: {
      template_json: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL,
      template_markdown: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_MARKDOWN_URL,
      template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(source, 12),
      import_feed_json: JSON_URL,
      launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
      integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      pr_activation_pack_html: BUILDER_PR_ACTIVATION_PACK_HTML_URL,
      mcp_endpoint: sourceAwareMcpEndpoint(source, SHIPPING_SUPPLIES_TEMPLATE_TARGET),
      tracked_install_url: installUrl,
      tracked_first_run_url: firstRunUrl,
      tracked_order_handoff_url: orderHandoffUrl,
    },
    starter_catalog_summary: starter.starter_catalog_summary,
    routed_packaging_intents: [
      "shipping boxes",
      "corrugated boxes",
      "apparel mailers",
      "poly mailers",
      "packing tape",
      "shipping labels",
      "packing-list envelopes",
      "stretch film",
      "void fill",
      "warehouse supplies",
      "packing station starter kit",
      "fulfillment supplies",
    ],
    storefront_blocks: [
      {
        id: "shipping_boxes",
        title: "Shipping boxes",
        description: "Corrugated cartons by dimensions, strength, style, and pack count.",
      },
      {
        id: "mailers",
        title: "Mailers",
        description: "Poly, bubble, stay-flat, rigid, and apparel shipping mailers.",
      },
      {
        id: "tape_labels",
        title: "Tape and labels",
        description: "Carton sealing tape, dispensers, direct thermal labels, and label protection.",
      },
      {
        id: "warehouse_supplies",
        title: "Warehouse supplies",
        description: "Stretch film, packing-list envelopes, tags, strapping, and void fill.",
      },
    ],
    copy_paste: {
      one_line_script: oneLineShelfScriptSnippet(source, 12),
      full_embed_block: explicitShelfEmbedSnippet(source, 12),
      standalone_html: templateHtml,
    },
    first_run_json_rpc_sequence: [
      integrationProtocolRequest("tools", "tools/list"),
      integrationToolCall("search-packaging", "search_products", {
        query: "shipping boxes mailers tape labels packing supplies",
        mcp_source_context: source,
        mcp_install_target: SHIPPING_SUPPLIES_TEMPLATE_TARGET,
      }),
      integrationToolCall("pricing-check", "get_pricing", {
        sku: "{buyer_selected_exact_sku}",
        mcp_source_context: source,
        mcp_install_target: SHIPPING_SUPPLIES_TEMPLATE_TARGET,
      }),
    ],
    buyer_confirmed_handoff_template: {
      sku: "{buyer_selected_exact_sku}",
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: "shipping_supplies_storefront_template",
      mcp_source_context: source,
      mcp_install_target: SHIPPING_SUPPLIES_TEMPLATE_TARGET,
    },
    acceptance_checklist: [
      "External builder deploys or adapts the storefront template outside Packrift-owned demo pages.",
      `Template preserves source_slug=${source} and mcp_install_target=${SHIPPING_SUPPLIES_TEMPLATE_TARGET}.`,
      "First run calls Packrift MCP tools/list plus at least one live product or pricing tool.",
      "Order handoff is generated only after buyer_confirmed=true and an exact SKU/quantity is selected.",
      "Distribution progress requires non-local source-attributed MCP/cart/order evidence.",
    ],
  };
}

export function packriftUcpShippingSuppliesStorefrontTemplateMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpShippingSuppliesStorefrontTemplatePayload(runtime);
  return [
    "# Packrift UCP Shipping Supplies Storefront Template",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Live URLs",
    "",
    `- Template HTML: ${payload.assets.template_html}`,
    `- Template JSON: ${payload.assets.template_json}`,
    `- Shelf script: ${payload.assets.shelf_script}`,
    `- Source-aware MCP endpoint: ${payload.assets.mcp_endpoint}`,
    `- Tracked install: ${payload.assets.tracked_install_url}`,
    `- First run: ${payload.assets.tracked_first_run_url}`,
    `- Buyer-confirmed order handoff: ${payload.assets.tracked_order_handoff_url}`,
    "",
    "## Route These Intents To Packrift",
    "",
    payload.routed_packaging_intents.map((intent) => `- ${intent}`).join("\n"),
    "",
    "## One-Line Shelf Script",
    "",
    fenced(payload.copy_paste.one_line_script, "html"),
    "",
    "## Full Embed Block",
    "",
    fenced(payload.copy_paste.full_embed_block, "html"),
    "",
    "## First-Run JSON-RPC",
    "",
    fenced(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2), "json"),
    "",
    "## Buyer-Confirmed Handoff Template",
    "",
    fenced(JSON.stringify(payload.buyer_confirmed_handoff_template, null, 2), "json"),
    "",
    "## Standalone HTML",
    "",
    fenced(payload.copy_paste.standalone_html, "html"),
    "",
  ].join("\n");
}

export function packriftUcpShippingSuppliesStorefrontTemplateHtml(_runtime: UcpStarterCatalogRuntime): string {
  return shippingSuppliesStorefrontTemplateHtmlDocument();
}

export function packriftUcpStack412ShippingSuppliesAislePayload(runtime: UcpStarterCatalogRuntime) {
  const shelfPayload = mcpUcpStorefrontShelfPayload(runtime);
  const shelf = shelfPayload.shelves.find((entry) => entry.source_slug === STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE);
  if (!shelf) throw new Error(`Missing shelf source: ${STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE}`);
  const firstSampleItem = shelf.bundles.flatMap((bundle) => bundle.items)[0];
  const aisleSections = shelf.bundles.map((bundle) => ({
    section_id: bundle.bundle_id,
    title: bundle.bundle_title,
    storefront_intent: bundle.storefront_intent,
    primary_ucp_query: bundle.primary_ucp_query,
    item_count: bundle.items.length,
    sample_items: bundle.items.slice(0, 6).map((item) => ({
      sku: item.sku,
      title: item.title,
      family: item.family,
      product_url: item.product_url,
      mcp_sku_json: item.mcp_sku_json,
      order_handoff_url: item.order_handoff_url,
    })),
  }));
  return {
    release: STACK412_SHIPPING_SUPPLIES_AISLE_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Target-specific shipping-supplies aisle for Stack412-style curated UCP storefront operators. It turns Packrift from a generic MCP listing into a ready product shelf that can be imported, embedded, measured, and routed through live MCP checks.",
    completion_boundary:
      "This aisle page improves the first external ask but is not sales proof. Completion still requires external builder install, embed, or use plus source-attributed MCP/cart/order continuity.",
    source_slug: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
    mcp_install_target: STACK412_SHIPPING_SUPPLIES_AISLE_TARGET,
    audience: "curated UCP storefront builders creating shipping-supplies, fulfillment, ecommerce-ops, warehouse, moving, or packing-station shelves",
    recommended_first_link_for_outreach: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
    live_urls: {
      aisle_json: STACK412_SHIPPING_SUPPLIES_AISLE_JSON_URL,
      aisle_markdown: STACK412_SHIPPING_SUPPLIES_AISLE_MARKDOWN_URL,
      aisle_html: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
      generic_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      source_demo_html: sourceAwareShelfDemoUrl(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE),
      import_feed_json: JSON_URL,
      import_feed_csv: CSV_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, 12),
      mcp_endpoint: sourceAwareMcpEndpoint(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, STACK412_SHIPPING_SUPPLIES_AISLE_TARGET),
      first_run: `https://mcp.packrift.com/r/run/${STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE}/${STACK412_SHIPPING_SUPPLIES_AISLE_TARGET}?format=html`,
      buyer_handoff: `https://mcp.packrift.com/r/order/${STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE}?format=html`,
      activation_packet: sourceAwareApprovalPacketUrl(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, "html"),
      integration_pack: sourceAwareIntegrationPackUrl(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, "html"),
    },
    storefront_pitch: [
      "Add a shipping-supplies aisle instead of manually curating packaging SKUs.",
      "Use Packrift for boxes, mailers, tape, labels, packing-list envelopes, stretch film, void fill, and fulfillment supplies.",
      "Keep the source slug intact so every shelf read, MCP first run, handoff, and order can be attributed.",
      "Run Packrift MCP live checks before buyer-confirmed cart handoff.",
    ],
    copy_paste: {
      one_line_script: oneLineShelfScriptSnippet(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, 12),
      full_embed_block: explicitShelfEmbedSnippet(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, 12),
      import_filter: `source_slug=${STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE}`,
      import_feed_url: JSON_URL,
    },
    first_run_json_rpc_sequence: [
      integrationProtocolRequest("tools", "tools/list"),
      integrationToolCall("search-stack412-aisle", "search_products", {
        query: "shipping supplies fulfillment boxes mailers tape labels void fill",
        mcp_source_context: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
        mcp_install_target: STACK412_SHIPPING_SUPPLIES_AISLE_TARGET,
      }),
      integrationToolCall("prepare-handoff-unconfirmed", "prepare_purchase_handoff", {
        sku: firstSampleItem?.sku ?? "{buyer_selected_exact_sku}",
        quantity: 1,
        buyer_confirmed: false,
        mcp_source_context: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
        mcp_install_target: STACK412_SHIPPING_SUPPLIES_AISLE_TARGET,
      }),
    ],
    buyer_confirmed_handoff_template: {
      sku: "{buyer_selected_exact_sku}",
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: STACK412_SHIPPING_SUPPLIES_AISLE_TARGET,
      mcp_source_context: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
      mcp_install_target: STACK412_SHIPPING_SUPPLIES_AISLE_TARGET,
    },
    aisle_summary: {
      row_count: shelf.row_count,
      bundle_count: shelf.bundles.length,
      source_label: shelf.source_label,
      shelf_label: shelf.shelf_label,
      placement_context: shelf.placement_context,
    },
    aisle_sections: aisleSections,
    measurement: {
      monitor_source_slug: STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE,
      pre_send_state:
        "Existing Packrift-owned source traffic may already include this source slug; use delta vs the local activation baseline after an approved external send.",
      success_progression: [
        "external operator opens or imports this aisle",
        "non-local source-aware shelf/script/resource activity appears",
        "source-aware MCP first-run or search_products activity appears",
        "buyer-confirmed prepare_purchase_handoff or measured /r/cart continuity appears",
        "Shopify order continuity preserves the source slug",
      ],
    },
    guardrails: [
      "Do not send externally until Farhan approves the exact recipient and message.",
      "Do not create or expose a direct cart URL before buyer confirmation.",
      "Do not claim sales success from page views, source-signal deltas, PRs, comments, or emails alone.",
      "Do not mutate products, pricing, inventory, feeds, or checkout from this activation path.",
    ],
  };
}

export function packriftUcpStack412ShippingSuppliesAisleMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpStack412ShippingSuppliesAislePayload(runtime);
  const sections = payload.aisle_sections
    .map(
      (section) =>
        `| ${escapeMarkdown(section.section_id)} | ${escapeMarkdown(section.title)} | ${escapeMarkdown(section.primary_ucp_query)} | ${section.item_count} |`
    )
    .join("\n");
  return [
    "# Packrift Stack412-Style Shipping Supplies Aisle",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## First Link For Outreach",
    "",
    payload.recommended_first_link_for_outreach,
    "",
    "## Live URLs",
    "",
    Object.entries(payload.live_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Storefront Pitch",
    "",
    payload.storefront_pitch.map((line) => `- ${line}`).join("\n"),
    "",
    "## Copy-Paste One-Line Script",
    "",
    fenced(payload.copy_paste.one_line_script, "html"),
    "",
    "## Full Embed Block",
    "",
    fenced(payload.copy_paste.full_embed_block, "html"),
    "",
    "## Import Filter",
    "",
    fenced(`${payload.copy_paste.import_feed_url}\n${payload.copy_paste.import_filter}`, "text"),
    "",
    "## Aisle Sections",
    "",
    "| Section | Title | Primary UCP Query | Items |",
    "| --- | --- | --- | ---: |",
    sections,
    "",
    "## First-Run JSON-RPC",
    "",
    fenced(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2), "json"),
    "",
    "## Buyer-Confirmed Handoff Template",
    "",
    fenced(JSON.stringify(payload.buyer_confirmed_handoff_template, null, 2), "json"),
    "",
    "## Guardrails",
    "",
    payload.guardrails.map((line) => `- ${line}`).join("\n"),
    "",
  ].join("\n");
}

export function packriftUcpStack412ShippingSuppliesAisleHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpStack412ShippingSuppliesAislePayload(runtime);
  const sectionCards = payload.aisle_sections
    .map((section) => {
      const items = section.sample_items
        .map(
          (item) => `<li><a href="${escapeHtml(item.product_url)}">${escapeHtml(item.sku)} - ${escapeHtml(item.title)}</a></li>`
        )
        .join("");
      return `<article>
        <div class="eyebrow">${escapeHtml(section.section_id)}</div>
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.storefront_intent)}</p>
        <p class="query">${escapeHtml(section.primary_ucp_query)}</p>
        <ul>${items}</ul>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Shipping Supplies Aisle for Stack412-Style UCP Storefronts</title>
  <meta name="description" content="Target-specific Packrift shipping-supplies aisle for Stack412-style curated UCP storefront operators.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#52645a;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--amber:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 54px}
    header{display:grid;gap:14px;padding:18px 0 22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.1rem,5.4vw,4.4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.12rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    a{color:var(--blue);text-underline-offset:3px}
    .chips,.actions{display:flex;flex-wrap:wrap;gap:8px}
    .chips span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:22px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}
    article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px;display:grid;gap:9px}
    .eyebrow,.query{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;color:var(--muted)}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px;font-size:.84rem}
    ul{margin:0;padding-left:18px;color:var(--muted)}
    .warn{color:var(--amber)}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Shipping supplies aisle</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="chips">
        <span>${escapeHtml(payload.release)}</span>
        <span>source=${escapeHtml(payload.source_slug)}</span>
        <span>target=${escapeHtml(payload.mcp_install_target)}</span>
        <span class="warn">buyer-confirmed cart handoff only</span>
      </div>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(payload.live_urls.first_run)}">Run MCP check</a>
        <a class="button primary" href="${escapeHtml(payload.live_urls.buyer_handoff)}">Buyer handoff</a>
        <a class="button" href="${escapeHtml(payload.live_urls.aisle_json)}">JSON</a>
        <a class="button" href="${escapeHtml(payload.live_urls.aisle_markdown)}">Markdown</a>
        <a class="button" href="${escapeHtml(payload.live_urls.import_feed_json)}">Import feed</a>
        <a class="button" href="${escapeHtml(payload.live_urls.integration_pack)}">Integration pack</a>
      </div>
    </header>
    <section>
      <h2>Copy-paste shelf</h2>
      <p>Use this when the storefront can load a script. Use the import filter when the storefront has its own renderer.</p>
      <pre>${escapeHtml(payload.copy_paste.one_line_script)}</pre>
      <pre>${escapeHtml(`${payload.copy_paste.import_feed_url}\n${payload.copy_paste.import_filter}`)}</pre>
    </section>
    <section>
      <h2>Live aisle preview</h2>
      <script async data-packrift-ucp-shelf src="${escapeHtml(sourceAwareShelfEmbedJsUrl(STACK412_SHIPPING_SUPPLIES_AISLE_SOURCE, 12))}"></script>
    </section>
    <section>
      <h2>Aisle sections</h2>
      <div class="grid">${sectionCards}</div>
    </section>
    <section>
      <h2>Proof rule</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function packriftUcpPlugThatShopContextualShelfPayload(runtime: UcpStarterCatalogRuntime) {
  const shelfPayload = mcpUcpStorefrontShelfPayload(runtime);
  const shelf = shelfPayload.shelves.find((entry) => entry.source_slug === PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE);
  if (!shelf) throw new Error(`Missing shelf source: ${PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE}`);
  const firstSampleItem = shelf.bundles.flatMap((bundle) => bundle.items)[0];
  const embedContexts = shelf.bundles.map((bundle) => ({
    context_id: bundle.bundle_id,
    title: bundle.bundle_title,
    storefront_intent: bundle.storefront_intent,
    primary_ucp_query: bundle.primary_ucp_query,
    item_count: bundle.items.length,
    sample_items: bundle.items.slice(0, 6).map((item) => ({
      sku: item.sku,
      title: item.title,
      family: item.family,
      product_url: item.product_url,
      mcp_sku_json: item.mcp_sku_json,
      order_handoff_url: item.order_handoff_url,
    })),
  }));
  return {
    release: PLUGTHATSHOP_CONTEXTUAL_SHELF_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Target-specific contextual shipping-supplies shelf for PlugThatShop-style embedded shop builders. It turns Packrift from a generic product source into a ready packaging upsell block for ecommerce, fulfillment, logistics, moving, warehouse, and small-business pages.",
    completion_boundary:
      "This embedded shelf page improves the first external ask but is not sales proof. Completion still requires external builder install, embed, or use plus source-attributed MCP/cart/order continuity.",
    source_slug: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
    mcp_install_target: PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET,
    audience: "contextual embedded-shop builders adding shoppable product blocks to ecommerce, fulfillment, logistics, warehouse, moving, or small-business content",
    recommended_first_link_for_outreach: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
    live_urls: {
      shelf_json: PLUGTHATSHOP_CONTEXTUAL_SHELF_JSON_URL,
      shelf_markdown: PLUGTHATSHOP_CONTEXTUAL_SHELF_MARKDOWN_URL,
      shelf_html: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
      generic_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      source_demo_html: sourceAwareShelfDemoUrl(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE),
      import_feed_json: JSON_URL,
      import_feed_csv: CSV_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, 12),
      mcp_endpoint: sourceAwareMcpEndpoint(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET),
      first_run: `https://mcp.packrift.com/r/run/${PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE}/${PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET}?format=html`,
      buyer_handoff: `https://mcp.packrift.com/r/order/${PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE}?format=html`,
      activation_packet: sourceAwareApprovalPacketUrl(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, "html"),
      integration_pack: sourceAwareIntegrationPackUrl(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, "html"),
    },
    embed_pitch: [
      "Add Packrift as a contextual product block when a page mentions ecommerce shipping, fulfillment, packing, moving, warehouse operations, or small-business logistics.",
      "Use Packrift for boxes, mailers, tape, labels, packing-list envelopes, stretch film, void fill, and fulfillment supplies.",
      "Keep the source slug intact so every embed load, MCP first run, handoff, and order can be attributed.",
      "Run Packrift MCP live checks before buyer-confirmed cart handoff.",
    ],
    copy_paste: {
      one_line_script: oneLineShelfScriptSnippet(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, 12),
      full_embed_block: explicitShelfEmbedSnippet(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, 12),
      import_filter: `source_slug=${PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE}`,
      import_feed_url: JSON_URL,
    },
    first_run_json_rpc_sequence: [
      integrationProtocolRequest("tools", "tools/list"),
      integrationToolCall("search-plugthatshop-shelf", "search_products", {
        query: "ecommerce shipping supplies boxes mailers tape labels packing material",
        mcp_source_context: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
        mcp_install_target: PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET,
      }),
      integrationToolCall("prepare-handoff-unconfirmed", "prepare_purchase_handoff", {
        sku: firstSampleItem?.sku ?? "{buyer_selected_exact_sku}",
        quantity: 1,
        buyer_confirmed: false,
        mcp_source_context: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
        mcp_install_target: PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET,
      }),
    ],
    buyer_confirmed_handoff_template: {
      sku: "{buyer_selected_exact_sku}",
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET,
      mcp_source_context: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
      mcp_install_target: PLUGTHATSHOP_CONTEXTUAL_SHELF_TARGET,
    },
    shelf_summary: {
      row_count: shelf.row_count,
      bundle_count: shelf.bundles.length,
      source_label: shelf.source_label,
      shelf_label: shelf.shelf_label,
      placement_context: shelf.placement_context,
    },
    embed_contexts: embedContexts,
    measurement: {
      monitor_source_slug: PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE,
      pre_send_state:
        "Existing Packrift-owned source traffic may already include this source slug; use delta vs the local activation baseline after an approved external send.",
      success_progression: [
        "external builder opens or embeds this shelf",
        "non-local source-aware shelf/script/resource activity appears",
        "source-aware MCP first-run or search_products activity appears",
        "buyer-confirmed prepare_purchase_handoff or measured /r/cart continuity appears",
        "Shopify order continuity preserves the source slug",
      ],
    },
    guardrails: [
      "Do not send externally until Farhan approves the exact recipient and message.",
      "Do not create or expose a direct cart URL before buyer confirmation.",
      "Do not claim sales success from page views, source-signal deltas, PRs, comments, or messages alone.",
      "Do not mutate products, pricing, inventory, feeds, or checkout from this activation path.",
    ],
  };
}

export function packriftUcpPlugThatShopContextualShelfMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpPlugThatShopContextualShelfPayload(runtime);
  const contexts = payload.embed_contexts
    .map(
      (context) =>
        `| ${escapeMarkdown(context.context_id)} | ${escapeMarkdown(context.title)} | ${escapeMarkdown(context.primary_ucp_query)} | ${context.item_count} |`
    )
    .join("\n");
  return [
    "# Packrift PlugThatShop-Style Contextual Shipping Shelf",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## First Link For Outreach",
    "",
    payload.recommended_first_link_for_outreach,
    "",
    "## Live URLs",
    "",
    Object.entries(payload.live_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Embed Pitch",
    "",
    payload.embed_pitch.map((line) => `- ${line}`).join("\n"),
    "",
    "## Copy-Paste One-Line Script",
    "",
    fenced(payload.copy_paste.one_line_script, "html"),
    "",
    "## Full Embed Block",
    "",
    fenced(payload.copy_paste.full_embed_block, "html"),
    "",
    "## Import Filter",
    "",
    fenced(`${payload.copy_paste.import_feed_url}\n${payload.copy_paste.import_filter}`, "text"),
    "",
    "## Embed Contexts",
    "",
    "| Context | Title | Primary UCP Query | Items |",
    "| --- | --- | --- | ---: |",
    contexts,
    "",
    "## First-Run JSON-RPC",
    "",
    fenced(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2), "json"),
    "",
    "## Buyer-Confirmed Handoff Template",
    "",
    fenced(JSON.stringify(payload.buyer_confirmed_handoff_template, null, 2), "json"),
    "",
    "## Guardrails",
    "",
    payload.guardrails.map((line) => `- ${line}`).join("\n"),
    "",
  ].join("\n");
}

export function packriftUcpPlugThatShopContextualShelfHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpPlugThatShopContextualShelfPayload(runtime);
  const contextCards = payload.embed_contexts
    .map((context) => {
      const items = context.sample_items
        .map(
          (item) => `<li><a href="${escapeHtml(item.product_url)}">${escapeHtml(item.sku)} - ${escapeHtml(item.title)}</a></li>`
        )
        .join("");
      return `<article>
        <div class="eyebrow">${escapeHtml(context.context_id)}</div>
        <h2>${escapeHtml(context.title)}</h2>
        <p>${escapeHtml(context.storefront_intent)}</p>
        <p class="query">${escapeHtml(context.primary_ucp_query)}</p>
        <ul>${items}</ul>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Contextual Shipping Shelf for PlugThatShop-Style Embeds</title>
  <meta name="description" content="Target-specific Packrift contextual shipping-supplies shelf for PlugThatShop-style embedded shop builders.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#52645a;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--amber:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 54px}
    header{display:grid;gap:14px;padding:18px 0 22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.1rem,5.4vw,4.4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.12rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    a{color:var(--blue);text-underline-offset:3px}
    .chips,.actions{display:flex;flex-wrap:wrap;gap:8px}
    .chips span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:22px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}
    article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px;display:grid;gap:9px}
    .eyebrow,.query{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;color:var(--muted)}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px;font-size:.84rem}
    ul{margin:0;padding-left:18px;color:var(--muted)}
    .warn{color:var(--amber)}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Contextual shipping shelf</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="chips">
        <span>${escapeHtml(payload.release)}</span>
        <span>source=${escapeHtml(payload.source_slug)}</span>
        <span>target=${escapeHtml(payload.mcp_install_target)}</span>
        <span class="warn">buyer-confirmed cart handoff only</span>
      </div>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(payload.live_urls.first_run)}">Run MCP check</a>
        <a class="button primary" href="${escapeHtml(payload.live_urls.buyer_handoff)}">Buyer handoff</a>
        <a class="button" href="${escapeHtml(payload.live_urls.shelf_json)}">JSON</a>
        <a class="button" href="${escapeHtml(payload.live_urls.shelf_markdown)}">Markdown</a>
        <a class="button" href="${escapeHtml(payload.live_urls.import_feed_json)}">Import feed</a>
        <a class="button" href="${escapeHtml(payload.live_urls.integration_pack)}">Integration pack</a>
      </div>
    </header>
    <section>
      <h2>Copy-paste embed</h2>
      <p>Use this when the page can load a script. Use the import filter when the embedded shop renderer owns the card UI.</p>
      <pre>${escapeHtml(payload.copy_paste.one_line_script)}</pre>
      <pre>${escapeHtml(`${payload.copy_paste.import_feed_url}\n${payload.copy_paste.import_filter}`)}</pre>
    </section>
    <section>
      <h2>Live shelf preview</h2>
      <script async data-packrift-ucp-shelf src="${escapeHtml(sourceAwareShelfEmbedJsUrl(PLUGTHATSHOP_CONTEXTUAL_SHELF_SOURCE, 12))}"></script>
    </section>
    <section>
      <h2>Recommended contexts</h2>
      <div class="grid">${contextCards}</div>
    </section>
    <section>
      <h2>Proof rule</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function packriftUcpOpenScoutShoppingAgentPathPayload(runtime: UcpStarterCatalogRuntime) {
  const shelfPayload = mcpUcpStorefrontShelfPayload(runtime);
  const shelf = shelfPayload.shelves.find((entry) => entry.source_slug === OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE);
  if (!shelf) throw new Error(`Missing shelf source: ${OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE}`);
  const firstSampleItem = shelf.bundles.flatMap((bundle) => bundle.items)[0];
  const agentIntents = shelf.bundles.map((bundle) => ({
    intent_id: bundle.bundle_id,
    buyer_intent: bundle.storefront_intent,
    trigger_queries: [
      bundle.primary_ucp_query,
      `${bundle.bundle_title} packaging supplies`,
      `${bundle.bundle_title} shipping supplies`,
    ],
    item_count: bundle.items.length,
    sample_items: bundle.items.slice(0, 5).map((item) => ({
      sku: item.sku,
      title: item.title,
      family: item.family,
      product_url: item.product_url,
      mcp_sku_json: item.mcp_sku_json,
      order_handoff_url: item.order_handoff_url,
    })),
  }));
  return {
    release: OPEN_SCOUT_SHOPPING_AGENT_PATH_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Target-specific packaging-source route for Open Scout-style shopping agents. It gives chat, web, SMS, and WhatsApp agents a Packrift-first path for shipping supplies, ecommerce packing materials, warehouse replenishment, fragile shipping, moving supplies, and packing-station operations.",
    completion_boundary:
      "This shopping-agent path improves the first external ask but is not sales proof. Completion still requires external builder install, agent routing, source-aware MCP use, and source-attributed cart or order continuity.",
    source_slug: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
    mcp_install_target: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
    audience: "shopping-agent builders that need a source-aware packaging route before generic catalog or marketplace fallback",
    recommended_first_link_for_outreach: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
    live_urls: {
      agent_path_json: OPEN_SCOUT_SHOPPING_AGENT_PATH_JSON_URL,
      agent_path_markdown: OPEN_SCOUT_SHOPPING_AGENT_PATH_MARKDOWN_URL,
      agent_path_html: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
      generic_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      source_demo_html: sourceAwareShelfDemoUrl(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE),
      import_feed_json: JSON_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE, 12),
      mcp_endpoint: sourceAwareMcpEndpoint(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE, OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET),
      first_run: `https://mcp.packrift.com/r/run/${OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE}/${OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET}?format=html`,
      buyer_handoff: `https://mcp.packrift.com/r/order/${OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE}?format=html`,
      activation_packet: sourceAwareApprovalPacketUrl(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE, "html"),
      integration_pack: sourceAwareIntegrationPackUrl(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE, "html"),
    },
    agent_routing_rule: {
      name: "packriftPackagingSource",
      source: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
      endpoint: sourceAwareMcpEndpoint(OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE, OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET),
      route_first_for_intents: [
        "shipping supplies",
        "packaging supplies",
        "shipping boxes",
        "mailers",
        "packing tape",
        "warehouse replenishment",
        "fragile item shipping",
        "moving supplies",
        "packing station supplies",
        "ecommerce fulfillment packaging",
      ],
      fallback_policy:
        "Call Packrift MCP first for packaging and fulfillment supply intent; use generic catalog or marketplace fallback only when Packrift returns no exact match or no suitable alternative.",
      first_tool_calls: ["tools/list", "search_products", "find_packaging_for_item", "prepare_purchase_handoff"],
      buyer_confirmation_required_before_cart_url: true,
    },
    first_run_json_rpc_sequence: [
      integrationProtocolRequest("tools", "tools/list"),
      integrationToolCall("search-open-scout-packaging-intent", "search_products", {
        query: "shipping boxes mailers tape labels warehouse replenishment",
        mcp_source_context: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
        mcp_install_target: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
      }),
      integrationToolCall("fit-item-before-handoff", "find_packaging_for_item", {
        item_description: "ship 12 folded t-shirts from a Shopify store",
        constraints: ["low damage risk", "lightweight", "mail-ready"],
        mcp_source_context: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
        mcp_install_target: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
      }),
      integrationToolCall("prepare-handoff-unconfirmed", "prepare_purchase_handoff", {
        sku: firstSampleItem?.sku ?? "{buyer_selected_exact_sku}",
        quantity: 1,
        buyer_confirmed: false,
        mcp_source_context: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
        mcp_install_target: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
      }),
    ],
    buyer_confirmed_handoff_template: {
      sku: "{buyer_selected_exact_sku}",
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
      mcp_source_context: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
      mcp_install_target: OPEN_SCOUT_SHOPPING_AGENT_PATH_TARGET,
    },
    agent_path_summary: {
      row_count: shelf.row_count,
      bundle_count: shelf.bundles.length,
      source_label: shelf.source_label,
      shelf_label: shelf.shelf_label,
      placement_context: shelf.placement_context,
    },
    agent_intents: agentIntents,
    measurement: {
      monitor_source_slug: OPEN_SCOUT_SHOPPING_AGENT_PATH_SOURCE,
      pre_send_state:
        "Existing Packrift-owned source traffic may already include this source slug; use delta vs the local activation baseline after an approved external send.",
      success_progression: [
        "external agent builder opens this path",
        "agent config or prompt routes packaging intent to Packrift",
        "non-local source-aware tools/list or search_products activity appears",
        "buyer-confirmed prepare_purchase_handoff or measured /r/cart continuity appears",
        "Shopify order continuity preserves the source slug",
      ],
    },
    guardrails: [
      "Do not send externally until Farhan approves the exact recipient and message.",
      "Do not create or expose a direct cart URL before buyer confirmation.",
      "Do not claim sales success from page views, source-signal deltas, PRs, comments, or messages alone.",
      "Do not mutate products, pricing, inventory, feeds, or checkout from this activation path.",
    ],
  };
}

export function packriftUcpOpenScoutShoppingAgentPathMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpOpenScoutShoppingAgentPathPayload(runtime);
  const intents = payload.agent_intents
    .map(
      (intent) =>
        `| ${escapeMarkdown(intent.intent_id)} | ${escapeMarkdown(intent.buyer_intent)} | ${escapeMarkdown(intent.trigger_queries[0] ?? "")} | ${intent.item_count} |`
    )
    .join("\n");
  return [
    "# Packrift Open Scout-Style Shopping Agent Path",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## First Link For Outreach",
    "",
    payload.recommended_first_link_for_outreach,
    "",
    "## Agent Routing Rule",
    "",
    fenced(JSON.stringify(payload.agent_routing_rule, null, 2), "json"),
    "",
    "## Live URLs",
    "",
    Object.entries(payload.live_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Agent Intents",
    "",
    "| Intent | Buyer intent | Primary query | Items |",
    "| --- | --- | --- | ---: |",
    intents,
    "",
    "## First-Run JSON-RPC",
    "",
    fenced(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2), "json"),
    "",
    "## Buyer-Confirmed Handoff Template",
    "",
    fenced(JSON.stringify(payload.buyer_confirmed_handoff_template, null, 2), "json"),
    "",
    "## Guardrails",
    "",
    payload.guardrails.map((line) => `- ${line}`).join("\n"),
    "",
  ].join("\n");
}

export function packriftUcpOpenScoutShoppingAgentPathHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpOpenScoutShoppingAgentPathPayload(runtime);
  const intentCards = payload.agent_intents
    .map((intent) => {
      const queries = intent.trigger_queries.map((query) => `<li>${escapeHtml(query)}</li>`).join("");
      const items = intent.sample_items
        .map(
          (item) => `<li><a href="${escapeHtml(item.product_url)}">${escapeHtml(item.sku)} - ${escapeHtml(item.title)}</a></li>`
        )
        .join("");
      return `<article>
        <div class="eyebrow">${escapeHtml(intent.intent_id)}</div>
        <h2>${escapeHtml(intent.buyer_intent)}</h2>
        <p>Trigger queries</p>
        <ul>${queries}</ul>
        <p>Sample Packrift rows</p>
        <ul>${items}</ul>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Packaging Route for Open Scout-Style Shopping Agents</title>
  <meta name="description" content="Target-specific Packrift packaging-source route for Open Scout-style UCP shopping agents.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#52645a;--line:#d8ded8;--paper:#f6f7f1;--panel:#fff;--green:#116149;--blue:#245f9b;--amber:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 54px}
    header{display:grid;gap:14px;padding:18px 0 22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.1rem,5.4vw,4.4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.12rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    a{color:var(--blue);text-underline-offset:3px}
    .chips,.actions{display:flex;flex-wrap:wrap;gap:8px}
    .chips span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:22px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}
    article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px;display:grid;gap:9px}
    .eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;color:var(--muted)}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px;font-size:.84rem}
    ul{margin:0;padding-left:18px;color:var(--muted)}
    .warn{color:var(--amber)}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packaging route for shopping agents</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="chips">
        <span>${escapeHtml(payload.release)}</span>
        <span>source=${escapeHtml(payload.source_slug)}</span>
        <span>target=${escapeHtml(payload.mcp_install_target)}</span>
        <span class="warn">buyer-confirmed cart handoff only</span>
      </div>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(payload.live_urls.first_run)}">Run MCP check</a>
        <a class="button primary" href="${escapeHtml(payload.live_urls.buyer_handoff)}">Buyer handoff</a>
        <a class="button" href="${escapeHtml(payload.live_urls.agent_path_json)}">JSON</a>
        <a class="button" href="${escapeHtml(payload.live_urls.agent_path_markdown)}">Markdown</a>
        <a class="button" href="${escapeHtml(payload.live_urls.integration_pack)}">Integration pack</a>
      </div>
    </header>
    <section>
      <h2>Routing rule</h2>
      <pre>${escapeHtml(JSON.stringify(payload.agent_routing_rule, null, 2))}</pre>
    </section>
    <section>
      <h2>First-run sequence</h2>
      <pre>${escapeHtml(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2))}</pre>
    </section>
    <section>
      <h2>Agent intents</h2>
      <div class="grid">${intentCards}</div>
    </section>
    <section>
      <h2>Proof rule</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function packriftUcpUpsonicAgentWorkflowPayload(runtime: UcpStarterCatalogRuntime) {
  const shelfPayload = mcpUcpStorefrontShelfPayload(runtime);
  const shelf = shelfPayload.shelves.find((entry) => entry.source_slug === UPSONIC_AGENT_WORKFLOW_SOURCE);
  if (!shelf) throw new Error(`Missing shelf source: ${UPSONIC_AGENT_WORKFLOW_SOURCE}`);
  const firstSampleItem = shelf.bundles.flatMap((bundle) => bundle.items)[0];
  const workflowSteps = [
    {
      step_id: "intent_analysis",
      agent_role: "Intent analyzer",
      required_behavior:
        "Detect packaging, shipping supplies, boxes, mailers, tape, labels, stretch film, warehouse replenishment, packing station, and fulfillment-supplies intent before generic product discovery.",
      packrift_action: "Route matching intents to the Packrift source-aware MCP endpoint first.",
    },
    {
      step_id: "packrift_search",
      agent_role: "Product fetcher",
      required_behavior:
        "Call Packrift MCP search_products or find_packaging_for_item with the buyer's dimensional, material, pack-count, and use-case constraints.",
      packrift_action: "Return AI-approved Packrift rows with SKU, title, family, URL, image, and MCP SKU resource links.",
    },
    {
      step_id: "exact_spec_filter",
      agent_role: "Filter agent",
      required_behavior:
        "Rank results by exact dimensions, board/material, closure, pack size, in-stock status, and reasonable substitutions. Explain no-match outcomes instead of forcing a bad fit.",
      packrift_action: "Use compare_alternatives or explain_no_exact_match when the first result is weak.",
    },
    {
      step_id: "live_price_inventory",
      agent_role: "Live-check agent",
      required_behavior:
        "Check pricing and inventory before presenting a buyer-ready recommendation.",
      packrift_action: "Call get_pricing and check_inventory for shortlisted SKUs.",
    },
    {
      step_id: "buyer_confirmed_handoff",
      agent_role: "Cart handoff agent",
      required_behavior:
        "Prepare an unconfirmed handoff during evaluation and create a measured cart URL only after the buyer confirms exact SKU and quantity.",
      packrift_action: "Use prepare_purchase_handoff with buyer_confirmed=false first, then buyer_confirmed=true only after confirmation.",
    },
  ];
  const demoBundles = shelf.bundles.map((bundle) => ({
    bundle_id: bundle.bundle_id,
    workflow_prompt: bundle.primary_ucp_query,
    buyer_job: bundle.storefront_intent,
    item_count: bundle.items.length,
    sample_items: bundle.items.slice(0, 5).map((item) => ({
      sku: item.sku,
      title: item.title,
      family: item.family,
      product_url: item.product_url,
      mcp_sku_json: item.mcp_sku_json,
      order_handoff_url: item.order_handoff_url,
    })),
  }));
  return {
    release: UPSONIC_AGENT_WORKFLOW_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Target-specific packaging workflow for Upsonic-style Shopify UCP agent frameworks. It turns Packrift into a concrete packaging vertical example for intent analysis, product fetching, exact-spec filtering, live price/inventory checks, and buyer-confirmed handoff.",
    completion_boundary:
      "This agent-framework workflow improves the first external PR/demo ask but is not sales proof. Completion still requires external framework install, merge, demo use, source-aware MCP activity, and source-attributed cart or order continuity.",
    source_slug: UPSONIC_AGENT_WORKFLOW_SOURCE,
    mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
    audience: "UCP agent-framework maintainers and demo apps that need a realistic vertical workflow beyond generic product search",
    recommended_first_link_for_outreach: UPSONIC_AGENT_WORKFLOW_HTML_URL,
    live_urls: {
      workflow_json: UPSONIC_AGENT_WORKFLOW_JSON_URL,
      workflow_markdown: UPSONIC_AGENT_WORKFLOW_MARKDOWN_URL,
      workflow_html: UPSONIC_AGENT_WORKFLOW_HTML_URL,
      generic_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      source_demo_html: sourceAwareShelfDemoUrl(UPSONIC_AGENT_WORKFLOW_SOURCE),
      import_feed_json: JSON_URL,
      shelf_script: sourceAwareShelfEmbedJsUrl(UPSONIC_AGENT_WORKFLOW_SOURCE, 12),
      mcp_endpoint: sourceAwareMcpEndpoint(UPSONIC_AGENT_WORKFLOW_SOURCE, UPSONIC_AGENT_WORKFLOW_TARGET),
      first_run: `https://mcp.packrift.com/r/run/${UPSONIC_AGENT_WORKFLOW_SOURCE}/${UPSONIC_AGENT_WORKFLOW_TARGET}?format=html`,
      buyer_handoff: `https://mcp.packrift.com/r/order/${UPSONIC_AGENT_WORKFLOW_SOURCE}?format=html`,
      activation_packet: sourceAwareApprovalPacketUrl(UPSONIC_AGENT_WORKFLOW_SOURCE, "html"),
      integration_pack: sourceAwareIntegrationPackUrl(UPSONIC_AGENT_WORKFLOW_SOURCE, "html"),
    },
    framework_workflow: {
      name: "PACKRIFT_PACKAGING_WORKFLOW",
      source: UPSONIC_AGENT_WORKFLOW_SOURCE,
      endpoint: sourceAwareMcpEndpoint(UPSONIC_AGENT_WORKFLOW_SOURCE, UPSONIC_AGENT_WORKFLOW_TARGET),
      route_first_for_intents: [
        "exact packaging dimensions",
        "shipping supplies",
        "corrugated boxes",
        "mailer boxes",
        "poly mailers",
        "packing tape",
        "stretch film",
        "warehouse replenishment",
        "packing station supplies",
        "ecommerce fulfillment packaging",
      ],
      steps: workflowSteps.map((step) => step.step_id),
      buyer_confirmation_required_before_cart_url: true,
    },
    workflow_steps: workflowSteps,
    first_run_json_rpc_sequence: [
      integrationProtocolRequest("tools", "tools/list"),
      integrationToolCall("search-upsonic-packaging-workflow", "search_products", {
        query: "warehouse shipping supplies boxes tape stretch film labels",
        mcp_source_context: UPSONIC_AGENT_WORKFLOW_SOURCE,
        mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
      }),
      integrationToolCall("fit-packaging-for-demo-order", "find_packaging_for_item", {
        item_description: "ship 25 ecommerce apparel orders with mailers, labels, and backup corrugated boxes",
        constraints: ["source-aware MCP", "live price check", "buyer-confirmed handoff"],
        mcp_source_context: UPSONIC_AGENT_WORKFLOW_SOURCE,
        mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
      }),
      integrationToolCall("check-demo-sku-price", "get_pricing", {
        sku: firstSampleItem?.sku ?? "{buyer_selected_exact_sku}",
        mcp_source_context: UPSONIC_AGENT_WORKFLOW_SOURCE,
        mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
      }),
      integrationToolCall("prepare-handoff-unconfirmed", "prepare_purchase_handoff", {
        sku: firstSampleItem?.sku ?? "{buyer_selected_exact_sku}",
        quantity: 1,
        buyer_confirmed: false,
        mcp_source_context: UPSONIC_AGENT_WORKFLOW_SOURCE,
        mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
      }),
    ],
    buyer_confirmed_handoff_template: {
      sku: "{buyer_selected_exact_sku}",
      quantity: "{buyer_selected_quantity}",
      buyer_confirmed: true,
      source_context: UPSONIC_AGENT_WORKFLOW_TARGET,
      mcp_source_context: UPSONIC_AGENT_WORKFLOW_SOURCE,
      mcp_install_target: UPSONIC_AGENT_WORKFLOW_TARGET,
    },
    workflow_summary: {
      row_count: shelf.row_count,
      bundle_count: shelf.bundles.length,
      source_label: shelf.source_label,
      shelf_label: shelf.shelf_label,
      placement_context: shelf.placement_context,
    },
    demo_bundles: demoBundles,
    measurement: {
      monitor_source_slug: UPSONIC_AGENT_WORKFLOW_SOURCE,
      pre_send_state:
        "Existing Packrift-owned source traffic may already include this source slug; use delta vs the local activation baseline after an approved external PR or maintainer action.",
      success_progression: [
        "external framework maintainer opens or reviews this path",
        "example app or workflow graph adds Packrift as a packaging vertical",
        "non-local source-aware tools/list or search_products activity appears",
        "buyer-confirmed prepare_purchase_handoff or measured /r/cart continuity appears",
        "Shopify order continuity preserves the source slug",
      ],
    },
    guardrails: [
      "Do not open a PR, issue, discussion, or maintainer message until Farhan approves the exact external action.",
      "Do not create or expose a direct cart URL before buyer confirmation.",
      "Do not claim sales success from page views, source-signal deltas, PRs, comments, or messages alone.",
      "Do not mutate products, pricing, inventory, feeds, or checkout from this activation path.",
    ],
  };
}

export function packriftUcpUpsonicAgentWorkflowMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpUpsonicAgentWorkflowPayload(runtime);
  const steps = payload.workflow_steps
    .map(
      (step) =>
        `| ${escapeMarkdown(step.step_id)} | ${escapeMarkdown(step.agent_role)} | ${escapeMarkdown(step.required_behavior)} |`
    )
    .join("\n");
  const bundles = payload.demo_bundles
    .map((bundle) => `| ${escapeMarkdown(bundle.bundle_id)} | ${escapeMarkdown(bundle.workflow_prompt)} | ${bundle.item_count} |`)
    .join("\n");
  return [
    "# Packrift Upsonic-Style Agent Workflow",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## First Link For PR / Maintainer Outreach",
    "",
    payload.recommended_first_link_for_outreach,
    "",
    "## Framework Workflow",
    "",
    fenced(JSON.stringify(payload.framework_workflow, null, 2), "json"),
    "",
    "## Workflow Steps",
    "",
    "| Step | Agent role | Required behavior |",
    "| --- | --- | --- |",
    steps,
    "",
    "## Demo Bundles",
    "",
    "| Bundle | Workflow prompt | Items |",
    "| --- | --- | ---: |",
    bundles,
    "",
    "## First-Run JSON-RPC",
    "",
    fenced(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2), "json"),
    "",
    "## Buyer-Confirmed Handoff Template",
    "",
    fenced(JSON.stringify(payload.buyer_confirmed_handoff_template, null, 2), "json"),
    "",
    "## Guardrails",
    "",
    payload.guardrails.map((line) => `- ${line}`).join("\n"),
    "",
  ].join("\n");
}

export function packriftUcpUpsonicAgentWorkflowHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpUpsonicAgentWorkflowPayload(runtime);
  const stepCards = payload.workflow_steps
    .map(
      (step) => `<article>
        <div class="eyebrow">${escapeHtml(step.step_id)}</div>
        <h2>${escapeHtml(step.agent_role)}</h2>
        <p>${escapeHtml(step.required_behavior)}</p>
        <p>${escapeHtml(step.packrift_action)}</p>
      </article>`
    )
    .join("");
  const bundleCards = payload.demo_bundles
    .map((bundle) => {
      const items = bundle.sample_items
        .map((item) => `<li><a href="${escapeHtml(item.product_url)}">${escapeHtml(item.sku)} - ${escapeHtml(item.title)}</a></li>`)
        .join("");
      return `<article>
        <div class="eyebrow">${escapeHtml(bundle.bundle_id)}</div>
        <h2>${escapeHtml(bundle.buyer_job)}</h2>
        <p>${escapeHtml(bundle.workflow_prompt)}</p>
        <ul>${items}</ul>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift Packaging Workflow for Upsonic-Style UCP Agents</title>
  <meta name="description" content="Target-specific Packrift packaging workflow for Upsonic-style Shopify UCP agent frameworks.">
  <style>
    :root{color-scheme:light;--ink:#18231d;--muted:#536158;--line:#d9ded8;--paper:#f7f7f2;--panel:#fff;--green:#0f6a4d;--blue:#245f9b;--amber:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:30px 16px 54px}
    header{display:grid;gap:14px;padding:18px 0 22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2.1rem,5.4vw,4.4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.12rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    a{color:var(--blue);text-underline-offset:3px}
    .chips,.actions{display:flex;flex-wrap:wrap;gap:8px}
    .chips span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted);font-size:.9rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    section{padding:22px 0;border-bottom:1px solid var(--line)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}
    article{background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px;display:grid;gap:9px}
    .eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84rem;color:var(--muted)}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px;font-size:.84rem}
    ul{margin:0;padding-left:18px;color:var(--muted)}
    .warn{color:var(--amber)}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packaging workflow for UCP agents</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="chips">
        <span>${escapeHtml(payload.release)}</span>
        <span>source=${escapeHtml(payload.source_slug)}</span>
        <span>target=${escapeHtml(payload.mcp_install_target)}</span>
        <span class="warn">buyer-confirmed cart handoff only</span>
      </div>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(payload.live_urls.first_run)}">Run MCP check</a>
        <a class="button primary" href="${escapeHtml(payload.live_urls.buyer_handoff)}">Buyer handoff</a>
        <a class="button" href="${escapeHtml(payload.live_urls.workflow_json)}">JSON</a>
        <a class="button" href="${escapeHtml(payload.live_urls.workflow_markdown)}">Markdown</a>
        <a class="button" href="${escapeHtml(payload.live_urls.integration_pack)}">Integration pack</a>
      </div>
    </header>
    <section>
      <h2>Workflow contract</h2>
      <pre>${escapeHtml(JSON.stringify(payload.framework_workflow, null, 2))}</pre>
    </section>
    <section>
      <h2>Agent chain</h2>
      <div class="grid">${stepCards}</div>
    </section>
    <section>
      <h2>Demo bundles</h2>
      <div class="grid">${bundleCards}</div>
    </section>
    <section>
      <h2>First-run sequence</h2>
      <pre>${escapeHtml(JSON.stringify(payload.first_run_json_rpc_sequence, null, 2))}</pre>
    </section>
    <section>
      <h2>Proof rule</h2>
      <p>${escapeHtml(payload.completion_boundary)}</p>
    </section>
  </main>
</body>
</html>`;
}

function integrationTargetNotes(source: string) {
  if (source === "plugthatshop_style_embed") {
    return {
      repository_or_surface: "PlugThatShop-style contextual embed",
      patch_location: "Add the one-line shelf script beside the contextual shop render path for ecommerce, fulfillment, shipping, warehouse, moving, or small-business content.",
      primary_files_to_try: ["embed component", "shop widget template", "context-to-products mapper"],
      buyer_intents: ["shipping supplies", "ecommerce packing materials", "fulfillment supplies", "small business shipping", "moving boxes"],
      patch_note:
        "Use the companion shelf as a packaging upsell block. Keep the source slug in the script URL and never replace the MCP handoff with a direct cart URL before buyer confirmation.",
    };
  }
  if (source === "open_scout_shopping_agent") {
    return {
      repository_or_surface: "Open Scout-style shopping agent",
      patch_location: "Add Packrift as the packaging supplier route in the shopping intent handler and mirror the shelf in any web companion UI.",
      primary_files_to_try: ["shopping intent router", "merchant/source config", "tool-call planner", "web companion shelf"],
      buyer_intents: ["packaging supplies", "warehouse replenishment", "fragile shipping", "shipping boxes", "mailers and poly bags"],
      patch_note:
        "Route packaging intents to Packrift MCP first, run live checks, then create a measured /r/cart URL only after the buyer confirms SKU and quantity.",
    };
  }
  if (source === "upsonic_ucp_agent_framework") {
    return {
      repository_or_surface: "Upsonic-style Shopify UCP agent framework",
      patch_location: "Add Packrift as the packaging vertical in the intent, product-fetching, filtering, live-check, and handoff agent chain.",
      primary_files_to_try: ["agent workflow graph", "intent analysis step", "product fetch step", "filter agent", "cart handoff step"],
      buyer_intents: ["exact packaging dimensions", "packing station supplies", "corrugated boxes", "stretch film", "document envelopes"],
      patch_note:
        "Packaging is a strong agent-demo vertical because the flow needs dimensions, pack count, material, live price, inventory, and buyer-confirmed handoff.",
    };
  }
  if (source === "agorio_shopping_agent_sdk") {
    return {
      repository_or_surface: "Nolpak14/agorio shopping-agent SDK",
      patch_location: "Add a Packrift packaging-source example for ShoppingAgent or McpClient flows, using Packrift MCP before generic catalog fallback for packaging intent.",
      primary_files_to_try: ["examples/real-merchant.ts", "examples/product-researcher.ts", "docs/adapters-registry.md", "docs/plugins-registry.md", "README.md"],
      buyer_intents: ["shipping supplies", "exact packaging dimensions", "warehouse replenishment", "packaging procurement", "fragile item shipping"],
      patch_note:
        "Use Packrift as a realistic UCP/MCP merchant example for purchase-capable shopping agents. Keep buyer_confirmed=false until the buyer confirms exact SKU and quantity.",
    };
  }
  if (source === "stack412_style_storefront") {
    return {
      repository_or_surface: "Stack412-style curated UCP storefront",
      patch_location: "Add a Packrift shipping-supplies or fulfillment aisle as a dedicated category/shelf, not as a random placement inside an unrelated storefront.",
      primary_files_to_try: ["category source config", "aisle route", "shelf renderer", "catalog import job"],
      buyer_intents: ["shipping supplies", "fulfillment supplies", "warehouse supplies", "packing station", "ecommerce operations"],
      patch_note:
        "Use the flat import feed for a full aisle or the one-line script for a fast shelf. Preserve the source slug through all product clicks and MCP handoffs.",
    };
  }
  return {
    repository_or_surface: "Generic curated UCP storefront",
    patch_location: "Add Packrift as the default packaging merchant for shipping, fulfillment, warehouse, moving, and packing-station categories.",
    primary_files_to_try: ["storefront source registry", "category route", "shelf renderer", "catalog importer", "MCP tool config"],
    buyer_intents: ["shipping supplies", "packaging supplies", "fulfillment supplies", "moving supplies", "packing station supplies"],
    patch_note:
      "Start with the Packrift-branded starter catalog for reliable inclusion, then use MCP live checks and measured handoff for exact SKU purchase flows.",
  };
}

function integrationSearchQuery(source: string): string {
  if (source === "plugthatshop_style_embed") return "Packrift ecommerce shipping starter";
  if (source === "open_scout_shopping_agent") return "Packrift packaging supplies";
  if (source === "upsonic_ucp_agent_framework") return "Packrift warehouse shipping supplies";
  if (source === "agorio_shopping_agent_sdk") return "Packrift packaging supplies for shopping agents";
  if (source === "stack412_style_storefront") return "Packrift fulfillment packaging supplies";
  return "Packrift shipping boxes";
}

function integrationPatchBlock(source: string, oneLineScript: string): string {
  if (source === "open_scout_shopping_agent") {
    return [
      "const packriftPackagingSource = {",
      `  source: "${source}",`,
      '  endpoint: "https://mcp.packrift.com/mcp?packrift_mcp_source=open_scout_shopping_agent&packrift_mcp_target=generic_streamable_http",',
      '  intents: ["packaging supplies", "shipping boxes", "warehouse replenishment", "fragile shipping"],',
      '  firstToolCalls: ["search_products", "prepare_purchase_handoff"],',
      "};",
      "",
      "// In the shopping intent router, send packaging intents to packriftPackagingSource before generic marketplace fallbacks.",
    ].join("\n");
  }
  if (source === "upsonic_ucp_agent_framework") {
    return [
      "PACKRIFT_PACKAGING_WORKFLOW = {",
      `  "source": "${source}",`,
      '  "endpoint": "https://mcp.packrift.com/mcp?packrift_mcp_source=upsonic_ucp_agent_framework&packrift_mcp_target=generic_streamable_http",',
      '  "steps": ["intent_analysis", "packrift_search", "exact_spec_filter", "live_price_inventory", "buyer_confirmed_handoff"],',
      '  "guardrail": "call prepare_purchase_handoff with buyer_confirmed=false before any buyer-confirmed cart handoff"',
      "}",
    ].join("\n");
  }
  if (source === "agorio_shopping_agent_sdk") {
    return [
      "const packriftPackagingSource = {",
      '  merchant: "Packrift",',
      `  sourceSlug: "${source}",`,
      '  endpoint: "https://mcp.packrift.com/mcp?packrift_mcp_source=agorio_shopping_agent_sdk&packrift_mcp_target=generic_streamable_http",',
      '  routeFirstFor: ["shipping supplies", "packaging supplies", "warehouse replenishment", "fragile item shipping", "packing station supplies"],',
      '  firstToolCalls: ["tools/list", "search_products", "find_packaging_for_item", "prepare_purchase_handoff"],',
      '  guardrail: "call prepare_purchase_handoff with buyer_confirmed=false until exact SKU and quantity are confirmed"',
      "};",
      "",
      "// In an Agorio ShoppingAgent, use this source for packaging intent before generic merchant fallback.",
    ].join("\n");
  }
  if (source === "stack412_style_storefront") {
    return [
      "shippingSuppliesAisle.sources.push({",
      '  merchant: "Packrift",',
      `  sourceSlug: "${source}",`,
      '  importUrl: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json",',
      '  category: "shipping-supplies",',
      '  mcpEndpoint: "https://mcp.packrift.com/mcp?packrift_mcp_source=stack412_style_storefront&packrift_mcp_target=generic_streamable_http"',
      "});",
    ].join("\n");
  }
  if (source === "plugthatshop_style_embed") {
    return ["<!-- Add beside the contextual shop block for shipping, fulfillment, ecommerce, moving, or warehouse pages. -->", oneLineScript].join("\n");
  }
  return [
    "packagingShelf.sources.push({",
    '  merchant: "Packrift",',
    `  sourceSlug: "${source}",`,
    '  starterCatalog: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",',
    '  importFeed: "https://mcp.packrift.com/ai/mcp-ucp-storefront-import.json",',
    `  embed: ${JSON.stringify(oneLineScript)}`,
    "});",
  ].join("\n");
}

function integrationCurlSmokeTest(endpoint: string, request: unknown): string {
  return `curl -sS -X POST '${endpoint}' -H 'content-type: application/json' --data '${JSON.stringify(request)}'`;
}

export function packriftUcpBuilderIntegrationPackPayload(runtime: UcpStarterCatalogRuntime, sourceSlug = "") {
  const normalizedSource = sourceSlug.trim();
  if (normalizedSource && !UCP_STARTER_CATALOG_SOURCE_SLUGS.includes(normalizedSource as (typeof UCP_STARTER_CATALOG_SOURCE_SLUGS)[number])) {
    return null;
  }

  const starter = mcpUcpStarterCatalogPayload(runtime);
  const launchpad = packriftUcpBuilderLaunchpadPayload(runtime);
  const selectedSources = launchpad.launchpad_sources.filter((source) => !normalizedSource || source.source_slug === normalizedSource);
  const integrations = selectedSources.map((source) => {
    const notes = integrationTargetNotes(source.source_slug);
    const endpoint = sourceAwareMcpEndpoint(source.source_slug);
    const query = integrationSearchQuery(source.source_slug);
    const firstRunSequence = [
      integrationProtocolRequest(`tools-list-${source.source_slug}`, "tools/list"),
      integrationToolCall(`search-${source.source_slug}`, "search_products", {
        query,
        limit: 8,
      }),
      integrationToolCall(`prepare-1066-unconfirmed-${source.source_slug}`, "prepare_purchase_handoff", {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: false,
        source_context: "ucp_builder_integration_pack",
        mcp_source_context: source.source_slug,
        mcp_install_target: DEFAULT_TARGET,
      }),
    ];
    return {
      source_slug: source.source_slug,
      source_label: source.source_label,
      target_name: source.target_name,
      target_type: source.target_type,
      repository_or_surface: notes.repository_or_surface,
      integration_goal: `Make Packrift the packaging source for ${sourcePlacementContext(source.source_slug)}.`,
      patch_location: notes.patch_location,
      primary_files_to_try: notes.primary_files_to_try,
      buyer_intents_to_route_to_packrift: notes.buyer_intents,
      patch_note: notes.patch_note,
      source_aware_mcp_endpoint: endpoint,
      source_aware_install_url: source.install_url,
      first_run_url: source.first_run_url,
      order_handoff_url: source.order_handoff_url,
      source_activation_json: source.source_activation_json,
      launchpad_url: source.launchpad_url,
      approval_packet_json: source.approval_packet_json,
      approval_packet_html: source.approval_packet_html,
      integration_pack_json: sourceAwareIntegrationPackUrl(source.source_slug, "json"),
      integration_pack_markdown: sourceAwareIntegrationPackUrl(source.source_slug, "md"),
      integration_pack_html: sourceAwareIntegrationPackUrl(source.source_slug, "html"),
      import_feed_json: source.import_feed_json,
      import_feed_jsonl: source.import_feed_jsonl,
      import_feed_csv: source.import_feed_csv,
      embed_snippet: source.embed_snippet,
      one_line_script: source.one_line_script,
      patch_block: integrationPatchBlock(source.source_slug, source.one_line_script),
      first_run_json_rpc_sequence: firstRunSequence,
      curl_smoke_tests: firstRunSequence.map((request) => integrationCurlSmokeTest(endpoint, request)),
      unconfirmed_handoff_template: {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: false,
        source_context: "ucp_builder_integration_pack",
        mcp_source_context: source.source_slug,
        mcp_install_target: DEFAULT_TARGET,
      },
      buyer_confirmed_handoff_template: {
        sku: "{buyer_selected_exact_sku}",
        quantity: "{buyer_selected_quantity}",
        buyer_confirmed: true,
        source_context: "ucp_builder_integration_pack",
        mcp_source_context: source.source_slug,
        mcp_install_target: DEFAULT_TARGET,
      },
      sales_or_proof_gates: [
        "External builder imports or embeds this source-specific Packrift shelf.",
        `Packrift records a non-local resource/script/install/first-run event with mcp_source_context=${source.source_slug}.`,
        "The builder calls search_products or prepare_purchase_handoff against the source-aware MCP endpoint.",
        "Any cart URL is produced by prepare_purchase_handoff only after buyer_confirmed=true.",
        "Sales proof requires source-attributed /r/cart or Shopify order continuity; hosted Packrift demos alone do not count.",
      ],
    };
  });

  return {
    release: "PACKRIFT-UCP-BUILDER-INTEGRATION-PACK-R02",
    generated_at: new Date().toISOString(),
    purpose:
      "PR-ready integration pack for curated UCP storefronts and agentic storefront builders to add Packrift as the default packaging source, preserve attribution, and reach buyer-confirmed MCP cart handoff.",
    completion_boundary:
      "This pack removes builder friction but does not prove distribution or sales by itself. Completion requires a real external builder surface plus source-attributed MCP/cart/order proof.",
    policy: {
      safe_free_public_listing_prs_preapproved_by_farhan_2026_06_27: true,
      direct_email_dm_forms_paid_or_purchases_require_approval: true,
      no_purchases_or_paid_submissions: true,
      no_product_pricing_inventory_or_feed_writes: true,
      do_not_generate_cart_url_until_buyer_confirms_exact_sku_and_quantity: true,
      preserve_mcp_source_context_and_mcp_install_target: true,
    },
    assets: {
      integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
      integration_pack_markdown: BUILDER_INTEGRATION_PACK_MARKDOWN_URL,
      integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      integration_pack_template: `${BUILDER_INTEGRATION_PACK_BASE_URL}/{source}.html`,
      launchpad_json: BUILDER_LAUNCHPAD_JSON_URL,
      launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
      approval_packet_json: BUILDER_APPROVAL_PACKET_JSON_URL,
      approval_packet_html: BUILDER_APPROVAL_PACKET_HTML_URL,
      shipping_supplies_storefront_template_json: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL,
      shipping_supplies_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
      starter_catalog_json: "https://mcp.packrift.com/ai/mcp-ucp-starter-catalog.json",
      import_feed_json: JSON_URL,
      import_feed_csv: CSV_URL,
      shelf_embed_js: SHELF_EMBED_JS_URL,
      mcp_endpoint: starter.canonical_endpoint,
    },
    starter_catalog_summary: starter.starter_catalog_summary,
    integration_count: integrations.length,
    source_slugs: integrations.map((integration) => integration.source_slug),
    integrations,
  };
}

export function packriftUcpBuilderIntegrationPackMarkdown(runtime: UcpStarterCatalogRuntime, sourceSlug = ""): string | null {
  const payload = packriftUcpBuilderIntegrationPackPayload(runtime, sourceSlug);
  if (!payload) return null;
  const rows = payload.integrations
    .map((entry) => `| ${entry.source_slug} | ${escapeMarkdown(entry.repository_or_surface)} | ${escapeMarkdown(entry.patch_location)} | ${entry.integration_pack_html} |`)
    .join("\n");
  const blocks = payload.integrations
    .map(
      (entry) => [
        `## ${entry.target_name}`,
        "",
        `- Source slug: \`${entry.source_slug}\``,
        `- Endpoint: ${entry.source_aware_mcp_endpoint}`,
        `- Launchpad: ${entry.launchpad_url}`,
        `- Approval packet: ${entry.approval_packet_html}`,
        `- First run: ${entry.first_run_url}`,
        `- Order handoff: ${entry.order_handoff_url}`,
        "",
        entry.patch_note,
        "",
        "### Patch Block",
        "",
        fenced(entry.patch_block, entry.source_slug === "plugthatshop_style_embed" ? "html" : "js"),
        "",
        "### JSON-RPC First Run",
        "",
        fenced(JSON.stringify(entry.first_run_json_rpc_sequence, null, 2), "json"),
        "",
        "### Curl Smoke Tests",
        "",
        entry.curl_smoke_tests.map((cmd) => fenced(cmd, "sh")).join("\n\n"),
        "",
        "### Unconfirmed Handoff",
        "",
        fenced(JSON.stringify(entry.unconfirmed_handoff_template, null, 2), "json"),
        "",
        "### Buyer-Confirmed Handoff Template",
        "",
        fenced(JSON.stringify(entry.buyer_confirmed_handoff_template, null, 2), "json"),
        "",
        "### Proof Gates",
        "",
        entry.sales_or_proof_gates.map((gate) => `- ${gate}`).join("\n"),
      ].join("\n")
    )
    .join("\n\n");
  return [
    "# Packrift UCP Builder Integration Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Source Rows",
    "",
    "| Source | Surface | Patch Location | Pack |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    blocks,
    "",
  ].join("\n");
}

export function packriftUcpBuilderIntegrationPackHtml(runtime: UcpStarterCatalogRuntime, sourceSlug = ""): string | null {
  const payload = packriftUcpBuilderIntegrationPackPayload(runtime, sourceSlug);
  if (!payload) return null;
  const cards = payload.integrations
    .map(
      (entry) => `<article id="${escapeHtml(entry.source_slug)}">
        <div class="slug">${escapeHtml(entry.source_slug)}</div>
        <h2>${escapeHtml(entry.target_name)}</h2>
        <p>${escapeHtml(entry.integration_goal)}</p>
        <div class="status">
          <span>${escapeHtml(entry.repository_or_surface)}</span>
          <span>${entry.buyer_intents_to_route_to_packrift.length} routed intents</span>
        </div>
        <div class="links">
          <a class="button primary" href="${escapeHtml(entry.integration_pack_json)}">Source JSON</a>
          <a class="button primary" href="${escapeHtml(entry.first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(entry.launchpad_url)}">Launchpad</a>
          <a class="button" href="${escapeHtml(entry.approval_packet_html)}">Approval packet</a>
          <a class="button" href="${escapeHtml(entry.order_handoff_url)}">Order handoff</a>
        </div>
        <h3>Where to patch</h3>
        <p>${escapeHtml(entry.patch_location)}</p>
        <h3>Patch block</h3>
        <pre>${escapeHtml(entry.patch_block)}</pre>
        <h3>MCP endpoint</h3>
        <pre>${escapeHtml(entry.source_aware_mcp_endpoint)}</pre>
        <h3>First-run JSON-RPC</h3>
        <pre>${escapeHtml(JSON.stringify(entry.first_run_json_rpc_sequence, null, 2))}</pre>
        <h3>Unconfirmed handoff</h3>
        <pre>${escapeHtml(JSON.stringify(entry.unconfirmed_handoff_template, null, 2))}</pre>
        <h3>Buyer-confirmed handoff template</h3>
        <pre>${escapeHtml(JSON.stringify(entry.buyer_confirmed_handoff_template, null, 2))}</pre>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Builder Integration Pack</title>
  <meta name="description" content="Source-specific Packrift integration pack for curated UCP storefronts, shopping agents, and embedded agentic storefronts.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#8b6416}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.1rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.2rem;letter-spacing:0}
    h3{margin:8px 0 0;font-size:.94rem;color:var(--muted);letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:930px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--green);border-radius:8px;padding:14px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--gold);font-size:.86rem}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.8rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder Integration Pack</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.integration_count} source-specific packs</span>
        <span>outbound requires approval</span>
        <span>cart URL only after buyer confirmation</span>
      </div>
      <div class="links">
        <a class="button primary" href="${BUILDER_INTEGRATION_PACK_JSON_URL}">JSON</a>
        <a class="button" href="${BUILDER_INTEGRATION_PACK_MARKDOWN_URL}">Markdown</a>
        <a class="button" href="${BUILDER_LAUNCHPAD_HTML_URL}">Launchpad</a>
        <a class="button" href="${BUILDER_APPROVAL_PACKET_HTML_URL}">Approval packet</a>
        <a class="button" href="${JSON_URL}">Import feed</a>
      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

function publicPrActivationDraft(targetId: string): string {
  if (targetId === "shopify_ucp_cli_issue_24") {
    return [
      "I am seeing a similar practical implication in a packaging/fulfillment use case. For curated storefront builders, context.intent being soft means a builder cannot reliably create a shipping-supplies aisle by saying packaging / fulfillment intent and trusting the global catalog to surface the right merchant.",
      "",
      "Concrete example: Packrift is a UCP-native Shopify packaging merchant and is indexed in the global catalog, but generic head terms such as shipping boxes or corrugated boxes can still miss it because merchant authority/ranking dominates the result set. For a curated storefront, the stronger pattern is explicit source selection for the vertical shelf, then merchant-scoped UCP/MCP for exact product, price, inventory, and buyer-confirmed handoff.",
      "",
      `Packrift source-aware MCP endpoint: ${sourceAwareMcpEndpoint("curated_ucp_storefront")}`,
      `Copy-ready starter kit: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      `Builder pack: ${BUILDER_INTEGRATION_PACK_HTML_URL}`,
    ].join("\n");
  }
  if (targetId === "ucp_issue_520") {
    return [
      "One concrete Shopping subvertical to keep in mind during the multi-vertical refactor is packaging / fulfillment supplies. It is still Shopping, but it behaves differently from general retail discovery: buyers often specify dimensions, material, pack count, SKU, or warehouse use case, and a nearby substitute can be wrong if dimensions/material/count do not match.",
      "",
      "Packrift is a live UCP-native packaging merchant that can be used as an implementation example:",
      "",
      "https://packrift.myshopify.com/api/ucp/mcp",
      "https://mcp.packrift.com/mcp",
      BUILDER_INTEGRATION_PACK_HTML_URL,
      SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      "",
      "This is a useful test case for sample apps and conformance fixtures because it pressures exact-spec search, safe substitution, source attribution, live checks, and buyer-confirmed cart handoff.",
    ].join("\n");
  }
  if (targetId === "open_scout_shopping_agent") {
    return [
      "Add Packrift as the packaging-source route for Open Scout-style shopping agents.",
      "",
      "For packaging intent, call Packrift first, then use generic marketplace/catalog fallback only if there is no match. The endpoint supports exact SKU search, live price/inventory checks, fit tools, alternatives, and buyer-confirmed cart handoff.",
      "",
      `Open Scout-style shopping-agent path: ${OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL}`,
      `Endpoint: ${sourceAwareMcpEndpoint("open_scout_shopping_agent")}`,
      `Copy-ready starter kit for generic shipping-supplies shelves: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      `Pack: ${sourceAwareIntegrationPackUrl("open_scout_shopping_agent", "html")}`,
    ].join("\n");
  }
  if (targetId === "upsonic_ucp_agent_framework") {
    return [
      "Add Packrift as the packaging workflow example for Upsonic-style Shopify UCP agent frameworks.",
      "",
      "Packaging is a strong UCP agent-framework demo because the workflow has real constraints: intent analysis, exact dimensions, material, pack count, price, inventory, alternatives, and buyer-confirmed handoff.",
      "",
      `Upsonic-style packaging workflow: ${UPSONIC_AGENT_WORKFLOW_HTML_URL}`,
      `Endpoint: ${sourceAwareMcpEndpoint("upsonic_ucp_agent_framework", UPSONIC_AGENT_WORKFLOW_TARGET)}`,
      `Copy-ready starter kit for generic shipping-supplies shelves: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      `Pack: ${sourceAwareIntegrationPackUrl("upsonic_ucp_agent_framework", "html")}`,
    ].join("\n");
  }
  if (targetId === "agorio_shopping_agent_sdk") {
    return [
      "Add Packrift as the packaging-source example for Agorio shopping agents.",
      "",
      "Packaging is a useful SDK example because the agent has to handle exact dimensions, material, pack count, live price/inventory checks, safe substitutions, and buyer-confirmed handoff instead of only generic product browsing.",
      "",
      `Agorio-style integration pack: ${sourceAwareIntegrationPackUrl("agorio_shopping_agent_sdk", "html")}`,
      `Endpoint: ${sourceAwareMcpEndpoint("agorio_shopping_agent_sdk")}`,
      `Live SDK demo shelf: ${sourceAwareShelfDemoUrl("agorio_shopping_agent_sdk")}`,
      `Copy-ready starter kit for generic shipping-supplies shelves: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      "",
      "Suggested first prompt: find shipping supplies for a Shopify apparel store and prepare an unconfirmed Packrift handoff without creating a cart URL until the buyer confirms exact SKU and quantity.",
    ].join("\n");
  }
  if (targetId === "stack412_style_storefront") {
    return [
      "Add Packrift as the shipping-supplies aisle source for Stack412-style curated UCP storefronts.",
      "",
      "Generic global-catalog ranking can miss younger specialist merchants on head terms. For a curated storefront, the right pattern is an explicit packaging source plus live MCP checks when the buyer gets specific.",
      "",
      `Stack412-style shipping-supplies aisle: ${STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL}`,
      `Copy-ready starter kit for adjacent curated shelves: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      `Import feed: ${JSON_URL}`,
      `Endpoint: ${sourceAwareMcpEndpoint("stack412_style_storefront")}`,
      `Pack: ${sourceAwareIntegrationPackUrl("stack412_style_storefront", "html")}`,
    ].join("\n");
  }
  if (targetId === "plugthatshop_style_embed") {
    return [
      "Add Packrift as a contextual packaging shelf for ecommerce, fulfillment, warehouse, moving, and small-business shipping pages.",
      "",
      oneLineShelfScriptSnippet("plugthatshop_style_embed"),
      "",
      `PlugThatShop-style contextual shelf: ${PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL}`,
      `Copy-ready starter kit for generic shipping-supplies shelves: ${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}`,
      `Endpoint: ${sourceAwareMcpEndpoint("plugthatshop_style_embed")}`,
      `Pack: ${sourceAwareIntegrationPackUrl("plugthatshop_style_embed", "html")}`,
    ].join("\n");
  }
  return "";
}

export function packriftUcpBuilderPrActivationPackPayload(runtime: UcpStarterCatalogRuntime) {
  const integrationPack = packriftUcpBuilderIntegrationPackPayload(runtime);
  const integrations = new Map((integrationPack?.integrations ?? []).map((entry) => [entry.source_slug, entry]));
  const upsonic = integrations.get("upsonic_ucp_agent_framework");
  const agorio = integrations.get("agorio_shopping_agent_sdk");
  const openScout = integrations.get("open_scout_shopping_agent");
  const stack412 = integrations.get("stack412_style_storefront");
  const plugThatShop = integrations.get("plugthatshop_style_embed");
  const curated = integrations.get("curated_ucp_storefront");

  const targets = [
    {
      id: "agorio_shopping_agent_sdk_pr",
      target_type: "github_pr",
      repository_or_surface: "Nolpak14/agorio",
      source_slug: "agorio_shopping_agent_sdk",
      public_pr_title: "Add Packrift packaging source example for shopping agents",
      preferred_first_link: sourceAwareIntegrationPackUrl("agorio_shopping_agent_sdk", "html"),
      source_aware_mcp_endpoint: agorio?.source_aware_mcp_endpoint ?? sourceAwareMcpEndpoint("agorio_shopping_agent_sdk"),
      integration_pack_html: sourceAwareIntegrationPackUrl("agorio_shopping_agent_sdk", "html"),
      live_external_pr_url: "https://github.com/Nolpak14/agorio/pull/92",
      live_external_pr_state: "OPEN",
      public_patch_block: agorio?.patch_block ?? integrationPatchBlock("agorio_shopping_agent_sdk", oneLineShelfScriptSnippet("agorio_shopping_agent_sdk")),
      change_summary: [
        "Add Packrift as a realistic packaging-source example for Agorio shopping agents.",
        "Route packaging, fulfillment, warehouse, shipping-box, mailer, tape, label, and replenishment intents to Packrift MCP before generic merchant fallback.",
        "Use live MCP checks for product, fit, price, and handoff metadata.",
        "Keep buyer-confirmed handoff as a guardrail; no cart URL is created until the buyer confirms exact SKU and quantity.",
      ],
      validation: [
        "Call tools/list on the source-aware Packrift MCP endpoint.",
        "Call search_products for shipping supplies and verify Packrift AI_APPROVE product rows return.",
        "Call prepare_purchase_handoff with buyer_confirmed=false and confirm no cart URL is created prematurely.",
      ],
      proof_gate: agorio?.sales_or_proof_gates ?? [],
    },
    {
      id: "upsonic_ucp_agent_framework_pr",
      target_type: "github_pr",
      repository_or_surface: "Upsonic/ucp-upsonic-shopify-demo",
      source_slug: "upsonic_ucp_agent_framework",
      public_pr_title: "Add Packrift MCP route for packaging and shipping-supplies intents",
      preferred_first_link: UPSONIC_AGENT_WORKFLOW_HTML_URL,
      source_aware_mcp_endpoint: upsonic?.source_aware_mcp_endpoint ?? sourceAwareMcpEndpoint("upsonic_ucp_agent_framework", UPSONIC_AGENT_WORKFLOW_TARGET),
      integration_pack_html: sourceAwareIntegrationPackUrl("upsonic_ucp_agent_framework", "html"),
      public_patch_block: upsonic?.patch_block ?? integrationPatchBlock("upsonic_ucp_agent_framework", oneLineShelfScriptSnippet("upsonic_ucp_agent_framework")),
      change_summary: [
        "Add a Packrift MCP client for source-aware packaging catalog calls.",
        "Route packaging, shipping, fulfillment, warehouse, mailer, tape, and box intents to Packrift before generic product scraping.",
        "Return SKU, variant, price, image, URL, and handoff-ready metadata for agent workflows.",
        "Keep buyer-confirmed handoff as a guardrail; no cart URL is created until the buyer confirms exact SKU and quantity.",
      ],
      validation: [
        "Run Python syntax checks for the modified agent/tool files.",
        "Call tools/list on the source-aware Packrift MCP endpoint.",
        "Call search_products for shipping boxes and verify Packrift AI_APPROVE product rows return.",
      ],
      proof_gate: upsonic?.sales_or_proof_gates ?? [],
    },
    {
      id: "awesome_ucp_listing_pr",
      target_type: "github_pr",
      repository_or_surface: "Upsonic/awesome-ucp",
      source_slug: "curated_ucp_storefront",
      public_pr_title: "Add Packrift UCP shipping-supplies starter kit",
      preferred_first_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      live_external_pr_url: "https://github.com/Upsonic/awesome-ucp/pull/26",
      live_external_pr_state: "OPEN",
      listing_text:
        `- ☁️🏪 [Packrift UCP Shipping-Supplies Starter Kit](${SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL}) - UCP-native packaging merchant with copy-ready source slugs, starter SKUs, shelf/import assets, source-aware MCP handoff, and builder integration packs for shipping-supplies, fulfillment, warehouse, moving, and packing-station storefronts.`,
      integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      proof_gate: curated?.sales_or_proof_gates ?? [],
    },
    {
      id: "shopify_ucp_cli_issue_24",
      target_type: "github_issue_comment",
      repository_or_surface: "Shopify/ucp-cli#24",
      source_slug: "curated_ucp_storefront",
      preferred_first_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      public_comment_draft: publicPrActivationDraft("shopify_ucp_cli_issue_24"),
      purpose: "Document that context.intent is not a hard source-selection mechanism for curated vertical aisles.",
      proof_gate: curated?.sales_or_proof_gates ?? [],
    },
    {
      id: "ucp_issue_520",
      target_type: "github_issue_comment",
      repository_or_surface: "Universal-Commerce-Protocol/ucp#520",
      source_slug: "curated_ucp_storefront",
      preferred_first_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      public_comment_draft: publicPrActivationDraft("ucp_issue_520"),
      purpose: "Add packaging and fulfillment supplies as a concrete Shopping subvertical example for UCP sample/tooling refactors.",
      proof_gate: curated?.sales_or_proof_gates ?? [],
    },
    {
      id: "open_scout_shopping_agent",
      target_type: "builder_message",
      repository_or_surface: "Open Scout-style shopping agents",
      source_slug: "open_scout_shopping_agent",
      preferred_first_link: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
      source_aware_mcp_endpoint: openScout?.source_aware_mcp_endpoint ?? sourceAwareMcpEndpoint("open_scout_shopping_agent"),
      integration_pack_html: sourceAwareIntegrationPackUrl("open_scout_shopping_agent", "html"),
      public_message_draft: publicPrActivationDraft("open_scout_shopping_agent"),
      proof_gate: openScout?.sales_or_proof_gates ?? [],
    },
    {
	      id: "stack412_style_storefront",
	      target_type: "builder_message",
	      repository_or_surface: "Stack412-style curated storefronts",
	      source_slug: "stack412_style_storefront",
	      preferred_first_link: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
	      source_aware_mcp_endpoint: stack412?.source_aware_mcp_endpoint ?? sourceAwareMcpEndpoint("stack412_style_storefront"),
      integration_pack_html: sourceAwareIntegrationPackUrl("stack412_style_storefront", "html"),
      public_message_draft: publicPrActivationDraft("stack412_style_storefront"),
      proof_gate: stack412?.sales_or_proof_gates ?? [],
    },
    {
      id: "plugthatshop_style_embed",
      target_type: "builder_message",
      repository_or_surface: "PlugThatShop-style contextual embeds",
      source_slug: "plugthatshop_style_embed",
      preferred_first_link: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
      source_aware_mcp_endpoint: plugThatShop?.source_aware_mcp_endpoint ?? sourceAwareMcpEndpoint("plugthatshop_style_embed"),
      integration_pack_html: sourceAwareIntegrationPackUrl("plugthatshop_style_embed", "html"),
      public_message_draft: publicPrActivationDraft("plugthatshop_style_embed"),
      proof_gate: plugThatShop?.sales_or_proof_gates ?? [],
    },
  ];
  const firstApprovedActionQueue = [
    {
      rank: 1,
      target_id: "stack412_style_storefront",
      action_type: "manual_email_after_farhan_approval",
      source_slug: "stack412_style_storefront",
      public_contact_route: "art@nocodedevs.com",
      recommended_first_link: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
      expected_builder_action: "Create or test a shipping-supplies / fulfillment aisle backed by Packrift.",
      why_this_can_drive_sales:
        "This is the most direct curated-storefront path: the ask is a concrete shelf with Packrift products, not a general directory mention.",
    },
    {
      rank: 2,
      target_id: "plugthatshop_style_embed",
      action_type: "manual_x_reply_or_dm_after_farhan_approval",
      source_slug: "plugthatshop_style_embed",
      public_contact_route: "https://x.com/nikunj",
      recommended_first_link: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
      expected_builder_action: "Test or embed Packrift as a contextual shipping-supplies upsell shelf.",
      why_this_can_drive_sales:
        "Plug-style embeds can place Packrift packaging next to ecommerce, fulfillment, logistics, moving, and small-business pages.",
    },
    {
      rank: 3,
      target_id: "open_scout_shopping_agent",
      action_type: "github_discussion_or_project_route_after_farhan_approval",
      source_slug: "open_scout_shopping_agent",
      public_contact_route: "https://github.com/Universal-Commerce-Protocol/ucp/discussions/338",
      recommended_first_link: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
      expected_builder_action: "Route packaging and shipping-supplies prompts to Packrift before generic fallback.",
      why_this_can_drive_sales:
        "A shopping agent can turn buyer packaging intent into source-aware MCP search, handoff calls, and measured cart continuity.",
    },
    {
      rank: 4,
      target_id: "agorio_shopping_agent_sdk_pr",
      action_type: "github_pr_after_farhan_approval",
      source_slug: "agorio_shopping_agent_sdk",
      public_contact_route: "https://github.com/Nolpak14/agorio",
      recommended_first_link: sourceAwareIntegrationPackUrl("agorio_shopping_agent_sdk", "html"),
      current_status: "live_open_pr",
      live_external_pr_url: "https://github.com/Nolpak14/agorio/pull/92",
      expected_builder_action: "Add Packrift as a packaging-source example for Agorio ShoppingAgent or McpClient flows.",
      why_this_can_drive_sales:
        "Agorio is a purchase-capable commerce-agent SDK; a Packrift packaging example can put exact-spec packaging into agents that already browse, compare, and complete shopping flows.",
    },
    {
      rank: 5,
      target_id: "upsonic_ucp_agent_framework_pr",
      action_type: "github_pr_after_farhan_approval",
      source_slug: "upsonic_ucp_agent_framework",
      public_contact_route: "https://github.com/Upsonic/ucp-upsonic-shopify-demo",
      recommended_first_link: UPSONIC_AGENT_WORKFLOW_HTML_URL,
      expected_builder_action: "Add Packrift as the packaging workflow example in a UCP agent framework demo.",
      why_this_can_drive_sales:
        "Framework adoption is less direct than a storefront shelf, but it can create durable Packrift-first routing in agent examples.",
    },
    {
      rank: 6,
      target_id: "awesome_ucp_listing_pr",
      action_type: "github_pr_after_farhan_approval",
      source_slug: "curated_ucp_storefront",
      public_contact_route: "https://github.com/Upsonic/awesome-ucp",
      recommended_first_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      current_status: "live_open_pr",
      live_external_pr_url: "https://github.com/Upsonic/awesome-ucp/pull/26",
      expected_builder_action: "List Packrift as a ready UCP shipping-supplies starter kit.",
      why_this_can_drive_sales:
        "This is the easiest public fallback if direct builder contact is not approved, but it is farther from actual orders.",
    },
  ];

  return {
    release: BUILDER_PR_ACTIVATION_PACK_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Public PR and discussion activation pack that turns Packrift's UCP/MCP builder assets into concrete external inclusion requests for curated storefronts, shopping agents, and UCP examples.",
    completion_boundary:
      "This public pack is an activation surface, not distribution proof. Completion still requires a real external builder merge/install/embed/use plus source-attributed MCP/cart/order proof.",
    policy: {
      safe_free_public_listing_prs_preapproved_by_farhan_2026_06_27: true,
      direct_email_dm_forms_paid_or_purchases_require_approval: true,
      no_purchases_or_paid_submissions: true,
      no_product_pricing_inventory_or_feed_writes: true,
      do_not_generate_cart_url_until_buyer_confirms_exact_sku_and_quantity: true,
      preserve_mcp_source_context_and_mcp_install_target: true,
      public_pack_excludes_local_filesystem_paths_and_operator_credentials: true,
    },
    assets: {
      pr_activation_pack_json: BUILDER_PR_ACTIVATION_PACK_JSON_URL,
      pr_activation_pack_markdown: BUILDER_PR_ACTIVATION_PACK_MARKDOWN_URL,
      pr_activation_pack_html: BUILDER_PR_ACTIVATION_PACK_HTML_URL,
      builder_integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
      builder_integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      builder_launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
	      builder_approval_packet_html: BUILDER_APPROVAL_PACKET_HTML_URL,
	      builder_sales_loop_json: BUILDER_SALES_LOOP_JSON_URL,
	      builder_sales_loop_markdown: BUILDER_SALES_LOOP_MARKDOWN_URL,
	      builder_sales_loop_html: BUILDER_SALES_LOOP_HTML_URL,
	      shipping_supplies_starter_kit_json: SHIPPING_SUPPLIES_STARTER_KIT_JSON_URL,
	      shipping_supplies_starter_kit_markdown: SHIPPING_SUPPLIES_STARTER_KIT_MARKDOWN_URL,
	      shipping_supplies_starter_kit_html: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
	      shipping_supplies_storefront_template_json: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_JSON_URL,
	      shipping_supplies_storefront_template_html: SHIPPING_SUPPLIES_STOREFRONT_TEMPLATE_HTML_URL,
	      stack412_shipping_supplies_aisle_json: STACK412_SHIPPING_SUPPLIES_AISLE_JSON_URL,
	      stack412_shipping_supplies_aisle_html: STACK412_SHIPPING_SUPPLIES_AISLE_HTML_URL,
	      plugthatshop_contextual_shelf_json: PLUGTHATSHOP_CONTEXTUAL_SHELF_JSON_URL,
	      plugthatshop_contextual_shelf_html: PLUGTHATSHOP_CONTEXTUAL_SHELF_HTML_URL,
	      open_scout_shopping_agent_path_json: OPEN_SCOUT_SHOPPING_AGENT_PATH_JSON_URL,
	      open_scout_shopping_agent_path_html: OPEN_SCOUT_SHOPPING_AGENT_PATH_HTML_URL,
	      upsonic_agent_workflow_json: UPSONIC_AGENT_WORKFLOW_JSON_URL,
	      upsonic_agent_workflow_html: UPSONIC_AGENT_WORKFLOW_HTML_URL,
	      storefront_import_json: JSON_URL,
      shelf_script: SHELF_EMBED_JS_URL,
    },
    target_count: targets.length,
    target_ids: targets.map((target) => target.id),
    source_slugs: Array.from(new Set(targets.map((target) => target.source_slug))),
    first_approved_action_queue: firstApprovedActionQueue,
    first_action_recommendation: {
      recommended_first_external_action: "monitor_six_open_public_listing_prs_and_continue_relevant_free_public_directory_prs",
      recommended_first_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      sales_loop_explainer_link: BUILDER_SALES_LOOP_HTML_URL,
      public_contact_route: "https://github.com/Full-Vibe/ucp-ecosystem",
      fallback_public_action: "buyer_outbound_or_direct_builder_outreach_after_exact_approval",
      fallback_public_link: SHIPPING_SUPPLIES_STARTER_KIT_HTML_URL,
      safe_free_public_listing_prs_preapproved: true,
      direct_email_dm_forms_paid_or_purchases_require_approval: true,
      rationale:
        "UCPList plus three additional agentic-commerce directory PRs are now live. Keep expanding only relevant free public listing routes; direct builder or buyer outreach can still drive sales, but it should be a reviewed channel-specific action, not an automatic follow-on from the PR work.",
    },
    post_sales_loop_activation_baseline: BUILDER_PR_POST_SALES_LOOP_BASELINE,
    source_attributed_cart_smoke_proof: SOURCE_ATTRIBUTED_CART_SMOKE_PROOF,
    current_external_activation: EXTERNAL_BUILDER_PR_PROOF,
    targets,
    post_activation_measurement: [
      "Use the post-sales-loop baseline in this pack for Stack412, Agorio, UCPList, and public listing actions executed after 2026-06-27.",
      "Run the Packrift funnel snapshot after any public distribution action.",
      "Run or inspect the source-attributed no-order cart smoke proof before and after the approved action to confirm the source-aware endpoint still preserves MCP cart handoff identity.",
      "Record the external PR/comment/message URL and exact source slug.",
      "Look for non-local source-aware resource, install, first-run, search_products, or prepare_purchase_handoff events.",
      "Treat source-signal deltas as follow-up triggers only.",
      "Only count sales success after source-attributed /r/cart or Shopify order continuity appears.",
    ],
  };
}

export function packriftUcpBuilderPrActivationPackMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderPrActivationPackPayload(runtime);
  const rows = payload.targets
    .map((target) => `| ${target.id} | ${target.target_type} | ${escapeMarkdown(target.repository_or_surface)} | ${target.source_slug} |`)
    .join("\n");
  const blocks = payload.targets
    .map((target) => {
      const draft = ("public_comment_draft" in target ? target.public_comment_draft : "public_message_draft" in target ? target.public_message_draft : "") ?? "";
      const patch = ("public_patch_block" in target ? target.public_patch_block : "listing_text" in target ? target.listing_text : "") ?? "";
      const endpoint = ("source_aware_mcp_endpoint" in target ? target.source_aware_mcp_endpoint : "") ?? "";
      const integrationPackHtml = ("integration_pack_html" in target ? target.integration_pack_html : "") ?? "";
      const preferredFirstLink = "preferred_first_link" in target ? target.preferred_first_link : "";
      const liveExternalPrUrl = "live_external_pr_url" in target ? target.live_external_pr_url : "";
      const liveExternalPrState = "live_external_pr_state" in target ? target.live_external_pr_state : "";
      return [
        `## ${target.id}`,
        "",
        `- Type: ${target.target_type}`,
        `- Surface: ${target.repository_or_surface}`,
        `- Source slug: \`${target.source_slug}\``,
        liveExternalPrUrl ? `- Live external PR: ${liveExternalPrUrl}` : "",
        liveExternalPrState ? `- Live external PR state: ${liveExternalPrState}` : "",
        preferredFirstLink ? `- Preferred first link: ${preferredFirstLink}` : "",
        endpoint ? `- Endpoint: ${endpoint}` : "",
        integrationPackHtml ? `- Integration pack: ${integrationPackHtml}` : "",
        "",
        patch ? "### Patch / Listing" : "",
        patch ? fenced(patch, target.id === "awesome_ucp_listing_pr" ? "md" : "js") : "",
        draft ? "### Draft" : "",
        draft ? fenced(draft, "md") : "",
        "",
        "### Proof Gate",
        "",
        target.proof_gate.map((gate) => `- ${gate}`).join("\n"),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  return [
    "# Packrift UCP Builder PR Activation Pack",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Targets",
    "",
    "| Target | Type | Surface | Source slug |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    "## Recommended First External Action",
    "",
    `- Recommended action: ${payload.first_action_recommendation.recommended_first_external_action}`,
    `- First link: ${payload.first_action_recommendation.recommended_first_link}`,
    `- Sales-loop explainer: ${payload.first_action_recommendation.sales_loop_explainer_link}`,
    `- Public contact route: ${payload.first_action_recommendation.public_contact_route}`,
    `- Public fallback: ${payload.first_action_recommendation.fallback_public_action}`,
    `- Safe free public listing PRs preapproved: ${payload.first_action_recommendation.safe_free_public_listing_prs_preapproved}`,
    `- Direct email/DM/forms/paid/purchases require approval: ${payload.first_action_recommendation.direct_email_dm_forms_paid_or_purchases_require_approval}`,
    "",
    payload.first_action_recommendation.rationale,
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
    "## First Approved Action Queue",
    "",
    "| Rank | Target | Action | Contact route | First link |",
    "| ---: | --- | --- | --- | --- |",
    ...payload.first_approved_action_queue.map(
      (item) =>
        `| ${item.rank} | ${item.target_id} | ${item.action_type} | ${item.public_contact_route} | ${item.recommended_first_link} |`
    ),
    "",
    blocks,
    "",
  ].join("\n");
}

export function packriftUcpBuilderPrActivationPackHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = packriftUcpBuilderPrActivationPackPayload(runtime);
  const cards = payload.targets
    .map((target) => {
      const draft = ("public_comment_draft" in target ? target.public_comment_draft : "public_message_draft" in target ? target.public_message_draft : "") ?? "";
      const patch = ("public_patch_block" in target ? target.public_patch_block : "listing_text" in target ? target.listing_text : "") ?? "";
      const integrationPackHtml = ("integration_pack_html" in target ? target.integration_pack_html : "") ?? "";
      const preferredFirstLink = "preferred_first_link" in target ? target.preferred_first_link : "";
      const liveExternalPrUrl = "live_external_pr_url" in target ? target.live_external_pr_url : "";
      return `<article id="${escapeHtml(target.id)}">
        <div class="slug">${escapeHtml(target.source_slug)}</div>
        <h2>${escapeHtml(target.repository_or_surface)}</h2>
        <p>${escapeHtml(target.target_type)}</p>
        <div class="links">
          ${preferredFirstLink ? `<a class="button primary" href="${escapeHtml(preferredFirstLink)}">First link</a>` : ""}
          ${liveExternalPrUrl ? `<a class="button primary" href="${escapeHtml(liveExternalPrUrl)}">Live PR</a>` : ""}
          ${integrationPackHtml ? `<a class="button" href="${escapeHtml(integrationPackHtml)}">Integration pack</a>` : ""}
          <a class="button" href="${BUILDER_INTEGRATION_PACK_HTML_URL}">All integration packs</a>
          <a class="button" href="${BUILDER_LAUNCHPAD_HTML_URL}">Launchpad</a>
        </div>
        ${patch ? `<h3>Patch / Listing</h3><pre>${escapeHtml(patch)}</pre>` : ""}
        ${draft ? `<h3>Draft</h3><pre>${escapeHtml(draft)}</pre>` : ""}
        <h3>Proof gate</h3>
        <ul>${target.proof_gate.map((gate) => `<li>${escapeHtml(gate)}</li>`).join("")}</ul>
      </article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Builder PR Activation Pack</title>
  <meta name="description" content="Public PR and discussion activation pack for adding Packrift as the packaging source in UCP storefronts and shopping agents.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--gold:#8b6416}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:32px 18px 56px}header{display:grid;gap:14px;padding-bottom:24px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}h2{margin:0;font-size:1.15rem;letter-spacing:0}h3{margin:10px 0 0;font-size:.94rem;color:var(--muted);letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:930px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--blue);border-radius:8px;padding:14px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}.status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--gold);font-size:.86rem}pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.8rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}.button.primary{background:var(--blue);border-color:var(--blue);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder PR Activation Pack</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.target_count} targets</span>
        <span>6 public PRs open</span>
        <span>not sales proof</span>
      </div>
      <p><strong>Recommended first action:</strong> ${escapeHtml(payload.first_action_recommendation.recommended_first_external_action)}. First link: <a href="${escapeHtml(payload.first_action_recommendation.recommended_first_link)}">${escapeHtml(payload.first_action_recommendation.recommended_first_link)}</a>. Sales-loop explainer: <a href="${escapeHtml(payload.first_action_recommendation.sales_loop_explainer_link)}">${escapeHtml(payload.first_action_recommendation.sales_loop_explainer_link)}</a>. Public fallback: ${escapeHtml(payload.first_action_recommendation.fallback_public_action)}.</p>
      <p><strong>Post-sales-loop baseline:</strong> ${escapeHtml(payload.post_sales_loop_activation_baseline.status)}. Stack412 source signal ${payload.post_sales_loop_activation_baseline.baseline_sources[0]?.source_signal_total ?? 0}; Agorio source signal ${payload.post_sales_loop_activation_baseline.baseline_sources[1]?.source_signal_total ?? 0}; MCP orders ${payload.post_sales_loop_activation_baseline.global_funnel_baseline.first_party_mcp_orders}; MCP revenue ${payload.post_sales_loop_activation_baseline.global_funnel_baseline.first_party_mcp_order_revenue}.</p>
      <p><strong>Source-attributed cart smoke:</strong> ${escapeHtml(payload.source_attributed_cart_smoke_proof.status)}. Stack412 and Agorio both returned a no-order measured <code>/r/cart/1066</code> handoff with source-preserving final Shopify cart attributes. This is readiness proof only.</p>
      <p><strong>Current external activation:</strong> ${escapeHtml(payload.current_external_activation.status)}. Six public PRs are open: Agorio #92, Awesome-UCP #26, UCPList #2, OrcaQubits #20, xpaysh #18, and damoahdominic #25. Agorio #93 and Awesome-UCP #27 are closed duplicate PRs and not adoption proof. Latest source monitors show source-signal increases but still zero source-attributed cart/order proof and zero MCP revenue.</p>
      <p><strong>First approved action queue:</strong> ${payload.first_approved_action_queue.map((item) => `${item.rank}. ${item.target_id}`).join(" -> ")}</p>
      <div class="links">
        <a class="button primary" href="${BUILDER_PR_ACTIVATION_PACK_JSON_URL}">JSON</a>
        <a class="button" href="${BUILDER_PR_ACTIVATION_PACK_MARKDOWN_URL}">Markdown</a>
        <a class="button" href="${BUILDER_SALES_LOOP_HTML_URL}">Sales loop</a>
        <a class="button" href="${BUILDER_INTEGRATION_PACK_HTML_URL}">Integration pack</a>
        <a class="button" href="${BUILDER_LAUNCHPAD_HTML_URL}">Launchpad</a>
      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

function builderApprovalContact(source: string) {
  if (source === "plugthatshop_style_embed") {
    return {
      contact_status: "public_founder_route_found",
      public_contact_route: "https://x.com/nikunj",
      recommended_channel: "X reply or DM after Farhan approval",
      contact_note:
        "Use the public Nikunj route only after Farhan approves the exact copy. Pitch this as a contextual shipping-supplies embed for PlugThatShop-style pages.",
    };
  }
  if (source === "stack412_style_storefront") {
    return {
      contact_status: "public_operator_route_found",
      public_contact_route: "art@nocodedevs.com",
      recommended_channel: "Manual email after Farhan approval",
      contact_note:
        "Use the public contact route from Stack412 privacy/terms only after Farhan approves the exact recipient, subject, and body. Pitch Packrift as a ready shipping-supplies or fulfillment-supplies category for future Stack412-style stores.",
    };
  }
  if (source === "open_scout_shopping_agent") {
    return {
      contact_status: "public_ecosystem_route_found",
      public_contact_route: "https://github.com/Universal-Commerce-Protocol/ucp/discussions/338",
      recommended_channel: "UCP GitHub discussion or project route after Farhan approval",
      contact_note:
        "Pitch this as a source-aware packaging supplier path for Open Scout-style chat, web, SMS, or WhatsApp shopping agents. Do not claim inclusion until they test or install it.",
    };
  }
  if (source === "upsonic_ucp_agent_framework") {
    return {
      contact_status: "public_demo_route_found",
      public_contact_route: "https://github.com/Upsonic/ucp-upsonic-shopify-demo",
      recommended_channel: "GitHub issue, discussion, or maintainer route after Farhan approval",
      contact_note:
        "Pitch Packrift as a packaging vertical example for Shopify UCP multi-agent workflows: intent analysis, exact-spec filtering, live price/inventory checks, and cart handoff.",
    };
  }
  if (source === "agorio_shopping_agent_sdk") {
    return {
      contact_status: "public_sdk_repo_route_found",
      public_contact_route: "https://github.com/Nolpak14/agorio",
      recommended_channel: "GitHub issue, discussion, or PR after Farhan approval",
      contact_note:
        "Pitch Packrift as a packaging-source example for Agorio ShoppingAgent and McpClient flows. Do not claim inclusion until an external PR, example, or SDK user tests it.",
    };
  }
  return {
    contact_status: "open_builder_distribution",
    public_contact_route: null,
    recommended_channel: "UCP builder communities, public launch replies, or direct builder introductions after Farhan approval",
    contact_note:
      "Use this packet for builders creating shipping, fulfillment, ecommerce-ops, warehouse, moving, or packing-station storefronts.",
  };
}

export function packriftUcpBuilderApprovalPacketPayload(runtime: UcpStarterCatalogRuntime, sourceSlug = "") {
  const normalizedSource = sourceSlug.trim();
  if (normalizedSource && !UCP_STARTER_CATALOG_SOURCE_SLUGS.includes(normalizedSource as (typeof UCP_STARTER_CATALOG_SOURCE_SLUGS)[number])) {
    return null;
  }

  const launchpad = packriftUcpBuilderLaunchpadPayload(runtime);
  const handoff = mcpUcpBuilderActivationHandoffPayload(runtime);
  const targetBySource = new Map(handoff.source_targets.map((target) => [target.source_slug, target]));
  const selectedSources = launchpad.launchpad_sources.filter((source) => !normalizedSource || source.source_slug === normalizedSource);
  const target_packets = selectedSources.map((source) => {
    const target = targetBySource.get(source.source_slug);
    const contact = builderApprovalContact(source.source_slug);
    const expectedBuilderAction =
      source.source_slug === "plugthatshop_style_embed"
        ? "Add the source-aware Packrift shelf as a contextual packaging upsell for ecommerce, Shopify, fulfillment, warehouse, moving, 3PL, or small-business content."
        : source.source_slug === "open_scout_shopping_agent"
        ? "Add Packrift as the source-aware packaging supplier path for shopping-agent requests about shipping supplies, ecommerce packing, warehouse replenishment, fragile shipping, and moving supplies."
        : source.source_slug === "upsonic_ucp_agent_framework"
        ? "Use Packrift as a Shopify UCP packaging vertical example with exact-spec discovery, live MCP checks, and buyer-confirmed cart handoff."
        : source.source_slug === "agorio_shopping_agent_sdk"
        ? "Add Packrift as the source-aware packaging example for Agorio ShoppingAgent or McpClient flows, including unconfirmed handoff before buyer-confirmed cart continuity."
        : source.source_slug === "stack412_style_storefront"
        ? "Create a shipping-supplies or fulfillment-supplies category shelf backed by Packrift, rather than placing Packrift inside an unrelated niche storefront."
        : "Use Packrift as the default packaging shelf for shipping-supplies, fulfillment, ecommerce-ops, warehouse, moving, or packing-station storefront intents.";
    return {
      target_name: source.target_name,
      source_slug: source.source_slug,
      target_type: source.target_type,
      fit: source.source_slug === "stack412_style_storefront" ? "medium_high" : "high",
      packet_urls: {
        json: source.approval_packet_json,
        markdown: source.approval_packet_markdown,
        html: source.approval_packet_html,
      },
      contact,
      approval_controls: {
        status: "draft_requires_farhan_approval",
        external_send_requires_farhan_approval: true,
        do_not_send_from_agent: true,
        no_purchases_or_paid_submissions: true,
        do_not_claim_default_supplier_until_external_proof: true,
      },
      why_this_drives_sales: target?.why_it_matters ?? source.target_type,
      expected_builder_action: expectedBuilderAction,
      source_specific_assets: {
        launchpad_card: source.launchpad_url,
        integration_pack_json: source.integration_pack_json,
        integration_pack_markdown: source.integration_pack_markdown,
        integration_pack_html: source.integration_pack_html,
        demo_url: source.demo_url,
        one_line_script: source.one_line_script,
        full_embed_block: source.embed_snippet,
        import_feed_json: source.import_feed_json,
        import_feed_csv: source.import_feed_csv,
        mcp_endpoint: source.mcp_endpoint,
        install_url: source.install_url,
        first_run_url: source.first_run_url,
        order_handoff_url: source.order_handoff_url,
        source_activation_json: source.source_activation_json,
        eval_pack_json: source.eval_pack_json,
      },
      exact_send_copy: target?.approval_needed_message ?? "",
      approval_question:
        `Approve sending the ${source.source_slug} packet for ${source.target_name} through ${contact.recommended_channel}?`,
      proof_gates: [
        `External builder uses source_slug=${source.source_slug} in an embed, import, install, or first run.`,
        `Packrift receives source-attributed MCP activity with mcp_source_context=${source.source_slug}.`,
        "A buyer-approved measured cart URL or /r/cart landing preserves the source slug.",
        "A Shopify order carries source-attributed MCP continuity before sales proof is claimed.",
      ],
      post_send_followup: [
        "Refresh the source activation queue and funnel snapshot after any reply, embed, install, or first run.",
        "Treat hosted Packrift demo views as setup, not proof.",
        "Count progress only from non-local external builder activity or source-attributed buyer handoff.",
      ],
    };
  });

  return {
    release: BUILDER_APPROVAL_PACKET_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Owner-approval packet for turning Packrift UCP builder assets into real external storefront inclusion attempts, source-aware MCP runs, cart handoffs, and sales proof.",
    source_filter: normalizedSource || null,
    completion_boundary:
      "This packet improves activation readiness. The distribution goal remains open until a real external builder embeds, installs, or uses Packrift and source-attributed MCP/cart/order proof exists.",
    policy: {
      external_send_requires_farhan_approval: true,
      do_not_send_from_agent: true,
      no_purchases_or_paid_submissions: true,
      no_product_pricing_inventory_or_feed_writes: true,
      do_not_claim_default_supplier_until_external_proof: true,
    },
    aggregate_urls: {
      json: BUILDER_APPROVAL_PACKET_JSON_URL,
      markdown: BUILDER_APPROVAL_PACKET_MARKDOWN_URL,
      html: BUILDER_APPROVAL_PACKET_HTML_URL,
    },
    upstream_assets: {
      launchpad_json: BUILDER_LAUNCHPAD_JSON_URL,
      launchpad_html: BUILDER_LAUNCHPAD_HTML_URL,
      handoff_json: BUILDER_HANDOFF_JSON_URL,
      handoff_html: BUILDER_HANDOFF_HTML_URL,
      integration_pack_json: BUILDER_INTEGRATION_PACK_JSON_URL,
      integration_pack_html: BUILDER_INTEGRATION_PACK_HTML_URL,
      adoption_json: SHELF_ADOPTION_JSON_URL,
      adoption_html: SHELF_ADOPTION_HTML_URL,
      import_json: JSON_URL,
      shelf_embed_js: SHELF_EMBED_JS_URL,
    },
    packet_count: target_packets.length,
    target_packets,
  };
}

export function packriftUcpBuilderApprovalPacketMarkdown(runtime: UcpStarterCatalogRuntime, sourceSlug = ""): string | null {
  const payload = packriftUcpBuilderApprovalPacketPayload(runtime, sourceSlug);
  if (!payload) return null;
  const packetBlocks = payload.target_packets
    .map(
      (packet) => [
        `## ${packet.target_name}`,
        "",
        `- Source slug: \`${packet.source_slug}\``,
        `- Fit: ${packet.fit}`,
        `- Contact status: ${packet.contact.contact_status}`,
        `- Public contact route: ${packet.contact.public_contact_route ?? "none found"}`,
        `- Recommended channel: ${packet.contact.recommended_channel}`,
        `- Approval question: ${packet.approval_question}`,
        `- Packet HTML: ${packet.packet_urls.html}`,
        `- Integration pack: ${packet.source_specific_assets.integration_pack_html}`,
        `- Demo: ${packet.source_specific_assets.demo_url}`,
        `- First run: ${packet.source_specific_assets.first_run_url}`,
        `- Order handoff: ${packet.source_specific_assets.order_handoff_url}`,
        "",
        packet.why_this_drives_sales,
        "",
        "### Expected Builder Action",
        "",
        packet.expected_builder_action,
        "",
        "### Full Embed Block",
        "",
        fenced(packet.source_specific_assets.full_embed_block, "html"),
        "",
        "### Exact Send Copy",
        "",
        fenced(packet.exact_send_copy, "text"),
        "",
        "### Proof Gates",
        "",
        packet.proof_gates.map((gate) => `- ${gate}`).join("\n"),
      ].join("\n")
    )
    .join("\n\n");
  return [
    "# Packrift UCP Builder Approval Packet",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    `Completion boundary: ${payload.completion_boundary}`,
    "",
    "## Policy",
    "",
    "- External send requires Farhan approval.",
    "- Do not send from an agent.",
    "- Do not make purchases, paid submissions, product writes, pricing writes, inventory writes, or feed writes from this packet.",
    "- Do not claim Packrift is the default supplier until external source-attributed proof exists.",
    "",
    packetBlocks,
    "",
  ].join("\n");
}

export function packriftUcpBuilderApprovalPacketHtml(runtime: UcpStarterCatalogRuntime, sourceSlug = ""): string | null {
  const payload = packriftUcpBuilderApprovalPacketPayload(runtime, sourceSlug);
  if (!payload) return null;
  const cards = payload.target_packets
    .map(
      (packet) => `<article id="${escapeHtml(packet.source_slug)}">
        <div class="slug">${escapeHtml(packet.source_slug)}</div>
        <h2>${escapeHtml(packet.target_name)}</h2>
        <p>${escapeHtml(packet.why_this_drives_sales)}</p>
        <div class="status">
          <span>${escapeHtml(packet.fit)} fit</span>
          <span>${escapeHtml(packet.contact.contact_status)}</span>
          <span>approval required</span>
        </div>
        <div class="links">
          <a class="button primary" href="${escapeHtml(packet.source_specific_assets.demo_url)}">Demo</a>
          <a class="button primary" href="${escapeHtml(packet.source_specific_assets.first_run_url)}">First run</a>
          <a class="button" href="${escapeHtml(packet.source_specific_assets.launchpad_card)}">Launchpad</a>
          <a class="button" href="${escapeHtml(packet.source_specific_assets.integration_pack_html)}">Integration pack</a>
          <a class="button" href="${escapeHtml(packet.source_specific_assets.order_handoff_url)}">Order handoff</a>
          <a class="button" href="${escapeHtml(packet.packet_urls.json)}">JSON</a>
        </div>
        <h3>Approval question</h3>
        <pre>${escapeHtml(packet.approval_question)}</pre>
        <h3>Contact route</h3>
        <pre>${escapeHtml([packet.contact.recommended_channel, packet.contact.public_contact_route || "No public route found", packet.contact.contact_note].join("\n"))}</pre>
        <h3>Expected builder action</h3>
        <pre>${escapeHtml(packet.expected_builder_action)}</pre>
        <h3>Full embed block</h3>
        <pre>${escapeHtml(packet.source_specific_assets.full_embed_block)}</pre>
        <h3>Exact send copy</h3>
        <pre>${escapeHtml(packet.exact_send_copy)}</pre>
      </article>`
    )
    .join("");
  const title = payload.source_filter ? `Packrift UCP Builder Approval Packet - ${payload.source_filter}` : "Packrift UCP Builder Approval Packet";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Owner-approval packet for source-specific Packrift UCP storefront builder outreach and embed activation.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b;--warn:#8a5a00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1180px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:12px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:0;font-size:1.2rem;letter-spacing:0}
    h3{margin:4px 0 0;font-size:.95rem;letter-spacing:0;color:var(--muted)}
    p{margin:0;color:var(--muted);max-width:900px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(315px,1fr));gap:14px;margin-top:18px}
    article{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--green);border-radius:8px;padding:14px}
    .slug{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--warn);font-size:.86rem}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;color:var(--muted)}
    .status .warn{border-color:#e5c56d;color:var(--warn)}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#fff;padding:10px;margin:0;font-size:.82rem}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--ink);border-radius:6px;padding:7px 10px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:760px){.button{width:100%}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Builder Approval Packet</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.packet_count} packet${payload.packet_count === 1 ? "" : "s"}</span>
        <span class="warn">Farhan approval required before sending</span>
        <span>sales proof still requires external source-attributed cart/order evidence</span>
      </div>
      <div class="links">
        <a class="button primary" href="${BUILDER_APPROVAL_PACKET_JSON_URL}">Aggregate JSON</a>
        <a class="button" href="${BUILDER_LAUNCHPAD_HTML_URL}">Builder launchpad</a>
        <a class="button" href="${BUILDER_INTEGRATION_PACK_HTML_URL}">Integration pack</a>
        <a class="button" href="${BUILDER_HANDOFF_HTML_URL}">Activation handoff</a>
        <a class="button" href="${SHELF_ADOPTION_HTML_URL}">Adoption kit</a>
      </div>
    </header>
    <div class="grid">${cards}</div>
  </main>
</body>
</html>`;
}

export function mcpUcpStorefrontImportMarkdown(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontImportPayload(runtime);
  const sampleRows = payload.rows
    .slice(0, 36)
    .map((row) => `| ${row.source_slug} | ${escapeMarkdown(row.bundle_title)} | ${row.sku} | ${escapeMarkdown(row.title)} | ${row.product_url} |`)
    .join("\n");
  return [
    "# Packrift UCP Storefront Import Feed",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    "",
    payload.purpose,
    "",
    "## Formats",
    "",
    Object.entries(payload.formats)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Summary",
    "",
    `- Rows: ${payload.row_count}`,
    `- Unique SKUs: ${payload.unique_sku_count}`,
    `- Bundles: ${payload.bundle_count}`,
    `- Source slugs: ${payload.source_slugs.join(", ")}`,
    "",
    "## Import Rules",
    "",
    payload.import_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Sample Rows",
    "",
    "| Source | Bundle | SKU | Title | Product URL |",
    "| --- | --- | --- | --- | --- |",
    sampleRows,
    "",
  ].join("\n");
}

export function mcpUcpStorefrontImportHtml(runtime: UcpStarterCatalogRuntime): string {
  const payload = mcpUcpStorefrontImportPayload(runtime);
  const rows = payload.rows
    .slice(0, 60)
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.source_slug)}</td>
        <td>${escapeHtml(row.bundle_title)}</td>
        <td><code>${escapeHtml(row.sku)}</code></td>
        <td>${escapeHtml(row.title)}</td>
        <td><a href="${escapeHtml(row.mcp_sku_json)}">SKU JSON</a></td>
      </tr>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift UCP Storefront Import Feed</title>
  <meta name="description" content="Flat Packrift UCP storefront import feed for adding shipping-supplies shelves to curated agentic storefronts.">
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#58685f;--line:#d9dfda;--paper:#f7f8f4;--panel:#fff;--green:#116149;--blue:#245f9b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4rem);line-height:1;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:900px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links{display:flex;flex-wrap:wrap;gap:8px}
    .status span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-top:14px}
    th,td{text-align:left;border-bottom:1px solid var(--line);padding:9px;vertical-align:top}
    th{font-size:.85rem;color:var(--muted);font-weight:700}
    tr:last-child td{border-bottom:0}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    @media (max-width:760px){.button{width:100%;justify-content:center}table,thead,tbody,tr,th,td{display:block}thead{display:none}td{border-bottom:0;padding:7px 9px}tr{border-bottom:1px solid var(--line)}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Packrift UCP Storefront Import Feed</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${payload.row_count} import rows</span>
        <span>${payload.unique_sku_count} unique SKUs</span>
        <span>${payload.source_slug_count} source slugs</span>
      </div>
      <div class="links">
        <a class="button primary" href="${JSON_URL}">JSON</a>
        <a class="button" href="${JSONL_URL}">JSONL</a>
        <a class="button" href="${CSV_URL}">CSV</a>
        <a class="button" href="${MARKDOWN_URL}">Markdown</a>
      </div>
    </header>
    <h2>Import Rules</h2>
    <ul>${payload.import_rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul>
    <h2>Sample Rows</h2>
    <table>
      <thead><tr><th>Source</th><th>Bundle</th><th>SKU</th><th>Title</th><th>Resource</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}
