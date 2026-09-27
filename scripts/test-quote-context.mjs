// Synthetic addresses only; fetch is mocked and no requests leave the process.
// Offline regression tests: npm run build && node --test scripts/test-quote-context.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { APPROVED_CATALOG } from "../dist/effective-approved-catalog.js";
import { getPricingHandler, getPricingSchema } from "../dist/tools/get_pricing.js";
import { getShippingEstimateHandler, getShippingEstimateSchema } from "../dist/tools/get_shipping_estimate.js";

const variantId = APPROVED_CATALOG.find((item) => item.variantId)?.variantId;
assert.ok(variantId);
const env = { SHOPIFY_STORE_DOMAIN: "offline.invalid", SHOPIFY_API_VERSION: "test", SHOPIFY_PACKRIFT_TOKEN: "offline-test", STOREFRONT_DOMAIN: "packrift.com" };
const shippingInput = { destination_postal_code: "54923", country: "US", items: [{ variant_id: variantId, qty: 10 }] };
const calcData = { draftOrderCalculate: { userErrors: [], calculatedDraftOrder: { availableShippingRates: [{ handle: "rate", title: "Freight Shipping", price: { amount: "144.80", currencyCode: "USD" } }] } } };
function mockShopify(t, data) {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://offline.invalid/admin/api/test/graphql.json");
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = original; });
  return requests;
}

test("supplied address reaches existing calculation exactly and remains non-final", async (t) => {
  const requests = mockShopify(t, calcData);
  const rates = await getShippingEstimateHandler(env, { ...shippingInput, destination_address: { address1: "47 Example Road", city: "Exampletown", province_code: "WI" } });
  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /draftOrderCalculate/);
  assert.deepEqual(requests[0].variables.input.shippingAddress, { address1: "47 Example Road", city: "Exampletown", zip: "54923", country: "United States", provinceCode: "WI" });
  assert.equal(rates[0].price, 144.8);
  assert.equal(rates[0].destination_basis, "provided_address");
  assert.equal(rates[0].complete_address_provided, true);
  assert.equal(rates[0].address_validated, false);
  assert.equal(rates[0].discounts_evaluated, false);
  assert.equal(rates[0].price_is_final, false);
  assert.match(rates[0].estimate_note, /Cart shipping discounts/);
});

test("legacy US and CA calls retain placeholders and explicitly flag approximation", async (t) => {
  const requests = mockShopify(t, calcData);
  for (const [country, city, name] of [["US", "Anywhere", "United States"], ["CA", "Toronto", "Canada"]]) {
    const rates = await getShippingEstimateHandler(env, { ...shippingInput, country });
    assert.deepEqual(requests.at(-1).variables.input.shippingAddress, { address1: "1 Main Street", city, zip: "54923", country: name, provinceCode: null });
    assert.equal(rates[0].destination_basis, "postal_code_only");
    assert.equal(rates[0].complete_address_provided, false);
    assert.equal(rates[0].price_is_final, false);
    assert.equal(rates[0].discounts_evaluated, false);
    assert.match(rates[0].estimate_note, /placeholder street and city/);
  }
});

test("partial, blank, null or conflicting nested destination fields fail before any request", async (t) => {
  const requests = mockShopify(t, calcData);
  for (const destination_address of [{}, { address1: "47 Example Road" }, { address1: "47 Example Road", city: "Exampletown" }, { address1: " ", city: "Exampletown", province_code: "WI" }, { address1: "47 Example Road", city: "Exampletown", province_code: "WI", country: "CA" }, null]) {
    await assert.rejects(getShippingEstimateHandler(env, { ...shippingInput, destination_address }));
  }
  assert.equal(requests.length, 0);
  assert.deepEqual(getShippingEstimateSchema.inputSchema.properties.destination_address.required, ["address1", "city", "province_code"]);
});

test("pricing keeps numeric compatibility while explicitly excluding cart discounts", async (t) => {
  const requests = mockShopify(t, { nodes: [{ id: `gid://shopify/ProductVariant/${variantId}`, price: "132.92", inventoryQuantity: 50, availableForSale: true, product: { priceRangeV2: { minVariantPrice: { currencyCode: "USD" } } } }] });
  for (const quantity of [1, 10]) {
    const [row] = await getPricingHandler(env, { variant_ids: [variantId], quantity });
    assert.equal(row.unit_price, 132.92);
    assert.equal(row.base_unit_price, row.unit_price);
    assert.equal(row.line_total, quantity === 10 ? 1329.2 : 132.92);
    assert.equal(row.base_line_total, row.line_total);
    assert.equal(row.pricing_basis, "shopify_variant_base_price");
    assert.equal(row.discounts_evaluated, false);
    assert.equal(row.final_cart_total, null);
    assert.equal(row.final_price_authority, "Shopify cart and checkout");
    assert.ok(row.tracking);
    assert.ok(row.post_confirmation_handoff);
  }
  assert.equal(requests.length, 2);
  assert.match(getPricingSchema.description, /base catalog/);
});

test("missing variant returns null base amounts rather than a final zero total", async (t) => {
  mockShopify(t, { nodes: [null] });
  const [row] = await getPricingHandler(env, { variant_ids: [variantId], quantity: 10 });
  assert.equal(row.error, "variant not found");
  assert.equal(row.base_unit_price, null);
  assert.equal(row.base_line_total, null);
  assert.equal(row.line_total, null);
  assert.equal(row.final_cart_total, null);
  assert.equal(row.discounts_evaluated, false);
});

test("approval and quantity guards still prevent network requests", async (t) => {
  const requests = mockShopify(t, calcData);
  await assert.rejects(getPricingHandler(env, { variant_ids: ["0"], quantity: 1 }), /AI_APPROVE/);
  await assert.rejects(getPricingHandler(env, { variant_ids: [variantId], quantity: 0 }));
  await assert.rejects(getShippingEstimateHandler(env, { ...shippingInput, items: [{ variant_id: "0", qty: 1 }] }), /AI_APPROVE/);
  await assert.rejects(getShippingEstimateHandler(env, { ...shippingInput, items: [{ variant_id: variantId, qty: 0 }] }));
  assert.equal(requests.length, 0);
});
