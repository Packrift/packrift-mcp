import { mcpDirectorySubmitActionsPayload, type DirectorySubmitActionsRuntime } from "./directory-submit-actions.js";
import { MCP_ENDPOINT, mcpFirstUsefulRun, trackedConfigUrl, trackedInstallUrl } from "./install-action.js";
import { trackedRunUrl } from "./first-run-action.js";

export interface ReviewerActivationRuntime extends DirectorySubmitActionsRuntime {}

export const MCP_REVIEWER_ACTIVATION_RELEASE = "PACKRIFT-MCP-REVIEWER-ACTIVATION-R01";
export const MCP_REVIEWER_ACTIVATION_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.json";
export const MCP_REVIEWER_ACTIVATION_MD_URL = "https://mcp.packrift.com/ai/mcp-reviewer-activation.md";
export const TRACKED_REVIEWER_ACTIVATION_TEMPLATE = "https://mcp.packrift.com/r/activate/{source}";

function normalizeSource(value: string, fallback = "generic"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug.length >= 2 ? slug : fallback;
}

export function trackedReviewerActivationUrl(source: string): string {
  const sourceSlug = normalizeSource(source);
  const url = new URL(`https://mcp.packrift.com/r/activate/${sourceSlug}`);
  url.searchParams.set("utm_source", sourceSlug);
  url.searchParams.set("utm_medium", "reviewer_activation");
  url.searchParams.set("utm_campaign", "packrift_mcp_activation");
  url.searchParams.set("utm_content", "real_mcp_client_run");
  return url.toString();
}

function sourceSummary(action: ReturnType<typeof mcpDirectorySubmitActionsPayload>["actions"][number]) {
  const source = normalizeSource(action.id);
  return {
    id: source,
    label: action.label,
    priority: action.priority,
    action_status: action.action_status,
    directory_status: action.directory_status,
    listing_url: action.listing_url,
    submission_url: action.submission_url,
    tracked_start_url: action.tracked_start_url,
    tracked_config_url: action.tracked_config_url,
    tracked_install_codex_url: trackedInstallUrl(source, "codex"),
    tracked_install_generic_url: trackedInstallUrl(source, "generic_streamable_http"),
    tracked_first_run_url: trackedRunUrl(source, "generic_streamable_http"),
    tracked_first_run_browser_url: `${trackedRunUrl(source, "generic_streamable_http")}&format=html`,
    tracked_first_run_live_proof_url: `${trackedRunUrl(source, "generic_streamable_http")}&execute=1`,
    tracked_reviewer_activation_url: trackedReviewerActivationUrl(source),
    next_action: action.next_action,
    missing_next_step:
      "Convert browser proof or install intent into a real MCP client call against https://mcp.packrift.com/mcp and a create_cart_url result.",
  };
}

function genericSourceSummary(source: string) {
  const sourceSlug = normalizeSource(source);
  return {
    id: sourceSlug,
    label: sourceSlug,
    priority: "medium",
    action_status: "source_specific_activation_ready",
    directory_status: "unknown",
    listing_url: "",
    submission_url: "",
    tracked_start_url: `https://mcp.packrift.com/r/start/${sourceSlug}`,
    tracked_config_url: trackedConfigUrl(sourceSlug),
    tracked_install_codex_url: trackedInstallUrl(sourceSlug, "codex"),
    tracked_install_generic_url: trackedInstallUrl(sourceSlug, "generic_streamable_http"),
    tracked_first_run_url: trackedRunUrl(sourceSlug, "generic_streamable_http"),
    tracked_first_run_browser_url: `${trackedRunUrl(sourceSlug, "generic_streamable_http")}&format=html`,
    tracked_first_run_live_proof_url: `${trackedRunUrl(sourceSlug, "generic_streamable_http")}&execute=1`,
    tracked_reviewer_activation_url: trackedReviewerActivationUrl(sourceSlug),
    next_action: "Install Packrift MCP from the hosted endpoint, then run the real MCP sequence below.",
    missing_next_step:
      "Convert browser proof or install intent into a real MCP client call against https://mcp.packrift.com/mcp and a create_cart_url result.",
  };
}

function copyReadyMessage(summary: ReturnType<typeof sourceSummary> | ReturnType<typeof genericSourceSummary>) {
  return [
    `Packrift MCP is ready for ${summary.label}.`,
    "",
    `Endpoint: ${MCP_ENDPOINT}`,
    `Tracked activation handoff: ${summary.tracked_reviewer_activation_url}`,
    `Tracked config: ${summary.tracked_config_url}`,
    `Tracked first-run proof: ${summary.tracked_first_run_live_proof_url}`,
    "",
    "Acceptance test:",
    "1. Install the hosted no-auth Streamable HTTP MCP endpoint.",
    "2. Run tools/list against the source-aware endpoint in the activation payload.",
    "3. Run get_cart_handoff_candidates, get_pricing, check_inventory, and create_cart_url for SKU 1066.",
    "4. Treat the flow as activated only when create_cart_url returns a URL starting with https://mcp.packrift.com/r/cart/1066.",
    "",
    "The browser proof is useful for review, but it is not a substitute for a real MCP client call or cart handoff.",
  ].join("\n");
}

