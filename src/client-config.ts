export interface McpClientConfigRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

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
] as const;

export function mcpClientConfigPayload(runtime: McpClientConfigRuntime) {
  return {
    release: "PACKRIFT-MCP-CLIENT-CONFIG-R01",
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
    aliases: {
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      canonical_json: "https://mcp.packrift.com/ai/mcp-client-config.json",
      markdown: "https://mcp.packrift.com/ai/mcp-client-config.md",
    },
    install_commands: {
      claude_code: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
      codex: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      endpoint_only: MCP_ENDPOINT,
    },
    host_notes: [
      "For Cursor, Windsurf, VS Code, Cline, Roo-style hosts, Claude Desktop, and generic MCP clients, use the config.mcpServers.packrift object.",
      "If a host asks for transport, choose HTTP or Streamable HTTP.",
      "Do not ask buyers for Packrift API keys; the hosted endpoint requires no buyer-side auth.",
      "Use prepare_purchase_handoff for exact SKU prep, then create cart handoffs only after buyer confirmation.",
    ],
    first_tests: FIRST_TESTS,
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
    "## First Tests",
    "",
    payload.first_tests.map((test) => [`### ${test.id}`, "", test.purpose, "", fencedJson(test.request)].join("\n")).join("\n\n"),
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
