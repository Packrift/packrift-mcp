#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANALYTICS_ROOT = "/Users/farhan/Downloads/packrift-ai-commerce-execution-2026-05-04/analytics-1000x";
const FACTORY_OUTPUT_ROOT = "/Users/farhan/Downloads/packrift-ai-commerce-factory/outputs";
const GA4_PULLER = join(ANALYTICS_ROOT, "packrift_ga4_pull.py");
const GA4_ENV = join(ANALYTICS_ROOT, "packrift-ga4-env.local");
const MCP_STATS_ENV = "/Users/farhan/Downloads/env-packrift-mcp-stats.txt";
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-funnel-snapshot");
const DEFAULT_PROPERTY_ID = "531219331";
const DEFAULT_REPORTS = "ai_mcp_events,mcp_cart_url_landings";

const args = parseArgs(process.argv.slice(2));
loadEnvFile(GA4_ENV);
loadEnvFile(MCP_STATS_ENV);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(args["output-dir"] || join(OUT_ROOT, stamp));
mkdirSync(outDir, { recursive: true });

const snapshot = {
  generated_at: new Date().toISOString(),
  status: "not_proven",
  partial_snapshot: skippedChecks().length > 0,
  skipped_checks: skippedChecks(),
  proof_gate: {
    thousands_of_qualified_visitors: false,
    stamped_mcp_cart_landings: false,
    measurable_mcp_sales: false,
  },
  first_party_mcp: null,
  ga4: null,
  distribution: null,
  live_discovery: null,
  static_availability: null,
  indexnow: null,
  artifacts: {
    snapshot_json: join(outDir, "mcp-funnel-snapshot.json"),
    snapshot_md: join(outDir, "mcp-funnel-snapshot.md"),
  },
};

try {
  snapshot.first_party_mcp = await buildFirstPartyMcpSummary();
} catch (error) {
  snapshot.first_party_mcp = { ok: false, error: error.message || String(error) };
}

try {
  if (!args["skip-ga4"]) snapshot.ga4 = runGa4Pull();
} catch (error) {
  snapshot.ga4 = { ok: false, error: error.message || String(error) };
}

try {
  if (!args["skip-distribution"]) snapshot.distribution = runDistributionCheck();
} catch (error) {
  snapshot.distribution = { ok: false, error: error.message || String(error) };
}

try {
  if (!args["skip-live-discovery"]) snapshot.live_discovery = await buildLiveDiscoverySummary();
} catch (error) {
  snapshot.live_discovery = { ok: false, error: error.message || String(error) };
}

try {
  if (!args["skip-static-availability"]) snapshot.static_availability = runStaticAvailabilityCheck();
} catch (error) {
  snapshot.static_availability = { ok: false, error: error.message || String(error) };
}

try {
  if (!args["skip-indexnow"]) snapshot.indexnow = buildIndexNowSummary();
} catch (error) {
  snapshot.indexnow = { ok: false, error: error.message || String(error) };
}

try {
  applyProofGate(snapshot);
} finally {
  writeArtifacts(snapshot);
  console.log(JSON.stringify({
    status: snapshot.status,
    out_dir: outDir,
    first_party_total_events: snapshot.first_party_mcp?.total_events ?? null,
    first_party_total_tool_calls: snapshot.first_party_mcp?.total_tool_calls ?? null,
    ga4_mcp_cart_url_landing_events: snapshot.ga4?.mcp_cart_url_landings?.event_count ?? null,
    distribution_counts: snapshot.distribution?.counts ?? null,
    live_discovery_ok: snapshot.live_discovery?.ok ?? null,
    static_availability_ok: snapshot.static_availability?.ok ?? null,
    indexnow_ok: snapshot.indexnow?.ok ?? null,
    partial_snapshot: snapshot.partial_snapshot,
    skipped_checks: snapshot.skipped_checks,
  }, null, 2));
}

