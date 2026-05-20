import { mcpDirectorySubmitActionsPayload, type DirectorySubmitActionsRuntime } from "./directory-submit-actions.js";
import { MCP_ENDPOINT, mcpFirstUsefulRun, trackedConfigUrl, trackedInstallUrl } from "./install-action.js";
import { trackedRunUrl } from "./first-run-action.js";
import { packriftMcpGa4HeadScript } from "./mcp-page-analytics.js";

export interface ReviewerActivationRuntime extends DirectorySubmitActionsRuntime {}

export const MCP_REVIEWER_ACTIVATION_RELEASE = "PACKRIFT-MCP-REVIEWER-ACTIVATION-R11";
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

function preferredActivationTarget(source: string): string {
  return source === "cline_mcp_marketplace" ? "cline" : "generic_streamable_http";
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function copyReadyHostConfigs(input: {
  source: string;
  preferredTarget: string;
  sourceAwareEndpoint: string;
  agentPrompt: string;
  curlScript: string;
}) {
  const genericConfig = {
    mcpServers: {
      packrift: {
        type: "http",
        url: input.sourceAwareEndpoint,
      },
    },
  };
  const clineConfig = {
    mcpServers: {
      packrift: {
        type: "streamableHttp",
        url: input.sourceAwareEndpoint,
        disabled: false,
        timeout: 60,
      },
    },
  };
  return {
    source: input.source,
    preferred_target: input.preferredTarget,
    source_aware_endpoint: input.sourceAwareEndpoint,
    generic_mcp_json: JSON.stringify(genericConfig, null, 2),
    cline_mcp_json: JSON.stringify(clineConfig, null, 2),
    claude_code_command: `claude mcp add --transport http packrift ${shellQuote(input.sourceAwareEndpoint)}`,
    codex_command: `codex mcp add packrift --url ${shellQuote(input.sourceAwareEndpoint)}`,
    agent_prompt: input.agentPrompt,
    curl_script: input.curlScript,
    success_gate:
      "After install, run the agent prompt in the real MCP host and require create_cart_url to return a measured https://mcp.packrift.com/r/cart/1066 URL.",
  };
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
  const preferredTarget = preferredActivationTarget(source);
  return {
    id: source,
    label: action.label,
    preferred_target: preferredTarget,
    priority: action.priority,
    action_status: action.action_status,
    directory_status: action.directory_status,
    listing_url: action.listing_url,
    submission_url: action.submission_url,
    tracked_start_url: action.tracked_start_url,
    tracked_config_url: action.tracked_config_url,
    tracked_install_codex_url: trackedInstallUrl(source, "codex"),
    tracked_install_generic_url: trackedInstallUrl(source, "generic_streamable_http"),
    tracked_install_cline_url: trackedInstallUrl(source, "cline"),
    tracked_preferred_install_url: trackedInstallUrl(source, preferredTarget),
    tracked_first_run_url: trackedRunUrl(source, preferredTarget),
    tracked_first_run_browser_url: `${trackedRunUrl(source, preferredTarget)}&format=html`,
    tracked_first_run_live_proof_url: `${trackedRunUrl(source, preferredTarget)}&execute=1`,
    tracked_reviewer_activation_url: trackedReviewerActivationUrl(source),
    tracked_reviewer_activation_html_url: `${trackedReviewerActivationUrl(source)}&format=html`,
    tracked_reviewer_activation_shell_url: `${trackedReviewerActivationUrl(source)}&format=sh`,
    next_action: action.next_action,
    missing_next_step:
      "Convert browser proof or install intent into a real MCP client call against https://mcp.packrift.com/mcp and a create_cart_url result.",
  };
}

function genericSourceSummary(source: string) {
  const sourceSlug = normalizeSource(source);
  const preferredTarget = preferredActivationTarget(sourceSlug);
  return {
    id: sourceSlug,
    label: sourceSlug,
    preferred_target: preferredTarget,
    priority: "medium",
    action_status: "source_specific_activation_ready",
    directory_status: "unknown",
    listing_url: "",
    submission_url: "",
    tracked_start_url: `https://mcp.packrift.com/r/start/${sourceSlug}`,
    tracked_config_url: trackedConfigUrl(sourceSlug),
    tracked_install_codex_url: trackedInstallUrl(sourceSlug, "codex"),
    tracked_install_generic_url: trackedInstallUrl(sourceSlug, "generic_streamable_http"),
    tracked_install_cline_url: trackedInstallUrl(sourceSlug, "cline"),
    tracked_preferred_install_url: trackedInstallUrl(sourceSlug, preferredTarget),
    tracked_first_run_url: trackedRunUrl(sourceSlug, preferredTarget),
    tracked_first_run_browser_url: `${trackedRunUrl(sourceSlug, preferredTarget)}&format=html`,
    tracked_first_run_live_proof_url: `${trackedRunUrl(sourceSlug, preferredTarget)}&execute=1`,
    tracked_reviewer_activation_url: trackedReviewerActivationUrl(sourceSlug),
    tracked_reviewer_activation_html_url: `${trackedReviewerActivationUrl(sourceSlug)}&format=html`,
    tracked_reviewer_activation_shell_url: `${trackedReviewerActivationUrl(sourceSlug)}&format=sh`,
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
    `Shell activation script: ${summary.tracked_reviewer_activation_shell_url}`,
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
  const firstUsefulRun = mcpFirstUsefulRun(sourceSlug, target.preferred_target);
  const sourceAwareEndpoint = firstUsefulRun.endpoint;
  const hostConfigs = copyReadyHostConfigs({
    source: sourceSlug,
    preferredTarget: target.preferred_target,
    sourceAwareEndpoint,
    agentPrompt: firstUsefulRun.agent_prompt,
    curlScript: firstUsefulRun.curl_script,
  });
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
    agent_prompt: firstUsefulRun.agent_prompt,
    json_rpc_sequence: firstUsefulRun.sequence,
    curl_script: firstUsefulRun.curl_script,
    copy_ready_host_configs: hostConfigs,
    real_mcp_client_run: {
      endpoint: sourceAwareEndpoint,
      buyer_prompt: firstUsefulRun.buyer_prompt,
      run_rule: firstUsefulRun.run_rule,
      required_final_tool: "create_cart_url",
      browser_executable: true,
      browser_runner_url: target.tracked_reviewer_activation_html_url,
      agent_prompt: firstUsefulRun.agent_prompt,
      sequence: firstUsefulRun.sequence,
      curl_script: firstUsefulRun.curl_script,
      success_signals: firstUsefulRun.success_signals,
      agent_prompt_success_criteria: firstUsefulRun.agent_prompt_success_criteria,
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
      tracked_reviewer_activation_html: target.tracked_reviewer_activation_html_url,
      tracked_reviewer_activation_shell: target.tracked_reviewer_activation_shell_url,
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
    `- Browser runner: ${target.tracked_reviewer_activation_html_url}`,
    `- Shell script URL: ${target.tracked_reviewer_activation_shell_url}`,
    `- Tracked first-run proof: ${target.tracked_first_run_live_proof_url}`,
    `- Tracked config: ${target.tracked_config_url}`,
    "",
    "## Real MCP Client Run",
    "",
    `Endpoint: ${payload.real_mcp_client_run.endpoint}`,
    "",
    "Copy-ready host configs:",
    "",
    fencedJson(payload.copy_ready_host_configs),
    "",
    "Agent prompt:",
    "",
    fencedText(payload.real_mcp_client_run.agent_prompt),
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

export function mcpReviewerActivationHtml(runtime: ReviewerActivationRuntime, source = "generic"): string {
  const payload = mcpReviewerActivationPayload(runtime, source);
  const target = payload.target_source;
  const cartUrlPattern = "https://mcp.packrift.com/r/cart/";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packrift MCP Activation</title>
  ${packriftMcpGa4HeadScript({ pageType: "mcp_activation", source: target.id, target: target.preferred_target, utmCampaign: "packrift_mcp_activation" })}
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f6f3;color:#1b2533}
    main{max-width:980px;margin:0 auto;padding:28px 18px 48px}
    h1{font-size:1.7rem;margin:0 0 8px}
    h2{font-size:1rem;margin:22px 0 8px}
    p{line-height:1.5;color:#4f5d6b}
    .bar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
    a.button,button{display:inline-flex;align-items:center;border:1px solid #1b2533;border-radius:6px;background:#1b2533;color:#fff;padding:9px 12px;text-decoration:none;font:inherit;cursor:pointer}
    a.secondary,button.secondary{background:#fff;color:#1b2533}
    button:disabled{opacity:.56;cursor:wait}
    .panel{background:#fff;border:1px solid #dfd9ce;border-radius:8px;padding:14px;margin:14px 0}
    .pill{display:inline-block;border:1px solid #d4cec3;border-radius:999px;padding:4px 8px;margin:2px 4px 2px 0;font-size:.84rem;background:#fff}
    pre{white-space:pre-wrap;word-break:break-word;background:#101820;color:#f4f8fb;border-radius:8px;padding:12px;overflow:auto}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .ok{border-left:4px solid #1f8f55}
    .warn{border-left:4px solid #b86b00}
    .muted{color:#657384}
    .cart-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .cart-note{flex-basis:100%;margin:0;color:#4f5d6b}
  </style>
</head>
<body>
  <main>
    <h1>Packrift MCP Activation</h1>
    <p>${escapeHtml(payload.purpose)}</p>
    <div>
      <span class="pill">Source: ${escapeHtml(target.id)}</span>
      <span class="pill">Endpoint: hosted MCP</span>
      <span class="pill">Final tool: create_cart_url</span>
      <span class="pill">No order created</span>
    </div>
    <div class="bar">
      <button id="run">Run real MCP check</button>
      <button id="copy-agent-prompt" class="secondary" type="button">Copy agent prompt</button>
      <a class="button secondary" href="${escapeHtml(target.tracked_reviewer_activation_shell_url)}">Shell script</a>
      <a class="button secondary" href="${escapeHtml(target.tracked_first_run_live_proof_url)}">Open live proof</a>
      <a class="button secondary" href="${escapeHtml(payload.markdown_url)}?source=${escapeHtml(target.id)}">Markdown</a>
      <a class="button secondary" href="${escapeHtml(payload.machine_readable_url)}?source=${escapeHtml(target.id)}">JSON</a>
    </div>
    <section class="panel">
      <h2>Activation Gate</h2>
      <p>Run the real MCP check to call <code>tools/list</code>, <code>get_cart_handoff_candidates</code>, <code>get_pricing</code>, <code>check_inventory</code>, and <code>create_cart_url</code> against the source-aware endpoint.</p>
      <p class="muted">Success means the final result contains a measured <code>${cartUrlPattern}</code> URL.</p>
    </section>
    <section class="panel">
      <h2>Source-Aware Endpoint</h2>
      <pre>${escapeHtml(payload.real_mcp_client_run.endpoint)}</pre>
    </section>
    <section class="panel">
      <h2>Copy-Ready Host Configs</h2>
      <pre>${escapeHtml(JSON.stringify(payload.copy_ready_host_configs, null, 2))}</pre>
    </section>
    <section class="panel">
      <h2>Agent Prompt</h2>
      <p>Paste this into the MCP host after install. It requires the real Packrift MCP tools and a measured cart URL.</p>
      <pre>${escapeHtml(payload.real_mcp_client_run.agent_prompt)}</pre>
    </section>
    <section class="panel">
      <h2>JSON-RPC Sequence</h2>
      <pre>${escapeHtml(JSON.stringify(payload.real_mcp_client_run.sequence, null, 2))}</pre>
    </section>
    <section id="result" class="panel">
      <h2>Result</h2>
      <pre id="output">Not run yet.</pre>
      <p id="cart"></p>
    </section>
  </main>
  <script>
    const activation = ${scriptJson(payload)};
    const runButton = document.getElementById("run");
    const copyPromptButton = document.getElementById("copy-agent-prompt");
    const output = document.getElementById("output");
    const cart = document.getElementById("cart");
    const resultPanel = document.getElementById("result");
    let cartReadyRecorded = false;
    let activationSessionId = "";
    function cleanCartUrl(value) {
      if (typeof value !== "string" || !value.startsWith("${cartUrlPattern}")) return null;
      try {
        const url = new URL(value);
        if (url.origin !== "https://mcp.packrift.com" || !url.pathname.startsWith("/r/cart/")) return null;
        return url.toString();
      } catch {
        return null;
      }
    }
    function activationSourceId() {
      return activation && activation.target_source && activation.target_source.id ? activation.target_source.id : "generic";
    }
    function skuFromCartUrl(value) {
      try {
        const url = new URL(value);
        const parts = url.pathname.split("/").filter(Boolean);
        const cartIndex = parts.indexOf("cart");
        return cartIndex >= 0 ? parts[cartIndex + 1] || "" : "";
      } catch {
        return "";
      }
    }
    function recordCartReady(measuredCartUrl, results) {
      if (cartReadyRecorded) return;
      cartReadyRecorded = true;
      const source = activationSourceId();
      const sku = skuFromCartUrl(measuredCartUrl);
      let params = new URLSearchParams();
      try {
        params = new URL(measuredCartUrl).searchParams;
      } catch {}
      fetch("/events/ai-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event: "mcp_activation_cart_ready",
          source: "mcp_reviewer_activation_runner",
          tool_name: "create_cart_url",
          release: activation.release,
          sku,
          result_count: Array.isArray(results) ? results.length : 0,
          match_type: "activation_cart_ready",
          packrift_ai_id: params.get("packrift_ai_id") || params.get("ai_commerce_id") || params.get("mcp_journey") || "",
          ai_commerce_id: params.get("ai_commerce_id") || params.get("packrift_ai_id") || params.get("mcp_journey") || "",
          mcp_handoff_id: params.get("mcp_handoff_id") || "",
          mcp_session_id: activationSessionId,
          mcp_key: params.get("mcp_key") || "activation_cart_ready:" + source,
          mcp_journey: params.get("mcp_journey") || "reviewer_activation:" + source,
          mcp_result_set: params.get("mcp_result_set") || "",
          mcp_source_context: source,
          mcp_install_target: "generic_streamable_http",
          utm_source: source,
          utm_medium: "reviewer_activation",
          utm_campaign: "packrift_mcp_activation",
          utm_content: "cart_ready",
          utm_term: sku,
          cart_url: measuredCartUrl,
          source_url: window.location.href,
          page_url: window.location.href,
          referrer: document.referrer,
          user_agent: navigator.userAgent
        })
      }).catch(() => {});
    }
    function extractMeasuredCartUrl(results) {
      for (let i = results.length - 1; i >= 0; i -= 1) {
        const result = results[i] && results[i].response && results[i].response.result;
        const structuredUrl = cleanCartUrl(result && result.structuredContent && result.structuredContent.url);
        if (structuredUrl) return structuredUrl;
        const content = result && Array.isArray(result.content) ? result.content : [];
        for (let j = content.length - 1; j >= 0; j -= 1) {
          const text = content[j] && content[j].text;
          if (typeof text !== "string") continue;
          try {
            const parsed = JSON.parse(text);
            const parsedUrl = cleanCartUrl(parsed && parsed.url);
            if (parsedUrl) return parsedUrl;
          } catch {
            const matches = Array.from(text.matchAll(/https:\\/\\/mcp\\.packrift\\.com\\/r\\/cart\\/[^"\\s<>\\\\]+/g))
              .map((match) => cleanCartUrl(match[0]))
              .filter(Boolean);
            if (matches.length) return matches[matches.length - 1];
          }
        }
      }
      return null;
    }
    function appendResult(results) {
      output.textContent = JSON.stringify(results, null, 2);
      const measuredCartUrl = extractMeasuredCartUrl(results);
      if (measuredCartUrl) {
        resultPanel.className = "panel ok";
        recordCartReady(measuredCartUrl, results);
        const actions = document.createElement("span");
        actions.className = "cart-actions";
        const link = document.createElement("a");
        link.className = "button";
        link.href = measuredCartUrl;
        link.textContent = "Open measured cart URL";
        const copy = document.createElement("button");
        copy.className = "secondary";
        copy.type = "button";
        copy.textContent = "Copy URL";
        copy.addEventListener("click", async () => {
          await navigator.clipboard.writeText(measuredCartUrl);
          copy.textContent = "Copied";
          setTimeout(() => { copy.textContent = "Copy URL"; }, 1600);
        });
        const note = document.createElement("span");
        note.className = "cart-note";
        note.textContent = "Measured cart URL is ready. This records cart-ready only; it is not counted as a cart landing until the URL is opened.";
        actions.replaceChildren(link, copy, note);
        cart.replaceChildren(actions);
        link.focus();
      } else {
        resultPanel.className = "panel warn";
        cart.textContent = "No measured cart URL returned yet.";
      }
    }
    async function parseMcpResponse(response) {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {}
      const dataLines = text.split("\\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);
      for (let index = dataLines.length - 1; index >= 0; index -= 1) {
        try {
          return JSON.parse(dataLines[index]);
        } catch {}
      }
      return { parse_error: "response_not_json_or_event_stream", raw: text.slice(0, 2000) };
    }
    async function runMcpSequence() {
      runButton.disabled = true;
      cart.textContent = "";
      output.textContent = "Running real MCP calls...";
      const sessionId = globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());
      activationSessionId = sessionId;
      const results = [];
      for (const request of activation.real_mcp_client_run.sequence) {
        const response = await fetch(activation.real_mcp_client_run.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
            "Mcp-Session-Id": sessionId
          },
          body: JSON.stringify(request)
        });
        const body = await parseMcpResponse(response);
        results.push({ status: response.status, request, response: body });
        appendResult(results);
        if (!response.ok || body.error) break;
      }
      runButton.disabled = false;
    }
    runButton.addEventListener("click", () => {
      runMcpSequence().catch((error) => {
        resultPanel.className = "panel warn";
        output.textContent = error && error.stack ? error.stack : String(error);
        runButton.disabled = false;
      });
    });
    copyPromptButton && copyPromptButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(activation.real_mcp_client_run.agent_prompt || "");
        copyPromptButton.textContent = "Copied";
      } catch {
        copyPromptButton.textContent = "Select prompt";
      }
      setTimeout(() => { copyPromptButton.textContent = "Copy agent prompt"; }, 1400);
    });
  </script>
</body>
</html>`;
}
