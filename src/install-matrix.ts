import { TRACKED_INSTALL_TEMPLATE, trackedInstallUrl } from "./install-action.js";

export interface InstallMatrixRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";

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

const SMOKE_TESTS = [
  {
    id: "tools-list",
    name: "List tools",
    purpose: "Confirm the hosted endpoint is reachable and exposes the current Packrift tool surface.",
    request: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    expected: {
      minimum_tools: 14,
      required_tools: ["search_products", "get_cart_handoff_candidates", "get_pricing", "check_inventory", "create_cart_url"],
    },
  },
  {
    id: "prompts-list",
    name: "List prompts",
    purpose: "Confirm exact-spec, reorder, and cart handoff workflows are visible to the host agent.",
    request: { jsonrpc: "2.0", id: "prompts", method: "prompts/list" },
    expected: {
      minimum_prompts: 9,
      required_prompts: ["find_exact_packaging_spec", "reorder_packrift_sku", "prepare_cart_handoff"],
    },
  },
  {
    id: "candidate-1066",
    name: "Fetch one ready cart handoff candidate",
    purpose: "Start with a known AI-approved SKU and inspect the required live-confirmation sequence before any cart action.",
    request: {
      jsonrpc: "2.0",
      id: "candidate-1066",
      method: "tools/call",
      params: {
        name: "get_cart_handoff_candidates",
        arguments: { sku: "1066", limit: 1 },
      },
    },
    expected: {
      selected_sku: "1066",
      next_required_calls: ["get_product", "get_pricing", "check_inventory", "create_cart_url"],
    },
  },
  {
    id: "price-1066",
    name: "Confirm live price",
    purpose: "Verify a host can call live commercial checks before presenting a buyer-facing recommendation.",
    request: {
      jsonrpc: "2.0",
      id: "price-1066",
      method: "tools/call",
      params: {
        name: "get_pricing",
        arguments: { variant_ids: ["53472879935856"], quantity: 1 },
      },
    },
    expected: {
      live_price_required: true,
      variant_id: "53472879935856",
    },
  },
  {
    id: "inventory-1066",
    name: "Confirm live inventory",
    purpose: "Verify a host can prevent cart handoff when an exact SKU is unavailable.",
    request: {
      jsonrpc: "2.0",
      id: "inventory-1066",
      method: "tools/call",
      params: {
        name: "check_inventory",
        arguments: { variant_ids: ["53472879935856"] },
      },
    },
    expected: {
      live_inventory_required: true,
      variant_id: "53472879935856",
    },
  },
] as const;