async function buildFirstPartyMcpSummary() {
  const date = args.date || utcDate(new Date());
  const token = process.env.MCP_STATS_TOKEN || "";
  if (!token) {
    return { ok: false, date, error: "MCP_STATS_TOKEN is not available in the local environment." };
  }
  const limit = String(args["mcp-limit"] || "5000");
  const url = new URL("https://mcp.packrift.com/admin/mcp-stats");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", limit);
  url.searchParams.set("token", token);
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { "User-Agent": "Packrift-MCP-Funnel-Snapshot/1.0" },
    signal: AbortSignal.timeout(Number(args["mcp-timeout-ms"] || 60000)),
  });
  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      date,
      http_status: response.status,
      latency_ms: Date.now() - startedAt,
      error: body.slice(0, 240),
    };
  }
  const parsed = JSON.parse(body);
  const byEvent = objectFromTopRows(parsed.by_event);
  const byTool = objectFromTopRows(parsed.by_tool);
  const bySource = objectFromTopRows(parsed.by_source);
  return {
    ok: Boolean(parsed.ok),
    date: parsed.date,
    limit: parsed.limit,
    latency_ms: Date.now() - startedAt,
    total_events: Number(parsed.total_events || 0),
    total_tool_calls: Number(parsed.total_tool_calls || 0),
    create_cart_url_calls: Number(byTool.create_cart_url || 0),
    cart_clicks: Number(byEvent.cart_click || 0),
    product_clicks: Number(byEvent.product_click || 0),
    quote_clicks: Number(byEvent.quote_click || 0),
    reorder_clicks: Number(byEvent.reorder_click || 0),
    sku_page_views: Number(byEvent.sku_page_view || 0),
    ai_corpus_clicks: Number(byEvent.ai_corpus_click || 0),
    top_events: parsed.by_event || [],
    top_tools: parsed.by_tool || [],
    top_sources: parsed.by_source || [],
    top_skus: parsed.by_sku || [],
    top_bot_families: parsed.by_bot_family || [],
  };
}

function runGa4Pull() {
  if (!existsSync(GA4_PULLER)) return { ok: false, error: `Missing GA4 puller at ${GA4_PULLER}` };
  const outputDir = join(outDir, "ga4-pull");
  const reports = args.reports || DEFAULT_REPORTS;
  const result = spawnSync("python3", [
    GA4_PULLER,
    "--property-id",
    args["property-id"] || process.env.PACKRIFT_GA4_PROPERTY_ID || DEFAULT_PROPERTY_ID,
    "--auth-mode",
    args["auth-mode"] || process.env.PACKRIFT_GA4_AUTH_MODE || "oauth",
    "--reports",
    reports,
    "--output-dir",
    outputDir,
  ], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: Number(args["ga4-timeout-ms"] || 120000),
  });
  const base = {
    ok: result.status === 0,
    output_dir: outputDir,
    reports,
    exit_status: result.status,
    stderr: result.status === 0 ? "" : (result.stderr || "").slice(0, 1000),
    summary_path: join(outputDir, "packrift-ga4-pull-summary.md"),
  };
  const eventsPath = join(outputDir, "packrift-ga4-ai_mcp_events.csv");
  const cartPath = join(outputDir, "packrift-ga4-mcp_cart_url_landings.csv");
  return {
    ...base,
    ai_mcp_events: existsSync(eventsPath) ? summarizeGa4AiMcpEvents(readCsv(eventsPath)) : { row_count: 0 },
    mcp_cart_url_landings: existsSync(cartPath) ? summarizeGa4CartLandings(readCsv(cartPath)) : { row_count: 0 },
  };
}

function runDistributionCheck() {
  const result = spawnSync("npm", ["run", "check:distribution"], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: Number(args["distribution-timeout-ms"] || 60000),
  });
  const latestPath = join(REPO_ROOT, "outputs/mcp-distribution-check/latest.json");
  const latest = existsSync(latestPath) ? JSON.parse(readFileSync(latestPath, "utf8")) : null;
  return {
    ok: result.status === 0 && Boolean(latest),
    exit_status: result.status,
    latest_path: latestPath,
    generated_at: latest?.generated_at ?? null,
    counts: latest?.counts ?? null,
    stale_or_blocked: latest?.checks?.filter((row) => row.status !== "pass").map((row) => ({
      name: row.name,
      status: row.status,
      url: row.url ?? null,
      missing: row.missing ?? [],
    })) ?? [],
  };
}

