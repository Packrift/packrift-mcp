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
const GA4_REALTIME_PULLER = resolve(REPO_ROOT, "scripts/pull-ga4-realtime-mcp-cart.py");
const MCP_STATS_ENV = "/Users/farhan/Downloads/env-packrift-mcp-stats.txt";
const OUT_ROOT = resolve(REPO_ROOT, "outputs/mcp-funnel-snapshot");
const DEFAULT_PROPERTY_ID = "531219331";
const DEFAULT_REPORTS = "ai_mcp_events,mcp_cart_url_landings";
const DEFAULT_GA4_START_DATE = "90daysAgo";
const DEFAULT_GA4_END_DATE = "today";
const ROOT_SHOPIFY_CART_ACTIVATION_CHECKS = [
  {
    name: "root_llms_txt",
    url: "https://packrift.com/llms.txt",
    markers: ["mcp-cart-activation.json", "create_cart_url", "/r/cart/", "mcp-cart-handoff-candidates.json"],
  },
  {
    name: "root_llms_full_txt",
    url: "https://packrift.com/llms-full.txt",
    markers: ["mcp-cart-activation.json", "create_cart_url", "/r/cart/", "mcp-cart-handoff-candidates.json"],
  },
  {
    name: "root_agents_md",
    url: "https://packrift.com/agents.md",
    markers: ["mcp-cart-activation.json", "create_cart_url", "/r/cart/", "mcp-cart-handoff-candidates.json"],
  },
  {
    name: "shopify_agent_instructions",
    url: "https://packrift.com/pages/packrift-ai-agent-instructions?view=default",
    markers: ["mcp-cart-activation.json", "create_cart_url", "https://mcp.packrift.com/r/cart/", "MCP cart activation"],
  },
  {
    name: "shopify_exact_spec_data",
    url: "https://packrift.com/pages/packrift-ai-exact-spec-data?view=default",
    markers: ["mcp-cart-activation.json", "create_cart_url", "https://mcp.packrift.com/r/cart/1066", "Measured cart"],
  },
  {
    name: "mcp_cart_landing_shim",
    url: "https://mcp.packrift.com/r/cart/1066?utm_source=chatgpt-mcp&utm_medium=mcp_tool&utm_campaign=create_cart_url&utm_content=1066&utm_term=1066&ref=mcp&qty=1",
    markers: ["Preparing Packrift cart", "mcp_cart_landing", "https://packrift.com/cart/"],
  },
];

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
  proof_metrics: null,
  first_party_mcp: null,
  first_party_orders: null,
  ga4: null,
  distribution: null,
  live_discovery: null,
  root_shopify_cart_activation_live: null,
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
  snapshot.first_party_orders = await buildFirstPartyOrderSummary();
} catch (error) {
  snapshot.first_party_orders = { ok: false, error: error.message || String(error) };
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
  if (!args["skip-root-shopify-cart-activation"]) snapshot.root_shopify_cart_activation_live = await buildRootShopifyCartActivationSummary();
} catch (error) {
  snapshot.root_shopify_cart_activation_live = { ok: false, error: error.message || String(error) };
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
    qualified_external_mcp_session_starts: snapshot.proof_metrics?.qualified_external_mcp_session_starts ?? null,
    qualified_external_cart_landings: snapshot.proof_metrics?.qualified_external_cart_landings ?? null,
    qualified_external_cart_revenue: snapshot.proof_metrics?.qualified_external_cart_revenue ?? null,
    first_party_mcp_orders: snapshot.first_party_orders?.attributed_order_count ?? null,
    first_party_mcp_order_revenue: snapshot.first_party_orders?.attributed_revenue ?? null,
    ga4_mcp_cart_url_landing_events: snapshot.ga4?.mcp_cart_url_landings?.event_count ?? null,
    ga4_realtime_mcp_cart_events: snapshot.ga4?.realtime_mcp_cart_events?.event_count ?? null,
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
  const byEventSource = objectFromTopRows(parsed.by_event_source);
  const byEventAttribution = objectFromTopRows(parsed.by_event_attribution);
  const mcpDiscoveryEvents = sum([
    byEvent.mcp_tools_list,
    byEvent.mcp_prompt_list,
    byEvent.mcp_prompt_get,
    byEvent.mcp_resource_list,
    byEvent.mcp_resource_templates_list,
    byEvent.mcp_resource_read,
  ]);
  return {
    ok: Boolean(parsed.ok),
    date: parsed.date,
    limit: parsed.limit,
    latency_ms: Date.now() - startedAt,
    total_events: Number(parsed.total_events || 0),
    total_tool_calls: Number(parsed.total_tool_calls || 0),
    mcp_discovery_events: mcpDiscoveryEvents,
    tools_list_events: Number(byEvent.mcp_tools_list || 0),
    prompt_list_events: Number(byEvent.mcp_prompt_list || 0),
    prompt_get_events: Number(byEvent.mcp_prompt_get || 0),
    resource_list_events: Number(byEvent.mcp_resource_list || 0),
    resource_template_list_events: Number(byEvent.mcp_resource_templates_list || 0),
    resource_read_events: Number(byEvent.mcp_resource_read || 0),
    create_cart_url_calls: Number(byTool.create_cart_url || 0),
    start_clicks: Number(byEvent.mcp_start_click || 0),
    cart_clicks: Number(byEvent.cart_click || 0),
    mcp_cart_landings: Number(byEvent.mcp_cart_landing || 0),
    qualified_first_party_mcp_cart_landings: qualifiedFirstPartyCartLandings(byEventAttribution, byEventSource),
    product_clicks: Number(byEvent.product_click || 0),
    quote_clicks: Number(byEvent.quote_click || 0),
    reorder_clicks: Number(byEvent.reorder_click || 0),
    sku_page_views: Number(byEvent.sku_page_view || 0),
    ai_corpus_clicks: Number(byEvent.ai_corpus_click || 0),
    top_events: parsed.by_event || [],
    top_tools: parsed.by_tool || [],
    top_prompts: parsed.by_prompt || [],
    top_resources: parsed.by_resource || [],
    top_mcp_methods: parsed.by_mcp_method || [],
    top_start_sources: parsed.by_start_source || [],
    top_utm_sources: parsed.by_utm_source || [],
    top_utm_campaigns: parsed.by_utm_campaign || [],
    top_event_sources: parsed.by_event_source || [],
    top_event_attribution: parsed.by_event_attribution || [],
    top_sources: parsed.by_source || [],
    top_skus: parsed.by_sku || [],
    top_bot_families: parsed.by_bot_family || [],
    top_packrift_ai_ids: parsed.by_packrift_ai_id || [],
    top_mcp_keys: parsed.by_mcp_key || [],
    top_mcp_journeys: parsed.by_mcp_journey || [],
    top_tool_mcp_keys: parsed.by_tool_mcp_key || [],
    recent_tool_calls: parsed.recent_tool_calls || [],
    traffic_quality: summarizeFirstPartyTrafficQuality(parsed),
  };
}

