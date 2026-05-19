#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = resolve(REPO_ROOT, "outputs/mcp-funnel-snapshot/latest.json");
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-ga4-funnel-proof");
const KV_KEY = "mcp-ga4-funnel-proof:latest";
const RELEASE = "PACKRIFT-MCP-GA4-FUNNEL-PROOF-R01";
const args = parseArgs(process.argv.slice(2));

loadEnvFile(resolve(REPO_ROOT, ".env.cloudflare.local"));
loadEnvFile("/Users/farhan/Downloads/env-cloudflare.txt");

function num(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value) {
  return num(value).toLocaleString("en-US");
}

function money(value, currency = "USD") {
  return `${currency} $${num(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function bool(value) {
  return Boolean(value);
}

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Missing snapshot: ${path}. Run npm run snapshot:funnel first.`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function publicProof(snapshot) {
  const metrics = snapshot.proof_metrics || {};
  const fp = snapshot.first_party_mcp || {};
  const orders = snapshot.first_party_orders || {};
  const ga4 = snapshot.ga4 || {};
  const distribution = snapshot.distribution || {};
  const currency = orders.currency || "USD";
  const threshold = 1000;
  const qualifiedSessions = num(metrics.qualified_external_mcp_session_starts);
  const qualifiedCartLandings = num(metrics.qualified_external_cart_landings);
  const firstPartyOrders = num(metrics.first_party_mcp_orders ?? orders.attributed_order_count);
  const firstPartyRevenue = num(metrics.first_party_mcp_order_revenue ?? orders.attributed_revenue);
  const proofGate = {
    thousands_of_qualified_visitors: qualifiedSessions >= threshold,
    stamped_mcp_cart_landings: bool(snapshot.proof_gate?.stamped_mcp_cart_landings),
    measurable_mcp_sales: bool(snapshot.proof_gate?.measurable_mcp_sales),
    mcp_tool_usage_is_material: bool(snapshot.proof_gate?.mcp_tool_usage_is_material),
    root_shopify_cart_activation_live: bool(snapshot.proof_gate?.root_shopify_cart_activation_live),
    distribution_core_live: bool(snapshot.proof_gate?.distribution_core_live),
    llms_full_static_availability: bool(snapshot.proof_gate?.llms_full_static_availability),
  };
  const blockers = [];
  if (!proofGate.thousands_of_qualified_visitors) {
    blockers.push(`Needs ${count(Math.max(0, threshold - qualifiedSessions))} more GA4-qualified external MCP session_start events.`);
  }
  if (!proofGate.mcp_tool_usage_is_material) blockers.push("Needs at least 50 first-party MCP tool calls in the snapshot window.");
  if (!proofGate.measurable_mcp_sales) blockers.push("Needs at least one MCP-attributed order or measurable MCP revenue.");
  if (!proofGate.stamped_mcp_cart_landings) blockers.push("Needs qualified stamped MCP cart landing receipts.");

  return {
    release: RELEASE,
    generated_at: new Date().toISOString(),
    source_snapshot_generated_at: snapshot.generated_at || null,
    source_snapshot_status: snapshot.status || "unknown",
    status: Object.values(proofGate).every(Boolean) ? "proven" : "not_proven",
    canonical_endpoint: "https://mcp.packrift.com/mcp",
    privacy: "Public aggregate proof only. No buyer identifiers, order rows, raw CSV rows, local paths, or credentials are exposed.",
    measurement_window: {
      ga4_range: {
        start_date: ga4.start_date || null,
        end_date: ga4.end_date || null,
      },
      first_party_mcp_date: fp.date || null,
      shopify_order_lookback_days: orders.lookback_days ?? null,
      shopify_orders_scanned: orders.scanned_order_count ?? null,
    },
    proof_gate: proofGate,
    visitor_goal: {
      basis: "GA4 qualified external MCP session_start events",
      threshold,
      qualified_external_mcp_session_starts: qualifiedSessions,
      remaining_to_threshold: Math.max(0, threshold - qualifiedSessions),
      progress_pct: Number(Math.min(100, (qualifiedSessions / threshold) * 100).toFixed(1)),
      raw_mcp_specific_session_starts: num(metrics.raw_mcp_specific_session_starts),
      raw_ai_mcp_session_starts: num(ga4.ai_mcp_events?.ai_session_start_events),
    },
    cart_and_revenue_proof: {
      raw_stamped_mcp_cart_landings: num(metrics.raw_stamped_mcp_cart_landings),
      raw_first_party_mcp_cart_landings: num(metrics.raw_first_party_mcp_cart_landings),
      qualified_ga4_cart_landings: num(metrics.qualified_ga4_cart_landings),
      qualified_first_party_mcp_cart_landings: num(metrics.qualified_first_party_mcp_cart_landings),
      qualified_external_cart_landings: qualifiedCartLandings,
      qualified_external_cart_revenue: num(metrics.qualified_external_cart_revenue),
      first_party_mcp_orders: firstPartyOrders,
      first_party_mcp_order_revenue: firstPartyRevenue,
      currency,
    },
    first_party_mcp: {
      total_events: num(fp.total_events),
      total_tool_calls: num(fp.total_tool_calls),
      create_cart_url_calls: num(fp.create_cart_url_calls),
      start_clicks: num(fp.start_clicks),
      cart_clicks: num(fp.cart_clicks),
      mcp_cart_landings: num(fp.mcp_cart_landings),
      top_tools: Array.isArray(fp.top_tools) ? fp.top_tools.slice(0, 10) : [],
      top_start_sources: Array.isArray(fp.start_click_sources) ? fp.start_click_sources.slice(0, 10) : [],
    },
    traffic_quality: {
      excluded_internal_or_synthetic_events: num(metrics.excluded_internal_or_synthetic_events),
      self_generated_distribution_events: num(metrics.self_generated_distribution_events),
      first_party_source_buckets: snapshot.traffic_quality?.first_party_source_buckets || {},
      ga4_session_buckets: snapshot.traffic_quality?.ga4_session_buckets || {},
      ga4_cart_landing_buckets: snapshot.traffic_quality?.ga4_cart_landing_buckets || {},
    },
    distribution_counts: distribution.counts || {},
    blockers,
    next_actions: [
      "Work the source activation queue toward real external MCP tool calls and create_cart_url runs.",
      "Route Cline and MCP.so activation traffic into the tracked first-run runner, then the returned /r/cart URL.",
      "Re-run npm run snapshot:funnel and this publisher after each distribution or cart-handoff push.",
    ],
    links: {
      ga4_funnel_proof_json: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      ga4_funnel_proof_markdown: "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md",
      live_worker_funnel_snapshot_json: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      activation_command_center: "https://mcp.packrift.com/r/activate",
    },
  };
}

function markdown(proof) {
  const gateRows = Object.entries(proof.proof_gate)
    .map(([key, value]) => `| ${key} | ${value ? "yes" : "no"} |`)
    .join("\n");
  return [
    "# Packrift MCP GA4 Funnel Proof",
    "",
    `Release: ${proof.release}`,
    `Generated: ${proof.generated_at}`,
    `Source snapshot: ${proof.source_snapshot_generated_at || "unknown"}`,
    `Status: ${proof.status}`,
    `Canonical endpoint: ${proof.canonical_endpoint}`,
    "",
    proof.privacy,
    "",
    "## Visitor Goal",
    "",
    `- Basis: ${proof.visitor_goal.basis}`,
    `- Qualified external MCP sessions: ${count(proof.visitor_goal.qualified_external_mcp_session_starts)} / ${count(proof.visitor_goal.threshold)}`,
    `- Remaining: ${count(proof.visitor_goal.remaining_to_threshold)}`,
    `- Progress: ${proof.visitor_goal.progress_pct}%`,
    `- Raw MCP-specific sessions: ${count(proof.visitor_goal.raw_mcp_specific_session_starts)}`,
    "",
    "## Cart And Revenue Proof",
    "",
    `- Qualified external cart landings: ${count(proof.cart_and_revenue_proof.qualified_external_cart_landings)}`,
    `- Qualified external cart revenue: ${money(proof.cart_and_revenue_proof.qualified_external_cart_revenue, proof.cart_and_revenue_proof.currency)}`,
    `- First-party MCP orders: ${count(proof.cart_and_revenue_proof.first_party_mcp_orders)}`,
    `- First-party MCP order revenue: ${money(proof.cart_and_revenue_proof.first_party_mcp_order_revenue, proof.cart_and_revenue_proof.currency)}`,
    "",
    "## Proof Gate",
    "",
    "| Gate | Proven |",
    "| --- | --- |",
    gateRows,
    "",
    "## Blockers",
    "",
    proof.blockers.length ? proof.blockers.map((item) => `- ${item}`).join("\n") : "- none",
    "",
    "## Next Actions",
    "",
    proof.next_actions.map((item) => `- ${item}`).join("\n"),
    "",
  ].join("\n");
}

function assertPublicSafe(proof) {
  const text = JSON.stringify(proof);
  if (/(\/Users\/|Downloads|env-|\.csv|ga4-pull|MCP_STATS_TOKEN|CLOUDFLARE_API_TOKEN)/i.test(text)) {
    throw new Error("Refusing to publish proof because it contains a local path, raw file reference, or credential-looking string.");
  }
}

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed with exit ${result.status}`);
}

function main() {
  const snapshot = readJson(args.snapshot ? resolve(args.snapshot) : SNAPSHOT_PATH);
  const proof = publicProof(snapshot);
  assertPublicSafe(proof);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(args["out-dir"] || join(OUT_ROOT, stamp));
  mkdirSync(outDir, { recursive: true });
  mkdirSync(OUT_ROOT, { recursive: true });
  const json = JSON.stringify(proof, null, 2) + "\n";
  const md = markdown(proof);
  const paths = {
    json: join(outDir, "mcp-ga4-funnel-proof.json"),
    md: join(outDir, "mcp-ga4-funnel-proof.md"),
    latest_json: join(OUT_ROOT, "latest.json"),
    latest_md: join(OUT_ROOT, "latest.md"),
  };
  writeFileSync(paths.json, json, "utf8");
  writeFileSync(paths.md, md, "utf8");
  writeFileSync(paths.latest_json, json, "utf8");
  writeFileSync(paths.latest_md, md, "utf8");

  let kvPublished = false;
  if (args["publish-kv"]) {
    runCommand("npx", [
      "wrangler",
      "kv",
      "key",
      "put",
      KV_KEY,
      "--binding",
      "CATALOG_CACHE",
      "--path",
      paths.latest_json,
    ]);
    kvPublished = true;
  }

  if (args.purge || args["publish-kv"]) {
    runCommand("npm", [
      "run",
      "purge:cache",
      "--",
      "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.json",
      "https://mcp.packrift.com/ai/mcp-ga4-funnel-proof.md",
      "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      "https://mcp.packrift.com/ai/mcp-funnel-snapshot.md",
    ]);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        release: proof.release,
        status: proof.status,
        kv_key: KV_KEY,
        kv_published: kvPublished,
        qualified_external_mcp_session_starts: proof.visitor_goal.qualified_external_mcp_session_starts,
        remaining_to_threshold: proof.visitor_goal.remaining_to_threshold,
        qualified_external_cart_landings: proof.cart_and_revenue_proof.qualified_external_cart_landings,
        first_party_mcp_orders: proof.cart_and_revenue_proof.first_party_mcp_orders,
        paths,
      },
      null,
      2
    )
  );
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

main();