function runStaticAvailabilityCheck() {
  const result = spawnSync("node", [
    "scripts/check-static-availability.mjs",
    "--samples-per-ua",
    String(args["availability-samples-per-ua"] || "5"),
    "--concurrency",
    String(args["availability-concurrency"] || "12"),
    "--timeout-ms",
    String(args["availability-timeout-ms"] || "15000"),
    "--json",
  ], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: Number(args["availability-check-timeout-ms"] || 180000),
  });
  let parsed = null;
  try {
    parsed = result.stdout ? JSON.parse(result.stdout) : null;
  } catch {
    parsed = null;
  }
  return {
    ...(parsed || {}),
    ok: result.status === 0 && Boolean(parsed?.ok),
    exit_status: result.status,
    stderr: result.status === 0 ? "" : (result.stderr || "").slice(0, 1000),
  };
}

async function buildLiveDiscoverySummary() {
  const [manifest, serverCard, wellKnownServerCard, llmsFull] = await Promise.all([
    fetchJsonWithMeta("https://mcp.packrift.com/manifest"),
    fetchJsonWithMeta("https://mcp.packrift.com/server-card.json"),
    fetchJsonWithMeta("https://mcp.packrift.com/.well-known/mcp/server-card.json"),
    fetchTextWithMeta("https://mcp.packrift.com/llms-full.txt", { "User-Agent": "ChatGPT-User" }),
  ]);
  const manifestBody = manifest.body || {};
  const tools = stringArray(manifestBody.tools);
  const prompts = stringArray(manifestBody.prompts);
  const serverCards = [serverCard, wellKnownServerCard].map((card) => summarizeServerCard(card));
  const llmsFullSummary = summarizeLlmsFull(llmsFull);
  return {
    ok: Boolean(
      manifest.ok
        && llmsFull.ok
        && serverCards.every((card) => card.ok)
        && tools.includes("create_cart_url")
        && tools.includes("get_cart_handoff_candidates")
        && prompts.includes("prepare_cart_handoff")
        && llmsFullSummary.priority_sku_count > 0
    ),
    manifest: {
      url: manifest.url,
      ok: manifest.ok,
      http_status: manifest.http_status,
      version: manifestBody.version ?? null,
      tool_count: tools.length,
      prompt_count: prompts.length,
      has_create_cart_url: tools.includes("create_cart_url"),
      has_get_cart_handoff_candidates: tools.includes("get_cart_handoff_candidates"),
      has_prepare_cart_handoff_prompt: prompts.includes("prepare_cart_handoff"),
      cache: manifest.cache,
    },
    server_cards: serverCards,
    llms_full: llmsFullSummary,
  };
}

