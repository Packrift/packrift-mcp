#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOST = "mcp.packrift.com";
const DEFAULT_SITEMAP_URL = "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml";
const DEFAULT_SCOPE = "source-activation";
const DEFAULT_KEY = "5050e763abb8dafdc736a5971e107171";
const KEY_LOCATION = `https://${HOST}/${DEFAULT_KEY}.txt`;
const ENDPOINTS = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];
const USER_AGENT = "Packrift-MCP-IndexNow/1.1";
const ENV_PATHS = [
  join(homedir(), "Downloads", "env-indexnow-packrift-root.txt"),
  join(homedir(), "Downloads", "env-indexnow-packrift.txt"),
];

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: 0,
    chunkSize: 250,
    timeoutMs: 20000,
    sitemapUrl: DEFAULT_SITEMAP_URL,
    scope: DEFAULT_SCOPE,
    preflightConcurrency: 16,
    skipPreflight: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--limit") args.limit = Number(argv[++index] || 0);
    else if (arg === "--chunk-size") args.chunkSize = Number(argv[++index] || 250);
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++index] || 20000);
    else if (arg === "--sitemap-url") args.sitemapUrl = argv[++index] || DEFAULT_SITEMAP_URL;
    else if (arg === "--scope") args.scope = argv[++index] || DEFAULT_SCOPE;
    else if (arg === "--preflight-concurrency") args.preflightConcurrency = Number(argv[++index] || 16);
    else if (arg === "--skip-preflight") args.skipPreflight = true;
    else if (arg === "--help") {
      console.log(
        [
          "Usage: node scripts/submit-source-activation-indexnow.mjs [--dry-run] [--limit N] [--chunk-size N] [--timeout-ms N]",
          "       [--sitemap-url URL] [--scope NAME] [--preflight-concurrency N] [--skip-preflight]",
          "",
          "Defaults to the Packrift MCP source-activation sitemap. Use --sitemap-url https://mcp.packrift.com/ai/sitemap.xml --scope ai-discovery to submit the broader MCP AI discovery sitemap.",
        ].join("\n")
      );
      process.exit(0);
    }
  }
  args.scope = slugify(args.scope || DEFAULT_SCOPE);
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function timestampSlug() {
  return nowIso().replace(/\.\d{3}Z$/, "Z").replace(/[:.]/g, "-");
}

function slugify(value) {
  return String(value || DEFAULT_SCOPE)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || DEFAULT_SCOPE;
}

function releaseScope(value) {
  return slugify(value).replace(/-/g, "_").toUpperCase();
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    out[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function loadKey() {
  const env = Object.assign({}, ...ENV_PATHS.map(readEnvFile));
  return env.INDEXNOW_ROOT_KEY || env.INDEXNOW_KEY_ROOT || env.INDEXNOW_KEY || DEFAULT_KEY;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function sourceFromUrl(url, fallbackSource) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] === "ai" && ["mcp-eval-pack.json", "mcp-eval-pack.md"].includes(parts[1])) {
    return parsed.searchParams.get("source") || fallbackSource;
  }
  if (parts[0] === "r" && ["start", "config", "activate"].includes(parts[1])) return parts[2] || "unknown";
  if (parts[0] === "r" && ["install", "run"].includes(parts[1])) return parts[2] || "unknown";
  return fallbackSource;
}

function urlType(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parsed.pathname === "/start") return "source_start_page";
  if (parts[0] === "ai" && parts[1] === "mcp-eval-pack.json") return "source_eval_pack_json";
  if (parts[0] === "ai" && parts[1] === "mcp-eval-pack.md") return "source_eval_pack_markdown";
  if (parts[0] === "r") return `tracked_${parts[1] || "route"}`;
  if (parsed.pathname.endsWith(".xml")) return "sitemap";
  return "resource";
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHead(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    return { response };
  } finally {
    clearTimeout(timeout);
  }
}

