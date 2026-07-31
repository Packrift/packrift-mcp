#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANALYTICS_ROOT =
  "/Users/farhan/Downloads/packrift-ai-commerce-execution-2026-05-04/analytics-1000x";
const GA4_PULLER = join(ANALYTICS_ROOT, "packrift_ga4_pull.py");
const GA4_ENV = join(ANALYTICS_ROOT, "packrift-ga4-env.local");
const FACTORY_OUTPUTS_ROOT = "/Users/farhan/Downloads/packrift-ai-commerce-factory/outputs";
const DEFAULT_PROPERTY_ID = "531219331";
const DEFAULT_REPORTS = "items,ai_mcp_events,mcp_cart_url_landings";
const DEFAULT_VERIFY_TARGETS = [
  { url: "https://mcp.packrift.com/llms-full.txt", required: true },
  { url: "https://packrift.com/llms-full.txt", required: false },
];

const args = parseArgs(process.argv.slice(2));
loadEnvFile(GA4_ENV);
loadEnvFile(join(REPO_ROOT, ".env.cloudflare.local"));
loadEnvFile("/Users/farhan/Downloads/env-cloudflare.txt");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = resolve(args["run-dir"] || join(REPO_ROOT, "outputs/llms-full-refresh", stamp));
const latestSummaryPath = resolve(args["latest-summary"] || join(REPO_ROOT, "outputs/llms-full-refresh", "latest.json"));
mkdirSync(runDir, { recursive: true });

const summary = {
  ok: false,
  run_dir: runDir,
  latest_summary_path: latestSummaryPath,
  ga4_output_dir: null,
  ga4_items_path: null,
  approved_jsonl_path: null,
  llms_full_text_path: join(runDir, "llms-full.txt"),
  build_report_path: join(runDir, "llms-full-priority-report.json"),
  kv_published: false,
  purged: false,
  verified: false,
  verification: [],
};

try {
  const ga4ItemsPath = args["ga4-items"]
    ? resolve(args["ga4-items"])
    : args["skip-ga4"]
      ? latestFile(ANALYTICS_ROOT, "packrift-ga4-items.csv")
      : runGa4Pull(runDir);
  summary.ga4_items_path = ga4ItemsPath;

  const approvedJsonlPath = args["approved-jsonl"]
    ? resolve(args["approved-jsonl"])
    : latestFile(FACTORY_OUTPUTS_ROOT, "packrift-ai-approved-products.jsonl");
  summary.approved_jsonl_path = approvedJsonlPath;

  runCommand("node", [
    "scripts/build-llms-full-from-ga4.mjs",
    "--ga4-items",
    ga4ItemsPath,
    "--approved-jsonl",
    approvedJsonlPath,
    "--limit",
    String(args.limit || 20),
    "--report",
    summary.build_report_path,
    "--output-text",
    summary.llms_full_text_path,
    ...(args["write-source"] ? [] : ["--no-write-source"]),
  ]);

  runCommand("npm", ["run", "typecheck"]);

  if (args["publish-kv"]) {
    runCommand("npx", [
      "wrangler",
      "kv",
      "key",
      "put",
      "static-override:llms-full.txt",
      "--binding",
      "CATALOG_CACHE",
      "--preview",
      "false",
      "--path",
      summary.llms_full_text_path,
    ]);
    summary.kv_published = true;
  }

  if (args.purge || args["publish-kv"]) {
    runCommand("npm", ["run", "purge:cache", "--", "--core"]);
    summary.purged = true;
  }

  if (args.verify || args["publish-kv"]) {
    summary.verification = await verifyTargets(DEFAULT_VERIFY_TARGETS);
    summary.verified = summary.verification
      .filter((result) => result.required)
      .every((result) => result.ok);
    if (!summary.verified) {
      throw new Error("One or more required llms-full verification fetches failed.");
    }
  }

  summary.ok = true;
} finally {
  const summaryJson = JSON.stringify(summary, null, 2);
  writeFileSync(join(runDir, "refresh-summary.json"), summaryJson, "utf8");
  mkdirSync(dirname(latestSummaryPath), { recursive: true });
  writeFileSync(latestSummaryPath, summaryJson, "utf8");
  console.log(summaryJson);
}

function runGa4Pull(runDirPath) {
  if (!existsSync(GA4_PULLER)) throw new Error(`Missing GA4 puller at ${GA4_PULLER}`);
  const outputDir = join(runDirPath, "ga4-pull");
  summary.ga4_output_dir = outputDir;
  runCommand("python3", [
    GA4_PULLER,
    "--property-id",
    args["property-id"] || process.env.PACKRIFT_GA4_PROPERTY_ID || DEFAULT_PROPERTY_ID,
    "--auth-mode",
    args["auth-mode"] || process.env.PACKRIFT_GA4_AUTH_MODE || "oauth",
    "--reports",
    args.reports || DEFAULT_REPORTS,
    "--output-dir",
    outputDir,
  ]);
  const itemsPath = join(outputDir, "packrift-ga4-items.csv");
  if (!existsSync(itemsPath)) throw new Error(`GA4 pull did not produce ${itemsPath}`);
  return itemsPath;
}

function runCommand(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit ${result.status}`);
  }
  return result;
}

async function verifyTargets(targets) {
  const userAgents = ["ChatGPT-User", "ClaudeBot", "PerplexityBot", "Mozilla/5.0 Packrift MCP Refresh"];
  const results = [];
  for (const target of targets) {
    for (const userAgent of userAgents) {
      const response = await fetch(target.url, {
        headers: {
          "User-Agent": userAgent,
          "Cache-Control": "no-cache",
        },
      });
      const text = await response.text();
      const isCanonicalCorpus = text.includes("## Priority exact-spec SKUs for agent lookup");
      const isRootDiscoveryAlias = text.includes("## Current Retrieval Rule")
        && text.includes("https://mcp.packrift.com/llms-full.txt");
      const ok =
        response.ok &&
        (isCanonicalCorpus || isRootDiscoveryAlias) &&
        text.includes("https://mcp.packrift.com/ai/sku/") &&
        !/(\/Users\/farhan|Downloads|env-shopify|campaign sub-bucket|paid-search)/i.test(text);
      results.push({
        url: target.url,
        required: target.required,
        user_agent: userAgent,
        status: response.status,
        cache_state: response.headers.get("x-packrift-static-cache") || "",
        ok,
        bytes: text.length,
      });
    }
  }
  return results;
}

function latestFile(root, filename) {
  let latest = null;
  walk(root, (file) => {
    if (!file.endsWith(`/${filename}`)) return;
    const mtimeMs = statSync(file).mtimeMs;
    if (!latest || mtimeMs > latest.mtimeMs) latest = { file, mtimeMs };
  });
  if (!latest) throw new Error(`Could not find ${filename} under ${root}`);
  return latest.file;
}

function walk(root, visit) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.replace(/^export\s+/, "").split("=");
    const key = rawKey.trim();
    const value = rest
      .join("=")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
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
