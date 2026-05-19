import { TRACKED_INSTALL_TEMPLATE, clineMcpJson, mcpFirstUsefulRun, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface McpClientConfigRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";
const TRACKED_CONFIG_RECOMMENDED_SOURCES = [
  "official_registry",
  "mcpservers_org",
  "glama_connector",
  "mcp_directory",
  "anthropic_connectors_directory",
  "smithery",
  "cline_mcp_marketplace",
  "mcp_so",
  "mcpmarket_com",
  "cursor_directory",
  "mcpcentral",
  "mcpfinder",
  "generic",
] as const;

function remoteMcpJson(name = "packrift") {
  return {
    mcpServers: {
      [name]: {
        type: "http",
        url: MCP_ENDPOINT,
      },
    },
  };
}

function trackedConfigUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", "client_config");
  return url.toString();
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

const FIRST_TESTS = [
  {
    id: "tools-list",
    purpose: "Confirm the hosted endpoint is reachable and exposes Packrift MCP tools.",
    request: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    expected: {
      minimum_tools: 15,
      required_tools: ["search_products", "prepare_purchase_handoff", "get_cart_handoff_candidates", "create_cart_url"],
    },
  },
  {
    id: "prepare-1066",
    purpose: "Run the compact exact-SKU prep flow without creating a cart URL.",
    request: toolCall("prepare-1066", "prepare_purchase_handoff", {
      sku: "1066",
      quantity: 1,
      buyer_confirmed: false,
      source_context: "client_config_first_test",
    }),
    expected: {
      selected_sku: "1066",
      cart_url_present_before_buyer_confirmation: false,
    },
  },
  {
    id: "candidate-1066",
    purpose: "Fetch one purchase-ready exact-SKU handoff candidate with required live checks.",
    request: toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: "1066", limit: 1 }),
    expected: {
      selected_sku: "1066",
      required_before_cart: ["get_product", "get_pricing", "check_inventory"],
    },
  },
  {
    id: "cart-1066",
    purpose: "Confirm the MCP cart tool returns a measured /r/cart landing URL after exact SKU, price, and inventory are known.",
    request: toolCall("cart-1066", "create_cart_url", {
      sku: "1066",
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: "client_config_first_useful_run",
      source_context: "client_config_first_cart_run",
      journey_id: "mcp_client_config_1066_53472879935856",
      result_set_id: "mcp_client_config_first_run",
      utm_term: "1066",
    }),
    expected: {
      cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
      order_created: false,
    },
  },
] as const;

