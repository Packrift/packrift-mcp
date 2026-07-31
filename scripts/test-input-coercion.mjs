// Regression tests for the 2026-07-12 agent-tolerant input coercions.
//
//   node --test scripts/test-input-coercion.mjs
//
// Requires a prior `npm run build` (imports the compiled dist modules).
//
// Buying agents mix `qty`/`quantity`, send variant IDs as numbers, and pass
// free-text use_case values. These coercions keep the canonical schema shape
// while accepting the unambiguous variants instead of hard-erroring.

import { test } from "node:test";
import assert from "node:assert/strict";

import { tolerantLineItemZod } from "../dist/line-items.js";
import { coerceUseCase, recommendPackagingZod } from "../dist/tools/recommend_packaging.js";
import { createCartUrlZod } from "../dist/tools/create_cart_url.js";
import { getShippingEstimateZod } from "../dist/tools/get_shipping_estimate.js";

test("line item: canonical {variant_id, qty} passes unchanged", () => {
  const parsed = tolerantLineItemZod.parse({ variant_id: "53475949216112", qty: 2 });
  assert.deepEqual(parsed, { variant_id: "53475949216112", qty: 2 });
});

test("line item: `quantity` is accepted as an alias for `qty`", () => {
  const parsed = tolerantLineItemZod.parse({ variant_id: "53475949216112", quantity: 3 });
  assert.deepEqual(parsed, { variant_id: "53475949216112", qty: 3 });
});

test("line item: numeric variant_id is coerced to string", () => {
  const parsed = tolerantLineItemZod.parse({ variant_id: 53475949216112, qty: 1 });
  assert.deepEqual(parsed, { variant_id: "53475949216112", qty: 1 });
});

test("line item: explicit qty wins over a stray quantity alias", () => {
  const parsed = tolerantLineItemZod.parse({ variant_id: "1", qty: 5, quantity: 9 });
  assert.equal(parsed.qty, 5);
});

test("line item: still rejects garbage (qty 0, missing variant_id)", () => {
  assert.throws(() => tolerantLineItemZod.parse({ variant_id: "1", qty: 0 }));
  assert.throws(() => tolerantLineItemZod.parse({ qty: 1 }));
});

test("create_cart_url: items with quantity alias parse", () => {
  const parsed = createCartUrlZod.parse({ items: [{ variant_id: 53475949216112, quantity: 2 }] });
  assert.deepEqual(parsed.items, [{ variant_id: "53475949216112", qty: 2 }]);
});

test("get_shipping_estimate: items with quantity alias parse", () => {
  const parsed = getShippingEstimateZod.parse({
    destination_postal_code: "60614",
    country: "US",
    items: [{ variant_id: "53475949216112", quantity: 1 }],
  });
  assert.deepEqual(parsed.items, [{ variant_id: "53475949216112", qty: 1 }]);
});

test("use_case: canonical enum values pass through", () => {
  for (const value of ["mailer", "box", "fragile", "apparel", "ecommerce"]) {
    assert.equal(coerceUseCase(value), value);
  }
});

test("use_case: free text maps to the closest canonical context", () => {
  assert.equal(coerceUseCase("shipping ceramic mugs"), "fragile");
  assert.equal(coerceUseCase("t-shirt subscription orders"), "apparel");
  assert.equal(coerceUseCase("documents and photos"), "mailer");
  assert.equal(coerceUseCase("warehouse storage cartons"), "box");
  assert.equal(coerceUseCase("random widget"), "ecommerce");
});

test("find_packaging_for_item: free-text use_case parses end-to-end", () => {
  const parsed = recommendPackagingZod.parse({
    item_length_in: 10,
    item_width_in: 8,
    item_depth_in: 4,
    item_weight_lb: 3,
    use_case: "shipping ceramic mugs",
  });
  assert.equal(parsed.use_case, "fragile");
});
