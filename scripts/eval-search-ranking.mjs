// Before/after relevance eval for the Packrift custom-MCP search ranking.
//
//   npm run build && node scripts/eval-search-ranking.mjs
//
// Ranks the real approved catalog with BOTH the legacy flat-+20 scorer and the
// new IDF/phrase/field-boost scorer, and prints the top results side by side.
// Read-only: never touches Shopify, the catalog, or the network.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scoreRow as scoreNew } from "../dist/search-ranking.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCatalog() {
  const txt = readFileSync(join(__dirname, "..", "src", "approved-catalog.ts"), "utf8");
  const start = txt.indexOf("= [", txt.indexOf("APPROVED_CATALOG")) + 2;
  const end = txt.lastIndexOf("];");
  return JSON.parse(txt.slice(start, end + 1));
}
const CATALOG = loadCatalog();

// ---- legacy scorer (flat +20 per matched token), reproduced verbatim --------
const STOP_WORDS = new Set(["find","packrift","product","products","like","need","around","with","for","the","and","inch","inches"]);
const norm = (v) => v.toLowerCase().replace(/["']/g,"").replace(/&/g," and ").replace(/[^a-z0-9.]+/g," ").replace(/\s+/g," ").trim();
const toks = (v) => norm(v).split(" ").filter((t) => t.length > 1 && !STOP_WORDS.has(t));
const dimToks = (v) => [...norm(v).matchAll(/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\b/g)].map((m) => m[0].replace(/\s+/g, ""));
const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function skuHit(q, sku, hasDims) {
  const s = norm(sku); if (!s) return false;
  if (hasDims && /^\d{5,}$/.test(s)) return new RegExp(`\\b(?:sku\\s+)?${esc(s)}\\b`).test(q);
  if (!hasDims || /[a-z]/.test(s)) return q.includes(s);
  return new RegExp(`\\bsku\\s+${esc(s)}\\b`).test(q);
}
function scoreLegacy(query, item) {
  const q = norm(query);
  const text = `${item.sku} ${item.handle} ${item.title} ${item.family}`;
  const titleNorm = norm(item.title);
  const compact = norm(text).replace(/\s+/g, "");
  const tk = toks(query); const dims = dimToks(query);
  const rowTokens = new Set(toks(text)); let s = 0;
  if (skuHit(q, item.sku, dims.length > 0)) s += 1000;
  if (q.includes(norm(item.handle))) s += 900;
  if (q === titleNorm) s += 1000; else if (q.includes(titleNorm) || titleNorm.includes(q)) s += 500;
  for (const d of dims) if (compact.includes(d)) s += 300;
  for (const t of tk) if (rowTokens.has(t)) s += 20;
  if (/\bbox(?:es)?\b/.test(q) && item.family === "boxes") s += 50;
  if (/\blabel(?:s)?\b/.test(q) && item.family === "labels") s += 50;
  if (/\bmailer(?:s)?\b/.test(q) && item.family === "mailers") s += 50;
  return s;
}

function topLegacy(query, n = 5) {
  return CATALOG.map((i) => ({ i, s: scoreLegacy(query, i) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
}
function topNew(query, n = 5) {
  const dims = dimToks(query);
  return CATALOG.map((i) => ({ i, ...scoreNew(query, i) }))
    .filter((r) => (dims.length ? r.score >= 250 : r.qualifies))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

const QUERIES = [
  "4 mil accelerator free nitrile gloves",
  "24x20x12 ECT-48 double wall boxes hand holes",
  "kraft tape",
  "bubble mailers",
  "white shipping labels",
];

for (const q of QUERIES) {
  console.log(`\n=== "${q}" ===`);
  console.log("  -- BEFORE (flat +20) --");
  const before = topLegacy(q);
  if (!before.length) console.log("    (no matches)");
  for (const r of before) console.log(`    ${String(r.s).padStart(5)}  ${r.i.family.padEnd(8)} ${r.i.title}`);
  console.log("  -- AFTER (IDF + phrase + qualifying gate) --");
  const after = topNew(q);
  if (!after.length) console.log("    (no qualifying match -> routes to explain_no_exact_match / bulk quote)");
  for (const r of after) console.log(`    ${String(r.score).padStart(5)}  ${r.i.family.padEnd(8)} ${r.i.title}`);
}
console.log("");