const HOSTS = [
  {
    id: "generic_streamable_http",
    name: "Generic Streamable HTTP MCP client",
    audience: "Any MCP-capable host that accepts a remote HTTP endpoint.",
    status: "ready",
    preferred: true,
    install: remoteMcpJson(),
    first_test_ids: ["tools-list", "prompts-list", "candidate-1066"],
    notes: ["Use this when the host can read MCP JSON config.", "No buyer-side Packrift API key is required for the hosted endpoint."],
  },
  {
    id: "claude_code",
    name: "Claude Code",
    audience: "Developers adding Packrift to Claude Code as a remote MCP server.",
    status: "ready",
    preferred: true,
    install: {
      command: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
    },
    first_test_ids: ["tools-list", "candidate-1066", "price-1066", "inventory-1066"],
    notes: ["Use the remote endpoint, not a local Packrift CLI.", "Restart the host if MCP server changes are not visible immediately."],
  },
  {
    id: "codex",
    name: "Codex",
    audience: "Codex workspaces that should use Packrift as a remote MCP endpoint.",
    status: "ready",
    preferred: true,
    install: {
      command: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      config: remoteMcpJson(),
    },
    first_test_ids: ["tools-list", "prompts-list", "candidate-1066"],
    notes: ["Keep this as a thin remote endpoint install path.", "Do not fork a separate Packrift CLI surface."],
  },
  {
    id: "claude_desktop",
    name: "Claude Desktop",
    audience: "Claude Desktop users editing MCP server config.",
    status: "ready",
    preferred: true,
    install: remoteMcpJson(),
    first_test_ids: ["tools-list", "candidate-1066"],
    notes: ["Add the JSON under the host's MCP server configuration.", "Restart Claude Desktop after editing config."],
  },
  {
    id: "cursor_windsurf_vscode",
    name: "Cursor, Windsurf, VS Code, Cline, and Roo-style MCP hosts",
    audience: "IDE agents that accept MCP JSON config or remote server URLs.",
    status: "ready",
    preferred: true,
    install: remoteMcpJson(),
    first_test_ids: ["tools-list", "prompts-list", "candidate-1066"],
    notes: ["Use only the hosted HTTP endpoint unless doing local Packrift MCP development.", "If the IDE asks for transport, choose HTTP or Streamable HTTP."],
  },
  {
    id: "glama_connector",
    name: "Glama hosted connector",
    audience: "Users who prefer installing from a connector directory instead of hand-editing config.",
    status: "live",
    preferred: true,
    install: {
      url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    },
    first_test_ids: ["tools-list", "candidate-1066"],
    notes: ["The Glama hosted connector should show the current 15-tool remote endpoint.", "The stale Glama source listing is a separate directory refresh issue."],
  },
  {
    id: "mcp_marketplace",
    name: "MCP Marketplace",
    audience: "Users browsing marketplace-style MCP directories.",
    status: "live",
    preferred: true,
    install: {
      url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
      command: `claude mcp add --transport http io-github-packrift-packrift-mcp ${MCP_ENDPOINT}`,
    },
    first_test_ids: ["tools-list", "candidate-1066"],
    notes: ["Use marketplace discovery for install; the canonical runtime endpoint remains Packrift MCP."],
  },
  {
    id: "browserbase_browse_browser_agents",
    name: "Browserbase Browse and browser agents",
    audience: "Browser agents that can read public URLs but may not install MCP directly.",
    status: "bridge",
    preferred: false,
    install: {
      skill_md: "https://mcp.packrift.com/SKILL.md",
      start_url: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      canonical_skill_md: "https://mcp.packrift.com/ai/browserbase-browse/SKILL.md",
      confirmation_endpoint: MCP_ENDPOINT,
    },
    first_test_ids: ["candidate-1066", "price-1066", "inventory-1066"],
    notes: [
      "Browser reading is discovery only.",
      "Live price, inventory, shipping, exact product detail, and cart handoff must be confirmed through MCP.",
    ],
  },
  {
    id: "docker_optional",
    name: "Optional self-hosted container",
    audience: "Directories or local environments that require a package-style install surface.",
    status: "optional",
    preferred: false,
    install: {
      command: "docker pull ghcr.io/packrift/packrift-mcp:latest",
    },
    first_test_ids: ["tools-list"],
    notes: [
      "Prefer the hosted endpoint for buyers and agent platforms.",
      "Self-hosting live Shopify-backed tools requires Packrift-owned Shopify credentials.",
    ],
  },
] as const;

