import {
  INSTALL_TARGETS,
  MCP_ENDPOINT,
  TRACKED_CONFIG_TEMPLATE,
  TRACKED_INSTALL_TEMPLATE,
  mcpFirstUsefulRun,
  trackedConfigUrl,
  trackedInstallUrl,
} from "./install-action.js";

export interface FirstRunActionRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

export const MCP_FIRST_RUN_ACTION_RELEASE = "PACKRIFT-MCP-FIRST-RUN-ACTION-R05";
export const MCP_FIRST_RUN_ACTIONS_RELEASE = "PACKRIFT-MCP-FIRST-RUN-ACTIONS-R04";
export const TRACKED_RUN_TEMPLATE = "https://mcp.packrift.com/r/run/{source}/{target}";

function normalizeRunSlug(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug.length >= 2 ? slug : fallback;
}

export function trackedRunUrl(source: string, target = "generic_streamable_http"): string {
  const sourceSlug = normalizeRunSlug(source, "generic");
  const targetSlug = normalizeRunSlug(target, "generic_streamable_http");
  const url = new URL(`https://mcp.packrift.com/r/run/${sourceSlug}/${targetSlug}`);
  url.searchParams.set("utm_source", sourceSlug);
  url.searchParams.set("utm_medium", "first_run_action");
  url.searchParams.set("utm_campaign", "packrift_mcp_activation");
  url.searchParams.set("utm_content", targetSlug);
  return url.toString();
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function mcpFirstRunActionPayload(input: { source: string; target: string }) {
  const source = normalizeRunSlug(input.source, "generic");
  const target = normalizeRunSlug(input.target, "generic_streamable_http");
  const firstUsefulRun = mcpFirstUsefulRun(source, target);
  const trackedRun = trackedRunUrl(source, target);
  const shellOneLiner = `curl -sS ${shellQuote(`${trackedRun}&format=sh`)} | bash`;
  return {
    release: MCP_FIRST_RUN_ACTION_RELEASE,
    generated_at: new Date().toISOString(),
    source,
    target,
    purpose:
      "Source-attributed Packrift MCP first-run action. Use this after install to prove the hosted endpoint reaches live SKU checks and a measured cart URL without creating an order.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_run_url: trackedRun,
    tracked_run_html_url: `${trackedRun}&format=html`,
    tracked_run_execute_url: `${trackedRun}&execute=1`,
    tracked_run_markdown_url: `${trackedRun}&format=md`,
    tracked_run_shell_url: `${trackedRun}&format=sh`,
    tracked_config_url: trackedConfigUrl(source),
    tracked_install_url: trackedInstallUrl(source, target),
    tracked_templates: {
      run: TRACKED_RUN_TEMPLATE,
      install: TRACKED_INSTALL_TEMPLATE,
      config: TRACKED_CONFIG_TEMPLATE,
    },
    no_order_created: true,
    required_final_tool: "create_cart_url",
    shell_one_liner: shellOneLiner,
    first_useful_run: firstUsefulRun,
    success_signals: firstUsefulRun.success_signals,
    next_steps: [
      "Install Packrift MCP with the tracked config or install URL if the host is not already connected.",
      "Run the curl script or JSON-RPC sequence from the source-aware endpoint.",
      "Confirm create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066.",
      "For real buyer workflows, use prepare_purchase_handoff and only create cart URLs after buyer confirmation.",
    ],
    operating_rule:
      "This is a thin first-run wrapper around https://mcp.packrift.com/mcp. Do not treat it as a Packrift CLI, checkout, or alternate buyer surface.",
  };
}

export function mcpFirstRunActionsPayload(runtime: FirstRunActionRuntime, source = "generic") {
  const sourceSlug = normalizeRunSlug(source, "generic");
  return {
    release: MCP_FIRST_RUN_ACTIONS_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Tracked first-run URLs that move Packrift MCP users from install/config fetches into a measurable first useful run ending at create_cart_url.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_run_template: TRACKED_RUN_TEMPLATE,
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
      tracked_run_url: trackedRunUrl(sourceSlug, target.id),
      tracked_run_html_url: `${trackedRunUrl(sourceSlug, target.id)}&format=html`,
      tracked_run_execute_url: `${trackedRunUrl(sourceSlug, target.id)}&execute=1`,
      tracked_install_url: trackedInstallUrl(sourceSlug, target.id),
      tracked_config_url: trackedConfigUrl(sourceSlug),
      source_aware_endpoint: mcpFirstUsefulRun(sourceSlug, target.id).endpoint,
      required_final_tool: "create_cart_url",
      no_order_created: true,
    })),
    recommended_targets: ["generic_streamable_http", "claude_code", "codex", "cursor_windsurf_vscode", "cline"],
    first_run: mcpFirstRunActionPayload({ source: sourceSlug, target: "generic_streamable_http" }),
    proof_urls: {
      start: "https://mcp.packrift.com/start",
      install_actions: "https://mcp.packrift.com/ai/mcp-install-actions.json",
      client_config: "https://mcp.packrift.com/ai/mcp-client-config.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
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

export function mcpFirstRunActionMarkdown(payload: ReturnType<typeof mcpFirstRunActionPayload>): string {
  return [
    "# Packrift MCP First Run Action",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Source: ${payload.source}`,
    `Target: ${payload.target}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    "## Run Now",
    "",
    `Tracked run URL: ${payload.tracked_run_url}`,
    `Browser run URL: ${payload.tracked_run_html_url}`,
    `Live proof URL: ${payload.tracked_run_execute_url}`,
    "",
    "Shell one-liner:",
    "",
    fencedShell(payload.shell_one_liner),
    "",
    "Agent prompt:",
    "",
    fencedText(payload.first_useful_run.agent_prompt),
    "",
    "Pasteable curl script:",
    "",
    fencedShell(payload.first_useful_run.curl_script),
    "",
    "## JSON-RPC Sequence",
    "",
    `Endpoint: ${payload.first_useful_run.endpoint}`,
    "",
    fencedJson(payload.first_useful_run.sequence),
    "",
    "## Success Signals",
    "",
    payload.success_signals.map((signal) => `- ${signal}`).join("\n"),
    "",
    "## Operating Rule",
    "",
    payload.operating_rule,
    "",
  ].join("\n");
}

export function mcpFirstRunActionsMarkdown(runtime: FirstRunActionRuntime): string {
  const payload = mcpFirstRunActionsPayload(runtime);
  const rows = payload.targets
    .map((target) => `| ${target.id} | ${target.tracked_run_url} | ${target.tracked_run_execute_url} | ${target.tracked_install_url} |`)
    .join("\n");
  return [
    "# Packrift MCP First Run Actions",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    `Tracked run template: ${payload.tracked_run_template}`,
    "",
    "| Target | Tracked run URL | Live proof URL | Tracked install URL |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    "## Default First Run",
    "",
    mcpFirstRunActionMarkdown(payload.first_run),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-first-run-actions.json",
    "",
  ].join("\n");
}
