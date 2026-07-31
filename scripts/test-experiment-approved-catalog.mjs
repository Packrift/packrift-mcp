import { test } from "node:test";
import assert from "node:assert/strict";

import { APPROVED_CATALOG } from "../dist/effective-approved-catalog.js";
import { EXPERIMENT_APPROVED_CATALOG } from "../dist/experiment-approved-catalog.js";
import { scoreRow } from "../dist/search-ranking.js";

// The 2026-07-10 recovery SKUs graduated into the generated canonical
// allowlist on 2026-07-11 (canonical wins; overlay rows removed, aliases moved
// to query-alias-overrides). Identities must stay live via the canonical list.
const EXPECTED = new Map([
  ["444", "53472907362672"],
  ["PB339", "53473155776880"],
  ["T901800", "53475754574192"],
]);

test("experiment overlay only carries rows absent from the canonical allowlist", () => {
  const canonicalSkus = new Set(APPROVED_CATALOG.map((item) => item.sku.toUpperCase()));
  for (const item of EXPERIMENT_APPROVED_CATALOG) {
    assert.ok(item.sku && item.productId && item.variantId && item.handle && item.title && item.family, `incomplete overlay row for ${item.sku}`);
    assert.ok(item.searchAliases, `overlay row ${item.sku} must carry recovery aliases`);
  }
  // Effective-catalog merger throws on duplicates; this asserts the same
  // invariant early with a clearer message.
  const overlaySkus = EXPERIMENT_APPROVED_CATALOG.map((item) => item.sku.toUpperCase());
  for (const sku of overlaySkus) {
    assert.equal(canonicalSkus.has(sku), false, `${sku} is canonical; remove it from the overlay (canonical wins)`);
  }
});

test("recovery query aliases keep the graduated SKUs top-ranked", () => {
  // With the 2026-07-11 expanded allowlist, near-duplicate variants of the
  // same exact spec are approved too (e.g. 444W, the white 4x4x4 cube), so
  // "first place" is no longer a valid single-SKU assumption. The recovery
  // guarantee is: the graduated SKU qualifies and ranks in the top 2, and
  // anything above it is another exact-spec box of the same dimensions.
  const cases = [
    ["4x4x4 kraft corrugated shipping boxes 25 pack", "444", /4\s*x\s*4\s*x\s*4/i],
    ["2x2 clear poly bags 2 mil 1000 case", "PB339", /2\s*x\s*2/i],
    ["2 inch clear polypropylene carton sealing tape case", "T901800", /2\s*(?:"|in|x)/i],
  ];
  for (const [query, expectedSku, dimRe] of cases) {
    const ranked = APPROVED_CATALOG
      .map((item) => ({ item, ...scoreRow(query, item) }))
      .filter((row) => row.qualifies)
      .sort((a, b) => b.score - a.score);
    const index = ranked.findIndex((row) => row.item.sku === expectedSku);
    assert.ok(index >= 0, `${query} must return ${expectedSku} as a qualified result`);
    assert.ok(index <= 1, `${query} should rank ${expectedSku} in the top 2, got rank ${index + 1}`);
    for (const row of ranked.slice(0, index)) {
      assert.match(row.item.title, dimRe, `${query}: only same-dimension exact matches may outrank ${expectedSku}, got ${row.item.title}`);
    }
  }
});

test("effective catalog has unique SKU and variant identities", () => {
  const skus = APPROVED_CATALOG.map((item) => item.sku.toUpperCase());
  const variants = APPROVED_CATALOG.map((item) => item.variantId);
  assert.equal(new Set(skus).size, skus.length);
  assert.equal(new Set(variants).size, variants.length);
});

test("every graduated recovery SKU resolves from the effective catalog", () => {
  const bySku = new Map(APPROVED_CATALOG.map((item) => [item.sku.toUpperCase(), item]));
  for (const [sku, variantId] of EXPECTED) {
    assert.equal(bySku.get(sku)?.variantId, variantId);
  }
});
