import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchProductsHandler } from '../dist/tools/search_products.js';
import { APPROVED_CATALOG } from '../dist/effective-approved-catalog.js';

const byHandle = new Map(APPROVED_CATALOG.map(row => [row.handle, row]));
const bySku = new Map(APPROVED_CATALOG.map(row => [row.sku, row]));
const env = {
  SHOPIFY_STORE_DOMAIN: 'mock-shop.invalid', SHOPIFY_API_VERSION: 'test',
  SHOPIFY_PACKRIFT_TOKEN: 'local-test-only', STOREFRONT_DOMAIN: 'packrift.com',
  CATALOG_CACHE: {get: async () => null, put: async () => {}},
};
function product(row, overrides = {}) {
  assert.ok(row, 'fixture must be approved');
  return {
    id: `gid://shopify/Product/${row.productId}`, handle: row.handle, title: row.title,
    vendor: 'Packrift', onlineStoreUrl: `https://packrift.com/products/${row.handle}`,
    totalInventory: 7,
    priceRangeV2: {minVariantPrice: {amount: '73.21', currencyCode: 'USD'}, maxVariantPrice: {amount: '73.21', currencyCode: 'USD'}},
    featuredImage: {url: 'https://example.invalid/image.jpg'},
    variants: {edges: [{node: {id: `gid://shopify/ProductVariant/${row.variantId}`, availableForSale: true}}]},
    ...overrides,
  };
}
function mockShopify(t, {initial = [], hydrate, batchError} = {}) {
  const calls = []; let active = 0; let maxActive = 0; let batches = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://mock-shop.invalid/admin/api/test/graphql.json');
    const payload = JSON.parse(options.body); calls.push(payload);
    active += 1; maxActive = Math.max(active, maxActive);
    try {
      await new Promise(resolve => setTimeout(resolve, 1));
      if (payload.query.includes('query SearchProducts(')) {
        return Response.json({data: {products: {edges: initial.map(node => ({node}))}}});
      }
      assert.match(payload.query, /query SearchProductsByHandles\(/);
      const handles = Object.values(payload.variables);
      assert.ok(handles.length > 0 && handles.length <= 20, 'each alias batch is capped at 20');
      assert.equal((payload.query.match(/productByHandle\(handle: \$handle\d+\)/g) || []).length, handles.length);
      const batch = batches++;
      const error = batchError?.(handles, batch);
      if (error) return error;
      const data = Object.fromEntries(handles.map((handle, index) => [
        `p${index}`, hydrate ? hydrate(handle, index, batch) : product(byHandle.get(handle)),
      ]));
      return Response.json({data});
    } finally { active -= 1; }
  });
  return {calls, maxActive: () => maxActive};
}
const run = (query, limit) => searchProductsHandler(env, {query, ...(limit ? {limit} : {}), suppress_analytics: true});

test('default ten candidates use one search and one alias batch with live price/stock', async t => {
  const mock = mockShopify(t, {hydrate: handle => product(byHandle.get(handle), {
    totalInventory: 0, variants: {edges: [{node: {id: `gid://shopify/ProductVariant/${byHandle.get(handle).variantId}`, availableForSale: false}}]},
  })});
  const rows = await run('kraft tape');
  assert.equal(mock.calls.length, 2);
  assert.equal(Object.keys(mock.calls[1].variables).length, 10);
  assert.equal(rows.length, 10);
  assert.ok(rows.every(row => row.price_range.min === 73.21 && row.price_range.currency === 'USD' && row.in_stock === false));
  assert.ok(rows.every(row => row.url === `https://packrift.com/products/${row.handle}`));
  assert.equal(mock.maxActive(), 1);
});

test('stale null, malformed product and unapproved identity do not discard healthy peers', async t => {
  const mock = mockShopify(t, {hydrate: (handle, index) => {
    if (index === 0) return null;
    if (index === 1) return {handle, variants: {edges: []}};
    if (index === 2) return product(byHandle.get(handle), {handle: 'not-approved', variants: {edges: []}});
    return product(byHandle.get(handle));
  }});
  const rows = await run('kraft tape');
  assert.equal(mock.calls.length, 2); assert.equal(rows.length, 7);
  assert.ok(rows.every(row => byHandle.has(row.handle)));
});

test('alias-scoped GraphQL error drops failed handle and recovers healthy peers sequentially', async t => {
  let failedHandle;
  const mock = mockShopify(t, {batchError: (handles, batch) => {
    if (batch !== 0) return null;
    failedHandle = handles[1];
    return Response.json({data: {}, errors: [{message: 'stale handle failure', path: ['p1']}]});
  }});
  const rows = await run('kraft tape');
  assert.equal(mock.calls.length, 3); assert.equal(rows.length, 9);
  assert.ok(!rows.some(row => row.handle === failedHandle));
  assert.equal(Object.keys(mock.calls[2].variables).length, 9);
  assert.equal(mock.maxActive(), 1);
});

test('whole-request failure is fail-soft without retry amplification', async t => {
  const initial = APPROVED_CATALOG.find(row => row.family === 'tape' && /kraft/i.test(row.title));
  const mock = mockShopify(t, {initial: [product(initial)], batchError: () => new Response('upstream unavailable', {status: 503})});
  const rows = await run('kraft tape');
  assert.equal(mock.calls.length, 2);
  assert.equal(rows.length, 1); assert.equal(rows[0].handle, initial.handle);
});

test('exact Unicode dimensions reject 48-inch and wrong-pack initial candidates', async t => {
  const mock = mockShopify(t, {initial: [product(bySku.get('4866')), product(bySku.get('M866'))]});
  const rows = await run('8 × 6 × 6 ECT-32 kraft shipping boxes 25 pack');
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(rows.map(row => row.approved_sku), ['866']);
  const hydrated = Object.values(mock.calls[1].variables);
  assert.ok(!hydrated.includes(bySku.get('4866').handle));
  assert.ok(!hydrated.includes(bySku.get('M866').handle));
});

test('live dimensions override stale local candidate facts after hydration', async t => {
  const mock = mockShopify(t, {hydrate: handle => product(byHandle.get(handle), {title: '48x6x6 Kraft Shipping Boxes 25-Pack'})});
  const result = await run('8x6x6 ECT-32 kraft shipping boxes 25 pack');
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(result.results, []); assert.ok(result.no_match_recovery);
});

test('larger candidate budget remains complete across sequential batches capped at twenty', async t => {
  const mock = mockShopify(t);
  const rows = await run('tape', 50);
  assert.equal(mock.calls.length, 4);
  assert.deepEqual(mock.calls.slice(1).map(call => Object.keys(call.variables).length), [20, 20, 10]);
  assert.equal(rows.length, 50);
  assert.equal(new Set(rows.map(row => row.handle)).size, 50);
  assert.equal(mock.maxActive(), 1);
});

test('match explanations report query evidence instead of copying all product tokens', async t => {
  const exact=bySku.get('DL1066');
  mockShopify(t,{initial:[product(exact)]});
  const rows=await run('SKU DL1066');
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0].match.evidence.exact_terms_matched,['dl1066']);
  assert.ok(rows[0].match.matched_fields.includes('sku'));
  assert.ok(!rows[0].match.matched_fields.includes('family'));
});
