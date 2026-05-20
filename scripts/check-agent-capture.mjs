#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const BASE_URL = String(args["base-url"] || "https://mcp.packrift.com").replace(/\/$/, "");
const MCP_ENDPOINT = String(args["mcp-endpoint"] || `${BASE_URL}/mcp`);
const OUT_ROOT = resolve(process.cwd(), "outputs/agent-capture-check");
const RUN_CACHE_BUST = Date.now().toString(36);
const TEXT_HEADERS = {
  "User-Agent": "Packrift-Agent-Capture-Check/1.0 (+https://mcp.packrift.com/ai/all-agent-capture.json)",
  Accept: "application/json,text/markdown,text/plain;q=0.9,*/*;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

function cacheBustedUrl(url) {
  if (!url.startsWith(BASE_URL)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("packrift_check", RUN_CACHE_BUST);
  return parsed.toString();
}

async function fetchText(url) {
  try {
    const response = await fetch(cacheBustedUrl(url), { headers: TEXT_HEADERS, redirect: "follow" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, text };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", error: error.message };
  }
}

async function fetchJson(url) {
  const result = await fetchText(url);
  if (!result.ok) return { ...result, value: null, parse_error: null };
  try {
    return { ...result, value: JSON.parse(result.text), parse_error: null };
  } catch (error) {
    return { ...result, value: null, parse_error: error.message };
  }
}

async function fetchMcp(method, params = undefined) {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        ...TEXT_HEADERS,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: method,
        method,
        ...(params ? { params } : {}),
      }),
      redirect: "follow",
    });
    const text = await response.text();
    const value = text ? JSON.parse(text) : null;
    return {
      ok: response.ok && !value?.error,
      status: response.status,
      url: response.url,
      value,
      error: value?.error?.message ?? null,
    };
  } catch (error) {
    return { ok: false, status: 0, url: MCP_ENDPOINT, value: null, error: error.message };
  }
}

function check(name, ok, details = {}) {
  return {
    name,
    ok: Boolean(ok),
    ...details,
  };
}

function hasAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function hasResourceUri(resourceUris, path) {
  return resourceUris.has(`${BASE_URL}${path}`) || resourceUris.has(`https://mcp.packrift.com${path}`);
}

function markdownReport(payload) {
  const rows = payload.checks
    .map((row) => `| ${row.name} | ${row.ok ? "pass" : "fail"} | ${row.detail || row.status || row.url || ""} |`)
    .join("\n");
  const failures = payload.checks.filter((row) => !row.ok);
  return [
    "# Packrift All-Agent Capture Check",
    "",
    `Generated: ${payload.generated_at}`,
    `Base URL: ${payload.base_url}`,
    "",
    "| Check | Result | Detail |",
    "| --- | --- | --- |",
    rows,
    "",
    "## Follow-Up",
    "",
    ...(failures.length
      ? failures.map((row) => `- ${row.name}: ${row.detail || row.error || "failed"}`)
      : ["- None. All all-agent capture checks passed."]),
    "",
  ].join("\n");
}

