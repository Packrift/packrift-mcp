import { test } from "node:test";
import assert from "node:assert/strict";

import { APPROVED_CATALOG } from "../dist/effective-approved-catalog.js";
import { QUERY_ALIAS_OVERRIDES } from "../dist/query-alias-overrides.js";
import { scoreRow } from "../dist/search-ranking.js";

const CASES = new Map([
  ["wardrobe box", "362110"],
  ["80 gauge stretch wrap", "SF188"],
  ["pallet stretch wrap", "SF188"],
  ["stretch wrap 20 inch x 1000 ft", "SF2071PK"],
  ["kraft paper tape", "T94653006PK"],
  ["water activated tape", "T9067500"],
  ["void fill", "FD1424"],
  ["packing slip envelopes", "PL28"],
]);

const EXPECTED_OVERRIDES = {
  "362110": "wardrobe box",
  "SF188": "80 gauge stretch wrap || pallet stretch wrap",
  "SF2071PK": "stretch wrap 20 inch x 1000 ft",
  "T94653006PK": "kraft paper tape",
  "T9067500": "water activated tape",
  "FD1424": "void fill",
  "PL28": "packing slip envelopes",
  // 2026-07-11: graduated 2026-07-10 experiment-overlay recovery SKUs.
  "444": "4 x 4 x 4 kraft corrugated shipping boxes ECT-32 25 pack cube",
  "PB339": "2 x 2 clear polyethylene poly bags 2 mil 1000 case lay flat",
  "T901800": "2 inch clear polypropylene carton sealing tape 2 x 55 yd hot melt 2.2 mil 36 roll case",
};

test("query alias override is limited to the accepted AI_APPROVE identities", () => {
  assert.deepEqual(QUERY_ALIAS_OVERRIDES, EXPECTED_OVERRIDES);
  const bySku = new Map(APPROVED_CATALOG.map((item) => [item.sku.toUpperCase(), item]));
  for (const [sku, aliases] of Object.entries(EXPECTED_OVERRIDES)) {
    const item = bySku.get(sku);
    assert.ok(item, `${sku} must remain in the generated approved catalog`);
    assert.equal(item.searchAliases, aliases);
    assert.equal(item.riskFlags, "");
  }
});

test("accepted buyer queries rank the intended exact SKU first", () => {
  for (const [query, expectedSku] of CASES) {
    const ranked = APPROVED_CATALOG
      .map((item) => ({ item, ...scoreRow(query, item) }))
      .filter((row) => row.qualifies)
      .sort((a, b) => b.score - a.score);
    assert.equal(ranked[0]?.item.sku, expectedSku, `${query} should rank ${expectedSku} first`);
  }
});

test("override excludes all active experiment overlaps", () => {
  const forbidden = new Set(["B873", "B921", "CPM1013BL", "121212V3C", "181824DPBRP6", "3666", "HD181818TW", "HD24248DW"]);
  for (const sku of Object.keys(QUERY_ALIAS_OVERRIDES)) assert.equal(forbidden.has(sku), false, `${sku} overlaps an active experiment`);
});