function buildIndexNowSummary() {
  const manifestPath = findLatestIndexNowManifest();
  if (!manifestPath) {
    return {
      ok: false,
      error: `No IndexNow release manifest found under ${FACTORY_OUTPUT_ROOT}`,
    };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return {
    ok: Boolean(
      manifest.status === "pass"
        && manifest.qa_pass === true
        && Number(manifest.preflight_fail_count || 0) === 0
        && Number(manifest.submitted_url_count || 0) > 0
        && Number(manifest.endpoint_ok_count || 0) > 0
    ),
    manifest_path: manifestPath,
    release_id: manifest.release_id ?? null,
    generated_at: manifest.generated_at ?? null,
    host: manifest.host ?? null,
    core_only: manifest.core_only ?? null,
    status: manifest.status ?? null,
    qa_pass: manifest.qa_pass ?? null,
    key_location_ok: manifest.key_location_ok ?? null,
    candidate_url_count: Number(manifest.candidate_url_count || 0),
    preflight_pass_count: Number(manifest.preflight_pass_count || 0),
    preflight_fail_count: Number(manifest.preflight_fail_count || 0),
    submitted_url_count: Number(manifest.submitted_url_count || 0),
    endpoint_ok_count: Number(manifest.endpoint_ok_count || 0),
    source_meta: manifest.source_meta ?? null,
    artifacts: manifest.artifacts ?? null,
  };
}

async function fetchJsonWithMeta(url, headers = {}) {
  const text = await fetchTextWithMeta(url, headers);
  if (!text.ok) return { ...text, body: null };
  try {
    return { ...text, body: JSON.parse(text.body) };
  } catch (error) {
    return { ...text, ok: false, body: null, error: `Invalid JSON: ${error.message || String(error)}` };
  }
}

async function fetchTextWithMeta(url, headers = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { "User-Agent": "Packrift-MCP-Funnel-Snapshot/1.0", ...headers },
    signal: AbortSignal.timeout(Number(args["live-timeout-ms"] || 45000)),
  });
  const body = await response.text();
  return {
    url,
    ok: response.ok,
    http_status: response.status,
    latency_ms: Date.now() - startedAt,
    bytes: body.length,
    content_type: response.headers.get("content-type"),
    cache: response.headers.get("x-packrift-static-cache")
      || response.headers.get("cf-cache-status")
      || response.headers.get("cache-control"),
    body,
  };
}

function summarizeServerCard(card) {
  const body = card.body || {};
  const tools = stringArray(body.tools);
  const prompts = stringArray(body.prompts);
  return {
    url: card.url,
    ok: card.ok,
    http_status: card.http_status,
    version: body.version ?? null,
    tool_count: tools.length,
    prompt_count: prompts.length,
    has_create_cart_url: tools.includes("create_cart_url"),
    has_get_cart_handoff_candidates: tools.includes("get_cart_handoff_candidates"),
    has_prepare_cart_handoff_prompt: prompts.includes("prepare_cart_handoff"),
    cache: card.cache,
  };
}

function summarizeLlmsFull(result) {
  if (!result.ok) {
    return {
      url: result.url,
      ok: false,
      http_status: result.http_status,
      error: result.body?.slice(0, 240) || "llms-full fetch failed",
    };
  }
  const text = result.body || "";
  const priorityRows = parsePrioritySkuRows(text);
  const lastUpdated = text.match(/Last updated:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1] ?? null;
  return {
    url: result.url,
    ok: true,
    http_status: result.http_status,
    bytes: result.bytes,
    cache: result.cache,
    content_type: result.content_type,
    last_updated: lastUpdated,
    last_updated_age_days: lastUpdated ? daysSinceDate(lastUpdated) : null,
    priority_sku_count: priorityRows.length,
    top_priority_skus: priorityRows.slice(0, 5),
  };
}

function summarizeGa4AiMcpEvents(rows) {
  const bySource = new Map();
  const byEvent = new Map();
  for (const row of rows) {
    const source = row.sessionSourceMedium || "(not set)";
    const event = row.eventName || "(not set)";
    const count = numberValue(row.eventCount);
    addToMap(bySource, source, count);
    addToMap(byEvent, event, count);
  }
  return {
    row_count: rows.length,
    total_event_count: sum(rows.map((row) => numberValue(row.eventCount))),
    ai_session_start_events: sum(rows.filter((row) => row.eventName === "session_start").map((row) => numberValue(row.eventCount))),
    mcp_specific_session_start_events: sum(
      rows
        .filter((row) => row.eventName === "session_start" && /mcp/i.test(row.sessionSourceMedium || ""))
        .map((row) => numberValue(row.eventCount))
    ),
    session_start_by_source: rows
      .filter((row) => row.eventName === "session_start")
      .map((row) => ({ source_medium: row.sessionSourceMedium || "", event_count: numberValue(row.eventCount) }))
      .sort((a, b) => b.event_count - a.event_count),
    commerce_by_source: summarizeCommerceRows(rows),
    top_sources: topMap(bySource),
    top_events: topMap(byEvent),
  };
}

