import { TRACKED_INSTALL_TEMPLATE, clineMcpJson, mcpFirstUsefulRun, sourceAwareMcpEndpoint, stdioMcpRemoteJson, trackedInstallUrl } from "./install-action.js";
import { TRACKED_RUN_TEMPLATE, trackedRunUrl } from "./first-run-action.js";

export interface McpClientConfigRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const MCP_TOOL_DISCOVERY_JSON_URL = "https://mcp.packrift.com/ai/mcp-tools.json";
const MCP_TOOL_DISCOVERY_MARKDOWN_URL = "https://mcp.packrift.com/ai/spec-finder-tools.md";
const MCP_SOURCE_ACTIVATION_QUEUE_URL = "https://mcp.packrift.com/ai/mcp-source-activation-queue.json";
const MCP_OPENAPI_JSON_URL = "https://mcp.packrift.com/openapi.json";
const MCP_WELL_KNOWN_OPENAPI_JSON_URL = "https://mcp.packrift.com/.well-known/openapi.json";
const MCP_AI_PLUGIN_JSON_URL = "https://mcp.packrift.com/ai-plugin.json";
const MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL = "https://mcp.packrift.com/.well-known/ai-plugin.json";
const MCP_AGENT_ADOPTION_PROGRESS_URL = "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.json";
const MCP_AGENT_HOST_ROLLOUT_JSON_URL = "https://mcp.packrift.com/ai/mcp-agent-host-rollout.json";
const MCP_AGENT_HOST_ROLLOUT_MARKDOWN_URL = "https://mcp.packrift.com/ai/mcp-agent-host-rollout.md";
const MCP_AGENT_HOST_ROLLOUT_HTML_URL = "https://mcp.packrift.com/ai/mcp-agent-host-rollout.html";
const MCP_AGENT_HOST_ROLLOUT_TASKS_JSONL_URL = "https://mcp.packrift.com/ai/mcp-agent-host-rollout-tasks.jsonl";
const MCP_AGENT_HOST_ROLLOUT_TASKS_CSV_URL = "https://mcp.packrift.com/ai/mcp-agent-host-rollout-tasks.csv";
const MCP_EXTERNAL_ACTIVATION_BRIEF_URL = "https://mcp.packrift.com/ai/mcp-external-activation-brief.json";
const MCP_REVIEWER_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.json";
const MCP_EVAL_PACK_URL = "https://mcp.packrift.com/ai/mcp-eval-pack.json";
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
const SOURCE_AWARE_EXAMPLE_SOURCES = [
  "generic",
  "browse_sh",
  "cline_mcp_marketplace",
  "mcp_so",
  "glama_connector",
  "mcp_marketplace_io",
] as const;

