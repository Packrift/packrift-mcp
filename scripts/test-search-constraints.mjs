import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dimensionTokens,explicitPackCount,matchesRequiredSearchConstraints,scoreRow,queryIncludesSku,normalizeText} from '../dist/search-ranking.js';
import {APPROVED_CATALOG} from '../dist/effective-approved-catalog.js';
const get=sku=>{const r=APPROVED_CATALOG.find(r=>r.sku===sku);assert.ok(r);return r;};
const query='8x6x6 ECT-32 kraft shipping boxes 25 pack';
test('word separators and fractions preserve full dimension boundaries',()=>{
 assert.deepEqual(dimensionTokens('8 by 6 by 6'),['8x6x6']);
 assert.deepEqual(dimensionTokens('2 x 9 x 4 1/2"'),['2x9x4.5']);
 assert.deepEqual(dimensionTokens('8x6x6x4'),['8x6x6x4']);
 assert.deepEqual(dimensionTokens('SKU8x6x6'),[]);
 assert.equal(matchesRequiredSearchConstraints('8x6x6',{title:'8x6x6x4 box',handle:'8x6x6x4'}),false);
});
test('exact size search does not substitute white for kraft or a different ECT grade',()=>{
 assert.equal(matchesRequiredSearchConstraints('8x6x6 kraft boxes 50 pack',get('M866')),false);
 assert.equal(matchesRequiredSearchConstraints('8x6x6 ECT-48 kraft boxes 25 pack',get('866')),false);
 assert.equal(matchesRequiredSearchConstraints('8x6x6 32 ECT kraft boxes 25 pack',get('866')),true);
});
test('exact 8x6x6 remains eligible; 48/18/28 cannot masquerade as 8',()=>{
 assert.ok(scoreRow(query,get('866')).score>=250);
 for(const sku of ['4866','1866','2866']) {
  assert.equal(matchesRequiredSearchConstraints(query,get(sku)),false,sku);
  assert.ok(scoreRow(query,get(sku)).score<250,sku);
 }
});
test('ASCII, spaced, uppercase, Unicode times and decimal dimensions agree',()=>{
 for(const d of ['8x6x6','8 x 6 x 6','8 X 6 X 6','8 × 6 × 6','8.0 x 6.0 x 6.0']) {
  assert.deepEqual(dimensionTokens(d),['8x6x6']);
  assert.ok(scoreRow(d+' ECT-32 kraft boxes 25 pack',get('866')).score>=250,d);
  assert.equal(matchesRequiredSearchConstraints(d+' ECT-32 kraft boxes 25 pack',get('4866')),false,d);
 }
});
test('numeric SKU requires standalone or explicit SKU intent, never an order or pack count',()=>{
 assert.equal(queryIncludesSku(normalizeText('1066'),'1066',false),true);
 assert.equal(queryIncludesSku(normalizeText('SKU 1066 boxes'),'1066',false),true);
 assert.equal(queryIncludesSku(normalizeText('100 boxes'),'100',false),false);
 assert.equal(queryIncludesSku(normalizeText('25 pack boxes'),'25',false),false);
 assert.equal(queryIncludesSku(normalizeText('999 x 999 x 999 boxes'),'999',true),false);
 assert.equal(queryIncludesSku(normalizeText('SKU 999 999x999x999 box'),'999',true),true);
 assert.equal(queryIncludesSku(normalizeText('SKU DL1066'),'1066',false),false);
 assert.ok(scoreRow('1066',get('1066')).score>=1000);
});
test('explicit pack variants parse, but desired unit quantities are not pack sizes',()=>{
 for(const text of ['25 pack','25-Pack','25/Bundle','25 per case','bundle of 25','case of 25']) assert.equal(explicitPackCount(text),25,text);
 for(const text of ['100 boxes','need 100 items','4 bundles','2 cases','SKU 1066','10x6x6']) assert.equal(explicitPackCount(text),null,text);
 assert.equal(explicitPackCount('100 boxes in 25-pack bundles'),25);
 assert.equal(explicitPackCount('100 boxes in 4 bundles of 25'),25);
});
test('wrong pack count is ineligible; order quantity may exceed the sale unit',()=>{
 assert.equal(matchesRequiredSearchConstraints('100 boxes 8x6x6 25 pack',get('866')),true);
 assert.equal(matchesRequiredSearchConstraints('100 boxes 8x6x6 50 pack',get('866')),false);
 assert.equal(matchesRequiredSearchConstraints('100 boxes 8x6x6',get('866')),true);
 assert.equal(matchesRequiredSearchConstraints('SKU 866 8x6x6 50 pack',get('866')),false);
 assert.equal(matchesRequiredSearchConstraints('8x6x6 25 pack',get('M866')),false);
});
test('unknown pack count is not represented as an exact requested pack',()=>{
 assert.equal(matchesRequiredSearchConstraints('8x6x6 25 pack',{sku:'UNKNOWN',handle:'8x6x6',title:'8x6x6 boxes',family:'boxes'}),false);
});
test('general keyword and use-case ranking still returns category-correct candidates',()=>{
 for(const [q,family] of [['kraft tape','tape'],['packaging for shipping t-shirts','mailers']]) {
  const ranked=APPROVED_CATALOG.map(r=>({r,...scoreRow(q,r)})).filter(x=>x.qualifies).sort((a,b)=>b.score-a.score);
  assert.ok(ranked.length,q); assert.equal(ranked[0].r.family,family,q);
 }
});