function summarizeCommerceRows(rows) {
  const commerceEvents = new Set(["add_to_cart", "begin_checkout", "purchase"]);
  const out = new Map();
  for (const row of rows) {
    if (!commerceEvents.has(row.eventName)) continue;
    const source = row.sessionSourceMedium || "(not set)";
    const current = out.get(source) || { source_medium: source, add_to_cart: 0, begin_checkout: 0, purchase: 0, revenue: 0 };
    current[row.eventName] += numberValue(row.eventCount);
    current.revenue += numberValue(row.totalRevenue);
    out.set(source, current);
  }
  return Array.from(out.values()).sort((a, b) => b.purchase - a.purchase || b.begin_checkout - a.begin_checkout || b.add_to_cart - a.add_to_cart);
}

function summarizeGa4CartLandings(rows) {
  return {
    row_count: rows.length,
    event_count: sum(rows.map((row) => numberValue(row.eventCount))),
    key_events: sum(rows.map((row) => numberValue(row.keyEvents))),
    revenue: sum(rows.map((row) => numberValue(row.totalRevenue))),
    sources: topMap(rows.reduce((map, row) => {
      addToMap(map, row.sessionSourceMedium || "(not set)", numberValue(row.eventCount));
      return map;
    }, new Map())),
    landing_pages: rows.slice(0, 25).map((row) => ({
      source_medium: row.sessionSourceMedium || "",
      landing_page: row.landingPagePlusQueryString || "",
      event_name: row.eventName || "",
      event_count: numberValue(row.eventCount),
      key_events: numberValue(row.keyEvents),
      revenue: numberValue(row.totalRevenue),
    })),
  };
}

function applyProofGate(value) {
  const firstParty = value.first_party_mcp || {};
  const ga4 = value.ga4 || {};
  const distribution = value.distribution || {};
  const totalMcpSessions = Number(ga4.ai_mcp_events?.mcp_specific_session_start_events || 0);
  value.proof_gate = {
    thousands_of_qualified_visitors: totalMcpSessions >= 1000,
    stamped_mcp_cart_landings: Number(ga4.mcp_cart_url_landings?.event_count || 0) > 0,
    measurable_mcp_sales: Number(ga4.mcp_cart_url_landings?.revenue || 0) > 0,
    mcp_tool_usage_is_material: Number(firstParty.total_tool_calls || 0) >= 50,
    distribution_core_live: Number(distribution.counts?.pass || 0) >= 2 && Number(distribution.counts?.fail || 0) === 0,
    llms_full_static_availability: Boolean(value.static_availability?.ok)
      && Number(value.static_availability?.status_5xx_rate || 0) < 0.01,
  };
  value.status = Object.values(value.proof_gate).every(Boolean) ? "proven" : "not_proven";
}

function writeArtifacts(value) {
  writeFileSync(join(outDir, "mcp-funnel-snapshot.json"), JSON.stringify(value, null, 2) + "\n", "utf8");
  writeFileSync(join(outDir, "mcp-funnel-snapshot.md"), markdownReport(value), "utf8");
  if (value.partial_snapshot) return;
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(join(OUT_ROOT, "latest.json"), JSON.stringify(value, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_ROOT, "latest.md"), markdownReport(value), "utf8");
}