async function collectUrls(sitemapUrl, timeoutMs, limit, scope) {
  const { response, text } = await fetchText(sitemapUrl, timeoutMs);
  if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status}`);
  const locs = [...text.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decodeXml(match[1]));
  const seen = new Set();
  const rows = [];
  for (const url of [sitemapUrl, ...locs]) {
    if (!url.startsWith(`https://${HOST}/`) || seen.has(url)) continue;
    seen.add(url);
    rows.push({
      url,
      source: sourceFromUrl(url, scope.replace(/-/g, "_")),
      url_type: urlType(url),
    });
    if (limit > 0 && rows.length >= limit) break;
  }
  return rows;
}

async function probeUrl(row, timeoutMs) {
  try {
    let { response } = await fetchHead(row.url, timeoutMs);
    let text = "";
    if (response.status === 405 || response.status === 501) {
      const fallback = await fetchText(row.url, timeoutMs);
      response = fallback.response;
      text = fallback.text;
    }
    const finalUrl = response.url || row.url;
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    return {
      ...row,
      status: response.status,
      final_url: finalUrl,
      content_type: contentType,
      bytes: text.length || contentLength,
      ok: response.ok,
      error: "",
    };
  } catch (error) {
    return {
      ...row,
      status: "",
      final_url: "",
      content_type: "",
      bytes: 0,
      ok: false,
      error: `${error?.name || "Error"}: ${error?.message || String(error)}`.slice(0, 500),
    };
  }
}

async function probeKey(key, timeoutMs) {
  try {
    const { response, text } = await fetchText(KEY_LOCATION, timeoutMs);
    return {
      url: KEY_LOCATION,
      status: response.status,
      body_matches_key: text.trim() === key,
      ok: response.ok && text.trim() === key,
    };
  } catch (error) {
    return {
      url: KEY_LOCATION,
      status: "",
      body_matches_key: false,
      ok: false,
      error: `${error?.name || "Error"}: ${error?.message || String(error)}`.slice(0, 500),
    };
  }
}

