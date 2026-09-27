import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as before from './fixtures/search-ranking-before-optimization.mjs';
import * as after from '../dist/search-ranking.js';
import {APPROVED_CATALOG} from '../dist/effective-approved-catalog.js';
import {searchProductsHandler} from '../dist/tools/search_products.js';
const queries=['SKU DL1066','1066','8 × 6 × 6 ECT-32 kraft boxes 25 pack','8.000000001x6x6 boxes','8x6x6 cm boxes','6x18 4-mil poly bags','75-gauge stretch film','.5 mil poly bags','3" x 110 yds tape','stretch wrap 20 inch x 1000 ft','kraft tape','bubble mailers','packaging for shipping t-shirts','4 mil accelerator free nitrile gloves','8x6x6x-4 boxes','unicorn accelerator devices'];
test('compiled scorer exactly preserves every approved-row signal across representative queries',()=>{
 for(const query of queries) {
  for(const row of APPROVED_CATALOG) assert.deepEqual(after.scoreRow(query,row),before.scoreRow(query,row),`${query}: ${row.sku}`);
 }
});
test('candidate index never drops a constraint-eligible row, including float tolerance and tie order',()=>{
 for(const query of queries) {
  const candidates=after.catalogSearchCandidates(query);
  const expected=APPROVED_CATALOG.filter(row=>before.matchesRequiredSearchConstraints(query,row)).map(row=>row.handle);
  const actual=candidates.filter(row=>after.matchesRequiredSearchConstraints(query,row)).map(row=>row.handle);
  assert.deepEqual(actual,expected,query);
 }
});
test('mutating hydrated text invalidates its feature cache and query-cache eviction preserves semantics',()=>{
 const row={sku:'DYNAMIC',handle:'8x6x6-boxes',title:'8x6x6 Kraft Boxes 25-Pack',family:'boxes',searchAliases:''};
 const states=[{}, {title:'48x6x6 White Boxes 50-Pack'}, {sku:'DL1066',title:'Labels'}, {handle:'new-handle',family:'labels'}, {searchAliases:'special labels'}, {title:'8x6x6 Kraft Boxes 25-Pack'}];
 for(const changes of states) {
  Object.assign(row,changes);
  for(const query of [...queries,'special labels']) assert.deepEqual(after.scoreRow(query,row),before.scoreRow(query,row),query);
 }
 for(let i=0;i<45;i++)after.scoreRow('unused query '+i,row);
 assert.deepEqual(after.scoreRow('special labels',row),before.scoreRow('special labels',row));
});
test('cached fallback identities still hydrate changed price, stock and title on the next request',async t=>{
 const byHandle=new Map(APPROVED_CATALOG.map(row=>[row.handle,row]));let version=0;const calls=[];
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.query.includes('query SearchProducts('))return Response.json({data:{products:{edges:[]}}});
  return Response.json({data:Object.fromEntries(Object.values(body.variables).map((handle,i)=>{
   const row=byHandle.get(handle);
   return ['p'+i,{id:`gid://shopify/Product/${row.productId}`,handle,title:row.title,vendor:'Packrift',onlineStoreUrl:`https://packrift.com/products/${handle}`,totalInventory:version?0:10,priceRangeV2:{minVariantPrice:{amount:version?'84.56':'73.21',currencyCode:'USD'},maxVariantPrice:{amount:version?'84.56':'73.21',currencyCode:'USD'}},featuredImage:null,variants:{edges:[{node:{id:`gid://shopify/ProductVariant/${row.variantId}`,availableForSale:!version}}]}}];
  }))});
 });
 const env={SHOPIFY_STORE_DOMAIN:'mock.invalid',SHOPIFY_API_VERSION:'test',SHOPIFY_PACKRIFT_TOKEN:'fixture',STOREFRONT_DOMAIN:'packrift.com',CATALOG_CACHE:{get:async()=>null,put:async()=>{}}};
 const args={query:'kraft tape',limit:5,suppress_analytics:true};
 const first=await searchProductsHandler(env,args);version=1;const second=await searchProductsHandler(env,args);
 assert.equal(calls.length,4,'each request still searches and hydrates');
 assert.deepEqual(first.map(r=>r.handle),second.map(r=>r.handle));
 assert.ok(first.every(r=>r.price_range.min===73.21&&r.in_stock));
 assert.ok(second.every(r=>r.price_range.min===84.56&&!r.in_stock));
});