function markdownReport(value) {
  const fp = value.first_party_mcp || {};
  const ga4 = value.ga4 || {};
  const cart = ga4.mcp_cart_url_landings || {};
  const dist = value.distribution || {};
  const live = value.live_discovery || {};
  const availability = value.static_availability || {};
  const indexnow = value.indexnow || {};
  const liveManifest = live.manifest || {};
  const liveLlms = live.llms_full || {};
  return [
    "# Packrift MCP Funnel Snapshot",
    "",
    `Generated: ${value.generated_at}`,
    `Status: ${value.status}`,
    value.partial_snapshot ? `Partial snapshot: yes (${value.skipped_checks.join(", ")} skipped)` : "Partial snapshot: no",
    "",
    "## Proof Gate",
    "",
    "| Requirement | Proven | Evidence |",
    "| --- | --- | --- |",
    `| Thousands of qualified MCP visitors | ${yesNo(value.proof_gate.thousands_of_qualified_visitors)} | ${ga4.ai_mcp_events?.mcp_specific_session_start_events ?? 0} MCP-specific session_start events in pulled GA4 report |`,
    `| Stamped MCP cart landings | ${yesNo(value.proof_gate.stamped_mcp_cart_landings)} | ${cart.event_count ?? 0} GA4 events on create_cart_url UTM landing pages |`,
    `| Measurable MCP sales | ${yesNo(value.proof_gate.measurable_mcp_sales)} | $${numberValue(cart.revenue).toFixed(2)} revenue on stamped MCP cart landing rows |`,
    `| Material MCP tool usage | ${yesNo(value.proof_gate.mcp_tool_usage_is_material)} | ${fp.total_tool_calls ?? 0} first-party MCP tool calls for ${fp.date ?? "selected date"} |`,
    `| Distribution core live | ${yesNo(value.proof_gate.distribution_core_live)} | ${dist.counts ? `${dist.counts.pass} pass, ${dist.counts.stale} stale, ${dist.counts.blocked} blocked, ${dist.counts.fail} fail` : "not checked"} |`,
    `| llms-full static availability | ${yesNo(value.proof_gate.llms_full_static_availability)} | ${availability.total_fetches ?? 0} fetches, ${percentValue(availability.failed_fetch_rate)} failure rate, ${percentValue(availability.status_5xx_rate)} 5xx rate |`,
    "",
    "## First-Party MCP",
    "",
    `- Date: ${fp.date ?? "not available"}`,
    `- Total events: ${fp.total_events ?? 0}`,
    `- MCP tool calls: ${fp.total_tool_calls ?? 0}`,
    `- create_cart_url calls: ${fp.create_cart_url_calls ?? 0}`,
    `- Cart clicks: ${fp.cart_clicks ?? 0}`,
    `- AI corpus clicks: ${fp.ai_corpus_clicks ?? 0}`,
    `- SKU page views: ${fp.sku_page_views ?? 0}`,
    "",
    "## GA4 MCP Attribution",
    "",
    `- GA4 output: ${ga4.output_dir ?? "not run"}`,
    `- AI/MCP event rows: ${ga4.ai_mcp_events?.row_count ?? 0}`,
    `- Total AI/MCP session_start events: ${ga4.ai_mcp_events?.ai_session_start_events ?? 0}`,
    `- MCP-specific session_start events: ${ga4.ai_mcp_events?.mcp_specific_session_start_events ?? 0}`,
    `- Stamped cart landing rows: ${cart.row_count ?? 0}`,
    `- Stamped cart landing events: ${cart.event_count ?? 0}`,
    `- Stamped cart landing revenue: $${numberValue(cart.revenue).toFixed(2)}`,
    "",
    "## Distribution",
    "",
    `- Distribution output: ${dist.latest_path ?? "not run"}`,
    `- Counts: ${dist.counts ? `${dist.counts.pass} pass, ${dist.counts.stale} stale, ${dist.counts.blocked} blocked, ${dist.counts.fail} fail` : "not checked"}`,
    "",
    "## Live Discovery",
    "",
    `- Status: ${live.ok == null ? "not checked" : yesNo(live.ok)}`,
    `- Manifest: version ${liveManifest.version ?? "unknown"}, ${liveManifest.tool_count ?? 0} tools, ${liveManifest.prompt_count ?? 0} prompts`,
    `- Cart handoff surfaces: create_cart_url ${yesNo(liveManifest.has_create_cart_url)}, get_cart_handoff_candidates ${yesNo(liveManifest.has_get_cart_handoff_candidates)}, prepare_cart_handoff ${yesNo(liveManifest.has_prepare_cart_handoff_prompt)}`,
    `- Server cards live: ${Array.isArray(live.server_cards) ? `${live.server_cards.filter((card) => card.ok).length}/${live.server_cards.length}` : "not checked"}`,
    `- llms-full: ${liveLlms.priority_sku_count ?? 0} priority SKUs, top SKU ${liveLlms.top_priority_skus?.[0]?.sku ?? "not available"}, cache ${liveLlms.cache ?? "unknown"}`,
    "",
    "## Static Availability",
    "",
    `- Status: ${availability.ok == null ? "not checked" : yesNo(availability.ok)}`,
    `- Fetches: ${availability.total_fetches ?? 0} across ${availability.user_agents?.length ?? 0} AI user agents`,
    `- Failure rate: ${percentValue(availability.failed_fetch_rate)}`,
    `- 5xx rate: ${percentValue(availability.status_5xx_rate)}`,
    `- Content failure rate: ${percentValue(availability.content_fail_rate)}`,
    `- p95 latency: ${availability.latency_ms?.p95 ?? 0} ms`,
    "",
    "## IndexNow Discovery",
    "",
    `- Status: ${indexnow.status ?? (indexnow.ok == null ? "not checked" : yesNo(indexnow.ok))}`,
    `- Submitted URLs: ${indexnow.submitted_url_count ?? 0} / ${indexnow.candidate_url_count ?? 0}`,
    `- Preflight failures: ${indexnow.preflight_fail_count ?? 0}`,
    `- Endpoint ok count: ${indexnow.endpoint_ok_count ?? 0}`,
    `- Manifest: ${indexnow.manifest_path ?? "not found"}`,
    "",
    "## Next Actions",
    "",
    "- Keep recrawl pressure on stale directories until Packrift appears with current tools and cart handoff resources.",
    "- Push real buyer/tool usage toward create_cart_url and monitor GA4 stamped cart landing rows.",
    "- Do not call the goal complete until stamped MCP landings, material MCP tool usage, and MCP-attributed sales are visible.",
    "",
  ].join("\n");
}

