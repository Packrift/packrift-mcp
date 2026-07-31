// Regression tests for the Packrift custom-MCP search relevance ranking.
//
//   node --test scripts/test-search-ranking.mjs
//
// Requires a prior `npm run build` (imports the compiled dist module).
//
// Covers the two queries from the 2026-06-03 agentic catalog audit:
//   1. "4 mil accelerator free nitrile gloves" — the discriminating product
//      nouns (nitrile/gloves) must outrank generic-modifier tape (mil/free),
//      and generic-only tape must NOT qualify as a keyword match.
//   2. "24x20x12 ECT-48 double wall boxes hand holes" — the exact-dimension box
//      must stay rank 1 (no regression on spec/dimension queries).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { scoreRow, tokenWeight, LOW_SIGNAL_MODIFIERS, normalizeText, queryIncludesSku } from "../dist/search-ranking.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the real approved catalog straight from the source array.
function loadCatalog() {
  const txt = readFileSync(join(__dirname, "..", "src", "approved-catalog.ts"), "utf8");
  const start = txt.indexOf("= [", txt.indexOf("APPROVED_CATALOG")) + 2;
  const end = txt.lastIndexOf("];");
  return JSON.parse(txt.slice(start, end + 1));
}

const CATALOG = loadCatalog();

function rank(query, catalog = CATALOG) {
  return catalog
    .map((item) => ({ item, ...scoreRow(query, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function rankQualified(query, catalog = CATALOG) {
  return rank(query, catalog).filter((r) => r.qualifies);
}

const GLOVE_QUERY = "4 mil accelerator free nitrile gloves";
const BOX_QUERY = "24x20x12 ECT-48 double wall boxes hand holes";

// A synthetic glove product proves the ranking logic itself, independent of
// whatever is currently AI_APPROVE'd in the live catalog (the 2026-05-20
// snapshot happens to contain zero glove SKUs).
const SYNTH_GLOVE = {
  sku: "NGXL4AF",
  handle: "xl-powder-free-nitrile-gloves-accelerator-free-4-mil-case-of-100",
  title: "XL Powder-Free Nitrile Gloves - Accelerator Free, 4 Mil, Case of 100",
  family: "gloves",
};

test("IDF: generic catalog-wide tokens weigh far less than rare product nouns", () => {
  const milW = tokenWeight("mil"); // ~1/3 of the catalog
  const freeW = tokenWeight("free");
  const nitrileW = tokenWeight("nitrile"); // absent from the catalog -> max weight
  const glovesW = tokenWeight("gloves");
  assert.ok(milW <= 6, `mil should be capped low, got ${milW}`);
  assert.ok(freeW <= 6, `free should be capped low, got ${freeW}`);
  assert.ok(nitrileW >= milW * 5, `nitrile (${nitrileW}) must dominate mil (${milW})`);
  assert.ok(glovesW >= milW * 5, `gloves (${glovesW}) must dominate mil (${milW})`);
});

test("low-signal list holds modifiers but not product-type nouns", () => {
  for (const generic of ["mil", "free", "white", "case", "pack", "heavy", "duty"]) {
    assert.ok(LOW_SIGNAL_MODIFIERS.has(generic), `${generic} should be low-signal`);
  }
  for (const noun of ["nitrile", "gloves", "tape", "box", "boxes", "mailer", "label"]) {
    assert.ok(!LOW_SIGNAL_MODIFIERS.has(noun), `${noun} must NOT be low-signal`);
  }
});

test("glove query: generic-modifier-only tape does NOT qualify as a keyword match", () => {
  // Across the real (glove-free) catalog, nothing should be surfaced: every
  // candidate matched only "mil"/"free", which no longer qualifies.
  const qualified = rankQualified(GLOVE_QUERY);
  const tapeQualified = qualified.filter((r) => r.item.family === "tape");
  assert.equal(
    tapeQualified.length,
    0,
    `tape should not qualify for a glove query; got: ${tapeQualified.slice(0, 3).map((r) => r.item.title).join(" | ")}`
  );
});

test("glove query: a real nitrile glove outranks every tape product", () => {
  const ranked = rank(GLOVE_QUERY, [...CATALOG, SYNTH_GLOVE]);
  assert.equal(ranked[0].item.sku, SYNTH_GLOVE.sku, `expected glove #1, got ${ranked[0].item.title}`);
  const topTape = ranked.find((r) => r.item.family === "tape");
  const gloveScore = ranked[0].score;
  assert.ok(
    !topTape || gloveScore > topTape.score * 2,
    `glove (${gloveScore}) must clearly beat best tape (${topTape?.score})`
  );
});

test("glove query: 'nitrile gloves' phrase + field boost lifts the glove score", () => {
  const glove = scoreRow(GLOVE_QUERY, SYNTH_GLOVE);
  assert.ok(glove.qualifies, "glove must qualify");
  assert.ok(glove.matchedDiscriminating, "glove must register a discriminating match");
  assert.ok(glove.score >= 120, `glove score should be strong, got ${glove.score}`);
});

test("box query: exact-dimension ECT-48 box stays rank 1 (no regression)", () => {
  const ranked = rank(BOX_QUERY);
  assert.ok(ranked.length > 0, "box query must return candidates");
  const top = ranked[0].item;
  assert.match(top.title, /24\s*x\s*20\s*x\s*12/i, `expected 24x20x12 box first, got ${top.title}`);
  assert.match(top.title, /ECT-48/i, `expected ECT-48 box first, got ${top.title}`);
  assert.equal(top.family, "boxes");
});

test("box query: top exact box clears the dimension exact gate (>=250)", () => {
  const ranked = rank(BOX_QUERY);
  assert.ok(ranked[0].score >= 250, `top box score ${ranked[0].score} must clear the 250 exact gate`);
});

test("box query: exact box outscores same-ECT boxes of other dimensions", () => {
  const ranked = rank(BOX_QUERY);
  const top = ranked[0];
  const otherEct48 = ranked.find(
    (r) => /ECT-48/i.test(r.item.title) && !/24\s*x\s*20\s*x\s*12/i.test(r.item.title)
  );
  assert.ok(otherEct48, "expected at least one other ECT-48 box in candidates");
  assert.ok(
    top.score > otherEct48.score,
    `exact dim box (${top.score}) must beat other ECT-48 (${otherEct48.score})`
  );
});

test("category keyword: 'bubble mailers' still returns mailers (family bonus protects category search)", () => {
  const qualified = rankQualified("bubble mailers");
  assert.ok(qualified.length > 0, "bubble mailers must return results");
  assert.equal(qualified[0].item.family, "mailers");
});

test("product-type keyword: bare 'kraft tape' still qualifies and returns tape", () => {
  const qualified = rankQualified("kraft tape");
  assert.ok(qualified.length > 0, "kraft tape must return results");
  assert.equal(qualified[0].item.family, "tape", `got ${qualified[0].item.family}: ${qualified[0].item.title}`);
});

test("exact SKU lookup still wins decisively", () => {
  const sample = CATALOG.find((i) => /^[A-Z]/.test(i.sku));
  const ranked = rank(`sku ${sample.sku}`);
  assert.equal(ranked[0].item.sku, sample.sku, `sku lookup should return ${sample.sku} first`);
  assert.ok(ranked[0].score >= 1000, "sku match should score >= 1000");
});

test("SKU lookup does not partial-match a numeric suffix inside a different SKU", () => {
  const ranked = rank("SKU DL1066");
  assert.equal(
    ranked[0].item.sku,
    "DL1066",
    `expected DL1066 first, got ${ranked[0].item.sku}: ${ranked[0].item.title}`
  );
  assert.notEqual(ranked[0].item.sku, "1066", "bare 1066 must not outrank DL1066 for an exact SKU lookup");
});

test("SKU lookup still supports prefixed alphanumeric envelope SKUs", () => {
  const ranked = rank("SKU EN1066");
  assert.equal(
    ranked[0].item.sku,
    "EN1066",
    `expected EN1066 first, got ${ranked[0].item.sku}: ${ranked[0].item.title}`
  );
});

test("dimension-bearing queries do not treat repeated numbers as a bare numeric SKU", () => {
  assert.equal(
    queryIncludesSku(normalizeText("999 x 999 x 999 box"), "999", true),
    false,
    "dimension query should not auto-match numeric SKU 999 without an explicit sku prefix"
  );
  assert.equal(
    queryIncludesSku(normalizeText("SKU 999 999 x 999 x 999 box"), "999", true),
    true,
    "explicit sku prefix should still match numeric SKU in a dimension-bearing query"
  );
});

// ---------------------------------------------------------------------------
// 2026-07-12 capability upgrade: spec-attribute matching (mil/gauge/inch/yd),
// discriminating-only bigrams, and use-case expansion.
// ---------------------------------------------------------------------------

test("mil spec: '6x18 4 mil poly bags' ranks a 4-mil bag above the 1.5-mil sibling", () => {
  const ranked = rank("6x18 4 mil poly bags");
  assert.ok(ranked.length > 0, "must return candidates");
  assert.match(ranked[0].item.title, /6\s*x\s*18/i, `expected a 6x18 bag first, got ${ranked[0].item.title}`);
  assert.match(ranked[0].item.title, /4 ?mil/i, `expected the 4-mil bag first, got ${ranked[0].item.title}`);
});

test("inch+yard spec: '3 inch packing tape 110 yard' ranks 3-in/110-yd tape above 2-in tape", () => {
  const ranked = rankQualified("3 inch packing tape 110 yard");
  assert.ok(ranked.length > 0, "must return candidates");
  assert.match(
    ranked[0].item.title,
    /3\s*(?:"|in\b)/i,
    `expected a 3-inch tape first, got ${ranked[0].item.title}`
  );
  assert.match(ranked[0].item.title, /110 ?yd/i, `expected a 110-yd tape first, got ${ranked[0].item.title}`);
});

test("bigram gating: '10x13 white poly mailers' ranks actual poly mailers above Tyvek envelopes", () => {
  const ranked = rankQualified("10x13 white poly mailers");
  assert.ok(ranked.length > 0, "must return candidates");
  assert.match(
    ranked[0].item.title,
    /poly mailers/i,
    `expected poly mailers first, got ${ranked[0].item.title}`
  );
});

test("use-case expansion: 'packaging for shipping t-shirts' surfaces mailers", () => {
  const ranked = rankQualified("packaging for shipping t-shirts");
  assert.ok(ranked.length > 0, "must return candidates");
  assert.equal(
    ranked[0].item.family,
    "mailers",
    `expected a mailers-family product first, got ${ranked[0].item.family}: ${ranked[0].item.title}`
  );
});

test("spec penalty cap: exact-dimension match with conflicting specs still clears the 250 gate", () => {
  // Synthetic worst case: dims match (+300) but mil, gauge, inch, and yardage all conflict.
  const row = {
    sku: "SYNTHSPEC1",
    handle: "6x18-1-5-mil-test-row-90-gauge-2-in-55-yd",
    title: '6x18" 1.5 Mil Test Row 90 Gauge 2 in x 55 yd',
    family: "poly_bags",
  };
  const scored = scoreRow('6x18 4 mil 120 gauge 3 inch 110 yard bags', row);
  assert.ok(scored.score >= 250, `dim match must survive spec penalties, got ${scored.score}`);
});
