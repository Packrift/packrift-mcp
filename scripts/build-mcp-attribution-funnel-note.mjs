#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const SNAPSHOT_PATH = resolve(REPO_ROOT, "outputs/mcp-funnel-snapshot/latest.json");
const SNAPSHOT_MD_PATH = resolve(REPO_ROOT, "outputs/mcp-funnel-snapshot/latest.md");
const DEFAULT_OUT_DIR = "/Users/farhan/Downloads";
const OUT_DIR = resolve(process.env.PACKRIFT_ATTRIBUTION_NOTE_DIR || DEFAULT_OUT_DIR);

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}. Run npm run snapshot:funnel first.`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeReadCsv(path) {
  if (!path || !existsSync(path)) return [];
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function dateStamp(iso) {
  const date = new Date(iso || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function num(value) {
  return Number(value || 0);
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

function pct(numerator, denominator) {
  const den = num(denominator);
  if (!den) return "n/a";
  return `${((num(numerator) / den) * 100).toFixed(1)}%`;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function sourceMetricRows(csvRows, sourceMedium) {
  const rows = csvRows.filter((row) => row.sessionSourceMedium === sourceMedium);
  const metrics = {
    source_medium: sourceMedium,
    session_start: 0,
    page_view: 0,
    view_item: 0,
    add_to_cart: 0,
    begin_checkout: 0,
    purchase: 0,
    revenue: 0,
  };
  for (const row of rows) {
    const eventName = row.eventName;
    const eventCount = num(row.eventCount);
    if (Object.prototype.hasOwnProperty.call(metrics, eventName)) {
      metrics[eventName] += eventCount;
    }
    metrics.revenue += num(row.totalRevenue);
  }
  return metrics;
}

function sourceFallback(snapshot, sourceMedium) {
  const ai = snapshot.ga4?.ai_mcp_events ?? {};
  const sessions = (ai.session_start_by_source ?? []).find((row) => row.source_medium === sourceMedium)?.event_count ?? 0;
  const commerce = (ai.commerce_by_source ?? []).find((row) => row.source_medium === sourceMedium) ?? {};
  return {
    source_medium: sourceMedium,
    session_start: num(sessions),
    page_view: 0,
    view_item: 0,
    add_to_cart: num(commerce.add_to_cart),
    begin_checkout: num(commerce.begin_checkout),
    purchase: num(commerce.purchase),
    revenue: num(commerce.revenue),
  };
}

function sourceFunnel(snapshot, csvRows, sourceMedium) {
  const fromCsv = sourceMetricRows(csvRows, sourceMedium);
  if (
    fromCsv.session_start ||
    fromCsv.page_view ||
    fromCsv.view_item ||
    fromCsv.add_to_cart ||
    fromCsv.begin_checkout ||
    fromCsv.purchase ||
    fromCsv.revenue
  ) {
    return fromCsv;
  }
  return sourceFallback(snapshot, sourceMedium);
}

function gateRows(proofGate) {
  return Object.entries(proofGate ?? {}).map(([key, value]) => {
    const acronyms = new Map([
      ["mcp", "MCP"],
      ["ga4", "GA4"],
      ["llms", "LLMs"],
    ]);
    const label = key
      .split("_")
      .map((part) => acronyms.get(part) ?? part[0].toUpperCase() + part.slice(1))
      .join(" ");
    return `| ${label} | ${yesNo(value)} |`;
  });
}

function distributionLine(distribution) {
  const counts = distribution?.counts ?? {};
  return `${count(counts.pass)} pass, ${count(counts.pending)} pending, ${count(counts.stale)} stale, ${count(counts.blocked)} blocked, ${count(counts.fail)} fail`;
}

function sourceFunnelLine(row) {
  return `| ${row.source_medium} | ${count(row.session_start)} | ${count(row.view_item)} | ${count(row.add_to_cart)} | ${count(row.begin_checkout)} | ${count(row.purchase)} | ${money(row.revenue)} | ${pct(row.add_to_cart, row.session_start)} | ${pct(row.purchase, row.session_start)} |`;
}

function toolRows(snapshot) {
  const fp = snapshot.first_party_mcp ?? {};
  const metrics = snapshot.proof_metrics ?? {};
  const orders = snapshot.first_party_orders ?? {};
  const topTools = fp.top_tools?.length ? fp.top_tools : [];
  const rows = topTools.map((tool) => {
    const calls = num(tool.count);
    const createCartCalls = tool.key === "create_cart_url" ? num(fp.create_cart_url_calls) : 0;
    const status = createCartCalls
      ? "handoff emitted; downstream still needs external qualified proof"
      : "no downstream handoff emitted";
    return `| ${tool.key} | ${count(calls)} | ${count(createCartCalls)} | ${pct(createCartCalls, calls)} | ${count(metrics.qualified_external_cart_landings)} | ${count(orders.attributed_order_count)} | ${money(orders.attributed_revenue, orders.currency || "USD")} | ${status} |`;
  });
  if (!rows.length && num(fp.create_cart_url_calls)) {
    rows.push(
      `| create_cart_url | ${count(fp.create_cart_url_calls)} | ${count(fp.create_cart_url_calls)} | 100.0% | ${count(metrics.qualified_external_cart_landings)} | ${count(orders.attributed_order_count)} | ${money(orders.attributed_revenue, orders.currency || "USD")} | downstream still needs external qualified proof |`
    );
  }
  return rows.length
    ? rows
    : ["| none seen | 0 | 0 | n/a | 0 | 0 | USD $0.00 | no first-party MCP tool usage in snapshot |"];
}

function markdown(snapshot, paths) {
  const fp = snapshot.first_party_mcp ?? {};
  const metrics = snapshot.proof_metrics ?? {};
  const orders = snapshot.first_party_orders ?? {};
  const ga4 = snapshot.ga4 ?? {};
  const csvPath = ga4.output_dir ? resolve(ga4.output_dir, "packrift-ga4-ai_mcp_events.csv") : "";
  const csvRows = maybeReadCsv(csvPath);
  const mcpTool = sourceFunnel(snapshot, csvRows, "chatgpt-mcp / mcp_tool");
  const chatgptMcp = sourceFunnel(snapshot, csvRows, "chatgpt / mcp");
  const mcpCorpus = sourceFunnel(snapshot, csvRows, "mcp_corpus / ai_retrieval");
  const chatgptFeed = sourceFunnel(snapshot, csvRows, "chatgpt.com / feed");
  const currency = orders.currency || "USD";
  const generatedDate = dateStamp(snapshot.generated_at);

  return [
    "# Packrift MCP Attribution Funnel",
    "",
    `Generated from latest funnel snapshot: ${snapshot.generated_at}`,
    `Status: ${snapshot.status}`,
    "",
    "## Measurement Window",
    "",
    `- First-party MCP stats date: ${fp.date || "unknown"}`,
    `- GA4 range: ${ga4.start_date || "unknown"} to ${ga4.end_date || "unknown"}`,
    `- Shopify order lookback: ${orders.lookback_days ?? "unknown"} days`,
    `- Distribution state: ${distributionLine(snapshot.distribution)}`,
    "",
    "## Proof Gate",
    "",
    "| Gate | Proven |",
    "| --- | --- |",
    ...gateRows(snapshot.proof_gate),
    "",
    "## Current Funnel",
    "",
    "| Stage | Current value | Rate | Notes |",
    "| --- | ---: | ---: | --- |",
    `| First-party MCP discovery events | ${count(fp.mcp_discovery_events)} | n/a | tools/list, prompts/list, resources/list, resources/read |`,
    `| First-party MCP tool calls | ${count(fp.total_tool_calls)} | ${pct(fp.total_tool_calls, fp.mcp_discovery_events)} of discovery | top tool: ${(fp.top_tools ?? [])[0]?.key ?? "none"} |`,
    `| create_cart_url calls | ${count(fp.create_cart_url_calls)} | ${pct(fp.create_cart_url_calls, fp.total_tool_calls)} of tool calls | first-party handoff event needed before real cart proof |`,
    `| First-party cart clicks | ${count(fp.cart_clicks)} | ${pct(fp.cart_clicks, fp.create_cart_url_calls)} of create_cart_url calls | 0 means no measured clickthrough yet |`,
    `| GA4 raw MCP-specific sessions | ${count(metrics.raw_mcp_specific_session_starts)} | n/a | source-level, not all qualified buyer demand |`,
    `| GA4 qualified external MCP sessions | ${count(metrics.qualified_external_mcp_session_starts)} | ${pct(metrics.qualified_external_mcp_session_starts, metrics.raw_mcp_specific_session_starts)} of raw MCP sessions | current qualified visitor proof |`,
    `| GA4 raw stamped MCP cart landings | ${count(metrics.raw_stamped_mcp_cart_landings)} | n/a | includes internal/synthetic traffic |`,
    `| GA4 qualified external cart landings | ${count(metrics.qualified_external_cart_landings)} | ${pct(metrics.qualified_external_cart_landings, metrics.raw_stamped_mcp_cart_landings)} of raw stamped landings | must rise above 0 before goal can be proven |`,
    `| First-party MCP-attributed orders | ${count(orders.attributed_order_count)} | ${pct(orders.attributed_order_count, metrics.qualified_external_cart_landings)} of qualified cart landings | scanned ${count(orders.scanned_order_count)} Shopify orders |`,
    `| First-party MCP-attributed revenue | ${money(orders.attributed_revenue, currency)} | n/a | ${count(metrics.first_party_mcp_orders)} orders / ${money(metrics.first_party_mcp_order_revenue, currency)} in proof metrics |`,
    "",
    "## Source-Level GA4 Funnel",
    "",
    "This is source-level GA4 evidence, not joined per MCP tool yet.",
    "",
    "| Source / medium | Sessions | view_item | add_to_cart | begin_checkout | purchase | Revenue | ATC/session | Purchase/session |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    sourceFunnelLine(mcpTool),
    sourceFunnelLine(chatgptMcp),
    sourceFunnelLine(mcpCorpus),
    sourceFunnelLine(chatgptFeed),
    "",
    "## By MCP Tool",
    "",
    "Current first-party telemetry counts tool calls, while GA4 commerce is still source-level. This table therefore shows known tool calls and known downstream proof only when it can be safely attributed.",
    "",
    "| MCP tool | First-party calls | create_cart_url calls | Handoff rate | Qualified cart landings | MCP orders | Revenue | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...toolRows(snapshot),
    "",
    "## What This Proves",
    "",
    `- Not proven yet: only ${count(metrics.qualified_external_mcp_session_starts)} qualified external MCP sessions, ${count(metrics.qualified_external_cart_landings)} qualified cart landings, ${count(orders.attributed_order_count)} MCP orders, and ${money(orders.attributed_revenue, currency)} MCP revenue.`,
    `- The non-MCP ChatGPT product-card path is already monetizing: ${count(chatgptFeed.add_to_cart)} add_to_cart, ${count(chatgptFeed.begin_checkout)} begin_checkout, ${count(chatgptFeed.purchase)} purchases, ${money(chatgptFeed.revenue, currency)} revenue from chatgpt.com / feed.`,
    `- The live MCP surface is operational, but usage is still thin: ${count(fp.total_tool_calls)} tool calls and ${count(fp.create_cart_url_calls)} create_cart_url calls in the first-party snapshot.`,
    `- The main measurement gap is tool-to-commerce joining: source-level GA4 shows ${count(mcpTool.add_to_cart)} add_to_cart and ${count(mcpTool.begin_checkout)} begin_checkout for chatgpt-mcp / mcp_tool, but the current snapshot does not prove which MCP tool caused those events.`,
    "",
    "## Current Blockers",
    "",
    "- No thousands-of-visitors proof: qualified external MCP sessions are still in single digits.",
    "- No qualified cart-landing proof: the only raw stamped cart landing is classified as internal/synthetic.",
    "- No MCP sales proof: first-party Shopify scan found no MCP-attributed orders.",
    "- Per-tool attribution is incomplete: first-party tool calls are not yet joined to GA4 view_item, add_to_cart, checkout, or purchase rows.",
    `- Directory distribution still has recrawl drag: ${distributionLine(snapshot.distribution)}.`,
    "",
    "## Next Measurement Actions",
    "",
    "- Drive real external create_cart_url calls through the deployed telemetry enrichment so first-party tool-call rows carry MCP continuity IDs.",
    "- Extend the funnel snapshot aggregation to group tool calls, cart landings, and orders by MCP continuity ID once non-synthetic create_cart_url events exist.",
    "- Push external agents and directories toward create_cart_url, not just resource reads or directory recrawls.",
    "- Keep the stale directory recrawl queue moving until external qualified sessions and cart landings rise.",
    "- Re-run the funnel snapshot and this note after each distribution or cart-handoff push.",
    "",
    "## Source Files",
    "",
    `- Snapshot JSON: ${SNAPSHOT_PATH}`,
    `- Snapshot Markdown: ${SNAPSHOT_MD_PATH}`,
    `- GA4 summary: ${ga4.summary_path || "unknown"}`,
    `- GA4 source CSV: ${csvPath || "unknown"}`,
    `- Distribution check: ${snapshot.distribution?.latest_path || "unknown"}`,
    `- Current note: ${paths.current}`,
    `- Snapshot note: ${paths.dated}`,
    "",
    `Report date key: ${generatedDate}`,
    "",
  ].join("\n");
}

function main() {
  const snapshot = readJson(SNAPSHOT_PATH);
  const stamp = dateStamp(snapshot.generated_at);
  mkdirSync(OUT_DIR, { recursive: true });
  const paths = {
    current: resolve(OUT_DIR, "packrift-mcp-attribution-funnel-current.md"),
    dated: resolve(OUT_DIR, `packrift-mcp-attribution-funnel-${stamp}.md`),
  };
  const md = markdown(snapshot, paths);
  writeFileSync(paths.current, md);
  writeFileSync(paths.dated, md);
  console.log(
    JSON.stringify(
      {
        status: snapshot.status,
        current: paths.current,
        dated: paths.dated,
        qualified_external_mcp_session_starts: snapshot.proof_metrics?.qualified_external_mcp_session_starts ?? null,
        qualified_external_cart_landings: snapshot.proof_metrics?.qualified_external_cart_landings ?? null,
        first_party_mcp_orders: snapshot.first_party_orders?.attributed_order_count ?? null,
      },
      null,
      2
    )
  );
}

main();
