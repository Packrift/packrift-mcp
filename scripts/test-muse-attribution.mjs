// Offline only: npm run build && node --test scripts/test-muse-attribution.mjs
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { approvalForSku } from "../dist/approval.js";
import { createCartUrlHandler } from "../dist/tools/create_cart_url.js";
import { preparePurchaseHandoffHandler } from "../dist/tools/prepare_purchase_handoff.js";

const item = approvalForSku("1066");
assert.ok(item);
const env = {
  SHOPIFY_STORE_DOMAIN: "offline.invalid",
  SHOPIFY_API_VERSION: "test",
  SHOPIFY_PACKRIFT_TOKEN: "offline-test",
  STOREFRONT_DOMAIN: "packrift.com",
  CATALOG_CACHE: { put: async () => assert.fail("Synthetic tests must not write analytics") },
};
const input = { sku: item.sku, quantity: 2, suppress_analytics: true };

beforeEach((t) => {
  t.mock.method(globalThis, "fetch", async () => assert.fail("Unexpected network request"));
});

function assertAttribution(cart, source, context) {
  const landing = new URL(cart.url);
  const destination = new URL(cart.final_cart_url);
  assert.equal(landing.pathname, `/r/cart/${item.sku}`);
  assert.equal(destination.pathname, `/cart/${item.variantId}:2`);
  for (const url of [landing, destination]) {
    assert.equal(url.searchParams.get("utm_source"), source);
    assert.equal(url.searchParams.get("mcp_source_context"), context);
    assert.equal(url.searchParams.get("utm_medium"), "mcp_tool");
    assert.equal(url.searchParams.get("utm_campaign"), "create_cart_url");
    assert.equal(url.searchParams.get("mcp_handoff_id"), cart.mcp_handoff_id);
  }
  assert.equal(destination.searchParams.get("attributes[packrift_utm_source]"), source);
  assert.equal(destination.searchParams.get("attributes[packrift_mcp_source_context]"), context);
  assert.equal(cart.utm.source, source);
  assert.equal(cart.cart_tracking.utm_source, source);
  assert.equal(cart.cart_handoff.attribution_required.utm_source, source);
  assert.equal(cart.cart_handoff.primary_url, cart.url);
  assert.equal(cart.cart_handoff.final_destination_url, cart.final_cart_url);
  assert.equal(cart.cart_handoff.no_order_created_by_mcp, true);
}

test("Muse transport context survives landing, cart permalink and Shopify cart attributes", async () => {
  const cart = await createCartUrlHandler(env, input, { sourceSlug: "muse", sessionId: "offline-muse-session" });
  assertAttribution(cart, "muse", "muse");
  assert.equal(cart.mcp_session_id, "offline-muse-session");
});

test("explicit Muse source arguments use the same attribution", async () => {
  const cart = await createCartUrlHandler(env, { ...input, mcp_source_context: " Muse " });
  assertAttribution(cart, "muse", "muse");
});

test("explicit source arguments take precedence and attribute to the named assistant", async () => {
  const cart = await createCartUrlHandler(env, { ...input, mcp_source_context: "claude" }, { sourceSlug: "muse" });
  assertAttribution(cart, "claude", "claude");
});

test("assistant-specific sources map to one utm_source per assistant", async () => {
  const cases = [["claude_remote_mcp", "claude"], ["claude_code", "claude"], ["openai_chatgpt", "chatgpt"], ["cursor_directory", "cursor_directory"]];
  for (const [sourceSlug, expected] of cases) {
    const cart = await createCartUrlHandler(env, input, { sourceSlug });
    assert.equal(new URL(cart.final_cart_url).searchParams.get("utm_source"), expected, sourceSlug);
  }
});

test("calls without a source are attributed to a generic AI agent, including freeform source_context", async () => {
  for (const source_context of [undefined, "muse"]) {
    const cart = await createCartUrlHandler(env, { ...input, source_context });
    assertAttribution(cart, "ai_agent", null);
  }
});

function mockProductChecks(t) {
  const requests = [];
  const variant = {
    id: `gid://shopify/ProductVariant/${item.variantId}`, sku: item.sku,
    title: "Default", price: "24.00", inventoryQuantity: 20, availableForSale: true,
    selectedOptions: [], inventoryItem: null,
    product: { priceRangeV2: { minVariantPrice: { amount: "24.00", currencyCode: "USD" } } },
  };
  const price = { amount: "24.00", currencyCode: "USD" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://offline.invalid/admin/api/test/graphql.json");
    const request = JSON.parse(options.body);
    assert.match(request.query, /^\s*query /);
    requests.push(request);
    let data;
    if (/query GetProduct\(/.test(request.query)) {
      assert.equal(request.variables.handle, item.handle);
      data = { productByHandle: {
        id: "gid://shopify/Product/1", handle: item.handle, title: item.title,
        vendor: "Offline fixture", productType: "Boxes", description: "Offline fixture", tags: [],
        featuredImage: null, onlineStoreUrl: `https://packrift.com/products/${item.handle}`,
        priceRangeV2: { minVariantPrice: price, maxVariantPrice: price },
        metafields: { edges: [] }, variants: { edges: [{ node: variant }] },
      } };
    } else {
      assert.match(request.query, /query (Pricing|Inventory)\(/);
      assert.deepEqual(request.variables.ids, [variant.id]);
      data = { nodes: [variant] };
    }
    return Response.json({ data });
  });
  return requests;
}

test("confirmed prepare_purchase_handoff carries Muse context through its exact-SKU checks", async (t) => {
  const requests = mockProductChecks(t);
  const result = await preparePurchaseHandoffHandler(env, { ...input, buyer_confirmed: true }, { sourceSlug: "muse" });
  assert.equal(result.status, "cart_handoff_ready");
  assert.equal(requests.length, 3);
  assertAttribution(result.cart, "muse", "muse");
});

test("unconfirmed prepare_purchase_handoff still withholds a cart for Muse", async (t) => {
  const requests = mockProductChecks(t);
  const result = await preparePurchaseHandoffHandler(env, { ...input, buyer_confirmed: false }, { sourceSlug: "muse" });
  assert.equal(requests.length, 3);
  assert.equal(result.cart, null);
});

test("Muse attribution never bypasses a commerce hold", async () => {
  const held = { ...input, sku: "12104", buyer_confirmed: true };
  await assert.rejects(createCartUrlHandler(env, held, { sourceSlug: "muse" }), /quoted rather than sold through a checkout link/);
  const result = await preparePurchaseHandoffHandler(env, held, { sourceSlug: "muse" });
  assert.equal(result.status, "blocked_by_mcp_commerce_hold");
  assert.equal(result.cart, null);
});
