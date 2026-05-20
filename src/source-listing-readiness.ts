export interface SourceListingReadinessRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const SOURCE_READINESS_JSON_URL = "https://mcp.packrift.com/ai/mcp-source-listing-readiness.json";
const SOURCE_READINESS_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-source-listing-readiness.md";
const GLAMA_SOURCE_API_URL = "https://glama.ai/api/mcp/v1/servers/Packrift/packrift-mcp";
const GLAMA_SOURCE_LISTING_URL = "https://glama.ai/mcp/servers/ye4xxr7qiu";
const GLAMA_HOSTED_CONNECTOR_URL = "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp";

const REQUIRED_TOOL_NAMES = [
  "search_products",
  "get_product",
  "get_pricing",
  "check_inventory",
  "find_packaging_for_item",
  "get_shipping_estimate",
  "get_cart_handoff_candidates",
  "create_cart_url",
  "prepare_purchase_handoff",
  "compare_alternatives",
  "pack_calculator",
  "inventory_status",
  "get_reorder_link",
  "get_bulk_quote_link",
  "explain_no_exact_match",
] as const;

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function mcpSourceListingReadinessPayload(runtime: SourceListingReadinessRuntime) {
  return {
    release: "PACKRIFT-MCP-SOURCE-LISTING-READINESS-R03",
    generated_at: new Date().toISOString(),
    status: "ready_for_glama_admin_release_sync",
    purpose:
      "Give Glama, MCP directories, and source-based scanners one canonical proof that Packrift MCP discovery works from the existing repository without requiring a private Shopify token or creating a duplicate CLI.",
    canonical_runtime: {
      endpoint: MCP_ENDPOINT,
      transport: "streamable-http",
      authentication: "none_required_for_hosted_endpoint",
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    source_listing_targets: {
      repository_url: "https://github.com/Packrift/packrift-mcp",
      glama_source_listing_url: GLAMA_SOURCE_LISTING_URL,
      glama_source_api_url: GLAMA_SOURCE_API_URL,
      glama_hosted_connector_url: GLAMA_HOSTED_CONNECTOR_URL,
      canonical_traffic_target: GLAMA_HOSTED_CONNECTOR_URL,
    },
    source_package_contract: {
      dockerfile: "Dockerfile",
      glama_claim_file: "glama.json",
      smithery_metadata: "smithery.yaml",
      start_command: "node dist/node.js",
      port: 8787,
      config_schema_required: [],
      token_policy:
        "SHOPIFY_PACKRIFT_TOKEN is optional for tools/list, resources/list, prompts/list, discovery, and directory scanning. It is required only for self-hosted live Shopify-backed catalog, pricing, inventory, shipping, and cart tool calls.",
      no_duplicate_surface_rule:
        "Release and sync Packrift/packrift-mcp as the source package, but keep users and agents on https://mcp.packrift.com/mcp. Do not create a separate Packrift CLI, marketplace listing, or buyer checkout surface.",
    },
    no_token_discovery_contract: {
      environment: "SHOPIFY_PACKRIFT_TOKEN unset",
      expected_methods: ["initialize", "tools/list", "resources/list", "prompts/list"],
      expected_tools_count: REQUIRED_TOOL_NAMES.length,
      expected_resources_min: 700,
      expected_prompts_min: 9,
      required_tools: REQUIRED_TOOL_NAMES,
      acceptance:
        "A source-listing release passes discovery when tools/list returns all required tools, resources/list returns the public AI/MCP resources, prompts/list returns Packrift prompt templates, and no required env var is inferred for those discovery methods.",
    },
    copy_ready_probe: {
      build: "npm ci && npm run build",
      run_without_token: "env -u SHOPIFY_PACKRIFT_TOKEN PORT=8787 npm start",
      tools_list:
        "curl -sS http://127.0.0.1:8787/mcp -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":\"tools\",\"method\":\"tools/list\"}'",
      resources_list:
        "curl -sS http://127.0.0.1:8787/mcp -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":\"resources\",\"method\":\"resources/list\"}'",
      prompts_list:
        "curl -sS http://127.0.0.1:8787/mcp -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":\"prompts\",\"method\":\"prompts/list\"}'",
    },
    current_known_blocker: {
      directory: "glama_source_server_listing",
      issue:
        "The hosted Glama connector is healthy, but the source server API is still stale: it reports zero tools, no score, and no package/config release for the Packrift/packrift-mcp source listing.",
      desired_state:
        "Glama source API reports at least 15 tools, a quality score, and no required Shopify token for basic MCP discovery.",
      downstream_impact:
        "Clearing this source score also removes the quality blocker for directories that depend on Glama source-listing metadata, including the pending punkpeye awesome-mcp-servers review.",
    },
    current_glama_source_api_observation: {
      source_api_url: GLAMA_SOURCE_API_URL,
      observed_tools_count: 0,
      observed_score: null,
      observed_package: null,
      observed_config: null,
      observed_server_url: null,
      interpretation:
        "Glama has discovered the repository record but has not completed a source release/quality evaluation against the current Dockerfile and smithery.yaml discovery contract.",
    },
    copy_ready_glama_admin_steps: [
      "Claim the Packrift source server listing in Glama admin.",
      "Use the current Packrift/packrift-mcp repository and Dockerfile for the source release.",
      "Deploy or make the Glama source release from that Dockerfile, then use Sync Server if Glama offers a manual resync action.",
      "Honor smithery.yaml configSchema.required as an empty array for discovery scans.",
      "Run release/sync so Glama re-inspects tools/list, resources/list, and prompts/list.",
      "Keep the hosted connector and all user traffic pointed at https://mcp.packrift.com/mcp.",
    ],
    copy_ready_recrawl_message:
      "Please claim and resync the Packrift source server listing from https://github.com/Packrift/packrift-mcp. The current Glama source API record shows tools=[], score=null, package=null, and config=null even though the repo includes glama.json, smithery.yaml with configSchema.required=[], and a Docker/Node server that exposes tools/list, resources/list, and prompts/list without SHOPIFY_PACKRIFT_TOKEN. The hosted connector remains the primary no-auth traffic target at https://mcp.packrift.com/mcp; please do not create a duplicate Packrift CLI or buyer surface.",
    proof_urls: {
      source_listing_readiness_json: SOURCE_READINESS_JSON_URL,
      source_listing_readiness_markdown: SOURCE_READINESS_MARKDOWN_URL,
      hosted_endpoint: MCP_ENDPOINT,
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      tool_discovery: "https://mcp.packrift.com/ai/mcp-tools.json",
      directory_update_card: "https://mcp.packrift.com/ai/mcp-directory-update/glama_server_listing.json",
      eval_pack: "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=glama_server_listing",
      glama_claim: "https://mcp.packrift.com/.well-known/glama.json",
    },
  };
}

export function mcpSourceListingReadinessMarkdown(runtime: SourceListingReadinessRuntime): string {
  const payload = mcpSourceListingReadinessPayload(runtime);
  return [
    "# Packrift MCP Source Listing Readiness",
    "",
    `Generated: ${payload.generated_at}`,
    `Release: ${payload.release}`,
    `Status: ${payload.status}`,
    "",
    payload.purpose,
    "",
    "## Canonical Runtime",
    "",
    `- Endpoint: ${payload.canonical_runtime.endpoint}`,
    `- Auth: ${payload.canonical_runtime.authentication}`,
    `- Tools: ${payload.canonical_runtime.tools_count}`,
    `- Resources: ${payload.canonical_runtime.resources_count}`,
    `- Prompts: ${payload.canonical_runtime.prompts_count}`,
    "",
    "## Source Package Contract",
    "",
    fencedJson(payload.source_package_contract),
    "",
    "## No-Token Discovery Contract",
    "",
    fencedJson(payload.no_token_discovery_contract),
    "",
    "## Glama Admin Steps",
    "",
    ...payload.copy_ready_glama_admin_steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Current Glama Source API Observation",
    "",
    fencedJson(payload.current_glama_source_api_observation),
    "",
    "## Copy-Ready Recrawl Message",
    "",
    payload.copy_ready_recrawl_message,
    "",
    "## Proof URLs",
    "",
    fencedJson(payload.proof_urls),
    "",
  ].join("\n");
}
