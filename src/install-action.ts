export interface McpInstallActionRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

export const MCP_INSTALL_ACTION_RELEASE = "PACKRIFT-MCP-INSTALL-ACTION-R03";
export const MCP_INSTALL_ACTIONS_RELEASE = "PACKRIFT-MCP-INSTALL-ACTIONS-R03";
export const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";
export const MCP_SOURCE_QUERY_PARAM = "packrift_mcp_source";
export const MCP_TARGET_QUERY_PARAM = "packrift_mcp_target";
export const TRACKED_INSTALL_TEMPLATE = "https://mcp.packrift.com/r/install/{source}/{target}";
export const TRACKED_CONFIG_TEMPLATE = "https://mcp.packrift.com/r/config/{source}";

type InstallTarget = {
  id: string;
  aliases: readonly string[];
  label: string;
  audience: string;
  format: "json" | "command" | "url";
  copyText: string;
  install: Record<string, unknown>;
  firstTests: readonly string[];
  notes: readonly string[];
};

function normalizeRuntimeSlug(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug.length >= 2 ? slug : fallback;
}

export function sourceAwareMcpEndpoint(source: string, target = "runtime"): string {
  const url = new URL(MCP_ENDPOINT);
  url.searchParams.set(MCP_SOURCE_QUERY_PARAM, normalizeRuntimeSlug(source, "generic"));
  url.searchParams.set(MCP_TARGET_QUERY_PARAM, normalizeRuntimeSlug(target, "runtime"));
  return url.toString();
}

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

export const INSTALL_TARGETS: readonly InstallTarget[] = [
  {
    id: "generic_streamable_http",
    aliases: ["generic", "json", "config", "remote_mcp_json"],
    label: "Generic Streamable HTTP MCP config",
    audience: "Any MCP-capable host that accepts remote HTTP config.",
    format: "json",
    copyText: JSON.stringify(remoteMcpJson(), null, 2),
    install: remoteMcpJson(),
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates"],
    notes: ["Use this when the host can read MCP JSON config.", "No buyer-side Packrift API key is required."],
  },
  {
    id: "claude_code",
    aliases: ["claude", "claude-code"],
    label: "Claude Code command",
    audience: "Developers adding Packrift to Claude Code as a remote MCP server.",
    format: "command",
    copyText: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
    install: {
      command: `claude mcp add --transport http packrift ${MCP_ENDPOINT}`,
    },
    firstTests: ["tools/list", "get_cart_handoff_candidates", "get_pricing", "check_inventory"],
    notes: ["Use the hosted remote endpoint, not a local Packrift CLI.", "Restart Claude Code if MCP server changes are not visible immediately."],
  },
  {
    id: "codex",
    aliases: ["openai_codex", "codex_cli"],
    label: "Codex command",
    audience: "Codex workspaces that should use Packrift as a remote MCP endpoint.",
    format: "command",
    copyText: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
    install: {
      command: `codex mcp add packrift --url ${MCP_ENDPOINT}`,
      config: remoteMcpJson(),
    },
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates"],
    notes: ["Keep this as a thin remote endpoint install path.", "Do not fork a separate Packrift CLI surface."],
  },
  {
    id: "claude_desktop",
    aliases: ["claude-desktop", "desktop"],
    label: "Claude Desktop config",
    audience: "Claude Desktop users editing MCP server config.",
    format: "json",
    copyText: JSON.stringify(remoteMcpJson(), null, 2),
    install: remoteMcpJson(),
    firstTests: ["tools/list", "get_cart_handoff_candidates"],
    notes: ["Add the JSON under the host MCP server configuration.", "Restart Claude Desktop after editing config."],
  },
  {
    id: "cursor_windsurf_vscode",
    aliases: ["cursor", "windsurf", "vscode", "cline", "roo", "ide"],
    label: "IDE MCP config",
    audience: "Cursor, Windsurf, VS Code, Cline, Roo, and other IDE agent hosts.",
    format: "json",
    copyText: JSON.stringify(remoteMcpJson(), null, 2),
    install: remoteMcpJson(),
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates"],
    notes: ["If the IDE asks for transport, choose HTTP or Streamable HTTP.", "Confirm live price and inventory through MCP before cart handoff."],
  },
  {
    id: "glama_connector",
    aliases: ["glama"],
    label: "Glama hosted connector",
    audience: "Users who prefer installing from a hosted MCP connector directory.",
    format: "url",
    copyText: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    install: {
      url: "https://glama.ai/mcp/connectors/io.github.Packrift/packrift-mcp",
    },
    firstTests: ["tools/list", "get_cart_handoff_candidates"],
    notes: ["Use the hosted Glama connector if the directory install UX is preferred.", "The canonical runtime endpoint remains Packrift MCP."],
  },
  {
    id: "mcp_marketplace",
    aliases: ["marketplace", "mcp-marketplace"],
    label: "MCP Marketplace command",
    audience: "Users browsing marketplace-style MCP directories.",
    format: "command",
    copyText: `claude mcp add --transport http io-github-packrift-packrift-mcp ${MCP_ENDPOINT}`,
    install: {
      url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
      command: `claude mcp add --transport http io-github-packrift-packrift-mcp ${MCP_ENDPOINT}`,
    },
    firstTests: ["tools/list", "get_cart_handoff_candidates"],
    notes: ["Marketplace discovery can vary by host.", "The canonical runtime endpoint remains Packrift MCP."],
  },
];

function normalizeTargetKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

const TARGET_BY_ALIAS = new Map<string, InstallTarget>(
  INSTALL_TARGETS.flatMap((target) => [
    [normalizeTargetKey(target.id), target] as const,
    ...target.aliases.map((alias) => [normalizeTargetKey(alias), target] as const),
  ])
);

export function normalizeInstallTarget(rawTarget: string): InstallTarget | null {
  return TARGET_BY_ALIAS.get(normalizeTargetKey(rawTarget)) ?? null;
}

export function trackedInstallUrl(source: string, target: string): string {
  const url = new URL(`https://mcp.packrift.com/r/install/${source}/${target}`);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "install_action");
  url.searchParams.set("utm_campaign", "packrift_mcp_install");
  url.searchParams.set("utm_content", target);
  return url.toString();
}

export function trackedConfigUrl(source: string): string {
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

const FIRST_USEFUL_RUN_SKU = {
  sku: "1066",
  variantId: "53472879935856",
  handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
} as const;

export function mcpFirstUsefulRun(source = "generic", target = "generic_streamable_http") {
  const sourceSlug = normalizeRuntimeSlug(source, "generic");
  const targetSlug = normalizeRuntimeSlug(target, "runtime");
  const sourceContext = `${sourceSlug}_first_cart_run`.slice(0, 80);
  const journeyId = `mcp_install_${sourceSlug}_${FIRST_USEFUL_RUN_SKU.sku}_${FIRST_USEFUL_RUN_SKU.variantId}`;
  const resultSetId = `mcp_install_first_run_${sourceSlug}`.slice(0, 120);
  return {
    purpose:
      "After installing Packrift MCP, run this exact source-aware workflow to prove the endpoint can progress from install to live SKU checks and a measured MCP cart handoff.",
    endpoint: sourceAwareMcpEndpoint(sourceSlug, targetSlug),
    buyer_prompt:
      "Reorder Packrift SKU 1066. Confirm the exact product, live price, and inventory, then prepare a measured cart handoff for quantity 1.",
    run_rule:
      "Use the source-aware endpoint above. The final create_cart_url call only creates a cart URL string; it does not place an order.",
    sequence: [
      { jsonrpc: "2.0", id: "tools", method: "tools/list" },
      toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: FIRST_USEFUL_RUN_SKU.sku, limit: 1 }),
      toolCall("price-1066", "get_pricing", {
        variant_ids: [FIRST_USEFUL_RUN_SKU.variantId],
        quantity: 1,
        selected_sku: FIRST_USEFUL_RUN_SKU.sku,
        selected_handle: FIRST_USEFUL_RUN_SKU.handle,
        match_type: "install_first_useful_run",
      }),
      toolCall("inventory-1066", "check_inventory", {
        variant_ids: [FIRST_USEFUL_RUN_SKU.variantId],
        selected_sku: FIRST_USEFUL_RUN_SKU.sku,
        selected_handle: FIRST_USEFUL_RUN_SKU.handle,
        match_type: "install_first_useful_run",
      }),
      toolCall("cart-1066", "create_cart_url", {
        sku: FIRST_USEFUL_RUN_SKU.sku,
        quantity: 1,
        selected_sku: FIRST_USEFUL_RUN_SKU.sku,
        selected_handle: FIRST_USEFUL_RUN_SKU.handle,
        match_type: "install_first_useful_run",
        source_context: sourceContext,
        journey_id: journeyId,
        result_set_id: resultSetId,
        utm_term: FIRST_USEFUL_RUN_SKU.sku,
      }),
    ],
    success_signals: [
      "tools/list returns the current Packrift tool surface",
      "get_cart_handoff_candidates returns SKU 1066",
      "get_pricing returns a live unit price and currency",
      "check_inventory returns in_stock before cart handoff",
      "create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066",
      "usage snapshot records a source-attributed create_cart_url tool call when the workflow is run from a tracked install",
    ],
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function sourceAwareInstallForTarget(target: InstallTarget, source: string) {
  const endpoint = sourceAwareMcpEndpoint(source, target.id);
  const config = remoteMcpJson("packrift", endpoint);
  const quotedEndpoint = shellQuote(endpoint);
  switch (target.id) {
    case "generic_streamable_http":
    case "claude_desktop":
    case "cursor_windsurf_vscode":
      return {
        endpoint,
        config,
        copyText: JSON.stringify(config, null, 2),
        install: config,
      };
    case "claude_code": {
      const command = `claude mcp add --transport http packrift ${quotedEndpoint}`;
      return {
        endpoint,
        config,
        copyText: command,
        install: { command },
      };
    }
    case "codex": {
      const command = `codex mcp add packrift --url ${quotedEndpoint}`;
      return {
        endpoint,
        config,
        copyText: command,
        install: { command, config },
      };
    }
    case "mcp_marketplace": {
      const command = `claude mcp add --transport http io-github-packrift-packrift-mcp ${quotedEndpoint}`;
      return {
        endpoint,
        config,
        copyText: command,
        install: {
          url: "https://mcp-marketplace.io/server/io-github-packrift-packrift-mcp",
          command,
          config,
        },
      };
    }
    case "glama_connector":
      return {
        endpoint,
        config,
        copyText: target.copyText,
        install: {
          ...(target.install as Record<string, unknown>),
          source_aware_endpoint: endpoint,
          source_aware_config: config,
        },
      };
    default:
      return {
        endpoint,
        config,
        copyText: target.copyText,
        install: target.install,
      };
  }
}

export function mcpInstallActionPayload(input: { source: string; target: string }) {
  const target = normalizeInstallTarget(input.target);
  if (!target) return null;
  const sourceAware = sourceAwareInstallForTarget(target, input.source);
  return {
    release: MCP_INSTALL_ACTION_RELEASE,
    generated_at: new Date().toISOString(),
    source: input.source,
    target: {
      id: target.id,
      label: target.label,
      audience: target.audience,
      format: target.format,
    },
    canonical_endpoint: MCP_ENDPOINT,
    source_aware_endpoint: sourceAware.endpoint,
    source_aware_config: sourceAware.config,
    tracked_install_url: trackedInstallUrl(input.source, target.id),
    tracked_config_url: trackedConfigUrl(input.source),
    copy_text: sourceAware.copyText,
    install: sourceAware.install,
    first_tests: target.firstTests,
    first_useful_run: mcpFirstUsefulRun(input.source, target.id),
    notes: target.notes,
    proof_urls: {
      health: "https://mcp.packrift.com/health",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      start: `https://mcp.packrift.com/start?utm_source=${input.source}`,
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    },
    operating_rule:
      "This is a thin tracked install handoff for the existing hosted Packrift MCP endpoint. Do not treat it as a separate Packrift CLI or buyer surface.",
  };
}

export function mcpInstallActionsPayload(runtime: McpInstallActionRuntime, source = "generic") {
  return {
    release: MCP_INSTALL_ACTIONS_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Source-aware tracked install-action URLs for Packrift MCP. These give directories, agent hosts, and developers one URL per client target while keeping all runtime use on the hosted endpoint.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_install_template: TRACKED_INSTALL_TEMPLATE,
    tracked_config_template: TRACKED_CONFIG_TEMPLATE,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    targets: INSTALL_TARGETS.map((target) => ({
      id: target.id,
      label: target.label,
      audience: target.audience,
      format: target.format,
      tracked_install_url: trackedInstallUrl(source, target.id),
      source_aware_endpoint: sourceAwareMcpEndpoint(source, target.id),
      aliases: target.aliases,
      first_tests: target.firstTests,
      first_useful_run_endpoint: sourceAwareMcpEndpoint(source, target.id),
    })),
    first_useful_run: mcpFirstUsefulRun(source, "generic_streamable_http"),
    recommended_directory_targets: ["generic_streamable_http", "claude_code", "codex", "cursor_windsurf_vscode"],
    proof_urls: {
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

export function mcpInstallActionMarkdown(payload: NonNullable<ReturnType<typeof mcpInstallActionPayload>>): string {
  return [
    "# Packrift MCP Install Action",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Source: ${payload.source}`,
    `Target: ${payload.target.id}`,
    `Endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.operating_rule,
    "",
    "## Copy Text",
    "",
    payload.target.format === "json" ? fencedJson(payload.install) : `\`${payload.copy_text}\``,
    "",
    "## First Tests",
    "",
    payload.first_tests.map((test) => `- ${test}`).join("\n"),
    "",
    "## First Useful Run",
    "",
    `Endpoint: \`${payload.first_useful_run.endpoint}\``,
    "",
    payload.first_useful_run.buyer_prompt,
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "Success signals:",
    "",
    payload.first_useful_run.success_signals.map((signal) => `- ${signal}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
  ].join("\n");
}

export function mcpInstallActionsMarkdown(runtime: McpInstallActionRuntime): string {
  const payload = mcpInstallActionsPayload(runtime);
  const rows = payload.targets
    .map((target) => `| ${target.id} | ${target.format} | ${target.tracked_install_url} |`)
    .join("\n");
  return [
    "# Packrift MCP Install Actions",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    `Tracked install template: \`${payload.tracked_install_template}\``,
    `Tracked config template: \`${payload.tracked_config_template}\``,
    "",
    "## First Useful Run",
    "",
    `Endpoint: \`${payload.first_useful_run.endpoint}\``,
    "",
    payload.first_useful_run.buyer_prompt,
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "| Target | Format | Generic tracked install URL |",
    "| --- | --- | --- |",
    rows,
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
  ].join("\n");
}
