#!/usr/bin/env node
// Real-usage report for Packrift MCP. Every event lands in one bucket: real
// assistant use, automation (scripted clients, tests, monitors), directory
// probes, activation-link runs, or crawlers. The headline counts only real
// assistant use: tool calls by assistant and tool, checkout links opened, and
// searches with no exact match (demand Packrift does not carry).
//   node scripts/usage-report.mjs [--days 7] [--out report.md]
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (for example from .env.cloudflare.local).
import { writeFileSync } from "node:fs";

const NAMESPACE = "c5aa45b19ebe4520b81ad219ba054443";
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const days = Math.max(1, Math.min(90, Number.parseInt(flag("days", "7"), 10)));
const out = flag("out", null);
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) throw new Error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${NAMESPACE}`;
const auth = { Authorization: `Bearer ${token}` };

const CRAWLER = /bot\b|bot\/|crawl|spider|slurp|semrush|ahrefs|bytespider|amazonbot|petalbot|facebookexternalhit|censys|expanse|zgrab|masscan/i;
// Scripted HTTP clients, test harnesses and our own monitors. A session that identified a known
// assistant at initialize (pk1.<assistant>.<id>) counts as that assistant whatever its HTTP client.
const AUTOMATION = /python-httpx|python-urllib|python-requests|aiohttp|\bhttpx\b|^node|undici|axios|node-fetch|curl\/|wget|go-http-client|okhttp|^java\/|libwww|postman|insomnia|packrift|codex|openclaw|hermes|smoke|\bqa\b|test|monitor|uptime|audit|github-actions/i;
const DIRECTORY = /glama|probe|scanner|catalog|scout|snapshot|scoring|health|inspect|registry|gateway|marketplace|pipeline|mcphub|smithery|pulsemcp|mcp\.so|mcpfinder|agentndx|directory|crew/i;
const ASSISTANT_SLUGS = /^(claude|claude_code|chatgpt|openai|codex|cursor|windsurf|vscode|cline|gemini|muse|zed|goose|continue|raycast|perplexity|copilot)/;
const EVENT_TYPES = new Set(["mcp_tool_call", "mcp_initialize", "mcp_cart_landing", "no_match", "spec_search"]);

async function listKeys(prefix) {
  const keys = [];
  let cursor = "";
  do {
    const params = new URLSearchParams({ prefix, limit: "1000", ...(cursor ? { cursor } : {}) });
    const res = await fetch(`${base}/keys?${params}`, { headers: auth });
    const body = await res.json();
    keys.push(...body.result.map((k) => k.name));
    cursor = body.result_info?.cursor ?? "";
  } while (cursor);
  return keys;
}

async function getValue(key, attempt = 0) {
  try {
    const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers: auth });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch (error) {
    if (attempt >= 3) return null;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    return getValue(key, attempt + 1);
  }
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    })
  );
  return results;
}

const ASSISTANT_NAMES = /claude|chatgpt|openai|cursor|windsurf|vscode|visual studio|copilot|cline|gemini|zed|goose|continue|raycast|perplexity|muse/i;

/** The assistant a session identified at initialize (pk1.<assistant>.<id>), or a checkout link's source. */
function sessionAssistant(event) {
  const sid = String(event.mcp_session_id ?? event.session_id ?? "");
  const slug = sid.match(/^pk1\.([a-z0-9_]+)\./)?.[1] ?? event.client_slug ?? (event.source === "v1_checkout_link" ? event.utm_source : null) ?? null;
  if (slug && ASSISTANT_SLUGS.test(slug) && !/codex_remote_mcp|plugin_sim/.test(slug)) return slug;
  const name = String(event.client_name ?? "");
  if (event.event === "mcp_initialize" && ASSISTANT_NAMES.test(name) && !DIRECTORY.test(name)) return name;
  return null;
}

/**
 * One bucket per event. Only identified assistants count as real use; everything else is
 * explained: activation-link runs, automation, directory probes, crawlers, people or crawlers
 * opening Packrift links on web pages, and unidentified clients.
 */
const SESSION_BUCKET = new Map();

function bucketOf(event) {
  const inherited = SESSION_BUCKET.get(String(event.mcp_session_id ?? ""));
  if (inherited && event.event !== "mcp_initialize") return inherited;
  const ua = String(event.user_agent ?? "");
  const tags = `${event.utm_medium ?? ""} ${event.utm_campaign ?? ""} ${event.source ?? ""} ${event.mcp_source_context ?? ""}`;
  const name = String(event.client_name ?? "");
  if (/first_run|activation|synthetic|tracked-run/i.test(`${tags} ${event.mcp_session_id ?? ""}`)) return "activation";
  if (/packrift_plugin_sim|e2e|smoke/i.test(`${tags} ${event.utm_source ?? ""} ${event.mcp_session_id ?? ""}`)) return "automation";
  if (DIRECTORY.test(name)) return "directory";
  if (sessionAssistant(event)) return "assistant";
  if (CRAWLER.test(ua) || (event.bot_family && !["browser_or_unknown", "generic_mcp_client"].includes(event.bot_family))) return "crawler";
  if (DIRECTORY.test(name) || DIRECTORY.test(ua) || event.bot_family === "generic_mcp_client" || /collector|monitor|oracle|beat|audit/i.test(`${name} ${ua}`)) return "directory";
  if (AUTOMATION.test(ua) || AUTOMATION.test(name)) return "automation";
  if (event.source === "mcp_route_redirect" || (event.event === "mcp_tool_call" && /create_cart_url/.test(event.utm_campaign ?? ""))) return "web_link";
  return "unidentified";
}

function clientOf(event) {
  return sessionAssistant(event) || event.client_name || event.client_slug || (String(event.user_agent ?? "").split("/")[0] || "unknown");
}

const counter = () => new Map();
const bump = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const top = (map, n = 15) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

const today = new Date();
const dayKeys = [];
for (let d = 0; d < days; d += 1) {
  const day = new Date(today.getTime() - d * 86_400_000).toISOString().slice(0, 10);
  dayKeys.push(...(await listKeys(`events/ai-sales/${day}/`)));
}
const events = (await mapLimit(dayKeys, 20, (key) => getValue(key))).filter((e) => e && EVENT_TYPES.has(e.event));
// Sessions take the bucket of their initialize event (a directory scout stays a directory scout).
for (const e of events) if (e.event === "mcp_initialize" && e.mcp_session_id) SESSION_BUCKET.set(String(e.mcp_session_id), bucketOf(e));
const buckets = counter();
const bucketCalls = counter();
for (const e of events) {
  const b = bucketOf(e);
  bump(buckets, b);
  if (e.event === "mcp_tool_call") bump(bucketCalls, b);
}
const real = events.filter((e) => bucketOf(e) === "assistant");

const byClient = counter();
const byTool = counter();
const byDay = counter();
const noMatch = counter();
const initByClient = counter();
let landings = 0;
for (const e of real) {
  if (e.event === "mcp_tool_call") {
    bump(byClient, clientOf(e));
    bump(byTool, e.tool_name ?? "unknown");
    bump(byDay, String(e.received_at ?? "").slice(0, 10));
  } else if (e.event === "mcp_initialize") {
    bump(initByClient, e.client_name || clientOf(e));
  } else if (e.event === "mcp_cart_landing") {
    landings += 1;
  } else if (e.event === "no_match" && e.query) {
    bump(noMatch, String(e.query).toLowerCase());
  }
}

const table = (rows, headers) => [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const report = [
  `# Packrift MCP usage, last ${days} day${days === 1 ? "" : "s"}`,
  "",
  `Generated ${new Date().toISOString()}. ${events.length} tracked events; ${real.length} from real assistant use.`,
  "",
  `- Real assistant tool calls: **${[...byTool.values()].reduce((a, b) => a + b, 0)}**`,
  `- Checkout links opened from real use: **${landings}**`,
  `- Assistants that connected: ${top(initByClient).map(([k, v]) => `${k} (${v})`).join(", ") || "none"}`,
  "",
  "## Where the other traffic came from",
  table(
    ["activation", "automation", "web_link", "crawler", "directory", "unidentified"].map((b) => [b, String(buckets.get(b) ?? 0), String(bucketCalls.get(b) ?? 0)]),
    ["bucket", "events", "tool calls"]
  ),
  "",
  "Activation is the retired activation-link runs. Automation is scripted clients, tests and monitors. Web link is people or crawlers opening Packrift links on web pages. Directory is listing sites checking the server. Unidentified clients did not say which assistant they are.",
  "",
  "## Tool calls by assistant",
  table(top(byClient).map(([k, v]) => [k, String(v)]), ["assistant", "calls"]),
  "",
  "## Tool calls by tool",
  table(top(byTool).map(([k, v]) => [k, String(v)]), ["tool", "calls"]),
  "",
  "## Tool calls by day",
  table([...byDay.entries()].sort().map(([k, v]) => [k, String(v)]), ["day", "calls"]),
  "",
  "## Searches with no exact match (demand to consider stocking)",
  table(top(noMatch, 25).map(([k, v]) => [k, String(v)]), ["search", "times"]),
  "",
].join("\n");
console.log(report);
if (out) writeFileSync(out, report);
