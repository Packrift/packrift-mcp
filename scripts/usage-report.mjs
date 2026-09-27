#!/usr/bin/env node
// Real-usage report for Packrift MCP: tool calls by assistant and tool,
// checkout links opened, and searches with no exact match (demand Packrift
// does not carry). Excludes crawlers, internal scripts and activation-link runs.
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

const CRAWLER = /bot|crawl|spider|slurp|semrush|ahrefs|bytespider|amazonbot|petalbot|facebookexternalhit|python-requests|curl\/|wget|audit|census|packrift-|packriftqa|monitor|uptime/i;
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

async function getValue(key) {
  const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers: auth });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
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

function isReal(event) {
  const ua = String(event.user_agent ?? "");
  if (CRAWLER.test(ua)) return false;
  if (/first_run|activation|smoke|synthetic/i.test(`${event.utm_medium ?? ""} ${event.utm_campaign ?? ""} ${event.source ?? ""}`)) return false;
  return true;
}

function clientOf(event) {
  return event.client_slug || event.utm_source || event.mcp_source_context || (String(event.user_agent ?? "").split("/")[0] || "unknown");
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
const events = (await mapLimit(dayKeys, 40, getValue)).filter((e) => e && EVENT_TYPES.has(e.event));
const real = events.filter(isReal);

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
  `Generated ${new Date().toISOString()}. ${events.length} tracked events, ${real.length} after removing crawlers, internal scripts and activation-link runs.`,
  "",
  `- Real tool calls: **${[...byTool.values()].reduce((a, b) => a + b, 0)}**`,
  `- Checkout links opened: **${landings}**`,
  `- Assistants that connected: ${top(initByClient).map(([k, v]) => `${k} (${v})`).join(", ") || "none"}`,
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
