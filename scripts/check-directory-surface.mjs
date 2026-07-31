#!/usr/bin/env node
/**
 * Directory-surface lint for the public MCP surface (tools, prompts, instructions).
 *
 * Enforces the Anthropic MCP directory review rules that got the listing bounced
 * on 2026-07-31, so they can never silently regress:
 *   1. No internal QA / test scaffolding params in public tool schemas.
 *   2. Assistant-neutral, jargon-free descriptions (no cross-assistant steering,
 *      no "sales test" / pilot language, no internal gate names).
 *   3. The public tool list exactly matches the declared submission list below.
 *
 * Modes:
 *   node scripts/check-directory-surface.mjs           # lint the local build (dist/)
 *   node scripts/check-directory-surface.mjs --live    # lint the live server surface too
 */

const LIVE = process.argv.includes("--live");
const LIVE_ENDPOINT = "https://mcp.packrift.com/mcp";

// The declared public tool list. This is the single source of truth that the
// directory submission, README, and live server must all agree with.
export const DECLARED_TOOLS = [
  "search_products",
  "get_product",
  "get_pricing",
  "check_inventory",
  "find_packaging_for_item",
  "get_shipping_estimate",
  "get_cart_handoff_candidates",
  "create_cart_url",
  "prepare_purchase_handoff",
  "compare_alternatives",
  "pack_calculator",
  "inventory_status",
  "get_reorder_link",
  "get_bulk_quote_link",
  "explain_no_exact_match",
];

// Params that must never appear in a public inputSchema. The server may still
// accept some of them at the zod layer for backward compatibility with older
// callers and internal QA scripts, but they are not part of the public contract.
const BANNED_PARAMS = [
  "suppress_analytics",
  "analytics_context",
  "mcp_source_context",
  "packrift_mcp_source",
  "mcp_source",
  "source_slug",
  "mcp_install_target",
  "packrift_mcp_target",
  "mcp_target",
  "packrift_ai_id",
  "ai_commerce_id",
  "reorder_source",
  "utm_term",
  "ref",
];

// Phrases that must never appear in public tool/prompt/instructions text.
// Cross-assistant names keep descriptions assistant-neutral; the rest are
// internal jargon or test-scaffolding language.
const BANNED_PHRASES = [
  /sales\s*test/i,
  /\bpilot\b/i,
  /AI_APPROVE/,
  /AI[- ]approved/i,
  /\bgemini\b/i,
  /\bchatgpt\b/i,
  /\bopenai\b/i,
  /\bcopilot\b/i,
  /\bclaude\b/i,
  /internal\s+qa/i,
  /suppress_analytics/i,
  /synthetic\s+eval/i,
];

const failures = [];

function fail(scope, message) {
  failures.push({ scope, message });
}

function checkText(scope, text) {
  if (!text) return;
  for (const pattern of BANNED_PHRASES) {
    const match = String(text).match(pattern);
    if (match) fail(scope, `banned phrase "${match[0]}" in: "${String(text).slice(0, 120)}..."`);
  }
}

function checkToolList(sourceLabel, tools) {
  const names = tools.map((t) => t.name);
  const missing = DECLARED_TOOLS.filter((n) => !names.includes(n));
  const undeclared = names.filter((n) => !DECLARED_TOOLS.includes(n));
  if (missing.length) fail(sourceLabel, `declared tools missing from surface: ${missing.join(", ")}`);
  if (undeclared.length) fail(sourceLabel, `surface exposes undeclared tools: ${undeclared.join(", ")}`);

  for (const tool of tools) {
    const scope = `${sourceLabel}:${tool.name}`;
    if (!tool.title) fail(scope, "missing title");
    if (!tool.description || tool.description.length < 20) fail(scope, "missing or too-short description");
    if (tool.description && tool.description.length > 900) fail(scope, `description too long (${tool.description.length} chars)`);
    if (!tool.annotations || typeof tool.annotations.readOnlyHint !== "boolean") fail(scope, "missing annotations.readOnlyHint");
    checkText(scope, tool.description);
    checkText(scope, tool.title);
    const properties = tool.inputSchema?.properties ?? {};
    for (const [param, def] of Object.entries(properties)) {
      if (BANNED_PARAMS.includes(param)) fail(scope, `banned public param: ${param}`);
      checkText(`${scope}.${param}`, def?.description);
    }
  }
}

async function lintLocalBuild() {
  const { TOOLS, PROMPTS, SERVER_INSTRUCTIONS } = await import("../dist/index.js");
  checkToolList("local", TOOLS.map((t) => t.schema));
  checkText("local:instructions", SERVER_INSTRUCTIONS);
  for (const prompt of PROMPTS) {
    checkText(`local:prompt:${prompt.name}`, prompt.description);
    checkText(`local:prompt:${prompt.name}`, prompt.template);
    for (const arg of prompt.arguments ?? []) checkText(`local:prompt:${prompt.name}.${arg.name}`, arg.description);
  }
}

async function rpc(endpoint, method, params, id, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": "packrift-directory-surface-check/1.0",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const body = { jsonrpc: "2.0", method };
  if (id !== undefined) body.id = id;
  if (params !== undefined) body.params = params;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const newSession = response.headers.get("mcp-session-id");
  const raw = await response.text();
  let payload = raw;
  if (raw && !raw.trimStart().startsWith("{")) {
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) {
        payload = line.slice(5).trim();
        break;
      }
    }
  }
  return { json: payload ? JSON.parse(payload) : null, sessionId: newSession ?? sessionId };
}

async function lintLiveSurface() {
  const init = await rpc(LIVE_ENDPOINT, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "packrift-directory-surface-check", version: "1.0" },
  }, 1);
  checkText("live:instructions", init.json?.result?.instructions);
  const list = await rpc(LIVE_ENDPOINT, "tools/list", {}, 2, init.sessionId);
  const tools = list.json?.result?.tools ?? [];
  if (!tools.length) {
    fail("live", "tools/list returned no tools");
    return;
  }
  checkToolList("live", tools);
  const prompts = await rpc(LIVE_ENDPOINT, "prompts/list", {}, 3, init.sessionId);
  for (const prompt of prompts.json?.result?.prompts ?? []) {
    checkText(`live:prompt:${prompt.name}`, prompt.description);
  }
}

await lintLocalBuild();
if (LIVE) await lintLiveSurface();

const summary = {
  generated_at: new Date().toISOString(),
  mode: LIVE ? "local+live" : "local",
  declared_tool_count: DECLARED_TOOLS.length,
  ok: failures.length === 0,
  failures,
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) {
  console.error(`\nDirectory surface check FAILED with ${failures.length} issue(s).`);
  process.exit(1);
}
console.error("\nDirectory surface check passed.");
