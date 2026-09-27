import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopifyQuery, ShopifyError } from '../dist/shopify.js';
const env={SHOPIFY_STORE_DOMAIN:'mock-shop.invalid',SHOPIFY_API_VERSION:'test',SHOPIFY_PACKRIFT_TOKEN:'local-test-only'};
const query='query Products { products(first:1) { nodes { id } } }';
const never=()=>new Promise(()=>{});
const isTimeout=e=>e instanceof ShopifyError && e.details?.code==='SHOPIFY_TIMEOUT';

test('healthy data keeps request shape and cleans up cancellation listener',async t=>{
 const c=new AbortController(); let registered=0,removed=0;
 const add=c.signal.addEventListener.bind(c.signal),remove=c.signal.removeEventListener.bind(c.signal);
 t.mock.method(c.signal,'addEventListener',(...args)=>{registered++;return add(...args)});
 t.mock.method(c.signal,'removeEventListener',(...args)=>{removed++;return remove(...args)});
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(url,'https://mock-shop.invalid/admin/api/test/graphql.json');
  assert.equal(init.headers['X-Shopify-Access-Token'],'local-test-only');
  assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{query,variables:{first:1}});
  assert.ok(init.signal instanceof AbortSignal);return Response.json({data:{ok:true}});
 });
 assert.deepEqual(await shopifyQuery(env,query,{first:1},{signal:c.signal}),{ok:true});
 assert.equal(registered,1);assert.equal(removed,1);
});
test('deadline terminates fetch that ignores abort without retry',{timeout:1000},async t=>{
 let calls=0,signal;t.mock.method(globalThis,'fetch',(_url,init)=>{calls++;signal=init.signal;return never()});
 await assert.rejects(shopifyQuery(env,query,{}, {timeoutMs:10}),isTimeout);
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});
for(const status of [200,503])test(`deadline covers hanging ${status} response body`,{timeout:1000},async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:status===200,status,json:never,text:never}));
 await assert.rejects(shopifyQuery(env,query,{}, {timeoutMs:10}),isTimeout);
});
test('caller abort interrupts stalled body with original reason',{timeout:1000},async t=>{
 const c=new AbortController(),reason=new Error('caller cancelled');let signal;
 t.mock.method(globalThis,'fetch',async(_url,init)=>{signal=init.signal;return {ok:true,json:()=>{c.abort(reason);return never()}}});
 await assert.rejects(shopifyQuery(env,query,{}, {signal:c.signal}),e=>e===reason);
 assert.equal(signal.aborted,true);
});
test('already-aborted caller never sends request',async t=>{
 const c=new AbortController();c.abort();const fetch=t.mock.method(globalThis,'fetch',never);
 await assert.rejects(shopifyQuery(env,query,{}, {signal:c.signal}),e=>e.name==='AbortError');
 assert.equal(fetch.mock.callCount(),0);
});
test('HTTP error preserves status with bounded body',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('x'.repeat(2000),{status:503}));
 await assert.rejects(shopifyQuery(env,query),e=>e instanceof ShopifyError && e.message==='Shopify HTTP 503' && e.details.length===1000);
});
test('GraphQL alias errors preserve details for partial recovery',async t=>{
 const errors=[{message:'stale alias',path:['p1']}];
 t.mock.method(globalThis,'fetch',async()=>Response.json({data:{p0:null},errors}));
 await assert.rejects(shopifyQuery(env,query),e=>e instanceof ShopifyError && JSON.stringify(e.details)===JSON.stringify(errors));
});
test('no-data response fails closed',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({}));
 await assert.rejects(shopifyQuery(env,query),/Shopify returned no data/);
});
test('mutation timeout is never replayed',{timeout:1000},async t=>{
 const fetch=t.mock.method(globalThis,'fetch',never);
 await assert.rejects(shopifyQuery(env,'mutation Example { example }',{}, {timeoutMs:10}),isTimeout);
 assert.equal(fetch.mock.callCount(),1);
});
test('invalid timeout budgets fail before network',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',never);
 for(const timeoutMs of [0,-1,NaN,Infinity,30001])await assert.rejects(shopifyQuery(env,query,{}, {timeoutMs}),/Invalid Shopify request deadline/);
 assert.equal(fetch.mock.callCount(),0);
});