export function mcpInstallMatrixPayload(runtime: InstallMatrixRuntime) {
  return {
    release: "PACKRIFT-MCP-INSTALL-MATRIX-R02",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Give agent hosts, developers, directories, and AI-commerce workflows copy-ready Packrift MCP install paths and smoke tests without creating a duplicate Packrift CLI or buyer surface.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    install_principles: [
      "Use https://mcp.packrift.com/mcp as the canonical runtime endpoint.",
      "Prefer remote MCP install paths over local self-hosting.",
      "Do not ask buyers for Packrift API keys.",
      "Use browser agents only as read-first discovery bridges; confirm live commerce facts through MCP.",
      "Use /r/config/{source} when sharing copy-ready MCP JSON config from a directory, partner, campaign, or agent handoff so the fetch is measurable.",
      "Use /r/install/{source}/{target} when a directory, partner, or agent handoff needs a target-specific install command or config and install-intent attribution.",
      "Use prepare_purchase_handoff for known exact SKUs when the host needs one compact live-confirmation and guarded cart-handoff tool call.",
      "Confirm exact SKU, live price, and live inventory before cart handoff.",
      "Route no-exact-match cases to quote recovery instead of forcing nearby substitutes.",
    ],
    tracked_install_template: TRACKED_INSTALL_TEMPLATE,
    tracked_install_examples: {
      generic_streamable_http: trackedInstallUrl("generic", "generic_streamable_http"),
      claude_code: trackedInstallUrl("generic", "claude_code"),
      codex: trackedInstallUrl("generic", "codex"),
      cursor_windsurf_vscode: trackedInstallUrl("generic", "cursor_windsurf_vscode"),
    },
    hosts: HOSTS,
    smoke_tests: SMOKE_TESTS,
    conversion_path: [
      "Install or connect the hosted Packrift MCP endpoint.",
      "Run tools/list and prompts/list.",
      "For a known exact SKU, call prepare_purchase_handoff with buyer_confirmed=false first; call again with buyer_confirmed=true only after the buyer confirms SKU and quantity.",
      "Call get_cart_handoff_candidates for a known SKU or search_products for the buyer request.",
      "Call get_product, get_pricing, and check_inventory for the exact selected SKU.",
      "Call create_cart_url only after buyer confirmation.",
      "Use the returned MCP cart landing URL so ref=mcp and mcp_tool attribution stay measurable.",
    ],
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      mcp_start: "https://mcp.packrift.com/ai/mcp-start.json",
      manifest: "https://mcp.packrift.com/manifest",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      tracked_install_template: TRACKED_INSTALL_TEMPLATE,
      client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      tracked_config_template: TRACKED_CONFIG_TEMPLATE,
      tracked_config_generic: "https://mcp.packrift.com/r/config/generic",
      root_mcp_json: "https://mcp.packrift.com/mcp.json",
      well_known_mcp_json: "https://mcp.packrift.com/.well-known/mcp.json",
      browser_agent_bridge: "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      measured_handoffs: "https://mcp.packrift.com/ai/measured-handoffs.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
      agent_capture_outreach: "https://mcp.packrift.com/ai/agent-capture-outreach.json",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpInstallMatrixMarkdown(runtime: InstallMatrixRuntime): string {
  const payload = mcpInstallMatrixPayload(runtime);
  const hostRows = payload.hosts
    .map(
      (host) =>
        `| ${escapeMarkdown(host.name)} | ${host.status} | ${host.preferred ? "yes" : "no"} | ${escapeMarkdown(host.audience)} | ${host.first_test_ids.map((id) => `\`${id}\``).join(", ")} |`
    )
    .join("\n");
  const smokeRows = payload.smoke_tests
    .map((test) => `| ${test.id} | ${escapeMarkdown(test.name)} | ${escapeMarkdown(test.purpose)} |`)
    .join("\n");
  return [
    "# Packrift MCP Install Matrix",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Install Principles",
    "",
    payload.install_principles.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Copy-Ready Generic Config",
    "",
    fencedJson(remoteMcpJson()),
    "",
    "## Tracked Install Actions",
    "",
    `Template: \`${payload.tracked_install_template}\``,
    "",
    Object.entries(payload.tracked_install_examples)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Host Matrix",
    "",
    "| Host | Status | Preferred | Audience | First tests |",
    "| --- | --- | --- | --- | --- |",
    hostRows,
    "",
    "## Smoke Tests",
    "",
    "| ID | Test | Purpose |",
    "| --- | --- | --- |",
    smokeRows,
    "",
    "## Smoke Test Requests",
    "",
    payload.smoke_tests.map((test) => [`### ${test.id}`, "", fencedJson(test.request)].join("\n")).join("\n\n"),
    "",
    "## Conversion Path",
    "",
    payload.conversion_path.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-install-matrix.json",
    "",
  ].join("\n");
}