export function mcpReviewerActivationPayload(runtime: ReviewerActivationRuntime, source = "generic") {
  const sourceSlug = normalizeSource(source);
  const directory = mcpDirectorySubmitActionsPayload(runtime);
  const actions = directory.actions.map(sourceSummary);
  const target = actions.find((row) => row.id === sourceSlug) ?? genericSourceSummary(sourceSlug);
  const firstUsefulRun = mcpFirstUsefulRun(sourceSlug, "generic_streamable_http");
  const sourceAwareEndpoint = firstUsefulRun.endpoint;
  return {
    release: MCP_REVIEWER_ACTIVATION_RELEASE,
    generated_at: new Date().toISOString(),
    purpose:
      "Move Packrift MCP directory reviewers, agent hosts, and Browse-style skill users from install/proof clicks into a real MCP client workflow that returns a measured cart handoff.",
    canonical_endpoint: MCP_ENDPOINT,
    tracked_reviewer_activation_template: TRACKED_REVIEWER_ACTIVATION_TEMPLATE,
    machine_readable_url: MCP_REVIEWER_ACTIVATION_URL,
    markdown_url: MCP_REVIEWER_ACTIVATION_MD_URL,
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    target_source: target,
    source_aware_endpoint: sourceAwareEndpoint,
    real_mcp_client_run: {
      endpoint: sourceAwareEndpoint,
      buyer_prompt: firstUsefulRun.buyer_prompt,
      run_rule: firstUsefulRun.run_rule,
      required_final_tool: "create_cart_url",
      sequence: firstUsefulRun.sequence,
      curl_script: firstUsefulRun.curl_script,
      success_signals: firstUsefulRun.success_signals,
    },
    activation_rules: [
      "Use the existing hosted Packrift MCP endpoint; do not create a separate Packrift CLI, browser-only buyer surface, or alternate checkout.",
      "Browser proof links can validate live product, price, inventory, and cart URL generation, but they do not replace a real MCP client workflow.",
      "A source is activated only when a real MCP client calls tools/list or tools/call through the hosted endpoint and the final workflow reaches create_cart_url.",
      "Use the MCP /r/cart URL returned by create_cart_url as the primary buyer handoff before Shopify checkout.",
      "Preserve source attribution through packrift_mcp_source on the source-aware endpoint or through the tracked config/install/run URLs.",
    ],
    reviewer_acceptance_gate: {
      proof_click_seen: `Open ${target.tracked_first_run_live_proof_url} and confirm status ok.`,
      real_client_seen: "Run the JSON-RPC sequence against the source-aware endpoint, not only the browser proof.",
      cart_handoff_seen: "create_cart_url returns https://mcp.packrift.com/r/cart/1066 with MCP attribution.",
      usage_snapshot_updates:
        "https://mcp.packrift.com/ai/mcp-usage-snapshot.json should show source-attributed runtime events or create_cart_url activity after a real client run.",
    },
    source_queue: actions,
    priority_sources_waiting_on_real_mcp_run: actions.filter((row) =>
      ["mcp_so", "cline_mcp_marketplace", "mcpservers_org", "anthropic_connectors_directory", "smithery", "mcp_directory"].includes(row.id)
    ),
    copy_ready_message: copyReadyMessage(target),
    proof_urls: {
      reviewer_activation_json: MCP_REVIEWER_ACTIVATION_URL,
      reviewer_activation_markdown: MCP_REVIEWER_ACTIVATION_MD_URL,
      tracked_reviewer_activation: target.tracked_reviewer_activation_url,
      tracked_first_run_live_proof: target.tracked_first_run_live_proof_url,
      tracked_first_run_browser: target.tracked_first_run_browser_url,
      first_run_actions: "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
    },
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function fencedText(value: string): string {
  return ["```text", value, "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function mcpReviewerActivationMarkdown(runtime: ReviewerActivationRuntime, source = "generic"): string {
  const payload = mcpReviewerActivationPayload(runtime, source);
  const target = payload.target_source;
  const rows = payload.priority_sources_waiting_on_real_mcp_run
    .map(
      (row) =>
        `| ${escapeMarkdown(row.label)} | ${row.action_status} | ${row.directory_status} | ${row.tracked_reviewer_activation_url} | ${row.tracked_first_run_live_proof_url} | ${escapeMarkdown(row.missing_next_step)} |`
    )
    .join("\n");
  return [
    "# Packrift MCP Reviewer Activation",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    `Target source: ${target.id}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Target Source",
    "",
    `- Label: ${target.label}`,
    `- Action status: ${target.action_status}`,
    `- Directory status: ${target.directory_status}`,
    `- Tracked activation handoff: ${target.tracked_reviewer_activation_url}`,
    `- Tracked first-run proof: ${target.tracked_first_run_live_proof_url}`,
    `- Tracked config: ${target.tracked_config_url}`,
    "",
    "## Real MCP Client Run",
    "",
    `Endpoint: ${payload.real_mcp_client_run.endpoint}`,
    "",
    fencedJson(payload.real_mcp_client_run.sequence),
    "",
    "Shell script:",
    "",
    fencedText(payload.real_mcp_client_run.curl_script),
    "",
    "## Reviewer Acceptance Gate",
    "",
    Object.entries(payload.reviewer_acceptance_gate)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "## Priority Sources Waiting On Real MCP Run",
    "",
    "| Source | Action status | Directory status | Activation handoff | Live proof | Missing next step |",
    "| --- | --- | --- | --- | --- | --- |",
    rows || "| none | pass | pass | | | |",
    "",
    "## Copy-Ready Message",
    "",
    fencedText(payload.copy_ready_message),
    "",
    "## Activation Rules",
    "",
    payload.activation_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    `Machine-readable version: ${payload.machine_readable_url}`,
    "",
  ].join("\n");
}