async function main() {
  const jsonUrl = `${BASE_URL}/ai/all-agent-capture.json`;
  const mdUrl = `${BASE_URL}/ai/all-agent-capture.md`;
  const [
    jsonResult,
    mdResult,
    healthResult,
    resourcesResult,
    resourceTemplatesResult,
    agentHostRolloutTasksJsonlResult,
    agentHostRolloutTasksCsvResult,
    clientConfigResult,
    directoryRefreshResult,
    directorySubmitActionsResult,
    visitorGrowthResult,
    visitorGrowthTasksJsonlResult,
    visitorGrowthTasksCsvResult,
    outreachResult,
  ] = await Promise.all([
    fetchJson(jsonUrl),
    fetchText(mdUrl),
    fetchJson(`${BASE_URL}/health`),
    fetchMcp("resources/list"),
    fetchMcp("resources/templates/list"),
    fetchText(`${BASE_URL}/ai/mcp-agent-host-rollout-tasks.jsonl`),
    fetchText(`${BASE_URL}/ai/mcp-agent-host-rollout-tasks.csv`),
    fetchJson(`${BASE_URL}/ai/mcp-client-config.json`),
    fetchJson(`${BASE_URL}/ai/mcp-directory-refresh.json`),
    fetchJson(`${BASE_URL}/ai/mcp-directory-submit-actions.json`),
    fetchJson(`${BASE_URL}/ai/mcp-visitor-growth-queue.json`),
    fetchText(`${BASE_URL}/ai/mcp-visitor-growth-tasks.jsonl`),
    fetchText(`${BASE_URL}/ai/mcp-visitor-growth-tasks.csv`),
    fetchJson(`${BASE_URL}/ai/agent-capture-outreach.json`),
  ]);

  const capture = jsonResult.value;
  const surfaceIdRows = (capture?.surfaces ?? []).map((row) => row.id);
  const surfaceIds = new Set(surfaceIdRows);
  const duplicateSurfaceIds = Array.from(new Set(surfaceIdRows.filter((id, index) => surfaceIdRows.indexOf(id) !== index)));
  const requiredSurfaceIds = [
    "hosted_mcp_endpoint",
    "mcp_start",
    "mcp_adoption_kit",
    "mcp_agent_host_rollout",
    "mcp_install_matrix",
    "mcp_install_actions",
    "mcp_first_run_actions",
    "mcp_reviewer_activation",
    "mcp_client_config",
    "mcp_usage_snapshot",
    "mcp_funnel_snapshot",
    "mcp_ga4_funnel_proof",
    "mcp_source_activation_queue",
    "mcp_visitor_growth_queue",
    "mcp_revenue_conversion_queue",
    "mcp_activation_experiments",
    "mcp_external_activation_brief",
    "buyer_mcp_use_cases",
    "mcp_cart_activation",
    "mcp_first_run_proof",
    "mcp_workflow_gallery",
    "mcp_automation_workflows",
    "mcp_eval_pack",
    "browser_agent_bridge",
    "chatgpt_openai_product_cards",
    "shopify_native_ucp",
    "claude_desktop_and_claude_code",
    "cursor_windsurf_vscode",
    "codex_remote_mcp",
    "glama_hosted_connector",
    "official_mcp_registry",
    "mcp_marketplace",
    "llms_txt_and_full_corpus",
    "root_agents_md",
    "ai_product_corpus",
    "measured_handoff_directory",
    "cart_handoff_candidates",
    "browser_agent_bridge",
    "browserbase_browse_candidate",
    "mcp_directory_refreshes",
    "mcp_directory_submit_actions",
    "agent_capture_outreach_packet",
    "claude_connector_submission_packet",
    "search_and_answer_crawlers",
  ];
  const missingSurfaceIds = requiredSurfaceIds.filter((id) => !surfaceIds.has(id));
  const resources = resourcesResult.value?.result?.resources ?? [];
  const resourceUris = new Set(resources.map((row) => row.uri));
  const resourceTemplates = resourceTemplatesResult.value?.result?.resourceTemplates ?? [];
  const resourceTemplateUris = new Set(resourceTemplates.map((row) => row.uriTemplate));
  const coreSurface = capture?.surfaces?.find((row) => row.id === "hosted_mcp_endpoint");
  const browseSurface = capture?.surfaces?.find((row) => row.id === "browserbase_browse_candidate");
  const clientConfig = clientConfigResult.value;
  const directoryRefresh = directoryRefreshResult.value;
  const directorySubmitActions = directorySubmitActionsResult.value;
  const visitorGrowth = visitorGrowthResult.value;
  const outreach = outreachResult.value;
  const outreachText = JSON.stringify(outreach ?? {});
  const mdNeedles = [
    "Packrift All-Agent Capture Matrix",
    "start page",
    "adoption kit",
    "install matrix",
    "tracked install actions",
    "stdio_mcp_remote",
    "mcp-remote",
    "first-run actions",
    "reviewer activation",
    "shell runners",
    "client config",
    "usage snapshot",
    "funnel snapshot",
    "GA4 proof",
    "source activation queue",
    "visitor growth queue",
    "mcp-visitor-growth-tasks.jsonl",
    "revenue conversion queue",
    "activation experiments",
    "selected external activation brief",
    "mcp-external-activation-brief-tasks.jsonl",
    "agent host rollout",
    "command center",
    "buyer use cases",
    "cart activation",
    "first-run proof",
    "workflow gallery",
    "automation workflows",
    "n8n",
    "Pipedream",
    "eval pack",
    "browser-agent bridge",
    "Browse skill pack",
    "directory refresh",
    "directory submit actions",
    "agent capture outreach",
    "Claude connector submission",
    "tracked start",
    "tracked config",
    "Browserbase Browse",
    "SKILL.md",
    "ChatGPT/OpenAI commerce",
    "Claude",
    "Cursor",
    "LangChain",
    "n8n",
    "MCP Inspector",
    "Glama",
    "Agent Host Fast Paths",
    "source-aware install",
    "Machine-readable version",
  ];

  const checks = [
    check("json route fetch", jsonResult.ok && capture, { detail: `${jsonResult.status} ${jsonResult.url}` }),
    check("markdown route fetch", mdResult.ok && mdResult.text.length > 1000, { detail: `${mdResult.status} ${mdResult.url}` }),
    check("release marker", capture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R30", { detail: capture?.release }),
    check("canonical endpoint", capture?.canonical_endpoint === "https://mcp.packrift.com/mcp", {
      detail: capture?.canonical_endpoint,
    }),
    check("surface coverage", (capture?.surfaces?.length ?? 0) >= 20 && missingSurfaceIds.length === 0, {
      detail: missingSurfaceIds.length ? `missing ${missingSurfaceIds.join(", ")}` : `${capture?.surfaces?.length ?? 0} surfaces`,
    }),
    check("surface ids are unique", duplicateSurfaceIds.length === 0, {
      detail: duplicateSurfaceIds.length ? `duplicates ${duplicateSurfaceIds.join(", ")}` : "unique",
    }),
    check("operating rule blocks duplicate CLI", (capture?.operating_rules ?? []).some((rule) => /separate Packrift CLI/.test(rule)), {
      detail: "duplicate CLI guard",
    }),
    check("operating rule advertises shell activation", (capture?.operating_rules ?? []).some((rule) => /format=sh/.test(rule) && /tools\/call/.test(rule)), {
      detail: "shell activation guard",
    }),
    check(
      "agent host fast paths source-aware",
      capture?.agent_host_fast_paths_release === "PACKRIFT-AGENT-HOST-FAST-PATHS-R03" &&
        capture?.counts?.agent_host_fast_paths >= 60 &&
        capture?.agent_host_fast_paths?.some(
          (row) =>
            row.source === "cline_mcp_marketplace" &&
            row.target === "cline" &&
            row.source_aware_endpoint?.includes("packrift_mcp_source=cline_mcp_marketplace") &&
            row.tracked_first_run_shell_url === "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=sh" &&
            row.order_handoff_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=html" &&
            row.order_handoff_shell_url === "https://mcp.packrift.com/r/order/cline_mcp_marketplace?format=sh" &&
            row.order_handoff_shell_one_liner?.includes("curl -sS") &&
            row.order_handoff_shell_one_liner?.includes("/r/order/cline_mcp_marketplace?format=sh")
        ) &&
        capture?.agent_host_fast_paths?.some(
          (row) =>
            row.source === "browse_sh" &&
            row.source_aware_endpoint ===
              "https://mcp.packrift.com/mcp?packrift_mcp_source=browse_sh&packrift_mcp_target=generic_streamable_http" &&
            row.order_handoff_shell_url === "https://mcp.packrift.com/r/order/browse_sh?format=sh"
        ) &&
        capture?.agent_host_fast_paths?.some(
          (row) =>
            row.source === "pipedream_automation" &&
            row.target === "generic_streamable_http" &&
            row.tracked_first_run_shell_url === "https://mcp.packrift.com/r/run/pipedream_automation/generic_streamable_http?format=sh"
        ) &&
        capture?.agent_host_fast_paths?.some(
          (row) =>
            row.source === "anthropic_connectors_directory" &&
            row.target === "claude_code" &&
            row.source_aware_endpoint ===
              "https://mcp.packrift.com/mcp?packrift_mcp_source=anthropic_connectors_directory&packrift_mcp_target=claude_code"
        ) &&
        capture?.agent_host_fast_paths?.every(
          (row) =>
            row.order_handoff_url?.startsWith("https://mcp.packrift.com/r/order/") &&
            row.order_handoff_shell_url?.startsWith("https://mcp.packrift.com/r/order/") &&
            row.order_handoff_shell_url?.includes("format=sh") &&
            row.order_handoff_shell_one_liner?.includes("curl -sS")
        ) &&
        capture?.agent_host_fast_paths?.some((row) => row.source === "mcp_so" && /order|revenue/i.test(row.success_gate ?? "")),
      { detail: `${capture?.counts?.agent_host_fast_paths ?? 0} fast paths` }
    ),
    check(
      "operating rule advertises expanded runtime inference",
      (capture?.operating_rules ?? []).some(
        (rule) =>
          /OpenAI\/ChatGPT/.test(rule) &&
          /LangChain/.test(rule) &&
          /n8n/.test(rule) &&
          /MCP Inspector/.test(rule) &&
          /Goose/.test(rule) &&
          /major MCP directories/.test(rule)
      ),
      { detail: "runtime inference guard" }
    ),
    check("hosted MCP marked live", coreSurface?.status === "live" && coreSurface?.canonical_url === "https://mcp.packrift.com/mcp", {
      detail: coreSurface?.status,
    }),
    check("resources/list advertises MCP start", hasResourceUri(resourceUris, "/start") && hasResourceUri(resourceUris, "/ai/mcp-start.json") && hasResourceUri(resourceUris, "/ai/mcp-start.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("Browserbase Browse is live after verified catalog install", browseSurface?.status === "live", {
      detail: browseSurface?.status,
    }),
    check(
      "major ready clients use source-aware install text",
      capture?.surfaces?.some((row) => row.id === "claude_desktop_and_claude_code" && row.install_or_call?.includes("packrift_mcp_source=claude_remote_mcp")) &&
        capture?.surfaces?.some((row) => row.id === "cursor_windsurf_vscode" && row.install_or_call?.includes("packrift_mcp_source=cursor_directory")) &&
        capture?.surfaces?.some((row) => row.id === "codex_remote_mcp" && row.install_or_call?.includes("packrift_mcp_source=codex_remote_mcp")) &&
        browseSurface?.install_or_call?.includes("packrift_mcp_source=browse_sh"),
      { detail: "source-aware client rows" }
    ),
    check("markdown contains agent surface labels", mdResult.ok && hasAll(mdResult.text, mdNeedles), {
      detail: mdNeedles.filter((needle) => !mdResult.text.includes(needle)).join(", ") || "all present",
    }),
    check("health still current", healthResult.value?.tools_count >= 15 && healthResult.value?.resources_count >= 70, {
      detail: `tools=${healthResult.value?.tools_count ?? 0}, resources=${healthResult.value?.resources_count ?? 0}`,
    }),
    check("resources/list advertises capture routes", hasResourceUri(resourceUris, "/ai/all-agent-capture.json") && hasResourceUri(resourceUris, "/ai/all-agent-capture.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises agent host rollout", hasResourceUri(resourceUris, "/ai/mcp-agent-host-rollout.json") && hasResourceUri(resourceUris, "/ai/mcp-agent-host-rollout.md") && hasResourceUri(resourceUris, "/ai/mcp-agent-host-rollout.html") && hasResourceUri(resourceUris, "/ai/mcp-agent-host-rollout-tasks.jsonl") && hasResourceUri(resourceUris, "/ai/mcp-agent-host-rollout-tasks.csv"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "agent host rollout flat task exports are importable",
      agentHostRolloutTasksJsonlResult.ok &&
        agentHostRolloutTasksCsvResult.ok &&
        agentHostRolloutTasksJsonlResult.text.includes('"source":"cline_mcp_marketplace"') &&
        agentHostRolloutTasksJsonlResult.text.includes('"tracked_first_run_shell_url"') &&
        agentHostRolloutTasksJsonlResult.text.includes('"no_duplicate_work_rule"') &&
        agentHostRolloutTasksCsvResult.text.startsWith("release,generated_at,rank,source,preferred_target") &&
        agentHostRolloutTasksCsvResult.text.includes("cline_mcp_marketplace"),
      { detail: `jsonl=${agentHostRolloutTasksJsonlResult.ok}, csv=${agentHostRolloutTasksCsvResult.ok}` }
    ),
    check("resources/list advertises adoption kit", hasResourceUri(resourceUris, "/ai/mcp-adoption-kit.json") && hasResourceUri(resourceUris, "/ai/mcp-adoption-kit.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises install matrix", hasResourceUri(resourceUris, "/ai/mcp-install-matrix.json") && hasResourceUri(resourceUris, "/ai/mcp-install-matrix.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises tracked install actions", hasResourceUri(resourceUris, "/ai/mcp-install-actions.json") && hasResourceUri(resourceUris, "/ai/mcp-install-actions.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises tracked first-run actions", hasResourceUri(resourceUris, "/ai/mcp-first-run-actions.json") && hasResourceUri(resourceUris, "/ai/mcp-first-run-actions.md") && hasResourceUri(resourceUris, "/r/run/generic/generic_streamable_http"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "resources/list advertises source-specific activation runners",
        resourceUris.has("https://mcp.packrift.com/r/run/mcp_so/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/order/mcp_so?format=md") &&
        resourceUris.has("https://mcp.packrift.com/r/run/codex_remote_mcp/codex?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/claude_remote_mcp/claude_code?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/openai_chatgpt/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/langchain_agent/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/n8n_automation/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/mcp_inspector/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/browse_sh/generic_streamable_http?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/run/browse_sh/codex?format=md") &&
        resourceUris.has("https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=sh") &&
        resourceUris.has("https://mcp.packrift.com/r/config/anthropic_connectors_directory"),
      { detail: `resources=${resources.length}` }
    ),
    check(
      "resources/templates advertises source-specific activation runners",
      resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}") &&
        resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}?format=sh") &&
        resourceTemplateUris.has("https://mcp.packrift.com/r/run/{source}/{target}?execute=1&format=json") &&
        resourceTemplateUris.has("https://mcp.packrift.com/r/activate/{source}?format=sh") &&
        resourceTemplateUris.has("https://mcp.packrift.com/r/order/{source}"),
      { detail: `templates=${resourceTemplates.length}` }
    ),
    check("resources/list advertises reviewer activation", hasResourceUri(resourceUris, "/ai/mcp-reviewer-activation.json") && hasResourceUri(resourceUris, "/ai/mcp-reviewer-activation.md") && hasResourceUri(resourceUris, "/r/activate/generic") && hasResourceUri(resourceUris, "/r/activate/generic?format=html") && hasResourceUri(resourceUris, "/r/activate/generic?format=sh"), {
      detail: `resources=${resources.length}`,
    }),
    check("hub advertises reviewer shell activation", capture?.hub_urls?.tracked_reviewer_activation_shell_runner_generic === "https://mcp.packrift.com/r/activate/generic?format=sh", {
      detail: capture?.hub_urls?.tracked_reviewer_activation_shell_runner_generic,
    }),
    check("resources/list advertises client config", hasResourceUri(resourceUris, "/mcp.json") && hasResourceUri(resourceUris, "/.well-known/mcp.json") && hasResourceUri(resourceUris, "/r/config/generic") && hasResourceUri(resourceUris, "/ai/mcp-client-config.json") && hasResourceUri(resourceUris, "/ai/mcp-client-config.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises legacy AI discovery", hasResourceUri(resourceUris, "/openapi.json") && hasResourceUri(resourceUris, "/.well-known/openapi.json") && hasResourceUri(resourceUris, "/ai-plugin.json") && hasResourceUri(resourceUris, "/.well-known/ai-plugin.json"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "public activation packets advertise legacy discovery",
      clientConfig?.aliases?.openapi_json === "https://mcp.packrift.com/openapi.json" &&
        clientConfig?.aliases?.ai_plugin_json === "https://mcp.packrift.com/ai-plugin.json" &&
        clientConfig?.legacy_ai_discovery?.well_known_openapi_json === "https://mcp.packrift.com/.well-known/openapi.json" &&
        directoryRefresh?.canonical_listing?.openapi_json === "https://mcp.packrift.com/openapi.json" &&
        directoryRefresh?.live_proof?.ai_plugin_json === "https://mcp.packrift.com/ai-plugin.json" &&
        /openapi\.json/.test(directoryRefresh?.recrawl_request ?? "") &&
        directorySubmitActions?.source_openapi_json === "https://mcp.packrift.com/openapi.json" &&
        directorySubmitActions?.source_ai_plugin_json === "https://mcp.packrift.com/ai-plugin.json" &&
        /openapi\.json/.test(directorySubmitActions?.actions?.find((row) => row.id === "mcp_directory")?.concise_email?.body ?? "") &&
        outreach?.evidence?.openapi_json === "https://mcp.packrift.com/openapi.json" &&
        /ai-plugin\.json/.test(outreachText),
      {
        detail:
          clientConfigResult.ok && directoryRefreshResult.ok && directorySubmitActionsResult.ok && outreachResult.ok
            ? `client=${clientConfig?.release}, refresh=${directoryRefresh?.release}, actions=${directorySubmitActions?.release}, outreach=${outreach?.release}`
            : "one or more public packets failed to fetch",
      }
    ),
    check("resources/list advertises usage snapshot", hasResourceUri(resourceUris, "/ai/mcp-usage-snapshot.json") && hasResourceUri(resourceUris, "/ai/mcp-usage-snapshot.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises funnel snapshot", hasResourceUri(resourceUris, "/ai/mcp-funnel-snapshot.json") && hasResourceUri(resourceUris, "/ai/mcp-funnel-snapshot.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises GA4 funnel proof", hasResourceUri(resourceUris, "/ai/mcp-ga4-funnel-proof.json") && hasResourceUri(resourceUris, "/ai/mcp-ga4-funnel-proof.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises source activation queue", hasResourceUri(resourceUris, "/ai/mcp-source-activation-queue.json") && hasResourceUri(resourceUris, "/ai/mcp-source-activation-queue.md") && hasResourceUri(resourceUris, "/ai/mcp-source-activation-queue.html") && hasResourceUri(resourceUris, "/ai/mcp-source-activation-sitemap.xml") && hasResourceUri(resourceUris, "/r/activate"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "resources/list advertises visitor growth queue",
      hasResourceUri(resourceUris, "/ai/mcp-visitor-growth-queue.json") &&
        hasResourceUri(resourceUris, "/ai/mcp-visitor-growth-queue.md") &&
        hasResourceUri(resourceUris, "/ai/mcp-visitor-growth-queue.html") &&
        hasResourceUri(resourceUris, "/ai/mcp-visitor-growth-tasks.jsonl") &&
        hasResourceUri(resourceUris, "/ai/mcp-visitor-growth-tasks.csv"),
      { detail: `resources=${resources.length}` }
    ),
    check(
      "visitor growth queue is importable and non-duplicative",
      visitorGrowth?.release === "PACKRIFT-MCP-VISITOR-GROWTH-QUEUE-R01" &&
        visitorGrowth?.proof_summary?.ga4_qualified_external_mcp_sessions?.threshold >= 1000 &&
        visitorGrowth?.tasks?.some((row) => row.lane === "qualified_visitor_growth" && row.tracked_start_url?.includes("/r/start/")) &&
        visitorGrowth?.tasks?.some((row) => row.lane === "buyer_order_conversion" && /order|checkout/i.test(row.success_gate ?? "")) &&
        visitorGrowth?.operating_rules?.some((rule) => /duplicate/.test(rule)) &&
        visitorGrowthTasksJsonlResult.ok &&
        visitorGrowthTasksJsonlResult.text.includes('"no_duplicate_work_rule"') &&
        visitorGrowthTasksCsvResult.ok &&
        visitorGrowthTasksCsvResult.text.startsWith("release,generated_at,rank,task_id,source"),
      { detail: visitorGrowthResult.ok ? `${visitorGrowth?.task_count ?? 0} visitor tasks` : "visitor queue failed" }
    ),
    check("resources/list advertises revenue conversion queue", hasResourceUri(resourceUris, "/ai/mcp-revenue-conversion-queue.json") && hasResourceUri(resourceUris, "/ai/mcp-revenue-conversion-queue.md") && hasResourceUri(resourceUris, "/ai/mcp-revenue-conversion-queue.html"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises buyer order handoffs", hasResourceUri(resourceUris, "/ai/mcp-buyer-order-handoffs.json") && hasResourceUri(resourceUris, "/ai/mcp-buyer-order-handoffs.md") && hasResourceUri(resourceUris, "/ai/mcp-buyer-order-handoffs.html") && hasResourceUri(resourceUris, "/ai/mcp-buyer-order-handoffs-tasks.jsonl") && hasResourceUri(resourceUris, "/ai/mcp-buyer-order-handoffs-tasks.csv"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises activation experiments", hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.json") && hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.md") && hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.html"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "all-agent capture advertises selected external activation brief",
      capture?.surfaces?.some(
        (row) =>
          row.id === "mcp_external_activation_brief" &&
          row.canonical_url === "https://mcp.packrift.com/ai/mcp-external-activation-brief.json" &&
          row.install_or_call?.includes("create_cart_url") &&
          row.install_or_call?.includes("https://mcp.packrift.com/mcp") &&
          row.proof_url === "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.jsonl"
      ) &&
        capture?.hub_urls?.external_activation_brief_tasks_jsonl === "https://mcp.packrift.com/ai/mcp-external-activation-brief-tasks.jsonl" &&
        capture?.hub_urls?.external_activation_brief_runner_shell === "https://mcp.packrift.com/ai/mcp-external-activation-brief-runner.sh" &&
        (capture?.operating_rules ?? []).some((rule) => /mcp-external-activation-brief-tasks\.jsonl/.test(rule) && /create_cart_url/.test(rule)),
      { detail: "selected task queue linked" }
    ),
    check("resources/list advertises activation wave exports", hasResourceUri(resourceUris, "/ai/mcp-activation-wave.json") && hasResourceUri(resourceUris, "/ai/mcp-activation-wave.md") && hasResourceUri(resourceUris, "/ai/mcp-activation-wave.html") && hasResourceUri(resourceUris, "/ai/mcp-activation-wave-tasks.jsonl") && hasResourceUri(resourceUris, "/ai/mcp-activation-wave-tasks.csv") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief.json") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief.md") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief.html") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief-tasks.jsonl") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief-tasks.csv") && hasResourceUri(resourceUris, "/ai/mcp-external-activation-brief-runner.sh"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises buyer use cases", hasResourceUri(resourceUris, "/ai/mcp-buyer-use-cases.json") && hasResourceUri(resourceUris, "/ai/mcp-buyer-use-cases.md") && hasResourceUri(resourceUris, "/ai/mcp-buyer-use-cases.html"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises cart activation", hasResourceUri(resourceUris, "/ai/mcp-cart-activation.json") && hasResourceUri(resourceUris, "/ai/mcp-cart-activation.md") && hasResourceUri(resourceUris, "/ai/mcp-cart-activation.html"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises agent adoption progress", hasResourceUri(resourceUris, "/ai/mcp-agent-adoption-progress.json") && hasResourceUri(resourceUris, "/ai/mcp-agent-adoption-progress.md") && hasResourceUri(resourceUris, "/ai/mcp-agent-adoption-progress.html"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises first-run proof", hasResourceUri(resourceUris, "/ai/mcp-first-run-proof.json") && hasResourceUri(resourceUris, "/ai/mcp-first-run-proof.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises workflow gallery", hasResourceUri(resourceUris, "/ai/mcp-workflow-gallery.json") && hasResourceUri(resourceUris, "/ai/mcp-workflow-gallery.md") && hasResourceUri(resourceUris, "/ai/mcp-workflow-gallery.html"), {
      detail: `resources=${resources.length}`,
    }),
    check(
      "resources/list advertises automation workflows",
      hasResourceUri(resourceUris, "/ai/mcp-automation-workflows.json") &&
        hasResourceUri(resourceUris, "/ai/mcp-automation-workflows.md") &&
        hasResourceUri(resourceUris, "/ai/mcp-automation-workflows.html") &&
        hasResourceUri(resourceUris, "/ai/mcp-n8n-workflow.json"),
      { detail: `resources=${resources.length}` }
    ),
    check("resources/list advertises eval pack", hasResourceUri(resourceUris, "/ai/mcp-eval-pack.json") && hasResourceUri(resourceUris, "/ai/mcp-eval-pack.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises browser-agent bridge", hasResourceUri(resourceUris, "/ai/browser-agent-bridge.json") && hasResourceUri(resourceUris, "/ai/browser-agent-bridge.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises Browserbase Browse skill pack", hasResourceUri(resourceUris, "/ai/browserbase-browse-skill-pack.json") && hasResourceUri(resourceUris, "/ai/browserbase-browse-skill-pack.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises Browserbase Browse SKILL.md", hasResourceUri(resourceUris, "/SKILL.md") && hasResourceUri(resourceUris, "/ai/browserbase-browse/SKILL.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises directory refresh pack", hasResourceUri(resourceUris, "/ai/mcp-directory-refresh.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-refresh.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises directory submit actions", hasResourceUri(resourceUris, "/ai/mcp-directory-submit-actions.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-submit-actions.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises source-specific directory update cards", hasResourceUri(resourceUris, "/ai/mcp-directory-update/cline_mcp_marketplace.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/cline_mcp_marketplace.md") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/mcp_so.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/mcp_so.md") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/punkpeye_awesome_mcp.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/punkpeye_awesome_mcp.md") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/browse_sh.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/browse_sh.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises agent capture outreach", hasResourceUri(resourceUris, "/ai/agent-capture-outreach.json") && hasResourceUri(resourceUris, "/ai/agent-capture-outreach.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises Claude connector submission", hasResourceUri(resourceUris, "/ai/claude-connector-submission.json") && hasResourceUri(resourceUris, "/ai/claude-connector-submission.md"), {
      detail: `resources=${resources.length}`,
    }),
  ];

  const generatedAt = new Date().toISOString();
  const outDir = resolve(OUT_ROOT, generatedAt.replace(/[:.]/g, "-"));
  mkdirSync(outDir, { recursive: true });
  const payload = {
    generated_at: generatedAt,
    base_url: BASE_URL,
    mcp_endpoint: MCP_ENDPOINT,
    ok: checks.every((row) => row.ok),
    checks,
  };
  writeFileSync(resolve(outDir, "agent-capture-check.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(outDir, "agent-capture-check.md"), markdownReport(payload));
  writeFileSync(resolve(OUT_ROOT, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  writeFileSync(resolve(OUT_ROOT, "latest.md"), markdownReport(payload));
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
