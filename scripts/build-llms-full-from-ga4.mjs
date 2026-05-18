#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const ANALYTICS_ROOT =
  "/Users/farhan/Downloads/packrift-ai-commerce-execution-2026-05-04/analytics-1000x";
const FACTORY_OUTPUTS_ROOT = "/Users/farhan/Downloads/packrift-ai-commerce-factory/outputs";
const DEFAULT_SHOPIFY_ENV = "/Users/farhan/Downloads/env-shopify-packrift.txt";
const DEFAULT_PINNED_SKUS = ["1066", "LL251WR", "MFL1295"];

const args = parseArgs(process.argv.slice(2));
const ga4ItemsPath = resolve(args["ga4-items"] || latestFile(ANALYTICS_ROOT, "packrift-ga4-items.csv"));
const approvedJsonlPath = resolve(
  args["approved-jsonl"] || latestFile(FACTORY_OUTPUTS_ROOT, "packrift-ai-approved-products.jsonl"),
);
const sourcePath = resolve(args.source || join(REPO_ROOT, "src/llms-full-content.ts"));
const outputTextPath = args["output-text"] ? resolve(args["output-text"]) : "";
const shouldWriteSource = !args["no-write-source"];
const outReportPath =
  args.report ||
  join(
    REPO_ROOT,
    "outputs/llms-full-priority-skus",
    `llms-full-priority-skus-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
const limit = Number(args.limit || 20);
const pinnedSkus = String(args["pinned-skus"] || DEFAULT_PINNED_SKUS.join(","))
  .split(",")
  .map((sku) => sku.trim().toUpperCase())
  .filter(Boolean);

const ga4Rows = parseCsv(readFileSync(ga4ItemsPath, "utf8"));
const approvedItems = readJsonl(approvedJsonlPath);
const approvedByOffer = new Map();
const approvedBySku = new Map();
for (const item of approvedItems) {
  if (!isApprovedInStock(item)) continue;
  if (item.offer_id) approvedByOffer.set(String(item.offer_id), item);
  if (item.sku) approvedBySku.set(String(item.sku).toUpperCase(), item);
}

const scored = [];
for (const row of ga4Rows) {
  const itemId = row.itemId || "";
  const catalogItem = approvedByOffer.get(itemId);
  if (!catalogItem) continue;
  scored.push(toPriorityRecord(catalogItem, row, "ga4_item_activity"));
}

for (const sku of pinnedSkus) {
  const catalogItem = approvedBySku.get(sku);
  if (!catalogItem) continue;
  if (scored.some((record) => record.sku.toUpperCase() === sku)) continue;
  scored.push(toPriorityRecord(catalogItem, {}, "pinned_paid_ai_sku"));
}

scored.sort((a, b) => b.score - a.score || a.sku.localeCompare(b.sku));
const candidatePriority = dedupeBySku(scored).slice(0, Math.max(limit * 3, 60));
const inventoryByVariant = args["skip-shopify-verify"] ? new Map() : await fetchInventoryByVariant(candidatePriority);
const priority = candidatePriority
  .map((record) => {
    const liveInventory = inventoryByVariant.get(String(record.variant_id || ""));
    return liveInventory === undefined ? record : { ...record, inventory: liveInventory };
  })
  .filter((record) => Number(record.inventory || 0) > 0)
  .slice(0, limit)
  .map((record, index) => ({ ...record, rank: index + 1 }));
if (priority.length < 5) {
  throw new Error(`Only found ${priority.length} approved in-stock priority SKUs; refusing to rewrite llms-full.`);
}

const source = readFileSync(sourcePath, "utf8");
const replacement = buildPrioritySection(priority, {
  ga4ItemsPath,
  approvedJsonlPath,
  verifiedWithShopify: inventoryByVariant.size > 0,
});
const updated = replacePrioritySection(source, replacement);
if (shouldWriteSource) {
  writeFileSync(sourcePath, updated, "utf8");
}
if (outputTextPath) {
  mkdirSync(dirname(outputTextPath), { recursive: true });
  writeFileSync(outputTextPath, extractExportedTemplateValue(updated, "llmsFullTxt"), "utf8");
}

mkdirSync(dirname(outReportPath), { recursive: true });
writeFileSync(
  outReportPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source_file: sourcePath,
      wrote_source: shouldWriteSource,
      output_text_path: outputTextPath || null,
      ga4_items_path: ga4ItemsPath,
      approved_jsonl_path: approvedJsonlPath,
      shopify_inventory_verified: inventoryByVariant.size > 0,
      priority_skus: priority,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      updated: shouldWriteSource ? sourcePath : null,
      output_text: outputTextPath || null,
      report: outReportPath,
      priority_count: priority.length,
      top_skus: priority.slice(0, 10).map((item) => item.sku),
      shopify_inventory_verified: inventoryByVariant.size > 0,
    },
    null,
    2,
  ),
);

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

function latestFile(root, filename) {
  let latest = null;
  walk(root, (file) => {
    if (!file.endsWith(`/${filename}`)) return;
    const mtimeMs = statMtimeMs(file);
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

function statMtimeMs(file) {
  return statSync(file).mtimeMs;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((cells) => cells.some((cell) => String(cell).trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function isApprovedInStock(item) {
  const inventory = Number(item.inventory || 0);
  const riskFlags = String(item.risk_flags || "");
  return (
    String(item.status || item.catalog_status || "").toUpperCase() === "AI_APPROVE" &&
    String(item.availability || "").toLowerCase() === "in_stock" &&
    inventory > 0 &&
    !riskFlags.includes("AI_HOLD")
  );
}

function toPriorityRecord(item, ga4Row, source) {
  const views = Number(ga4Row.itemsViewed || 0);
  const addToCart = Number(ga4Row.itemsAddedToCart || 0);
  const purchased = Number(ga4Row.itemsPurchased || 0);
  const revenue = Number(ga4Row.itemRevenue || 0);
  const paidBoost = String(item.ai_sales_tier || "").includes("tier_0") ? 250 : 0;
  const score = purchased * 1000 + revenue * 10 + addToCart * 100 + views + paidBoost;
  return {
    rank: 0,
    sku: String(item.sku),
    title: String(item.title || item.catalog_title || ga4Row.itemName || ""),
    family: String(item.family_label || item.family || ga4Row.itemCategory || ""),
    dimension_display: String(item.dimension_display || ""),
    pack_count: item.pack_count ?? "",
    strength_rating: String(item.strength_rating || ""),
    printer_type: String(item.printer_type || ""),
    inventory: Number(item.inventory || 0),
    price: String(item.price || ""),
    product_url: String(item.product_url || ""),
    variant_id: String(item.variant_id || ""),
    sku_record_url: `https://mcp.packrift.com/ai/sku/${encodeURIComponent(String(item.sku))}.md`,
    purchase_url: String(item.purchase_url || ""),
    reorder_url: String(item.reorder_url || ""),
    bulk_quote_url: String(item.bulk_quote_url || ""),
    views,
    add_to_cart: addToCart,
    purchased,
    revenue,
    source,
    score,
  };
}