async function buildFirstPartyOrderSummary() {
  const token = process.env.MCP_STATS_TOKEN || "";
  if (!token) {
    return { ok: false, error: "MCP_STATS_TOKEN is not available in the local environment." };
  }
  const url = new URL("https://mcp.packrift.com/admin/mcp-orders");
  url.searchParams.set("days", String(args["order-days"] || args["ga4-lookback-days"] || "90"));
  url.searchParams.set("limit", String(args["order-limit"] || "250"));
  url.searchParams.set("token", token);
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { "User-Agent": "Packrift-MCP-Funnel-Snapshot/1.0" },
    signal: AbortSignal.timeout(Number(args["order-timeout-ms"] || 60000)),
  });
  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      http_status: response.status,
      latency_ms: Date.now() - startedAt,
      error: body.slice(0, 500),
    };
  }
  const parsed = JSON.parse(body);
  return {
    ...parsed,
    latency_ms: Date.now() - startedAt,
    orders: Array.isArray(parsed.orders) ? parsed.orders.slice(0, 25) : [],
  };
}

function runGa4Pull() {
  if (!existsSync(GA4_PULLER)) return { ok: false, error: `Missing GA4 puller at ${GA4_PULLER}` };
  const outputDir = join(outDir, "ga4-pull");
  const reports = args.reports || DEFAULT_REPORTS;
  const startDate = args["ga4-start-date"] || args["start-date"] || DEFAULT_GA4_START_DATE;
  const endDate = args["ga4-end-date"] || args["end-date"] || DEFAULT_GA4_END_DATE;
  const result = spawnSync("python3", [
    GA4_PULLER,
    "--property-id",
    args["property-id"] || process.env.PACKRIFT_GA4_PROPERTY_ID || DEFAULT_PROPERTY_ID,
    "--auth-mode",
    args["auth-mode"] || process.env.PACKRIFT_GA4_AUTH_MODE || "oauth",
    "--reports",
    reports,
    "--start-date",
    startDate,
    "--end-date",
    endDate,
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
    start_date: startDate,
    end_date: endDate,
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
    realtime_mcp_cart_events: args["skip-ga4-realtime"] ? { ok: false, skipped: true } : runGa4RealtimeMcpCart(),
  };
}

function runGa4RealtimeMcpCart() {
  if (!existsSync(GA4_REALTIME_PULLER)) return { ok: false, error: `Missing GA4 realtime puller at ${GA4_REALTIME_PULLER}` };
  const result = spawnSync("python3", [GA4_REALTIME_PULLER], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: Number(args["ga4-realtime-timeout-ms"] || 120000),
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

async function buildRootShopifyCartActivationSummary() {
  const checks = await Promise.all(
    ROOT_SHOPIFY_CART_ACTIVATION_CHECKS.map(async (check) => {
      const response = await fetchTextWithMeta(check.url, {
        "User-Agent": check.name === "mcp_cart_landing_shim" ? "Packrift-MCP-Funnel-Snapshot/1.0" : "ChatGPT-User/1.0",
        "Accept": "text/plain,text/markdown,text/html,application/json,*/*",
        "Cache-Control": "no-cache",
      });
      return summarizeRootCartActivationCheck(check, response);
    })
  );
  return {
    ok: checks.every((check) => check.ok),
    release: "PACKRIFT-ROOT-SHOPIFY-CART-ACTIVATION-GATE-R01",
    purpose:
      "Hard gate for root-domain agent discovery and cart continuity. Packrift.com surfaces must expose MCP cart activation, create_cart_url, measured /r/cart handoff, and the cart landing shim.",
    passed_checks: checks.filter((check) => check.ok).length,
    total_checks: checks.length,
    checks,
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

function summarizeRootCartActivationCheck(check, response) {
  const body = response.body || "";
  const missing = check.markers.filter((marker) => !body.includes(marker));
  const finalUrl = response.final_url || response.url;
  return {
    name: check.name,
    url: check.url,
    final_url: finalUrl,
    ok: Boolean(response.ok && missing.length === 0),
    http_status: response.http_status,
    content_type: response.content_type,
    bytes: response.bytes,
    cache: response.cache,
    missing_markers: missing,
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
    final_url: response.url,
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
    traffic_quality: summarizeGa4TrafficQuality(rows),
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
    traffic_quality: summarizeGa4TrafficQuality(rows, { cartLanding: true }),
    sources: topMap(rows.reduce((map, row) => {
      addToMap(map, row.sessionSourceMedium || "(not set)", numberValue(row.eventCount));
      return map;
    }, new Map())),
    landing_pages: rows.slice(0, 25).map((row) => ({
      source_medium: row.sessionSourceMedium || "",
      landing_page: row.landingPagePlusQueryString || row.pagePathPlusQueryString || row.pageLocation || "",
      event_name: row.eventName || "",
      event_count: numberValue(row.eventCount),
      key_events: numberValue(row.keyEvents),
      revenue: numberValue(row.totalRevenue),
    })),
  };
}

function summarizeFirstPartyTrafficQuality(parsed) {
  const bySource = summarizeTopRowsByTrafficBucket(parsed.by_source || [], classifyFirstPartySource);
  const byBotFamily = summarizeTopRowsByTrafficBucket(parsed.by_bot_family || [], classifyBotFamily);
  const byEvent = summarizeTopRowsByTrafficBucket(parsed.by_event || [], classifyFirstPartyEvent);
  return {
    rules: [
      "external_qualified_demand: MCP tool, cart, checkout, quote, reorder, or ChatGPT-user activity not tagged as internal or self-generated",
      "external_unqualified_ai_crawl: known crawler/bot discovery activity without cart or commerce progression",
      "internal_synthetic: QA, smoke, eval, test, curl, python, Codex, or Packrift-owned checker traffic",
      "self_generated_distribution: corpus, route-catalog, sitemap, directory, and outreach surfaces created by Packrift to seed discovery",
      "unknown: browser_or_unknown and other rows that cannot prove external qualified buyer demand",
    ],
    source: bySource,
    bot_family: byBotFamily,
    event: byEvent,
    excluded_internal_or_synthetic_events:
      bucketCount(bySource.buckets, "internal_synthetic") + bucketCount(bySource.buckets, "internal_operator"),
    self_generated_distribution_events: bucketCount(bySource.buckets, "self_generated_distribution"),
    external_qualified_events: bucketCount(bySource.buckets, "external_qualified_demand"),
  };
}

function summarizeGa4TrafficQuality(rows, options = {}) {
  const classified = rows.map((row) => {
    const classification = classifyGa4Row(row, options);
    const eventCount = numberValue(row.eventCount);
    const revenue = numberValue(row.totalRevenue);
    const eventName = row.eventName || "(not set)";
    return {
      bucket: classification.bucket,
      reason: classification.reason,
      source_medium: row.sessionSourceMedium || "(not set)",
      event_name: eventName,
      landing_page: row.landingPagePlusQueryString || row.pagePathPlusQueryString || row.pageLocation || "",
      event_count: eventCount,
      session_start_count: eventName === "session_start" ? eventCount : 0,
      revenue,
    };
  });
  const eventBuckets = emptyTrafficBuckets();
  const sessionStartBuckets = emptyTrafficBuckets();
  const revenueBuckets = emptyTrafficBuckets();
  for (const row of classified) {
    eventBuckets[row.bucket] += row.event_count;
    sessionStartBuckets[row.bucket] += row.session_start_count;
    revenueBuckets[row.bucket] += row.revenue;
  }
  return {
    rules: [
      "MCP-qualified GA4 demand requires chatgpt-mcp/mcp_tool/create_cart_url attribution, MCP cart landing parameters, or commerce progression tied to an MCP source.",
      "Internal and synthetic source strings are excluded before any qualified-demand count.",
      "Catalog, sitemap, route catalog, and crawler-only rows can prove discovery, but not qualified buyer demand.",
    ],
    event_count_buckets: eventBuckets,
    session_start_buckets: sessionStartBuckets,
    revenue_buckets: revenueBuckets,
    qualified_external_events: eventBuckets.external_qualified_demand,
    qualified_external_session_starts: sessionStartBuckets.external_qualified_demand,
    qualified_external_revenue: revenueBuckets.external_qualified_demand,
    excluded_internal_or_synthetic_events: eventBuckets.internal_synthetic + eventBuckets.internal_operator,
    self_generated_distribution_events: eventBuckets.self_generated_distribution,
    classified_top_rows: classified
      .sort((a, b) => b.event_count - a.event_count || a.source_medium.localeCompare(b.source_medium))
      .slice(0, 25),
  };
}

function summarizeTopRowsByTrafficBucket(rows, classifier) {
  const buckets = emptyTrafficBuckets();
  const classified_top_rows = rows.map((row) => {
    const key = String(row.key ?? "");
    const count = Number(row.count || 0);
    const classification = classifier(key);
    buckets[classification.bucket] += count;
    return {
      key,
      count,
      bucket: classification.bucket,
      reason: classification.reason,
    };
  });
  return { buckets, classified_top_rows };
}

function emptyTrafficBuckets() {
  return {
    external_qualified_demand: 0,
    external_unqualified_ai_crawl: 0,
    internal_synthetic: 0,
    internal_operator: 0,
    self_generated_distribution: 0,
    unknown: 0,
  };
}

function bucketCount(buckets, name) {
  return Number(buckets?.[name] || 0);
}

function qualifiedFirstPartyCartLandings(byEventAttribution, byEventSource) {
  const rows = Object.keys(byEventAttribution || {}).length ? byEventAttribution : byEventSource;
  return Object.entries(rows || {}).reduce((total, [key, count]) => {
    const text = String(key || "").toLowerCase();
    if (!text.startsWith("mcp_cart_landing|")) return total;
    if (matchesInternalSynthetic(text) || matchesSelfGeneratedDistribution(text)) return total;
    return matchesExternalQualifiedDemand(text) ? total + Number(count || 0) : total;
  }, 0);
}

function classifyFirstPartySource(value) {
  const text = String(value || "").toLowerCase();
  if (matchesInternalSynthetic(text)) return { bucket: "internal_synthetic", reason: "internal_or_synthetic_source" };
  if (matchesSelfGeneratedDistribution(text)) return { bucket: "self_generated_distribution", reason: "packrift_seeded_discovery_surface" };
  if (matchesExternalQualifiedDemand(text)) return { bucket: "external_qualified_demand", reason: "mcp_tool_or_cart_handoff_source" };
  if (text === "mcp_discovery" || matchesExternalCrawler(text)) return { bucket: "external_unqualified_ai_crawl", reason: "discovery_without_buyer_progression" };
  return { bucket: "unknown", reason: "source_not_enough_to_prove_external_qualified_demand" };
}

function classifyFirstPartyEvent(value) {
  const text = String(value || "").toLowerCase();
  if (/mcp_tool_call|mcp_cart_landing|cart_click|product_click|quote_click|reorder_click|exact_match|multi_match|spec_search|copy_procurement_spec/.test(text)) {
    return { bucket: "external_qualified_demand", reason: "buyer_or_tool_progression_event_type" };
  }
  if (/mcp_tools_list|mcp_prompt_list|mcp_prompt_get|mcp_resource_list|mcp_resource_templates_list|mcp_resource_read|sku_page_view|ai_corpus_click/.test(text)) {
    return { bucket: "external_unqualified_ai_crawl", reason: "discovery_or_resource_read_event_type" };
  }
  return { bucket: "unknown", reason: "event_type_not_classified" };
}

function classifyBotFamily(value) {
  const text = String(value || "").toLowerCase();
  if (/openai_chatgpt_user|perplexity_user/.test(text)) return { bucket: "external_qualified_demand", reason: "known_user_agent_fetch" };
  if (/bot|crawler|spider|gptbot|oai_searchbot|claude|anthropic|google|bing|duckduck|bytespider|storebot/.test(text)) {
    return { bucket: "external_unqualified_ai_crawl", reason: "known_crawler_or_bot_family" };
  }
  if (text === "unknown" || text === "browser_or_unknown") return { bucket: "unknown", reason: "unknown_or_browser_family" };
  return { bucket: "unknown", reason: "bot_family_not_classified" };
}

function classifyGa4Row(row, options = {}) {
  const source = row.sessionSourceMedium || "";
  const event = row.eventName || "";
  const landing = row.landingPagePlusQueryString || row.pagePathPlusQueryString || row.pageLocation || "";
  const combined = `${source} ${event} ${landing}`.toLowerCase();
  if (matchesInternalSynthetic(combined)) return { bucket: "internal_synthetic", reason: "internal_or_synthetic_ga4_source" };
  if (options.cartLanding && matchesMcpCartAttribution(combined)) {
    return { bucket: "external_qualified_demand", reason: "mcp_cart_landing_attribution" };
  }
  if (matchesExternalQualifiedDemand(combined) && /session_start|add_to_cart|begin_checkout|purchase|mcp_cart_landing|cart/.test(combined)) {
    return { bucket: "external_qualified_demand", reason: "mcp_source_with_session_or_commerce_progression" };
  }
  if (matchesSelfGeneratedDistribution(combined)) return { bucket: "self_generated_distribution", reason: "packrift_seeded_discovery_surface" };
  if (matchesExternalCrawler(combined)) return { bucket: "external_unqualified_ai_crawl", reason: "crawler_or_bot_source_without_commerce_progression" };
  return { bucket: "unknown", reason: "ga4_row_not_enough_to_prove_external_qualified_demand" };
}

function matchesInternalSynthetic(text) {
  return (
    /(codex|localhost|manual_verify|packrift-agent|packrift-mcp-funnel|packrift-static|routecatalogqa|packriftqa|criticalpathqa|curl\/|python-urllib|node-fetch|undici)/i.test(text)
    || /(^|[^a-z0-9])(qa|smoke|synthetic|eval|test)([^a-z0-9]|$)/i.test(text)
  );
}

function matchesSelfGeneratedDistribution(text) {
  return /(mcp_ai_corpus|mcp_sku_page|conversion_route|conversion_starter|measured_handoff|ai_commerce_id_stitching|directory|submission|outreach|indexnow|sitemap|llms|resource_read|resources\/list|browser_agent_bridge|mcp_buyer_use_cases|mcp_usage_snapshot|mcp_install_matrix|mcp_directory_refresh|generated_ai_resource)/i.test(text);
}

function matchesExternalQualifiedDemand(text) {
  return /(chatgpt-mcp|mcp_tool|create_cart_url|get_cart_handoff_candidates|get_pricing|check_inventory|get_product|search_products|cart_click|quote_click|reorder_click)/i.test(text);
}

function matchesMcpCartAttribution(text) {
  return /utm_source=chatgpt-mcp/.test(text) && /utm_medium=mcp_tool/.test(text) && /utm_campaign=create_cart_url/.test(text);
}

function matchesExternalCrawler(text) {
  return /(gptbot|oai-searchbot|perplexitybot|perplexity-user|googlebot|bingbot|claudebot|anthropic-ai|bytespider|duckduckbot|crawler|spider|bot)/i.test(text);
}

function applyProofGate(value) {
  const firstParty = value.first_party_mcp || {};
  const firstPartyOrders = value.first_party_orders || {};
  const ga4 = value.ga4 || {};
  const distribution = value.distribution || {};
  const totalMcpSessions = Number(ga4.ai_mcp_events?.mcp_specific_session_start_events || 0);
  const qualifiedExternalMcpSessions = Number(ga4.ai_mcp_events?.traffic_quality?.qualified_external_session_starts || 0);
  const qualifiedGa4CartLandings = Number(ga4.mcp_cart_url_landings?.traffic_quality?.qualified_external_events || 0);
  const qualifiedFirstPartyCartLandings = Number(firstParty.qualified_first_party_mcp_cart_landings || 0);
  const qualifiedExternalCartLandings = Math.max(qualifiedGa4CartLandings, qualifiedFirstPartyCartLandings);
  const qualifiedExternalCartRevenue = Number(ga4.mcp_cart_url_landings?.traffic_quality?.qualified_external_revenue || 0);
  const firstPartyMcpOrders = Number(firstPartyOrders.attributed_order_count || 0);
  const firstPartyMcpOrderRevenue = Number(firstPartyOrders.attributed_revenue || 0);
  const excludedInternalOrSyntheticEvents =
    Number(firstParty.traffic_quality?.excluded_internal_or_synthetic_events || 0)
    + Number(ga4.ai_mcp_events?.traffic_quality?.excluded_internal_or_synthetic_events || 0)
    + Number(ga4.mcp_cart_url_landings?.traffic_quality?.excluded_internal_or_synthetic_events || 0);
  const selfGeneratedDistributionEvents =
    Number(firstParty.traffic_quality?.self_generated_distribution_events || 0)
    + Number(ga4.ai_mcp_events?.traffic_quality?.self_generated_distribution_events || 0)
    + Number(ga4.mcp_cart_url_landings?.traffic_quality?.self_generated_distribution_events || 0);
  value.proof_metrics = {
    raw_mcp_specific_session_starts: totalMcpSessions,
    qualified_external_mcp_session_starts: qualifiedExternalMcpSessions,
    raw_stamped_mcp_cart_landings: Number(ga4.mcp_cart_url_landings?.event_count || 0),
    raw_first_party_mcp_cart_landings: Number(firstParty.mcp_cart_landings || 0),
    qualified_ga4_cart_landings: qualifiedGa4CartLandings,
    qualified_first_party_mcp_cart_landings: qualifiedFirstPartyCartLandings,
    qualified_external_cart_landings: qualifiedExternalCartLandings,
    raw_stamped_mcp_cart_revenue: Number(ga4.mcp_cart_url_landings?.revenue || 0),
    qualified_external_cart_revenue: qualifiedExternalCartRevenue,
    first_party_mcp_orders: firstPartyMcpOrders,
    first_party_mcp_order_revenue: firstPartyMcpOrderRevenue,
    excluded_internal_or_synthetic_events: excludedInternalOrSyntheticEvents,
    self_generated_distribution_events: selfGeneratedDistributionEvents,
  };
  value.proof_gate = {
    thousands_of_qualified_visitors: qualifiedExternalMcpSessions >= 1000,
    stamped_mcp_cart_landings: qualifiedExternalCartLandings > 0,
    measurable_mcp_sales: qualifiedExternalCartRevenue > 0 || firstPartyMcpOrderRevenue > 0,
    mcp_tool_usage_is_material: Number(firstParty.total_tool_calls || 0) >= 50,
    root_shopify_cart_activation_live: Boolean(value.root_shopify_cart_activation_live?.ok),
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
  const orders = value.first_party_orders || {};
  const ga4 = value.ga4 || {};
  const cart = ga4.mcp_cart_url_landings || {};
  const dist = value.distribution || {};
  const live = value.live_discovery || {};
  const rootCart = value.root_shopify_cart_activation_live || {};
  const availability = value.static_availability || {};
  const indexnow = value.indexnow || {};
  const proofMetrics = value.proof_metrics || {};
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
    `| Thousands of qualified MCP visitors | ${yesNo(value.proof_gate.thousands_of_qualified_visitors)} | ${proofMetrics.qualified_external_mcp_session_starts ?? 0} qualified external MCP session_start events (${proofMetrics.raw_mcp_specific_session_starts ?? 0} raw MCP-specific) |`,
    `| Stamped MCP cart landings | ${yesNo(value.proof_gate.stamped_mcp_cart_landings)} | ${proofMetrics.qualified_external_cart_landings ?? 0} qualified external cart landing receipts (${proofMetrics.raw_stamped_mcp_cart_landings ?? 0} raw GA4 stamped; ${proofMetrics.raw_first_party_mcp_cart_landings ?? 0} raw first-party) |`,
    `| Measurable MCP sales | ${yesNo(value.proof_gate.measurable_mcp_sales)} | $${numberValue(proofMetrics.qualified_external_cart_revenue).toFixed(2)} qualified GA4 cart revenue; ${proofMetrics.first_party_mcp_orders ?? 0} first-party attributed orders / $${numberValue(proofMetrics.first_party_mcp_order_revenue).toFixed(2)} |`,
    `| Material MCP tool usage | ${yesNo(value.proof_gate.mcp_tool_usage_is_material)} | ${fp.total_tool_calls ?? 0} first-party MCP tool calls for ${fp.date ?? "selected date"} |`,
    `| Root Shopify cart activation live | ${yesNo(value.proof_gate.root_shopify_cart_activation_live)} | ${rootCart.passed_checks ?? 0}/${rootCart.total_checks ?? 0} root-domain and cart-shim checks passed |`,
    `| Distribution core live | ${yesNo(value.proof_gate.distribution_core_live)} | ${dist.counts ? `${dist.counts.pass} pass, ${dist.counts.pending ?? 0} pending, ${dist.counts.stale} stale, ${dist.counts.blocked} blocked, ${dist.counts.fail} fail` : "not checked"} |`,
    `| llms-full static availability | ${yesNo(value.proof_gate.llms_full_static_availability)} | ${availability.total_fetches ?? 0} fetches, ${percentValue(availability.failed_fetch_rate)} failure rate, ${percentValue(availability.status_5xx_rate)} 5xx rate |`,
    "",
    "## First-Party MCP",
    "",
    `- Date: ${fp.date ?? "not available"}`,
    `- Total events: ${fp.total_events ?? 0}`,
    `- MCP tool calls: ${fp.total_tool_calls ?? 0}`,
    `- MCP discovery events: ${fp.mcp_discovery_events ?? 0}`,
    `- Tools list events: ${fp.tools_list_events ?? 0}`,
    `- Prompt events: ${(fp.prompt_list_events ?? 0) + (fp.prompt_get_events ?? 0)} (${fp.prompt_list_events ?? 0} list, ${fp.prompt_get_events ?? 0} get)`,
    `- Resource events: ${(fp.resource_list_events ?? 0) + (fp.resource_template_list_events ?? 0) + (fp.resource_read_events ?? 0)} (${fp.resource_list_events ?? 0} list, ${fp.resource_template_list_events ?? 0} template list, ${fp.resource_read_events ?? 0} read)`,
    `- create_cart_url calls: ${fp.create_cart_url_calls ?? 0}`,
    `- Start clicks: ${fp.start_clicks ?? 0}`,
    `- Cart clicks: ${fp.cart_clicks ?? 0}`,
    `- MCP cart landings: ${fp.mcp_cart_landings ?? 0}`,
    `- AI corpus clicks: ${fp.ai_corpus_clicks ?? 0}`,
    `- SKU page views: ${fp.sku_page_views ?? 0}`,
    "",
    "## First-Party Source Attribution",
    "",
    `- Start click sources: ${topRowsSummary(fp.top_start_sources)}`,
    `- UTM sources: ${topRowsSummary(fp.top_utm_sources)}`,
    `- UTM campaigns: ${topRowsSummary(fp.top_utm_campaigns)}`,
    `- MCP keys: ${topRowsSummary(fp.top_mcp_keys)}`,
    `- Tool MCP keys: ${topRowsSummary(fp.top_tool_mcp_keys)}`,
    "",
    "## First-Party MCP Orders",
    "",
    `- Status: ${orders.ok == null ? "not checked" : yesNo(orders.ok)}`,
    `- Lookback: ${orders.lookback_days ?? "not set"} days`,
    `- Shopify orders scanned: ${orders.scanned_order_count ?? 0}`,
    `- MCP-attributed orders: ${orders.attributed_order_count ?? 0}`,
    `- MCP-attributed order revenue: $${numberValue(orders.attributed_revenue).toFixed(2)} ${orders.currency ?? ""}`.trim(),
    "",
    "## Traffic Quality",
    "",
    `- Qualified external MCP sessions: ${proofMetrics.qualified_external_mcp_session_starts ?? 0}`,
    `- Qualified external cart landings: ${proofMetrics.qualified_external_cart_landings ?? 0}`,
    `- Qualified GA4 cart landings: ${proofMetrics.qualified_ga4_cart_landings ?? 0}`,
    `- Qualified first-party MCP cart landings: ${proofMetrics.qualified_first_party_mcp_cart_landings ?? 0}`,
    `- Qualified external cart revenue: $${numberValue(proofMetrics.qualified_external_cart_revenue).toFixed(2)}`,
    `- Excluded internal/synthetic events: ${proofMetrics.excluded_internal_or_synthetic_events ?? 0}`,
    `- Self-generated distribution events: ${proofMetrics.self_generated_distribution_events ?? 0}`,
    `- First-party source buckets: ${trafficBucketSummary(fp.traffic_quality?.source?.buckets)}`,
    `- GA4 session buckets: ${trafficBucketSummary(ga4.ai_mcp_events?.traffic_quality?.session_start_buckets)}`,
    `- GA4 cart landing buckets: ${trafficBucketSummary(cart.traffic_quality?.event_count_buckets)}`,
    "",
    "## GA4 MCP Attribution",
    "",
    `- GA4 output: ${ga4.output_dir ?? "not run"}`,
    `- GA4 date range: ${ga4.start_date ?? "not set"} to ${ga4.end_date ?? "not set"}`,
    `- AI/MCP event rows: ${ga4.ai_mcp_events?.row_count ?? 0}`,
    `- Total AI/MCP session_start events: ${ga4.ai_mcp_events?.ai_session_start_events ?? 0}`,
    `- MCP-specific session_start events: ${ga4.ai_mcp_events?.mcp_specific_session_start_events ?? 0}`,
    `- Stamped cart landing rows: ${cart.row_count ?? 0}`,
    `- Stamped cart landing events: ${cart.event_count ?? 0}`,
    `- Realtime MCP cart events: ${ga4.realtime_mcp_cart_events?.event_count ?? 0}`,
    `- Stamped cart landing revenue: $${numberValue(cart.revenue).toFixed(2)}`,
    "",
    "## Distribution",
    "",
    `- Distribution output: ${dist.latest_path ?? "not run"}`,
    `- Counts: ${dist.counts ? `${dist.counts.pass} pass, ${dist.counts.pending ?? 0} pending, ${dist.counts.stale} stale, ${dist.counts.blocked} blocked, ${dist.counts.fail} fail` : "not checked"}`,
    "",
    "## Live Discovery",
    "",
    `- Status: ${live.ok == null ? "not checked" : yesNo(live.ok)}`,
    `- Manifest: version ${liveManifest.version ?? "unknown"}, ${liveManifest.tool_count ?? 0} tools, ${liveManifest.prompt_count ?? 0} prompts`,
    `- Cart handoff surfaces: create_cart_url ${yesNo(liveManifest.has_create_cart_url)}, get_cart_handoff_candidates ${yesNo(liveManifest.has_get_cart_handoff_candidates)}, prepare_cart_handoff ${yesNo(liveManifest.has_prepare_cart_handoff_prompt)}`,
    `- Server cards live: ${Array.isArray(live.server_cards) ? `${live.server_cards.filter((card) => card.ok).length}/${live.server_cards.length}` : "not checked"}`,
    `- llms-full: ${liveLlms.priority_sku_count ?? 0} priority SKUs, top SKU ${liveLlms.top_priority_skus?.[0]?.sku ?? "not available"}, cache ${liveLlms.cache ?? "unknown"}`,
    "",
    "## Root Shopify Cart Activation",
    "",
    `- Status: ${rootCart.ok == null ? "not checked" : yesNo(rootCart.ok)}`,
    `- Checks: ${rootCart.passed_checks ?? 0}/${rootCart.total_checks ?? 0}`,
    `- Failing checks: ${Array.isArray(rootCart.checks) ? rootCart.checks.filter((check) => !check.ok).map((check) => `${check.name} (${(check.missing_markers || []).join("|") || check.http_status || "failed"})`).join(", ") || "none" : "not checked"}`,
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
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : item?.name)).filter(Boolean).map((item) => String(item))
    : [];
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

function trafficBucketSummary(buckets) {
  if (!buckets) return "not available";
  return Object.entries(buckets)
    .map(([key, value]) => `${key}=${numberValue(value)}`)
    .join(", ");
}

function topRowsSummary(rows, limit = 5) {
  if (!Array.isArray(rows) || rows.length === 0) return "none";
  return rows
    .slice(0, limit)
    .map((row) => `${row.key}=${numberValue(row.count)}`)
    .join(", ");
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
    args["skip-root-shopify-cart-activation"] ? "root_shopify_cart_activation" : "",
    args["skip-static-availability"] ? "static_availability" : "",
    args["skip-indexnow"] ? "indexnow" : "",
  ].filter(Boolean);
}