export function mcpClientConfigPayload(runtime: McpClientConfigRuntime) {
  const firstUsefulRun = mcpFirstUsefulRun("generic", "client_config");
  return {
    release: "PACKRIFT-MCP-CLIENT-CONFIG-R09",
    generated_at: new Date().toISOString(),
    purpose:
      "Smallest copy-ready Packrift MCP install bundle for agent hosts, IDEs, directory reviewers, and developers. It is a thin config surface for the existing hosted endpoint, not a separate CLI or buyer surface.",
    canonical_endpoint: MCP_ENDPOINT,
    transport: "streamable-http",
    authentication: {
      required: false,
      buyer_side_api_key_required: false,
    },
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    config: remoteMcpJson(),
    cline_config: clineMcpJson(),
    aliases: {
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      canonical_json: "https://mcp.packrift.com/ai/mcp-client-config.json",
      markdown: "https://mcp.packrift.com/ai/mcp-client-config.md",
      tracked_config_template: TRACKED_CONFIG_TEMPLATE,
      tracked_config_generic: trackedConfigUrl("generic"),
      tracked_config_examples: Object.fromEntries(TRACKED_CONFIG_RECOMMENDED_SOURCES.map((source) => [source, trackedConfigUrl(source)])),
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_install_examples: {
        generic_streamable_http: trackedInstallUrl("generic", "generic_streamable_http"),
        claude_code: trackedInstallUrl("generic", "claude_code"),
        codex: trackedInstallUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedInstallUrl("generic", "cursor_windsurf_vscode"),
        cline: trackedInstallUrl("generic", "cline"),
      },
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_run_examples: {
        generic_streamable_http: trackedRunUrl("generic", "generic_streamable_http"),
        claude_code: trackedRunUrl("generic", "claude_code"),
        codex: trackedRunUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedRunUrl("generic", "cursor_windsurf_vscode"),
        cline: trackedRunUrl("generic", "cline"),
      },
    },
    install_commands: {
      claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      endpoint_only: MCP_ENDPOINT,
    },
    host_notes: [
      "For Cursor, Windsurf, VS Code, Roo-style hosts, Claude Desktop, and generic MCP clients, use the config.mcpServers.packrift object.",
      "For Cline and the Cline MCP Marketplace review path, use cline_config or the tracked Cline target at /r/install/{source}/cline and /r/run/{source}/cline.",
      "If a host asks for transport, choose HTTP or Streamable HTTP.",
      "Do not ask buyers for Packrift API keys; the hosted endpoint requires no buyer-side auth.",
      "After install, run the required post-install verification sequence for SKU 1066; it returns a measured cart URL only and does not place an order.",
      "For real buyer workflows, use prepare_purchase_handoff for exact SKU prep, then create cart handoffs only after buyer confirmation.",
      "Use /r/config/{source} when sharing the config from a directory, partner, campaign, or agent workflow so config fetches can be attributed.",
      "Use /r/install/{source}/{target} when sharing a target-specific command or config so install-intent can be attributed before tool calls arrive.",
    ],
    required_post_install_verification: {
      required: true,
      no_order_created: true,
      endpoint: firstUsefulRun.endpoint,
      run: "Run the first_useful_run sequence after adding Packrift MCP. It confirms exact SKU, live price, live inventory, and a measured cart handoff URL.",
      required_final_tool: "create_cart_url",
      required_sku: "1066",
      success_signal: "create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066",
      sequence: firstUsefulRun.sequence,
    },
    first_tests: FIRST_TESTS,
    first_useful_run: firstUsefulRun,
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      server_card: "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      start: "https://mcp.packrift.com/start",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      browse_skill_md: "https://mcp.packrift.com/SKILL.md",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function fencedShell(value: string): string {
  return ["```sh", value, "```"].join("\n");
}

export function mcpClientConfigMarkdown(runtime: McpClientConfigRuntime): string {
  const payload = mcpClientConfigPayload(runtime);
  return [
    "# Packrift MCP Client Config",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Endpoint: ${payload.canonical_endpoint}`,
    `Transport: ${payload.transport}`,
    "",
    payload.purpose,
    "",
    "## Copy-Ready MCP JSON",
    "",
    fencedJson(payload.config),
    "",
    "## Copy-Ready Cline MCP JSON",
    "",
    fencedJson(payload.cline_config),
    "",
    "## Source-Attributed Config Links",
    "",
    `Template: \`${payload.aliases.tracked_config_template}\``,
    "",
    Object.entries(payload.aliases.tracked_config_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Tracked Install Actions",
    "",
    `Template: \`${payload.aliases.tracked_install_template}\``,
    "",
    Object.entries(payload.aliases.tracked_install_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Tracked First-Run Actions",
    "",
    `Template: \`${payload.aliases.tracked_run_template}\``,
    "",
    Object.entries(payload.aliases.tracked_run_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Install Commands",
    "",
    `Claude Code: \`${payload.install_commands.claude_code}\``,
    "",
    `Codex: \`${payload.install_commands.codex}\``,
    "",
    "## Host Notes",
    "",
    payload.host_notes.map((note) => `- ${note}`).join("\n"),
    "",
    "## Required Post-Install Verification",
    "",
    payload.required_post_install_verification.run,
    "",
    `Endpoint: \`${payload.required_post_install_verification.endpoint}\``,
    "",
    `Required final tool: \`${payload.required_post_install_verification.required_final_tool}\``,
    "",
    fencedJson(payload.required_post_install_verification.sequence),
    "",
    "Pasteable curl script:",
    "",
    fencedShell(payload.first_useful_run.curl_script),
    "",
    "## First Tests",
    "",
    payload.first_tests.map((test) => [`### ${test.id}`, "", test.purpose, "", fencedJson(test.request)].join("\n")).join("\n\n"),
    "",
    "## First Useful Run",
    "",
    `Endpoint: \`${payload.first_useful_run.endpoint}\``,
    "",
    payload.first_useful_run.buyer_prompt,
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "Pasteable curl script:",
    "",
    fencedShell(payload.first_useful_run.curl_script),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-client-config.json",
    "",
  ].join("\n");
}