function dedupeBySku(records) {
  const seen = new Set();
  const deduped = [];
  for (const record of records) {
    const key = record.sku.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...record, rank: deduped.length + 1 });
  }
  return deduped;
}

function buildPrioritySection(records, context) {
  const lines = [
    "## Priority exact-spec SKUs for agent lookup",
    "",
    "The following SKUs are regenerated from recent GA4 item activity joined to Packrift's AI-approved, in-stock MCP catalog. Treat these as exact products, not generic category suggestions. For current price, inventory, variants, product handoff, reorder handoff, quote handoff, and cart handoff, use the MCP SKU record and MCP tools rather than copying stale direct product URLs from this corpus.",
    "",
    `Generation inputs: recent GA4 item activity, Packrift's AI-approved MCP catalog, and ${context.verifiedWithShopify ? "live Shopify inventory verification" : "catalog inventory readback"}.`,
    "",
    "| Rank | SKU | Family | Exact spec | Recent signal | MCP SKU record |",
    "|---:|---|---|---|---|---|",
  ];
  for (const record of records) {
    lines.push(
      `| ${record.rank} | ${escapeMd(record.sku)} | ${escapeMd(record.family)} | ${escapeMd(specSummary(record))} | ${escapeMd(signalSummary(record))} | ${record.sku_record_url} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function specSummary(record) {
  const details = [];
  if (record.dimension_display) details.push(record.dimension_display);
  if (record.strength_rating) details.push(record.strength_rating);
  if (record.printer_type) details.push(`${record.printer_type} printer`);
  if (record.pack_count) details.push(`${record.pack_count}/case or pack`);
  details.push(record.title);
  return details.filter(Boolean).join(" - ");
}

function signalSummary(record) {
  if (record.source === "pinned_paid_ai_sku") {
    return `known AI-commerce exact-spec family, inventory ${record.inventory}`;
  }
  const parts = [`${record.views} view_item`];
  if (record.add_to_cart) parts.push(`${record.add_to_cart} add_to_cart`);
  if (record.purchased) parts.push(`${record.purchased} purchase`);
  if (record.revenue) parts.push(`$${record.revenue.toFixed(2)} revenue`);
  parts.push(`inventory ${record.inventory}`);
  return parts.join(", ");
}

function escapeMd(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function replacePrioritySection(source, replacement) {
  const start = source.indexOf("## Priority exact-spec SKUs for agent lookup");
  const end = source.indexOf("Exact-match rule for agents:", start);
  if (start === -1 || end === -1) {
    throw new Error("Could not find priority SKU section boundaries in llms-full-content.ts");
  }
  const today = new Date().toISOString().slice(0, 10);
  return source
    .slice(0, start)
    .replace(/Last updated: \d{4}-\d{2}-\d{2}\./, `Last updated: ${today}.`) +
    escapeTemplateLiteral(replacement) +
    source.slice(end);
}

function extractExportedTemplateValue(source, exportName) {
  const marker = `export const ${exportName} = \``;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find template export ${exportName}`);
  const valueStart = start + marker.length;
  const valueEnd = source.lastIndexOf("`;");
  if (valueEnd <= valueStart) throw new Error(`Could not find end of template export ${exportName}`);
  const raw = source.slice(valueStart, valueEnd);
  return Function(`"use strict"; return \`${raw}\`;`)();
}

function escapeTemplateLiteral(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

async function fetchInventoryByVariant(items) {
  const env = loadEnv(DEFAULT_SHOPIFY_ENV);
  const token = process.env.SHOPIFY_PACKRIFT_TOKEN || env.SHOPIFY_PACKRIFT_TOKEN || env.SHOPIFY_ACCESS_TOKEN;
  const store = process.env.SHOPIFY_STORE_DOMAIN || env.SHOPIFY_STORE || "packrift.myshopify.com";
  if (!token || args["skip-shopify-verify"]) return new Map();

  const candidates = items
    .filter((item) => item.variant_id)
    .slice(0, 250)
    .map((item) => `gid://shopify/ProductVariant/${item.variant_id}`);
  const inventory = new Map();
  for (let index = 0; index < candidates.length; index += 50) {
    const ids = candidates.slice(index, index + 50);
    const response = await fetch(`https://${store}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: `query PackriftVariantInventory($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              inventoryQuantity
            }
          }
        }`,
        variables: { ids },
      }),
    });
    if (!response.ok) return new Map();
    const json = await response.json();
    if (json.errors) return new Map();
    for (const node of json.data?.nodes || []) {
      if (!node?.id) continue;
      inventory.set(node.id.split("/").pop(), Number(node.inventoryQuantity || 0));
    }
  }
  return inventory;
}

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
  return env;
}
