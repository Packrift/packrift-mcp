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
  const [jsonResult, mdResult, healthResult, resourcesResult, resourceTemplatesResult] = await Promise.all([
    fetchJson(jsonUrl),
    fetchText(mdUrl),
    fetchJson(`${BASE_URL}/health`),
    fetchMcp("resources/list"),
    fetchMcp("resources/templates/list"),
  ]);

  const capture = jsonResult.value;
  const surfaceIdRows = (capture?.surfaces ?? []).map((row) => row.id);
  const surfaceIds = new Set(surfaceIdRows);
  const duplicateSurfaceIds = Array.from(new Set(surfaceIdRows.filter((id, index) => surfaceIdRows.indexOf(id) !== index)));
  const requiredSurfaceIds = [
    "hosted_mcp_endpoint",
    "mcp_start",
    "mcp_adoption_kit",
    "mcp_install_matrix",
    "mcp_install_actions",
    "mcp_first_run_actions",
    "mcp_reviewer_activation",
    "mcp_client_config",
    "mcp_usage_snapshot",
    "mcp_funnel_snapshot",
    "mcp_ga4_funnel_proof",
    "mcp_source_activation_queue",
    "mcp_activation_experiments",
    "buyer_mcp_use_cases",
    "mcp_cart_activation",
    "mcp_first_run_proof",
    "mcp_workflow_gallery",
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
    "activation experiments",
    "command center",
    "buyer use cases",
    "cart activation",
    "first-run proof",
    "workflow gallery",
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
    "Machine-readable version",
  ];

  const checks = [
    check("json route fetch", jsonResult.ok && capture, { detail: `${jsonResult.status} ${jsonResult.url}` }),
    check("markdown route fetch", mdResult.ok && mdResult.text.length > 1000, { detail: `${mdResult.status} ${mdResult.url}` }),
    check("release marker", capture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R20", { detail: capture?.release }),
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
      "operating rule advertises expanded runtime inference",
      (capture?.operating_rules ?? []).some((rule) => /OpenAI\/ChatGPT/.test(rule) && /LangChain/.test(rule) && /n8n/.test(rule) && /MCP Inspector/.test(rule)),
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
    check("markdown contains agent surface labels", mdResult.ok && hasAll(mdResult.text, mdNeedles), {
      detail: mdNeedles.filter((needle) => !mdResult.text.includes(needle)).join(", ") || "all present",
    }),
    check("health still current", healthResult.value?.tools_count >= 15 && healthResult.value?.resources_count >= 70, {
      detail: `tools=${healthResult.value?.tools_count ?? 0}, resources=${healthResult.value?.resources_count ?? 0}`,
    }),
    check("resources/list advertises capture routes", hasResourceUri(resourceUris, "/ai/all-agent-capture.json") && hasResourceUri(resourceUris, "/ai/all-agent-capture.md"), {
      detail: `resources=${resources.length}`,
    }),
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
        resourceTemplateUris.has("https://mcp.packrift.com/r/activate/{source}?format=sh"),
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
    check("resources/list advertises activation experiments", hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.json") && hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.md") && hasResourceUri(resourceUris, "/ai/mcp-activation-experiments.html"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises buyer use cases", hasResourceUri(resourceUris, "/ai/mcp-buyer-use-cases.json") && hasResourceUri(resourceUris, "/ai/mcp-buyer-use-cases.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises cart activation", hasResourceUri(resourceUris, "/ai/mcp-cart-activation.json") && hasResourceUri(resourceUris, "/ai/mcp-cart-activation.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises first-run proof", hasResourceUri(resourceUris, "/ai/mcp-first-run-proof.json") && hasResourceUri(resourceUris, "/ai/mcp-first-run-proof.md"), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises workflow gallery", hasResourceUri(resourceUris, "/ai/mcp-workflow-gallery.json") && hasResourceUri(resourceUris, "/ai/mcp-workflow-gallery.md"), {
      detail: `resources=${resources.length}`,
    }),
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
    check("resources/list advertises source-specific directory update cards", hasResourceUri(resourceUris, "/ai/mcp-directory-update/cline_mcp_marketplace.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/cline_mcp_marketplace.md") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/mcp_so.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/mcp_so.md") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/browse_sh.json") && hasResourceUri(resourceUris, "/ai/mcp-directory-update/browse_sh.md"), {
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