async function submitChunk(endpoint, key, urls, chunkIndex, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: KEY_LOCATION,
        urlList: urls,
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      endpoint,
      chunk_index: chunkIndex,
      url_count: urls.length,
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      body: body.slice(0, 1000),
    };
  } catch (error) {
    return {
      endpoint,
      chunk_index: chunkIndex,
      url_count: urls.length,
      status: "",
      ok: false,
      body: `${error?.name || "Error"}: ${error?.message || String(error)}`.slice(0, 1000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function writeCsv(path, rows) {
  const fields = ["source", "url_type", "url", "status", "final_url", "content_type", "bytes", "ok", "error"];
  const lines = [
    fields.join(","),
    ...rows.map((row) =>
      fields
        .map((field) => {
          const value = String(row[field] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function chunks(values, size) {
  const out = [];
  for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
  return out;
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = nowIso();
  const outDir = join(process.cwd(), "outputs", `${args.scope}-indexnow`, timestampSlug());
  mkdirSync(outDir, { recursive: true });

  const key = loadKey();
  const keyProbe = await probeKey(key, args.timeoutMs);
  const candidates = await collectUrls(args.sitemapUrl, args.timeoutMs, args.limit, args.scope);
  const preflight = args.skipPreflight
    ? candidates.map((row) => ({
        ...row,
        status: "skipped",
        final_url: row.url,
        content_type: "",
        bytes: 0,
        ok: true,
        error: "",
      }))
    : await mapLimit(candidates, Math.max(1, args.preflightConcurrency), (row) => probeUrl(row, args.timeoutMs));
  const submitUrls = preflight.filter((row) => row.ok).map((row) => row.url);
  const endpointResults = [];
  const acceptedUrls = new Set();
  const chunkList = chunks(submitUrls, Math.max(1, args.chunkSize));

  if (args.dryRun) {
    for (let index = 0; index < chunkList.length; index += 1) {
      for (const endpoint of ENDPOINTS) {
        endpointResults.push({ endpoint, chunk_index: index + 1, url_count: chunkList[index].length, status: "dry_run", ok: true, body: "" });
      }
      for (const url of chunkList[index]) acceptedUrls.add(url);
    }
  } else if (keyProbe.ok) {
    for (let index = 0; index < chunkList.length; index += 1) {
      const chunk = chunkList[index];
      const results = [];
      for (const endpoint of ENDPOINTS) results.push(await submitChunk(endpoint, key, chunk, index + 1, args.timeoutMs * 3));
      endpointResults.push(...results);
      if (results.some((result) => result.ok)) for (const url of chunk) acceptedUrls.add(url);
    }
  }

  const manifest = {
    release_id: `PACKRIFT-MCP-${releaseScope(args.scope)}-INDEXNOW-${startedAt.slice(0, 10)}-R01`,
    generated_at: nowIso(),
    dry_run: args.dryRun,
    scope: args.scope,
    preflight_skipped: args.skipPreflight,
    host: HOST,
    sitemap_url: args.sitemapUrl,
    key_location: KEY_LOCATION,
    key_location_ok: keyProbe.ok,
    candidate_url_count: candidates.length,
    preflight_pass_count: submitUrls.length,
    preflight_fail_count: preflight.length - submitUrls.length,
    submitted_url_count: acceptedUrls.size,
    endpoint_ok_count: endpointResults.filter((result) => result.ok).length,
    endpoint_results: endpointResults,
    source_counts: preflight.reduce((acc, row) => {
      acc[row.source] = (acc[row.source] || 0) + 1;
      return acc;
    }, {}),
    artifacts: {
      indexnow_submission: join(outDir, "indexnow_submission.json"),
      release_manifest: join(outDir, "release_manifest.json"),
      url_preflight: join(outDir, "url_preflight.csv"),
      release_summary: join(outDir, "release_summary.md"),
    },
  };

  writeFileSync(join(outDir, "indexnow_submission.json"), `${JSON.stringify({ ...manifest, preflight, submitted_urls: submitUrls }, null, 2)}\n`);
  writeFileSync(join(outDir, "release_manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeCsv(join(outDir, "url_preflight.csv"), preflight);
  writeFileSync(
    join(outDir, "release_summary.md"),
    [
      `# Packrift MCP ${args.scope} IndexNow - ${startedAt.slice(0, 10)}`,
      "",
      `Scope: \`${args.scope}\``,
      `Host: \`${HOST}\``,
      `Sitemap: ${args.sitemapUrl}`,
      `Dry run: \`${args.dryRun}\``,
      `Preflight skipped: \`${args.skipPreflight}\``,
      `Key location ok: \`${keyProbe.ok}\``,
      `Candidate URLs: \`${candidates.length}\``,
      `Preflight pass: \`${submitUrls.length}\``,
      `Preflight fail: \`${manifest.preflight_fail_count}\``,
      `Submitted URLs: \`${acceptedUrls.size}\``,
      `Endpoint ok count: \`${manifest.endpoint_ok_count}\``,
      "",
      "## Scope",
      "",
      `This only notifies IndexNow about existing Packrift MCP URLs from ${args.sitemapUrl}. It does not create a new CLI, buyer surface, checkout path, or directory submission.`,
      "",
      "## Endpoint Results",
      "",
      ...endpointResults.map((result) => `- chunk \`${result.chunk_index}\` ${result.endpoint}: \`${result.status}\` ok=\`${result.ok}\` urls=\`${result.url_count}\``),
      "",
    ].join("\n")
  );

  console.log(
    JSON.stringify(
      {
        out_dir: outDir,
        dry_run: args.dryRun,
        scope: args.scope,
        preflight_skipped: args.skipPreflight,
        key_location_ok: keyProbe.ok,
        candidate_url_count: candidates.length,
        preflight_pass_count: submitUrls.length,
        preflight_fail_count: manifest.preflight_fail_count,
        submitted_url_count: acceptedUrls.size,
        endpoint_ok_count: manifest.endpoint_ok_count,
      },
      null,
      2
    )
  );

  if (!keyProbe.ok || submitUrls.length === 0 || (!args.dryRun && acceptedUrls.size === 0)) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
