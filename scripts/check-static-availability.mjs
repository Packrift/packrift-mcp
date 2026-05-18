#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = resolve(REPO_ROOT, "outputs/static-availability");
const DEFAULT_URLS = ["https://mcp.packrift.com/llms-full.txt"];
const DEFAULT_USER_AGENTS = [
  "ChatGPT-User",
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
];

const args = parseArgs(process.argv.slice(2));
const urls = stringList(args.urls || args.url).length > 0 ? stringList(args.urls || args.url) : DEFAULT_URLS;
const userAgents = stringList(args["user-agents"] || args.ua).length > 0
  ? stringList(args["user-agents"] || args.ua)
  : DEFAULT_USER_AGENTS;
const samplesPerUa = boundedInteger(args["samples-per-ua"], 20, 1, 500);
const concurrency = boundedInteger(args.concurrency, 12, 1, 100);
const timeoutMs = boundedInteger(args["timeout-ms"], 15000, 1000, 120000);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(args["output-dir"] || join(OUT_ROOT, stamp));

const jobs = [];
for (const url of urls) {
  for (const userAgent of userAgents) {
    for (let sample = 1; sample <= samplesPerUa; sample += 1) {
      jobs.push({ url, user_agent: userAgent, sample });
    }
  }
}

const startedAt = Date.now();
const results = await runPool(jobs, concurrency, checkOne);
const summary = summarize(results, {
  generated_at: new Date().toISOString(),
  urls,
  user_agents: userAgents,
  samples_per_ua: samplesPerUa,
  total_expected_fetches: jobs.length,
  concurrency,
  timeout_ms: timeoutMs,
  duration_ms: Date.now() - startedAt,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "static-availability.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "static-availability.md"), markdownReport(summary), "utf8");
if (!args["no-latest"]) {
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(join(OUT_ROOT, "latest.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_ROOT, "latest.md"), markdownReport(summary), "utf8");
}

console.log(JSON.stringify(summary, null, args.json ? 0 : 2));
if (!summary.ok) process.exitCode = 1;

async function checkOne(job) {
  const started = Date.now();
  try {
    const response = await fetch(job.url, {
      headers: {
        "User-Agent": job.user_agent,
        "Cache-Control": "no-cache",
        Accept: "text/plain,application/json,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const contentOk = validateContent(job.url, text);
    return {
      ...job,
      ok: response.ok && contentOk,
      http_ok: response.ok,
      content_ok: contentOk,
      status: response.status,
      latency_ms: Date.now() - started,
      bytes: text.length,
      cache_state: response.headers.get("x-packrift-static-cache")
        || response.headers.get("cf-cache-status")
        || response.headers.get("cache-control")
        || "",
      content_type: response.headers.get("content-type") || "",
      error: "",
    };
  } catch (error) {
    return {
      ...job,
      ok: false,
      http_ok: false,
      content_ok: false,
      status: 0,
      latency_ms: Date.now() - started,
      bytes: 0,
      cache_state: "",
      content_type: "",
      error: error.message || String(error),
    };
  }
}

function validateContent(url, text) {
  const pathname = new URL(url).pathname;
  if (pathname === "/llms-full.txt") {
    return text.includes("## Priority exact-spec SKUs for agent lookup")
      && text.includes("https://mcp.packrift.com/ai/sku/")
      && !/(\/Users\/farhan|Downloads|env-shopify|campaign sub-bucket|paid-search)/i.test(text);
  }
  return text.length > 0;
}

async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      out[current] = await worker(items[current]);
    }
  });
  await Promise.all(workers);
  return out;
}

function summarize(results, meta) {
  const total = results.length;
  const ok = results.filter((row) => row.ok).length;
  const failed = total - ok;
  const status_5xx = results.filter((row) => row.status >= 500 && row.status <= 599).length;
  const status_4xx = results.filter((row) => row.status >= 400 && row.status <= 499).length;
  const content_fail = results.filter((row) => row.http_ok && !row.content_ok).length;
  const latency = results.map((row) => row.latency_ms).sort((a, b) => a - b);
  const byUserAgent = groupStats(results, "user_agent");
  const byUrl = groupStats(results, "url");
  return {
    ...meta,
    ok: total > 0 && rate(failed, total) < 0.01 && rate(status_5xx, total) < 0.01 && content_fail === 0,
    total_fetches: total,
    ok_fetches: ok,
    failed_fetches: failed,
    failed_fetch_rate: rate(failed, total),
    status_5xx,
    status_5xx_rate: rate(status_5xx, total),
    status_4xx,
    status_4xx_rate: rate(status_4xx, total),
    content_fail,
    content_fail_rate: rate(content_fail, total),
    latency_ms: {
      min: latency[0] ?? 0,
      p50: percentile(latency, 0.5),
      p95: percentile(latency, 0.95),
      max: latency[latency.length - 1] ?? 0,
    },
    cache_states: countBy(results, "cache_state"),
    statuses: countBy(results, "status"),
    by_user_agent: byUserAgent,
    by_url: byUrl,
    failures: results
      .filter((row) => !row.ok)
      .slice(0, 50)
      .map((row) => ({
        url: row.url,
        user_agent: row.user_agent,
        sample: row.sample,
        status: row.status,
        http_ok: row.http_ok,
        content_ok: row.content_ok,
        error: row.error,
        latency_ms: row.latency_ms,
      })),
  };
}

function groupStats(results, key) {
  const groups = new Map();
  for (const row of results) {
    const value = String(row[key] ?? "");
    const current = groups.get(value) || [];
    current.push(row);
    groups.set(value, current);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, rows]) => ({
      [key]: value,
      total_fetches: rows.length,
      ok_fetches: rows.filter((row) => row.ok).length,
      failed_fetches: rows.filter((row) => !row.ok).length,
      status_5xx: rows.filter((row) => row.status >= 500 && row.status <= 599).length,
      status_5xx_rate: rate(rows.filter((row) => row.status >= 500 && row.status <= 599).length, rows.length),
      content_fail: rows.filter((row) => row.http_ok && !row.content_ok).length,
      p95_latency_ms: percentile(rows.map((row) => row.latency_ms).sort((a, b) => a - b), 0.95),
    }));
}

function markdownReport(value) {
  return [
    "# Packrift Static Availability Check",
    "",
    `Generated: ${value.generated_at}`,
    `Status: ${value.ok ? "pass" : "fail"}`,
    `Total fetches: ${value.total_fetches}`,
    `Failure rate: ${(value.failed_fetch_rate * 100).toFixed(2)}%`,
    `5xx rate: ${(value.status_5xx_rate * 100).toFixed(2)}%`,
    `Content failure rate: ${(value.content_fail_rate * 100).toFixed(2)}%`,
    `p95 latency: ${value.latency_ms.p95} ms`,
    "",
    "## User Agents",
    "",
    "| User agent | Fetches | Failed | 5xx rate | p95 latency |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...value.by_user_agent.map((row) =>
      `| ${row.user_agent} | ${row.total_fetches} | ${row.failed_fetches} | ${(row.status_5xx_rate * 100).toFixed(2)}% | ${row.p95_latency_ms} ms |`
    ),
    "",
    "## URLs",
    "",
    "| URL | Fetches | Failed | 5xx rate | p95 latency |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...value.by_url.map((row) =>
      `| ${row.url} | ${row.total_fetches} | ${row.failed_fetches} | ${(row.status_5xx_rate * 100).toFixed(2)}% | ${row.p95_latency_ms} ms |`
    ),
    "",
  ].join("\n");
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = String(row[key] ?? "");
    map.set(value, (map.get(value) || 0) + 1);
  }
  return Object.fromEntries(Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])));
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * pct) - 1));
  return sorted[index];
}

function rate(count, total) {
  return total > 0 ? count / total : 0;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function stringList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
