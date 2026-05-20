import { packriftMcpGa4HeadScript } from "./mcp-page-analytics.js";

export interface McpInstallActionRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

export const MCP_INSTALL_ACTION_RELEASE = "PACKRIFT-MCP-INSTALL-ACTION-R12";
export const MCP_INSTALL_ACTIONS_RELEASE = "PACKRIFT-MCP-INSTALL-ACTIONS-R11";
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

export function stdioMcpRemoteJson(name = "packrift", endpoint = MCP_ENDPOINT) {
  return {
    mcpServers: {
      [name]: {
        command: "npx",
        args: ["-y", "mcp-remote", endpoint],
      },
    },
  };
}

export function clineMcpJson(name = "packrift", endpoint = MCP_ENDPOINT) {
  return {
    mcpServers: {
      [name]: {
        type: "streamableHttp",
        url: endpoint,
        disabled: false,
        timeout: 60,
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
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
    notes: ["Use this when the host can read MCP JSON config.", "No buyer-side Packrift API key is required."],
  },
  {
    id: "stdio_mcp_remote",
    aliases: ["stdio", "stdio_bridge", "mcp_remote", "mcp-remote", "legacy_stdio", "desktop_stdio", "local_stdio_bridge"],
    label: "Stdio MCP bridge with mcp-remote",
    audience: "MCP hosts that only accept a local stdio command and cannot connect to remote HTTP directly.",
    format: "json",
    copyText: JSON.stringify(stdioMcpRemoteJson(), null, 2),
    install: stdioMcpRemoteJson(),
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates", "get_pricing", "check_inventory", 'create_cart_url({ sku:"1066", quantity:1 })'],
    notes: [
      "Use this only when the host cannot accept remote HTTP or Streamable HTTP directly.",
      "The bridge runs npx mcp-remote and forwards calls to the hosted Packrift MCP endpoint.",
      "This is a compatibility bridge, not a Packrift CLI or local buyer surface.",
    ],
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
    firstTests: ["tools/list", "get_cart_handoff_candidates", "get_pricing", "check_inventory", 'create_cart_url({ sku:"1066", quantity:1 })'],
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
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
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
    firstTests: ["tools/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
    notes: ["Add the JSON under the host MCP server configuration.", "Restart Claude Desktop after editing config."],
  },
  {
    id: "cursor_windsurf_vscode",
    aliases: ["cursor", "windsurf", "vscode", "roo", "ide"],
    label: "IDE MCP config",
    audience: "Cursor, Windsurf, VS Code, Roo, and other IDE agent hosts.",
    format: "json",
    copyText: JSON.stringify(remoteMcpJson(), null, 2),
    install: remoteMcpJson(),
    firstTests: ["tools/list", "prompts/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
    notes: ["If the IDE asks for transport, choose HTTP or Streamable HTTP.", "Confirm live price and inventory through MCP before cart handoff."],
  },
  {
    id: "cline",
    aliases: ["cline_mcp", "cline_marketplace", "cline_mcp_marketplace"],
    label: "Cline MCP config",
    audience: "Cline users and Cline MCP Marketplace reviewers who need a copy-ready remote MCP config.",
    format: "json",
    copyText: JSON.stringify(clineMcpJson(), null, 2),
    install: clineMcpJson(),
    firstTests: ["tools/list", "get_cart_handoff_candidates", "get_pricing", "check_inventory", 'create_cart_url({ sku:"1066", quantity:1 })'],
    notes: [
      "Use this Cline-specific target for the Cline MCP Marketplace activation row.",
      "Cline remote server config uses streamableHttp plus the hosted Packrift MCP URL.",
      "This remains a thin remote MCP config for the hosted endpoint, not a separate Packrift CLI.",
    ],
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
    firstTests: ["tools/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
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
    firstTests: ["tools/list", "get_cart_handoff_candidates", 'create_cart_url({ sku:"1066", quantity:1 })'],
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

function trackedRunUrlForInstall(source: string, target = "generic_streamable_http"): string {
  const sourceSlug = normalizeRuntimeSlug(source, "generic");
  const targetSlug = normalizeRuntimeSlug(target, "generic_streamable_http");
  const url = new URL(`https://mcp.packrift.com/r/run/${sourceSlug}/${targetSlug}`);
  url.searchParams.set("utm_source", sourceSlug);
  url.searchParams.set("utm_medium", "first_run_action");
  url.searchParams.set("utm_campaign", "packrift_mcp_activation");
  url.searchParams.set("utm_content", targetSlug);
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

function firstUsefulRunAgentPrompt(input: {
  endpoint: string;
  sourceSlug: string;
  targetSlug: string;
  sourceContext: string;
  journeyId: string;
  resultSetId: string;
}) {
  return [
    "Use Packrift MCP for this workflow; do not browse the storefront first and do not create a separate Packrift CLI.",
    `MCP endpoint/config source: ${input.endpoint}`,
    "",
    `Task: reorder Packrift SKU ${FIRST_USEFUL_RUN_SKU.sku} for quantity 1.`,
    "",
    "Required tool sequence:",
    "1. Run tools/list and confirm Packrift MCP is connected.",
    `2. Call get_cart_handoff_candidates with sku="${FIRST_USEFUL_RUN_SKU.sku}", limit=1, source_context="${input.sourceContext}", journey_id="${input.journeyId}", and result_set_id="${input.resultSetId}".`,
    `3. Call get_pricing with variant_ids=["${FIRST_USEFUL_RUN_SKU.variantId}"], quantity=1, selected_sku="${FIRST_USEFUL_RUN_SKU.sku}", selected_handle="${FIRST_USEFUL_RUN_SKU.handle}", match_type="agent_prompt_first_run", source_context="${input.sourceContext}", journey_id="${input.journeyId}", and result_set_id="${input.resultSetId}".`,
    `4. Call check_inventory with variant_ids=["${FIRST_USEFUL_RUN_SKU.variantId}"], selected_sku="${FIRST_USEFUL_RUN_SKU.sku}", selected_handle="${FIRST_USEFUL_RUN_SKU.handle}", match_type="agent_prompt_first_run", source_context="${input.sourceContext}", journey_id="${input.journeyId}", and result_set_id="${input.resultSetId}".`,
    `5. If the live checks pass, call create_cart_url with sku="${FIRST_USEFUL_RUN_SKU.sku}", quantity=1, selected_sku="${FIRST_USEFUL_RUN_SKU.sku}", selected_handle="${FIRST_USEFUL_RUN_SKU.handle}", match_type="agent_prompt_first_run", source_context="${input.sourceContext}", mcp_source_context="${input.sourceSlug}", mcp_install_target="${input.targetSlug}", journey_id="${input.journeyId}", result_set_id="${input.resultSetId}", and utm_term="${FIRST_USEFUL_RUN_SKU.sku}".`,
    "",
    "Return the product title, live unit price and currency, inventory status, and the measured cart URL.",
    `Success requires a cart URL starting with https://mcp.packrift.com/r/cart/${FIRST_USEFUL_RUN_SKU.sku}.`,
    "Do not place an order. If any live check fails, stop and say exactly which check failed.",
    "",
    `Attribution: source=${input.sourceSlug}; target=${input.targetSlug}.`,
  ].join("\n");
}

export function mcpFirstUsefulRun(source = "generic", target = "generic_streamable_http") {
  const sourceSlug = normalizeRuntimeSlug(source, "generic");
  const targetSlug = normalizeRuntimeSlug(target, "runtime");
  const endpoint = sourceAwareMcpEndpoint(sourceSlug, targetSlug);
  const sourceContext = `${sourceSlug}_first_cart_run`.slice(0, 80);
  const journeyId = `mcp_install_${sourceSlug}_${FIRST_USEFUL_RUN_SKU.sku}_${FIRST_USEFUL_RUN_SKU.variantId}`;
  const resultSetId = `mcp_install_first_run_${sourceSlug}`.slice(0, 120);
  const attributionArgs = {
    source_context: sourceContext,
    journey_id: journeyId,
    result_set_id: resultSetId,
  };
  const cartAttributionArgs = {
    ...attributionArgs,
    mcp_source_context: sourceSlug,
    mcp_install_target: targetSlug,
  };
  const sequence = [
    { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: FIRST_USEFUL_RUN_SKU.sku, limit: 1, ...attributionArgs }),
    toolCall("price-1066", "get_pricing", {
      variant_ids: [FIRST_USEFUL_RUN_SKU.variantId],
      quantity: 1,
      selected_sku: FIRST_USEFUL_RUN_SKU.sku,
      selected_handle: FIRST_USEFUL_RUN_SKU.handle,
      match_type: "install_first_useful_run",
      ...attributionArgs,
    }),
    toolCall("inventory-1066", "check_inventory", {
      variant_ids: [FIRST_USEFUL_RUN_SKU.variantId],
      selected_sku: FIRST_USEFUL_RUN_SKU.sku,
      selected_handle: FIRST_USEFUL_RUN_SKU.handle,
      match_type: "install_first_useful_run",
      ...attributionArgs,
    }),
    toolCall("cart-1066", "create_cart_url", {
      sku: FIRST_USEFUL_RUN_SKU.sku,
      quantity: 1,
      selected_sku: FIRST_USEFUL_RUN_SKU.sku,
      selected_handle: FIRST_USEFUL_RUN_SKU.handle,
      match_type: "install_first_useful_run",
      ...cartAttributionArgs,
      utm_term: FIRST_USEFUL_RUN_SKU.sku,
    }),
  ];
  const agentPrompt = firstUsefulRunAgentPrompt({
    endpoint,
    sourceSlug,
    targetSlug,
    sourceContext,
    journeyId,
    resultSetId,
  });
  return {
    purpose:
      "After installing Packrift MCP, run this exact source-aware workflow to prove the endpoint can progress from install to live SKU checks and a measured MCP cart handoff.",
    endpoint,
    buyer_prompt:
      "Reorder Packrift SKU 1066. Confirm the exact product, live price, and inventory, then prepare a measured cart handoff for quantity 1.",
    agent_prompt: agentPrompt,
    run_rule:
      "Use the source-aware endpoint above. The final create_cart_url call only creates a cart URL string; shell runners fetch the returned /r/cart landing once to record the handoff, but do not place an order.",
    sequence,
    curl_commands: sequence.map((request) => mcpCurlCommand(endpoint, request)),
    curl_script: mcpCurlScript(endpoint, sequence),
    success_signals: [
      "tools/list returns the current Packrift tool surface",
      "get_cart_handoff_candidates returns SKU 1066",
      "get_pricing returns a live unit price and currency",
      "check_inventory returns in_stock before cart handoff",
      "create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066",
      "curl shell runners open the returned /r/cart URL once to record mcp_cart_landing without following Shopify checkout",
      "Every tool call carries source_context, journey_id, and result_set_id; create_cart_url also carries mcp_source_context and mcp_install_target so cart attribution survives MCP hosts that strip endpoint query parameters",
      "usage snapshot records a source-attributed create_cart_url tool call when the workflow is run from a tracked install",
    ],
    agent_prompt_success_criteria: [
      "The agent calls the Packrift MCP tools instead of only reading the prompt.",
      "The agent confirms live price and inventory before calling create_cart_url.",
      "The final response includes a measured https://mcp.packrift.com/r/cart/1066 URL and says no order was placed.",
    ],
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function trackedRunShellUrlForInstall(source: string, target: string): string {
  return `${trackedRunUrlForInstall(source, target)}&format=sh`;
}

function trackedRunShellOneLinerForInstall(source: string, target: string): string {
  return `curl -sS ${shellQuote(trackedRunShellUrlForInstall(source, target))} | bash`;
}

function mcpCurlCommand(endpoint: string, request: Record<string, unknown>): string {
  return [
    `curl -sS ${shellQuote(endpoint)} \\`,
    "  -H 'content-type: application/json' \\",
    "  -H 'accept: application/json, text/event-stream' \\",
    "  -H 'user-agent: MCP-First-Run/1.1 (+https://mcp.packrift.com/start)' \\",
    `  -d ${shellQuote(JSON.stringify(request))}`,
  ].join("\n");
}

function mcpCurlScript(endpoint: string, sequence: readonly Record<string, unknown>[]): string {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    `PACKRIFT_MCP_ENDPOINT=${shellQuote(endpoint)}`,
    "PACKRIFT_MCP_USER_AGENT='MCP-First-Run/1.1 (+https://mcp.packrift.com/start)'",
    'PACKRIFT_MCP_SESSION_ID="${PACKRIFT_MCP_SESSION_ID:-mcp-first-run-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM}"',
    "PACKRIFT_MCP_LAST_RESPONSE=''",
    "",
    "rpc() {",
    '  PACKRIFT_MCP_LAST_RESPONSE="$(curl -sS "$PACKRIFT_MCP_ENDPOINT" \\',
    "    -H 'content-type: application/json' \\",
    "    -H 'accept: application/json, text/event-stream' \\",
    '    -H "Mcp-Session-Id: $PACKRIFT_MCP_SESSION_ID" \\',
    '    -H "user-agent: $PACKRIFT_MCP_USER_AGENT" \\',
    '    -d "$1")"',
    "  normalize_mcp_response",
    "}",
    "",
    "normalize_mcp_response() {",
    '  if printf "%s\\n" "$PACKRIFT_MCP_LAST_RESPONSE" | grep -q "^data:"; then',
    '    printf "%s\\n" "$PACKRIFT_MCP_LAST_RESPONSE" | sed -n "s/^data:[[:space:]]*//p" | tail -n 1',
    "    return",
    "  fi",
    '  printf "%s\\n" "$PACKRIFT_MCP_LAST_RESPONSE"',
    "}",
    "",
    "extract_measured_cart_url() {",
    '  printf "%s\\n" "$PACKRIFT_MCP_LAST_RESPONSE" | grep -Eo \'https://mcp\\.packrift\\.com/r/cart/[^"[:space:]<>\\\\]+\' | tail -n 1 || true',
    "}",
    "",
    "touch_measured_cart_landing() {",
    '  local cart_url="${PACKRIFT_MCP_CART_URL:-$(extract_measured_cart_url)}"',
    '  if [ -z "$cart_url" ]; then',
    '    printf "No measured Packrift MCP /r/cart URL found in the final response.\\n" >&2',
    "    return 1",
    "  fi",
    '  printf "Opening measured Packrift MCP cart landing: %s\\n" "$cart_url"',
    '  curl -sS -o /dev/null "$cart_url" \\',
    '    -H "user-agent: $PACKRIFT_MCP_USER_AGENT"',
    '  printf "Recorded mcp_cart_landing. No order was placed.\\n"',
    "}",
    "",
    ...sequence.map((request) => `rpc ${shellQuote(JSON.stringify(request))}`),
    "touch_measured_cart_landing",
    "",
  ].join("\n");
}

function sourceAwareInstallForTarget(target: InstallTarget, source: string) {
  const endpoint = sourceAwareMcpEndpoint(source, target.id);
  const config =
    target.id === "cline"
      ? clineMcpJson("packrift", endpoint)
      : target.id === "stdio_mcp_remote"
        ? stdioMcpRemoteJson("packrift", endpoint)
        : remoteMcpJson("packrift", endpoint);
  const quotedEndpoint = shellQuote(endpoint);
  switch (target.id) {
    case "generic_streamable_http":
    case "stdio_mcp_remote":
    case "claude_desktop":
    case "cursor_windsurf_vscode":
    case "cline":
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

function hostInstallSteps(target: InstallTarget, source: string, endpoint: string): string[] {
  if (target.id === "stdio_mcp_remote") {
    return [
      "Use this path only when the MCP host cannot install remote HTTP or Streamable HTTP directly.",
      "Add the copied stdio MCP JSON config so the host runs npx -y mcp-remote against the source-aware Packrift endpoint.",
      `Confirm the bridge exposes Packrift tools for source ${source} and forwards calls to ${endpoint}.`,
      "Paste the agent prompt from this page into the host and let the host call the Packrift MCP tools through the bridge.",
      "Count activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ];
  }
  if (target.id === "cline") {
    return [
      "Open Cline's MCP Servers settings or the Cline MCP Marketplace review flow.",
      "Add or edit the Packrift server entry with the copied streamableHttp JSON config.",
      `Confirm the Packrift server is enabled for source ${source} and points to ${endpoint}.`,
      "Paste the agent prompt from this page into Cline and let Cline call the Packrift MCP tools directly.",
      "Count the source as activated only after Cline reaches create_cart_url and returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ];
  }
  if (target.format === "json") {
    return [
      "Open the MCP host's server configuration screen.",
      "Paste the copied Packrift MCP JSON config.",
      `Save or reload the MCP host so Packrift tools are visible from ${endpoint}.`,
      "Run the first useful run prompt from this page through the source-aware endpoint.",
      "Count activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ];
  }
  if (target.format === "command") {
    return [
      "Run the copied command in the target host environment.",
      "Reload the host if Packrift tools are not immediately visible.",
      "Run the first useful run prompt from this page through the source-aware endpoint.",
      "Count activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ];
  }
  return [
    "Open the target install URL.",
    "Install or connect the hosted Packrift MCP endpoint.",
    "Run the first useful run prompt from this page.",
    "Count activation only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
  ];
}

export function mcpInstallActionPayload(input: { source: string; target: string }) {
  const target = normalizeInstallTarget(input.target);
  if (!target) return null;
  const sourceAware = sourceAwareInstallForTarget(target, input.source);
  const firstUsefulRun = mcpFirstUsefulRun(input.source, target.id);
  const installSteps = hostInstallSteps(target, input.source, sourceAware.endpoint);
  const trackedRun = trackedRunUrlForInstall(input.source, target.id);
  const trackedRunHtml = `${trackedRun}&format=html`;
  const trackedRunShell = trackedRunShellUrlForInstall(input.source, target.id);
  const shellOneLiner = trackedRunShellOneLinerForInstall(input.source, target.id);
  const fastestActivationPath = {
    label: "3-minute first useful run",
    purpose:
      "Move a directory reviewer, developer, or agent host from Packrift MCP install to a real source-attributed create_cart_url proof without creating an order.",
    steps: [
      `Copy the ${target.label} install block from this page and add it to the MCP host.`,
      "Reload the MCP host until Packrift tools are visible from the source-aware endpoint.",
      "Run the source-specific agent prompt or shell one-liner from this page.",
      "Confirm get_pricing and check_inventory pass before create_cart_url.",
      "Count the source only after create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL.",
    ],
    primary_action_label: "Run first useful check",
    primary_action_url: trackedRunHtml,
    shell_url: trackedRunShell,
    shell_one_liner: shellOneLiner,
    agent_prompt: firstUsefulRun.agent_prompt,
    required_final_tool: "create_cart_url",
    required_cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
    no_order_created: true,
    browser_proof_rule:
      "Browser proof alone is review evidence. Source activation requires host-side MCP tool telemetry plus the measured /r/cart handoff URL.",
  };
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
    host_install_steps: installSteps,
    activation_acceptance_gate: {
      real_host_required: true,
      browser_proof_is_not_enough: true,
      required_host_target: target.id,
      required_source: input.source,
      required_endpoint: sourceAware.endpoint,
      required_final_tool: "create_cart_url",
      required_cart_url_prefix: "https://mcp.packrift.com/r/cart/1066",
      measurement: "A valid activation produces source-attributed MCP tool-call telemetry from the host plus a measured /r/cart URL. Browser proof alone remains review evidence, not source activation.",
    },
    tracked_install_url: trackedInstallUrl(input.source, target.id),
    tracked_install_html_url: `${trackedInstallUrl(input.source, target.id)}&format=html`,
    tracked_config_url: trackedConfigUrl(input.source),
    tracked_run_url: trackedRun,
    tracked_run_html_url: trackedRunHtml,
    tracked_run_execute_url: `${trackedRun}&execute=1`,
    tracked_run_shell_url: trackedRunShell,
    tracked_reviewer_activation_html_url: `https://mcp.packrift.com/r/activate/${input.source}?format=html`,
    copy_text: sourceAware.copyText,
    copy_ready_agent_prompt: firstUsefulRun.agent_prompt,
    copy_ready_shell_one_liner: shellOneLiner,
    install: sourceAware.install,
    first_tests: target.firstTests,
    fastest_activation_path: fastestActivationPath,
    required_post_install_verification: {
      required: true,
      no_order_created: true,
      endpoint: firstUsefulRun.endpoint,
      run: "After install, run the first_useful_run sequence through this source-aware endpoint. The cart step returns a measured /r/cart URL only; it does not place an order.",
      required_final_tool: "create_cart_url",
      required_sku: FIRST_USEFUL_RUN_SKU.sku,
      success_signal: "create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066",
    },
    first_useful_run: firstUsefulRun,
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
  const firstUsefulRun = mcpFirstUsefulRun(source, "generic_streamable_http");
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
      tracked_install_html_url: `${trackedInstallUrl(source, target.id)}&format=html`,
      source_aware_endpoint: sourceAwareMcpEndpoint(source, target.id),
      host_install_steps: hostInstallSteps(target, source, sourceAwareMcpEndpoint(source, target.id)),
      aliases: target.aliases,
      first_tests: target.firstTests,
      first_useful_run_endpoint: sourceAwareMcpEndpoint(source, target.id),
      tracked_run_html_url: `${trackedRunUrlForInstall(source, target.id)}&format=html`,
      tracked_run_shell_url: trackedRunShellUrlForInstall(source, target.id),
      shell_one_liner: trackedRunShellOneLinerForInstall(source, target.id),
      required_post_install_final_tool: "create_cart_url",
    })),
    required_post_install_verification: {
      required: true,
      no_order_created: true,
      endpoint: firstUsefulRun.endpoint,
      run: "Installers and directory reviewers should run the first_useful_run sequence after adding Packrift MCP. It confirms exact SKU, live price, live inventory, and a measured cart handoff URL.",
      required_final_tool: "create_cart_url",
      required_sku: FIRST_USEFUL_RUN_SKU.sku,
      success_signal: "create_cart_url returns a measured https://mcp.packrift.com/r/cart/1066 URL",
    },
    first_useful_run: firstUsefulRun,
    recommended_directory_targets: ["generic_streamable_http", "stdio_mcp_remote", "claude_code", "codex", "cursor_windsurf_vscode", "cline"],
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

function fencedShell(value: string): string {
  return ["```sh", value, "```"].join("\n");
}

function fencedText(value: string): string {
  return ["```text", value, "```"].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
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
    "## Fastest Activation Path",
    "",
    `${payload.fastest_activation_path.label}: ${payload.fastest_activation_path.purpose}`,
    "",
    payload.fastest_activation_path.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    `Primary action: ${payload.fastest_activation_path.primary_action_url}`,
    "",
    "Shell one-liner:",
    "",
    fencedShell(payload.fastest_activation_path.shell_one_liner),
    "",
    payload.fastest_activation_path.browser_proof_rule,
    "",
    "## Copy Text",
    "",
    payload.target.format === "json" ? fencedJson(payload.install) : `\`${payload.copy_text}\``,
    "",
    "## First Tests",
    "",
    payload.first_tests.map((test) => `- ${test}`).join("\n"),
    "",
    "## Host Install Steps",
    "",
    payload.host_install_steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    "## Required Post-Install Verification",
    "",
    `${payload.required_post_install_verification.run}`,
    "",
    `Required final tool: \`${payload.required_post_install_verification.required_final_tool}\``,
    `Tracked browser run: ${payload.tracked_run_html_url}`,
    `Reviewer activation runner: ${payload.tracked_reviewer_activation_html_url}`,
    "",
    "## First Useful Run",
    "",
    `Endpoint: \`${payload.first_useful_run.endpoint}\``,
    "",
    payload.first_useful_run.buyer_prompt,
    "",
    "Agent prompt:",
    "",
    fencedText(payload.first_useful_run.agent_prompt),
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "Pasteable curl script:",
    "",
    fencedShell(payload.first_useful_run.curl_script),
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

export function mcpInstallActionHtml(payload: NonNullable<ReturnType<typeof mcpInstallActionPayload>>): string {
  const copyBlock = payload.target.format === "json" ? JSON.stringify(payload.install, null, 2) : payload.copy_text;
  const firstRunSequence = JSON.stringify(payload.first_useful_run.sequence, null, 2);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP Install</title>
  ${packriftMcpGa4HeadScript({ pageType: "mcp_install", source: payload.source, target: payload.target.id, utmCampaign: "packrift_mcp_install" })}
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f8f5;color:#17211d}
    main{max-width:980px;margin:0 auto;padding:28px 18px 48px}
    h1{font-size:1.8rem;margin:0 0 8px;letter-spacing:0}
    h2{font-size:1rem;margin:22px 0 8px;letter-spacing:0}
    p{line-height:1.5;color:#5f6f68}
    .bar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
    .button,button{display:inline-flex;align-items:center;border:1px solid #17211d;border-radius:6px;background:#17211d;color:#fff;padding:9px 12px;text-decoration:none;font:inherit;cursor:pointer}
    .secondary{background:#fff;color:#17211d}
    button.copied{background:#0f6b4f;border-color:#0f6b4f}
    .panel{background:#fff;border:1px solid #d7ded8;border-radius:8px;padding:14px;margin:14px 0}
    .pill{display:inline-block;border:1px solid #d7ded8;border-radius:999px;padding:4px 8px;margin:2px 4px 2px 0;font-size:.84rem;background:#fff;color:#5f6f68}
    pre{white-space:pre-wrap;word-break:break-word;background:#101714;color:#e9f2ed;border-radius:8px;padding:12px;overflow:auto}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    @media (max-width:640px){.button,button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>
    <h1>Packrift MCP Install</h1>
    <p>Copy the source-aware install for the existing hosted Packrift MCP endpoint, then run the first useful check to confirm live price, inventory, and measured cart handoff.</p>
    <div>
      <span class="pill">Source: ${escapeHtml(payload.source)}</span>
      <span class="pill">Target: ${escapeHtml(payload.target.label)}</span>
      <span class="pill">No buyer key</span>
      <span class="pill">No order created</span>
    </div>
    <div class="bar">
      <button data-copy-target="${escapeHtml(payload.target.id)}" data-copy="${escapeHtml(copyBlock)}">Copy install</button>
      <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_agent_prompt`)}" data-copy="${escapeHtml(payload.first_useful_run.agent_prompt)}">Copy agent prompt</button>
      <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_shell_one_liner`)}" data-copy="${escapeHtml(payload.fastest_activation_path.shell_one_liner)}">Copy shell one-liner</button>
      <a class="button secondary" href="${escapeHtml(payload.tracked_run_html_url)}">Open first run</a>
      <a class="button secondary" href="${escapeHtml(payload.tracked_reviewer_activation_html_url)}">Run real MCP check</a>
      <a class="button secondary" href="${escapeHtml(payload.tracked_config_url)}">Config JSON</a>
    </div>
    <section class="panel">
      <h2>Fastest Activation Path</h2>
      <p>${escapeHtml(payload.fastest_activation_path.purpose)}</p>
      <ol>
        ${payload.fastest_activation_path.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
      <div class="bar">
        <a class="button" href="${escapeHtml(payload.fastest_activation_path.primary_action_url)}">${escapeHtml(payload.fastest_activation_path.primary_action_label)}</a>
        <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_fast_agent_prompt`)}" data-copy="${escapeHtml(payload.fastest_activation_path.agent_prompt)}">Copy agent prompt</button>
        <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_fast_shell_one_liner`)}" data-copy="${escapeHtml(payload.fastest_activation_path.shell_one_liner)}">Copy shell one-liner</button>
      </div>
      <pre>${escapeHtml(payload.fastest_activation_path.shell_one_liner)}</pre>
      <p>${escapeHtml(payload.fastest_activation_path.browser_proof_rule)}</p>
    </section>
    <section class="panel">
      <h2>Install Copy</h2>
      <pre>${escapeHtml(copyBlock)}</pre>
    </section>
    <section class="panel">
      <h2>Host Install Steps</h2>
      <ol>
        ${payload.host_install_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    </section>
    <section class="panel">
      <h2>Source-Aware Endpoint</h2>
      <div class="bar">
        <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_endpoint`)}" data-copy="${escapeHtml(payload.source_aware_endpoint)}">Copy endpoint</button>
      </div>
      <pre>${escapeHtml(payload.source_aware_endpoint)}</pre>
    </section>
    <section class="panel">
      <h2>Agent Prompt</h2>
      <p>Paste this into the MCP host after install. It forces the real tool sequence and measured cart handoff.</p>
      <pre>${escapeHtml(payload.first_useful_run.agent_prompt)}</pre>
    </section>
    <section class="panel">
      <h2>First Useful Run</h2>
      <p>After install, run this through the source-aware endpoint. The final tool should return a measured <code>https://mcp.packrift.com/r/cart/1066</code> URL.</p>
      <div class="bar">
        <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_first_run_curl`)}" data-copy="${escapeHtml(payload.first_useful_run.curl_script)}">Copy curl script</button>
        <button class="secondary" data-copy-target="${escapeHtml(`${payload.target.id}_first_run_json`)}" data-copy="${escapeHtml(firstRunSequence)}">Copy JSON-RPC</button>
      </div>
      <pre>${escapeHtml(payload.first_useful_run.curl_script)}</pre>
    </section>
    <section class="panel">
      <h2>Rule</h2>
      <p>${escapeHtml(payload.operating_rule)}</p>
      <p>Activation requires real host-side MCP tool calls from this source and a measured <code>${escapeHtml(payload.activation_acceptance_gate.required_cart_url_prefix)}</code> URL. Browser proof alone is review evidence, not source activation.</p>
    </section>
  </main>
  <script>
    const installAction = ${scriptJson({
      release: payload.release,
      source: payload.source,
      target: payload.target.id,
    })};
    function recordInstallCopy(target) {
      const safeTarget = String(target || installAction.target || "unknown").replace(/[^a-z0-9_:-]/gi, "_").slice(0, 80);
      const stamp = Date.now();
      const body = JSON.stringify({
        event: "mcp_install_copy",
        source: "mcp_install_action_copy",
        tool_name: safeTarget,
        release: installAction.release,
        packrift_ai_id: "mcp_install_copy_" + installAction.source + "_" + safeTarget + "_" + stamp,
        ai_commerce_id: "mcp_install_copy_" + installAction.source + "_" + safeTarget + "_" + stamp,
        mcp_key: "install_copy:" + installAction.source + ":" + safeTarget,
        mcp_journey: "mcp_install_action:" + installAction.source + ":copy:" + safeTarget,
        mcp_result_set: "mcp_install_action_copy",
        utm_source: installAction.source,
        utm_medium: "install_copy",
        utm_campaign: "packrift_mcp_install",
        utm_content: safeTarget,
        mcp_install_target: installAction.target,
        page_url: window.location.href,
        source_url: window.location.href,
        referrer: document.referrer
      });
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon("/events/ai-sales", blob)) return;
      fetch("/events/ai-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    }
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy]");
      if (!button) return;
      const value = button.getAttribute("data-copy") || "";
      const target = button.getAttribute("data-copy-target") || installAction.target;
      recordInstallCopy(target);
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "Copied";
        button.classList.add("copied");
      } catch {
        button.textContent = "Select text";
      }
      window.setTimeout(() => {
        button.textContent = target.includes("agent_prompt") ? "Copy agent prompt" : target.includes("endpoint") ? "Copy endpoint" : target.includes("one_liner") ? "Copy shell one-liner" : target.includes("curl") ? "Copy curl script" : target.includes("json") ? "Copy JSON-RPC" : "Copy install";
        button.classList.remove("copied");
      }, 1400);
    });
  </script>
</body>
</html>`;
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
    payload.required_post_install_verification.run,
    "",
    `Endpoint: \`${payload.first_useful_run.endpoint}\``,
    "",
    payload.first_useful_run.buyer_prompt,
    "",
    "Agent prompt:",
    "",
    fencedText(payload.first_useful_run.agent_prompt),
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "Pasteable curl script:",
    "",
    fencedShell(payload.first_useful_run.curl_script),
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