function remoteMcpJson(name = "packrift", endpoint = MCP_ENDPOINT) {
  return {
    mcpServers: {
      [name]: {
        type: "http",
        url: endpoint,
      },
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function trackedConfigUrl(source: string): string {
  const url = new URL(`https://mcp.packrift.com/r/config/${source}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "directory_config");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", "client_config");
  return url.toString();
}

function sourceAwareInstallExample(source: string) {
  const genericEndpoint = sourceAwareMcpEndpoint(source, "generic_streamable_http");
  const claudeCodeEndpoint = sourceAwareMcpEndpoint(source, "claude_code");
  const codexEndpoint = sourceAwareMcpEndpoint(source, "codex");
  const clineEndpoint = sourceAwareMcpEndpoint(source, "cline");
  const stdioEndpoint = sourceAwareMcpEndpoint(source, "stdio_mcp_remote");
  return {
    start_url: `https://mcp.packrift.com/start?utm_source=${source}`,
    tracked_config_url: trackedConfigUrl(source),
    tracked_install_urls: {
      generic_streamable_http: trackedInstallUrl(source, "generic_streamable_http"),
      stdio_mcp_remote: trackedInstallUrl(source, "stdio_mcp_remote"),
      claude_code: trackedInstallUrl(source, "claude_code"),
      codex: trackedInstallUrl(source, "codex"),
      cline: trackedInstallUrl(source, "cline"),
    },
    source_aware_endpoints: {
      generic_streamable_http: genericEndpoint,
      stdio_mcp_remote: stdioEndpoint,
      claude_code: claudeCodeEndpoint,
      codex: codexEndpoint,
      cline: clineEndpoint,
    },
    remote_mcp_json: remoteMcpJson("packrift", genericEndpoint),
    stdio_mcp_remote_json: stdioMcpRemoteJson("packrift", stdioEndpoint),
    cline_mcp_json: clineMcpJson("packrift", clineEndpoint),
    commands: {
      stdio_mcp_remote: `npx -y mcp-remote ${shellQuote(stdioEndpoint)}`,
      claude_code: `claude mcp add --transport http packrift ${shellQuote(claudeCodeEndpoint)}`,
      codex: `codex mcp add packrift --url ${shellQuote(codexEndpoint)}`,
    },
    first_useful_run: {
      endpoint: mcpFirstUsefulRun(source, "generic_streamable_http").endpoint,
      tracked_run_url: trackedRunUrl(source, "generic_streamable_http"),
    },
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
    release: "PACKRIFT-MCP-CLIENT-CONFIG-R13",
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
    stdio_mcp_remote_config: stdioMcpRemoteJson(),
    cline_config: clineMcpJson(),
    aliases: {
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      canonical_json: "https://mcp.packrift.com/ai/mcp-client-config.json",
      markdown: "https://mcp.packrift.com/ai/mcp-client-config.md",
      openapi_json: MCP_OPENAPI_JSON_URL,
      well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
      ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
      well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
      tool_discovery_json: MCP_TOOL_DISCOVERY_JSON_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      agent_host_rollout: MCP_AGENT_HOST_ROLLOUT_JSON_URL,
      agent_host_rollout_markdown: MCP_AGENT_HOST_ROLLOUT_MARKDOWN_URL,
      agent_host_rollout_html: MCP_AGENT_HOST_ROLLOUT_HTML_URL,
      agent_host_rollout_tasks_jsonl: MCP_AGENT_HOST_ROLLOUT_TASKS_JSONL_URL,
      agent_host_rollout_tasks_csv: MCP_AGENT_HOST_ROLLOUT_TASKS_CSV_URL,
      tracked_config_template: TRACKED_CONFIG_TEMPLATE,
      tracked_config_generic: trackedConfigUrl("generic"),
      tracked_config_examples: Object.fromEntries(TRACKED_CONFIG_RECOMMENDED_SOURCES.map((source) => [source, trackedConfigUrl(source)])),
      source_aware_endpoint_template: "https://mcp.packrift.com/mcp?packrift_mcp_source={source}&packrift_mcp_target={target}",
      source_aware_examples: Object.fromEntries(SOURCE_AWARE_EXAMPLE_SOURCES.map((source) => [source, sourceAwareInstallExample(source)])),
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      tracked_install_examples: {
        generic_streamable_http: trackedInstallUrl("generic", "generic_streamable_http"),
        stdio_mcp_remote: trackedInstallUrl("generic", "stdio_mcp_remote"),
        claude_code: trackedInstallUrl("generic", "claude_code"),
        codex: trackedInstallUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedInstallUrl("generic", "cursor_windsurf_vscode"),
        cline: trackedInstallUrl("generic", "cline"),
      },
      tracked_run_template: TRACKED_RUN_TEMPLATE,
      tracked_run_examples: {
        generic_streamable_http: trackedRunUrl("generic", "generic_streamable_http"),
        stdio_mcp_remote: trackedRunUrl("generic", "stdio_mcp_remote"),
        claude_code: trackedRunUrl("generic", "claude_code"),
        codex: trackedRunUrl("generic", "codex"),
        cursor_windsurf_vscode: trackedRunUrl("generic", "cursor_windsurf_vscode"),
        cline: trackedRunUrl("generic", "cline"),
      },
    },
    install_commands: {
      stdio_mcp_remote: `npx -y mcp-remote ${MCP_ENDPOINT}`,
      claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      endpoint_only: MCP_ENDPOINT,
    },
    legacy_ai_discovery: {
      purpose:
        "Use these only when an agent host, crawler, or marketplace probes OpenAPI or plugin-style manifests before it understands MCP. They all route back to the hosted Packrift MCP endpoint.",
      openapi_json: MCP_OPENAPI_JSON_URL,
      well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
      ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
      well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
      canonical_mcp_endpoint: MCP_ENDPOINT,
      key_paths: [
        "/mcp",
        "/ai/mcp-client-config.json",
        "/ai/mcp-agent-adoption-progress.json",
        "/ai/mcp-agent-host-rollout.json",
        "/ai/mcp-agent-host-rollout-tasks.jsonl",
        "/ai/mcp-agent-host-rollout-tasks.csv",
        "/ai/mcp-source-activation-queue.json",
        "/ai/mcp-external-activation-brief.json",
        "/ai/mcp-eval-pack.json",
        "/r/install/{source}/{target}",
        "/r/run/{source}/{target}",
        "/r/activate/{source}",
        "/r/order/{source}",
      ],
      no_duplicate_surface_rule:
        "OpenAPI and plugin manifests are discovery adapters only; live price, inventory, exact-spec search, and cart handoff still happen through Packrift MCP.",
    },
    activation_surfaces: {
      agent_adoption_progress: MCP_AGENT_ADOPTION_PROGRESS_URL,
      agent_host_rollout: MCP_AGENT_HOST_ROLLOUT_JSON_URL,
      agent_host_rollout_tasks_jsonl: MCP_AGENT_HOST_ROLLOUT_TASKS_JSONL_URL,
      agent_host_rollout_tasks_csv: MCP_AGENT_HOST_ROLLOUT_TASKS_CSV_URL,
      source_activation_queue: MCP_SOURCE_ACTIVATION_QUEUE_URL,
      external_activation_brief: MCP_EXTERNAL_ACTIVATION_BRIEF_URL,
      reviewer_activation: MCP_REVIEWER_ACTIVATION_URL,
      eval_pack: MCP_EVAL_PACK_URL,
    },
    host_notes: [
      "For Cursor, Windsurf, VS Code, Roo-style hosts, Claude Desktop, and generic MCP clients, use the config.mcpServers.packrift object.",
      "For stdio-only MCP hosts that cannot call remote HTTP directly, use stdio_mcp_remote_config; it runs npx mcp-remote and still forwards every call to the hosted Packrift MCP endpoint.",
      "For Cline and the Cline MCP Marketplace review path, use cline_config or the tracked Cline target at /r/install/{source}/cline and /r/run/{source}/cline.",
      "If a host asks for transport, choose HTTP or Streamable HTTP.",
      "Do not ask buyers for Packrift API keys; the hosted endpoint requires no buyer-side auth.",
      "After install, run the required post-install verification sequence for SKU 1066; it returns a measured cart URL only and does not place an order.",
      "For real buyer workflows, use prepare_purchase_handoff for exact SKU prep, then create cart handoffs only after buyer confirmation.",
      "Use /r/config/{source} when sharing the config from a directory, partner, campaign, or agent workflow so config fetches can be attributed.",
      "Use /r/install/{source}/{target} when sharing a target-specific command or config so install-intent can be attributed before tool calls arrive.",
      "When the source is known, copy from aliases.source_aware_examples or /start?utm_source={source} so real tools/list and tools/call events are attributed to that source.",
      "When a legacy agent asks for OpenAPI or plugin metadata, provide aliases.openapi_json or aliases.ai_plugin_json, then send actual live MCP calls to the canonical endpoint.",
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
      openapi_json: MCP_OPENAPI_JSON_URL,
      well_known_openapi_json: MCP_WELL_KNOWN_OPENAPI_JSON_URL,
      ai_plugin_json: MCP_AI_PLUGIN_JSON_URL,
      well_known_ai_plugin_json: MCP_WELL_KNOWN_AI_PLUGIN_JSON_URL,
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      tool_discovery_json: MCP_TOOL_DISCOVERY_JSON_URL,
      tool_discovery_markdown: MCP_TOOL_DISCOVERY_MARKDOWN_URL,
      agent_host_rollout: MCP_AGENT_HOST_ROLLOUT_JSON_URL,
      agent_host_rollout_tasks_jsonl: MCP_AGENT_HOST_ROLLOUT_TASKS_JSONL_URL,
      agent_host_rollout_tasks_csv: MCP_AGENT_HOST_ROLLOUT_TASKS_CSV_URL,
      source_activation_queue: MCP_SOURCE_ACTIVATION_QUEUE_URL,
      agent_adoption_progress: MCP_AGENT_ADOPTION_PROGRESS_URL,
      external_activation_brief: MCP_EXTERNAL_ACTIVATION_BRIEF_URL,
      reviewer_activation: MCP_REVIEWER_ACTIVATION_URL,
      eval_pack: MCP_EVAL_PACK_URL,
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
    "## Copy-Ready Stdio Bridge MCP JSON",
    "",
    fencedJson(payload.stdio_mcp_remote_config),
    "",
    "## Source-Attributed Config Links",
    "",
    `Template: \`${payload.aliases.tracked_config_template}\``,
    "",
    Object.entries(payload.aliases.tracked_config_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Source-Aware Install Examples",
    "",
    `Endpoint template: \`${payload.aliases.source_aware_endpoint_template}\``,
    "",
    fencedJson(payload.aliases.source_aware_examples),
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
    "## Legacy AI Discovery",
    "",
    "Use these only for agents, crawlers, or marketplaces that probe OpenAPI or plugin manifests before MCP.",
    "",
    `OpenAPI: ${payload.legacy_ai_discovery.openapi_json}`,
    "",
    `Well-known OpenAPI: ${payload.legacy_ai_discovery.well_known_openapi_json}`,
    "",
    `AI plugin manifest: ${payload.legacy_ai_discovery.ai_plugin_json}`,
    "",
    `Well-known AI plugin manifest: ${payload.legacy_ai_discovery.well_known_ai_plugin_json}`,
    "",
    fencedJson(payload.legacy_ai_discovery),
    "",
    "## Activation Surfaces",
    "",
    Object.entries(payload.activation_surfaces)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Install Commands",
    "",
    `Stdio bridge: \`${payload.install_commands.stdio_mcp_remote}\``,
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