function readCsv(path) {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parsePrioritySkuRows(text) {
  const section = text.split("## Priority exact-spec SKUs for agent lookup")[1]?.split(/\n##\s+/)[0] || "";
  return section
    .split(/\r?\n/)
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return {
        rank: numberValue(cells[0]),
        sku: cells[1] || "",
        family: cells[2] || "",
        exact_spec: cells[3] || "",
        recent_signal: cells[4] || "",
        mcp_sku_record: cells[5] || "",
      };
    })
    .filter((row) => row.sku);
}

function findLatestIndexNowManifest() {
  if (!existsSync(FACTORY_OUTPUT_ROOT)) return null;
  return readdirSync(FACTORY_OUTPUT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(FACTORY_OUTPUT_ROOT, entry.name, "mcp_ai_corpus_indexnow_submission", "release_manifest.json"))
    .filter((path) => existsSync(path))
    .map((path) => {
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return { path, generated_at: parsed.generated_at || "" };
      } catch {
        return { path, generated_at: "" };
      }
    })
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at) || b.path.localeCompare(a.path))[0]?.path || null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function objectFromTopRows(rows = []) {
  return Object.fromEntries(rows.map((row) => [row.key, Number(row.count || 0)]));
}

function addToMap(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

function topMap(map, limit = 25) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(values) {
  return values.reduce((total, value) => total + numberValue(value), 0);
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function percentValue(value) {
  return `${(numberValue(value) * 100).toFixed(2)}%`;
}

function utcDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysSinceDate(value) {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.replace(/^export\s+/, "").split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
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

function skippedChecks() {
  return [
    args["skip-ga4"] ? "ga4" : "",
    args["skip-distribution"] ? "distribution" : "",
    args["skip-live-discovery"] ? "live_discovery" : "",
    args["skip-static-availability"] ? "static_availability" : "",
    args["skip-indexnow"] ? "indexnow" : "",
  ].filter(Boolean);
}
