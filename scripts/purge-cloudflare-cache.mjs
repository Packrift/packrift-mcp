#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPaths = [
  resolve(process.cwd(), ".env.cloudflare.local"),
  "/Users/farhan/Downloads/env-cloudflare.txt",
];

function loadLocalEnv(path) {
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

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function usage() {
  console.log(`Usage:
  npm run purge:cache -- https://packrift.com/pages/example
  npm run purge:cache -- --from-file /tmp/packrift-urls.txt
  npm run purge:cache -- --core

Options:
  --core       Purge core Packrift MCP/LLM URLs.
  --dry-run    Print the URLs that would be purged.
  --from-file  Read newline-delimited URLs from a file.
  --batch-size Number of URLs to purge per Cloudflare request. Default: 30.
  --delay-ms   Delay between batches. Default: 250.

Required env:
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_PACKRIFT_ZONE_ID or a token with Zone Read for packrift.com
`);
}

for (const envPath of envPaths) loadLocalEnv(envPath);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const core = args.includes("--core");
const fromFileIndex = args.indexOf("--from-file");
const batchSizeIndex = args.indexOf("--batch-size");
const delayMsIndex = args.indexOf("--delay-ms");
const fromFile =
  fromFileIndex >= 0 && args[fromFileIndex + 1] ? args[fromFileIndex + 1] : "";
const batchSize =
  batchSizeIndex >= 0 && args[batchSizeIndex + 1]
    ? Number.parseInt(args[batchSizeIndex + 1], 10)
    : 30;
const delayMs =
  delayMsIndex >= 0 && args[delayMsIndex + 1]
    ? Number.parseInt(args[delayMsIndex + 1], 10)
    : 250;
const skipNext = new Set(
  [fromFileIndex, batchSizeIndex, delayMsIndex]
    .filter((index) => index >= 0)
    .map((index) => index + 1),
);
const urls = args.filter(
  (arg, index) =>
    !arg.startsWith("--") &&
    !skipNext.has(index),
);

if (args.includes("--help") || (!core && !fromFile && urls.length === 0)) {
  usage();
  process.exit(args.includes("--help") ? 0 : 1);
}

const fileUrls = fromFile
  ? readFileSync(resolve(fromFile), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  : [];

const purgeUrls = Array.from(new Set(core
  ? [
      "https://mcp.packrift.com/",
      "https://mcp.packrift.com/start",
      "https://mcp.packrift.com/llms.txt",
      "https://mcp.packrift.com/llms-full.txt",
      "https://mcp.packrift.com/mcp.json",
      "https://mcp.packrift.com/r/config/generic",
      "https://mcp.packrift.com/agents.md",
      "https://mcp.packrift.com/favicon.ico",
      "https://mcp.packrift.com/.well-known/mcp.json",
      "https://mcp.packrift.com/.well-known/mcp/server-card.json",
      "https://mcp.packrift.com/.well-known/glama.json",
      "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.md",
      "https://mcp.packrift.com/ai/all-agent-capture.json",
      "https://mcp.packrift.com/ai/all-agent-capture.md",
      "https://mcp.packrift.com/ai/mcp-agent-host-rollout.json",
      "https://mcp.packrift.com/ai/mcp-agent-host-rollout.md",
      "https://mcp.packrift.com/ai/mcp-agent-host-rollout.html",
      "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      "https://mcp.packrift.com/ai/mcp-install-matrix.md",
      "https://mcp.packrift.com/ai/mcp-client-config.json",
      "https://mcp.packrift.com/ai/mcp-client-config.md",
      "https://mcp.packrift.com/ai/mcp-start.json",
      "https://mcp.packrift.com/ai/mcp-start.md",
      "https://mcp.packrift.com/ai/mcp-start.html",
      "https://mcp.packrift.com/ai/mcp-first-run-actions.json",
      "https://mcp.packrift.com/ai/mcp-first-run-actions.md",
      "https://mcp.packrift.com/r/run/generic/generic_streamable_http",
      "https://mcp.packrift.com/r/install/generic/cline",
      "https://mcp.packrift.com/r/install/generic/cline?format=json",
      "https://mcp.packrift.com/r/install/generic/cline?format=html",
      "https://mcp.packrift.com/r/run/generic/cline",
      "https://mcp.packrift.com/r/run/generic/cline?format=json",
      "https://mcp.packrift.com/r/run/generic/cline?format=html",
      "https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline",
      "https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline?format=json",
      "https://mcp.packrift.com/r/install/cline_mcp_marketplace/cline?format=html",
      "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline",
      "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=json",
      "https://mcp.packrift.com/r/run/cline_mcp_marketplace/cline?format=html",
      "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      "https://mcp.packrift.com/ai/mcp-adoption-kit.md",
      "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      "https://mcp.packrift.com/ai/mcp-usage-snapshot.md",
      "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
      "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md",
      "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      "https://mcp.packrift.com/ai/mcp-source-activation-queue.md",
      "https://mcp.packrift.com/ai/mcp-source-activation-queue.html",
      "https://mcp.packrift.com/ai/mcp-activation-experiments.json",
      "https://mcp.packrift.com/ai/mcp-activation-experiments.md",
      "https://mcp.packrift.com/ai/mcp-activation-experiments.html",
      "https://mcp.packrift.com/ai/mcp-source-activation-sitemap.xml",
      "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      "https://mcp.packrift.com/ai/mcp-buyer-use-cases.md",
      "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      "https://mcp.packrift.com/ai/mcp-cart-activation.md",
      "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      "https://mcp.packrift.com/ai/mcp-first-run-proof.md",
      "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
      "https://mcp.packrift.com/ai/mcp-workflow-gallery.md",
      "https://mcp.packrift.com/ai/mcp-eval-pack.json",
      "https://mcp.packrift.com/ai/mcp-eval-pack.md",
      "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=cline_mcp_marketplace",
      "https://mcp.packrift.com/ai/mcp-eval-pack.md?source=cline_mcp_marketplace",
      "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=mcp_so",
      "https://mcp.packrift.com/ai/mcp-eval-pack.md?source=mcp_so",
      "https://mcp.packrift.com/ai/mcp-eval-pack.json?source=browse_sh",
      "https://mcp.packrift.com/ai/mcp-eval-pack.md?source=browse_sh",
      "https://mcp.packrift.com/ai/browser-agent-bridge.json",
      "https://mcp.packrift.com/ai/browser-agent-bridge.md",
      "https://mcp.packrift.com/ai/mcp-directory-refresh.json",
      "https://mcp.packrift.com/ai/mcp-directory-refresh.md",
      "https://mcp.packrift.com/ai/mcp-directory-submit-actions.json",
      "https://mcp.packrift.com/ai/mcp-directory-submit-actions.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/cline_mcp_marketplace.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcp_so.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcp_marketplace_io.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/browse_sh.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcplist_ai.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcp_blue.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcp_blue.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcphubz.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcphubz.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/findmcp_dev.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/findmcp_dev.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcplane.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcplane.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpsolutions_dev.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpsolutions_dev.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/gpmcp.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/gpmcp.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/theresamcpforthat.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/theresamcpforthat.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserverfinder.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserver_cc.md",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.json",
      "https://mcp.packrift.com/ai/mcp-directory-update/mcpserverspot.md",
      "https://mcp.packrift.com/ai/mcp-reviewer-activation.json",
      "https://mcp.packrift.com/ai/mcp-reviewer-activation.md",
      "https://mcp.packrift.com/r/activate",
      "https://mcp.packrift.com/r/activate?format=json",
      "https://mcp.packrift.com/r/activate?format=md",
      "https://mcp.packrift.com/r/activate/generic",
      "https://mcp.packrift.com/r/activate/generic?format=json",
      "https://mcp.packrift.com/r/activate/generic?format=html",
      "https://mcp.packrift.com/r/activate/cline_mcp_marketplace",
      "https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=json",
      "https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=html",
      "https://mcp.packrift.com/r/activate/cline_mcp_marketplace?format=md",
      "https://mcp.packrift.com/ai/claude-connector-submission.json",
      "https://mcp.packrift.com/ai/claude-connector-submission.md",
      "https://mcp.packrift.com/ai/agent-capture-outreach.json",
      "https://mcp.packrift.com/ai/agent-capture-outreach.md",
      "https://mcp.packrift.com/ai/sitemap.xml",
      "https://packrift.com/llms.txt",
      "https://packrift.com/llms-full.txt",
      "https://packrift.com/agents.md",
    ]
  : [...urls, ...fileUrls]));

if (!Number.isFinite(batchSize) || batchSize < 1 || batchSize > 30) {
  console.error("--batch-size must be between 1 and 30.");
  process.exit(1);
}

if (!Number.isFinite(delayMs) || delayMs < 0) {
  console.error("--delay-ms must be 0 or greater.");
  process.exit(1);
}

const token = process.env.CLOUDFLARE_API_TOKEN;

if (!token) {
  console.error("Missing CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function getZoneId() {
  if (process.env.CLOUDFLARE_PACKRIFT_ZONE_ID) {
    return process.env.CLOUDFLARE_PACKRIFT_ZONE_ID;
  }

  const { response, body } = await cloudflare("/zones?name=packrift.com");
  if (!response.ok || !body.success || !body.result?.[0]?.id) {
    console.error("Unable to resolve packrift.com zone ID.");
    console.error(JSON.stringify(body.errors || body, null, 2));
    process.exit(1);
  }

  return body.result[0].id;
}

if (dryRun) {
  console.log("Dry run. Would purge:");
  for (const url of purgeUrls) console.log(`- ${url}`);
  console.log(`Total: ${purgeUrls.length} URL(s).`);
  process.exit(0);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

const zoneId = await getZoneId();
let purged = 0;
const batches = chunk(purgeUrls, batchSize);
for (let index = 0; index < batches.length; index += 1) {
  const files = batches[index];
  const { response, body } = await cloudflare(`/zones/${zoneId}/purge_cache`, {
    method: "POST",
    body: JSON.stringify({ files }),
  });

  if (!response.ok || !body.success) {
    console.error(`Cloudflare purge failed on batch ${index + 1}/${batches.length}: HTTP ${response.status}`);
    console.error(JSON.stringify(body.errors || body, null, 2));
    process.exit(1);
  }

  purged += files.length;
  console.log(`Purged batch ${index + 1}/${batches.length}: ${files.length} URL(s).`);
  if (delayMs > 0 && index < batches.length - 1) {
    await sleep(delayMs);
  }
}

console.log(`Purged ${purged} URL(s) from Cloudflare cache.`);
