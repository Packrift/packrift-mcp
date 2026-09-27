import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestEffort } from '../dist/best-effort.js';
import { searchProductsHandler } from '../dist/tools/search_products.js';
import { APPROVED_CATALOG } from '../dist/effective-approved-catalog.js';
for(const [name,operation,expected] of [
 ['success',async()=>42,42],['sync rejection',()=>{throw Error('offline')},null],
 ['async rejection',async()=>{throw Error('offline')},null],['stalled',()=>new Promise(()=>{}),null]
]) test(`optional work: ${name}`, {timeout:1000},async()=>assert.equal(await bestEffort(operation,null,10),expected));
test('late optional failure is consumed after timeout',async()=>{
 let reject;assert.equal(await bestEffort(()=>new Promise((_,r)=>{reject=r}),null,10),null);
 reject(Error('late failure'));await new Promise(resolve=>setImmediate(resolve));
});
test('search survives cache read/write and telemetry failures with live price and availability',async t=>{
 const row=APPROVED_CATALOG.find(x=>x.sku==='1066');assert.ok(row);
 const product={id:`gid://shopify/Product/${row.productId}`,handle:row.handle,title:row.title,vendor:'Packrift',onlineStoreUrl:`https://packrift.com/products/${row.handle}`,totalInventory:0,priceRangeV2:{minVariantPrice:{amount:'81.37',currencyCode:'USD'},maxVariantPrice:{amount:'81.37',currencyCode:'USD'}},featuredImage:null,variants:{edges:[{node:{id:`gid://shopify/ProductVariant/${row.variantId}`,availableForSale:false}}]}};
 let calls=0,reads=0,writes=0;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{calls++;const body=JSON.parse(init.body);assert.ok(body.query.includes('query SearchProducts('));return Response.json({data:{products:{edges:[{node:product}]}}});});
 const env={SHOPIFY_STORE_DOMAIN:'mock-shop.invalid',SHOPIFY_API_VERSION:'test',SHOPIFY_PACKRIFT_TOKEN:'fixture',STOREFRONT_DOMAIN:'packrift.com',CATALOG_CACHE:{get:async()=>{reads++;throw Error('KV offline')},put:async()=>{writes++;throw Error('KV offline')}}};
 const result=await searchProductsHandler(env,{query:'SKU 1066'});
 assert.equal(result.length,1);assert.equal(result[0].approved_sku,'1066');assert.equal(result[0].price_range.min,81.37);assert.equal(result[0].in_stock,false);assert.equal(calls,1);assert.equal(reads,1);assert.ok(writes>=2);
});
