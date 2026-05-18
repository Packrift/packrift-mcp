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
const TEXT_HEADERS = {
  "User-Agent": "Packrift-Agent-Capture-Check/1.0 (+https://mcp.packrift.com/ai/all-agent-capture.json)",
  Accept: "application/json,text/markdown,text/plain;q=0.9,*/*;q=0.8",
};

async function fetchText(url) {
  try {
    const response = await fetch(url, { headers: TEXT_HEADERS, redirect: "follow" });
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
  const [jsonResult, mdResult, healthResult, resourcesResult] = await Promise.all([
    fetchJson(jsonUrl),
    fetchText(mdUrl),
    fetchJson(`${BASE_URL}/health`),
    fetchMcp("resources/list"),
  ]);

  const capture = jsonResult.value;
  const surfaceIds = new Set((capture?.surfaces ?? []).map((row) => row.id));
  const requiredSurfaceIds = [
    "hosted_mcp_endpoint",
    "mcp_adoption_kit",
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
    "browserbase_browse_candidate",
    "mcp_directory_refreshes",
    "search_and_answer_crawlers",
  ];
  const missingSurfaceIds = requiredSurfaceIds.filter((id) => !surfaceIds.has(id));
  const resources = resourcesResult.value?.result?.resources ?? [];
  const resourceUris = new Set(resources.map((row) => row.uri));
  const coreSurface = capture?.surfaces?.find((row) => row.id === "hosted_mcp_endpoint");
  const browseSurface = capture?.surfaces?.find((row) => row.id === "browserbase_browse_candidate");
  const mdNeedles = [
    "Packrift All-Agent Capture Matrix",
    "adoption kit",
    "Browserbase Browse",
    "ChatGPT/OpenAI commerce",
    "Claude",
    "Cursor",
    "Glama",
    "Machine-readable version",
  ];

  const checks = [
    check("json route fetch", jsonResult.ok && capture, { detail: `${jsonResult.status} ${jsonResult.url}` }),
    check("markdown route fetch", mdResult.ok && mdResult.text.length > 1000, { detail: `${mdResult.status} ${mdResult.url}` }),
    check("release marker", capture?.release === "PACKRIFT-ALL-AGENT-CAPTURE-R01", { detail: capture?.release }),
    check("canonical endpoint", capture?.canonical_endpoint === "https://mcp.packrift.com/mcp", {
      detail: capture?.canonical_endpoint,
    }),
    check("surface coverage", (capture?.surfaces?.length ?? 0) >= 17 && missingSurfaceIds.length === 0, {
      detail: missingSurfaceIds.length ? `missing ${missingSurfaceIds.join(", ")}` : `${capture?.surfaces?.length ?? 0} surfaces`,
    }),
    check("operating rule blocks duplicate CLI", (capture?.operating_rules ?? []).some((rule) => /separate Packrift CLI/.test(rule)), {
      detail: "duplicate CLI guard",
    }),
    check("hosted MCP marked live", coreSurface?.status === "live" && coreSurface?.canonical_url === "https://mcp.packrift.com/mcp", {
      detail: coreSurface?.status,
    }),
    check("Browserbase Browse remains candidate", browseSurface?.status === "candidate", {
      detail: browseSurface?.status,
    }),
    check("markdown contains agent surface labels", mdResult.ok && hasAll(mdResult.text, mdNeedles), {
      detail: mdNeedles.filter((needle) => !mdResult.text.includes(needle)).join(", ") || "all present",
    }),
    check("health still current", healthResult.value?.tools_count >= 14 && healthResult.value?.resources_count >= 70, {
      detail: `tools=${healthResult.value?.tools_count ?? 0}, resources=${healthResult.value?.resources_count ?? 0}`,
    }),
    check("resources/list advertises capture routes", resourceUris.has(jsonUrl) && resourceUris.has(mdUrl), {
      detail: `resources=${resources.length}`,
    }),
    check("resources/list advertises adoption kit", resourceUris.has(`${BASE_URL}/ai/mcp-adoption-kit.json`) && resourceUris.has(`${BASE_URL}/ai/mcp-adoption-kit.md`), {
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
