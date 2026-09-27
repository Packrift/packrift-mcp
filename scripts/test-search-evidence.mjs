import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dimensionTokens,matchesRequiredSearchConstraints,scoreRow,parseSpecAttributes} from '../dist/search-ranking.js';
import {parseDimensions} from '../dist/dimensions.js';
import {APPROVED_CATALOG} from '../dist/effective-approved-catalog.js';
const row=title=>({sku:'SYNTH',handle:'synthetic',title,family:'boxes'});
const rejected=(query,title)=>{
 assert.equal(matchesRequiredSearchConstraints(query,row(title)),false,`${query} vs ${title}`);
 assert.equal(scoreRow(query,row(title)).qualifies,false);
 assert.equal(scoreRow(query,row(title)).score,0);
};
test('explicit units need same stated unit; absent units are not inferred from inch default',()=>{
 rejected('8x6x6 cm boxes','8x6x6 inches Boxes');
 rejected('8x6x6 cm boxes','8x6x6 Boxes');
 rejected('8x6x6 in boxes','8x6x6 Boxes');
 assert.equal(matchesRequiredSearchConstraints('8x6x6 boxes',row('8x6x6 Boxes')),true);
 assert.equal(matchesRequiredSearchConstraints('8x6x6 boxes',row('8x6x6 inches Boxes')),true);
 assert.equal(matchesRequiredSearchConstraints('8 x 6 x 6 in boxes',row('8x6x6 inches Boxes')),true);
 assert.equal(matchesRequiredSearchConstraints('8 cm x 6 cm x 6 cm boxes',row('8x6x6 cm Boxes')),true);
});
test('mixed units and invalid fractions fail closed even when the words match',()=>{
 rejected('8 cm x 6 in x 6 cm boxes','8x6x6 Boxes');
 rejected('8x6x6 boxes','8 cm x 6 in x 6 cm Boxes');
 rejected('1/0 x 2 x 3 boxes','1x2x3 Boxes');
 for(const q of ['1/2-3/4 x 2 x 3 boxes','8 x 1/2-3/4 x 3 boxes','3-4 mil poly bags']) rejected(q,'Poly Bags Boxes 4 Mil');
});
test('stated thickness, gauge, yardage and width require equal numeric evidence',()=>{
 for(const [q,title] of [
 ['6x18 4 mil poly bags','6x18 1.5 Mil Poly Bags'],
 ['6x18 4 mil poly bags','6x18 Poly Bags'],
 ['80 gauge stretch film','90 Gauge Stretch Film'],
 ['2 inch 110 yard packing tape','2 inch 55 yard Packing Tape'],
 ['2 inch 110 yard packing tape','3 inch 110 yard Packing Tape'],
 ])rejected(q,title);
 assert.equal(matchesRequiredSearchConstraints('6x18 4 mil bags',row('6x18" 4 Mil Bags')),true);
 assert.equal(matchesRequiredSearchConstraints('1/2 mil poly bags',row('0.5 Mil Poly Bags')),true);
 assert.equal(matchesRequiredSearchConstraints('1 1/2 inch tape',row('1.5 inch Tape')),true);
 assert.equal(matchesRequiredSearchConstraints('3 inch packing tape 110 yard',row('3" x 110 yds. Packing Tape')),true);
});
test('dimension inch marks are not confused with standalone widths',()=>{
 assert.deepEqual(parseSpecAttributes('8 x 6 x 6 inches boxes').inches,[]);
 assert.deepEqual(parseSpecAttributes('8" L x 6" W x 6" H boxes').inches,[]);
 assert.deepEqual(parseSpecAttributes('3 inch tape').inches,[3]);
});
test('explicit and standalone known SKU queries exclude unrelated rows, preserve numeric order queries',()=>{
 const exact=APPROVED_CATALOG.find(r=>r.sku==='DL1066');const numeric=APPROVED_CATALOG.find(r=>r.sku==='1066');
 for(const q of ['SKU DL1066','SKU:DL1066','sku # DL1066','DL1066']) {
  assert.equal(matchesRequiredSearchConstraints(q,exact),true,q);
  assert.equal(matchesRequiredSearchConstraints(q,numeric),false,q);
 }
 const box=APPROVED_CATALOG.find(r=>r.sku==='866');
 assert.equal(matchesRequiredSearchConstraints('100 boxes 8x6x6 25 pack',box),true);
 assert.equal(matchesRequiredSearchConstraints('SKU 866 8x6x6 50 pack',box),false);
 assert.equal(matchesRequiredSearchConstraints('SKU UNKNOWN-999',box),false);
});
test('inch fitter converts supported explicit units instead of relabeling numbers',()=>{
 for(const input of ['2.54x5.08x7.62 cm','25.4 × 50.8 × 76.2 mm','2.54 cm by 5.08 cm by 7.62 cm']) {
  const result=parseDimensions(input);assert.ok(result,input);
  for(const [i,key] of ['length_in','width_in','depth_in'].entries())assert.ok(Math.abs(result[key]-(i+1))<1e-8);
 }
 assert.equal(parseDimensions('1x2x3 ft').length_in,12);
 assert.equal(parseDimensions('8 x 6 x 6').length_in,8);
});
test('fitter consumes whole tuples, fractions and labels without accepting malformed dimensions',()=>{
 for(const input of ['8x6x6x4','1/0 x 2 x 3','0x6x6','8 cm x 6 in x 6 cm','1/2-3/4 x 2 x 3','8 x 1/2-3/4 x 3','-8x6x6'])assert.equal(parseDimensions(input),null,input);
 assert.deepEqual(dimensionTokens('8x6x6x4'),['8x6x6x4']);
 const mixed=parseDimensions('12 1/8" L x 11 5/8" W x 2 5/8" H');assert.equal(mixed.length_in,12.125);assert.equal(mixed.depth_in,2.625);
 assert.equal(parseDimensions('1/2 x 2 x 3').length_in,0.5);
 assert.equal(parseDimensions('Box 8 by 6 by 6').length_in,8);
});
test('real catalog precision: exact size+mil and explicit SKU produce only evidence-matching rows',()=>{
 for(const [query,predicate] of [
  ['6x18 4 mil poly bags',r=>/4 Mil/i.test(r.title)],
  ['SKU DL1066',r=>r.sku==='DL1066'],
 ]){
 const result=APPROVED_CATALOG.map(r=>({r,...scoreRow(query,r)})).filter(r=>r.qualifies);
 assert.ok(result.length,query);assert.ok(result.every(x=>predicate(x.r)),query);
 }
 const metric=APPROVED_CATALOG.map(r=>({r,...scoreRow('8x6x6 cm kraft shipping boxes 25 pack',r)})).filter(r=>r.qualifies);
 assert.equal(metric.length,0);
});

test('numeric attribute equality alone cannot substitute bags for gloves',()=>{
 const query='4 mil accelerator free nitrile gloves';
 const rows=APPROVED_CATALOG.map(r=>({r,...scoreRow(query,r)})).filter(x=>x.qualifies);
 assert.ok(rows.every(x=>/\b(?:nitrile|gloves?)\b/i.test(x.r.title)),rows.slice(0,3).map(x=>x.r.title).join(' | '));
 const glove={sku:'GLOVE4',handle:'gloves',title:'4 Mil Accelerator Free Nitrile Gloves',family:'gloves'};
 assert.equal(scoreRow(query,glove).qualifies,true);
});

test('inch width by yard roll length remains searchable with both specs enforced',()=>{
 for(const [query,width] of [['3" x 110 yds tape',3],['2 inch x 110 yards clear tape',2]]) {
  assert.deepEqual(dimensionTokens(query),[],query);
  assert.equal(parseSpecAttributes(query).inches[0],width);
  assert.equal(parseSpecAttributes(query).yards,110);
  assert.equal(parseDimensions(query),null,'a roll is not a box-size tuple');
  const rows=APPROVED_CATALOG.map(r=>({r,...scoreRow(query,r)})).filter(x=>x.qualifies);
  assert.ok(rows.length,query);
  for(const {r} of rows) {
   const specs=parseSpecAttributes(r.title);
   assert.ok(specs.inches.includes(width),r.title);
   assert.equal(specs.yards,110,r.title);
  }
  rejected(query,`${width+1}" x 110 yds Clear Tape`);
  rejected(query,`${width}" x 55 yds Clear Tape`);
 }
});

test('ranges in first, middle and last dimensions cannot become an exact product',()=>{
 const queries=['8-10 x 6 x 6 boxes','8 to 10 x 6 x 6 boxes','8 x 6-8 x 6 boxes','8 x 6 to 8 x 6 boxes','8 x 6 x 6-8 boxes','8 x 6 x 6 to 8 boxes','8 x 6 x 1/2-3/4 boxes'];
 for(const query of queries) {
  assert.deepEqual(dimensionTokens(query),[],query);
  assert.equal(parseDimensions(query),null,query);
  const rows=APPROVED_CATALOG.filter(r=>scoreRow(query,r).qualifies);
  assert.equal(rows.length,0,query);
 }
});

test('malformed dimensional intent fails closed instead of falling back to all boxes',()=>{
 for(const query of ['8x6x6x-4 boxes','8x6x6x boxes','-8x6x6 boxes','8 x 6 x boxes','8 by 6 by boxes']) {
  assert.deepEqual(dimensionTokens(query),[],query);
  assert.equal(parseDimensions(query),null,query);
  assert.equal(APPROVED_CATALOG.filter(r=>scoreRow(query,r).qualifies).length,0,query);
 }
 assert.equal(scoreRow('shipping boxes',APPROVED_CATALOG.find(r=>r.sku==='866')).qualifies,true);
});

test('hyphenated and leading-decimal numeric specifications preserve hard constraints',()=>{
 assert.equal(parseSpecAttributes('4-mil bags').mil,4);
 assert.equal(parseSpecAttributes('75-gauge film').gauge,75);
 assert.equal(parseSpecAttributes('.5 mil bags').mil,0.5);
 assert.equal(parseSpecAttributes('.5-mil bags').mil,0.5);
 for(const [query,key,value] of [['6x18 4-mil poly bags','mil',4],['75-gauge stretch film','gauge',75],['.5 mil poly bags','mil',0.5]]) {
  const rows=APPROVED_CATALOG.map(r=>({r,...scoreRow(query,r)})).filter(x=>x.qualifies);
  assert.ok(rows.length,query);
  for(const {r} of rows)assert.equal(parseSpecAttributes(r.title)[key],value,r.title);
 }
 rejected('6x18 4-mil poly bags','6x18 1.5 Mil Poly Bags');
 rejected('75-gauge stretch film','80 Gauge Stretch Film');
 rejected('.5 mil poly bags','1 Mil Poly Bags');
});

test('accepted inch-width by feet-length stretch-wrap alias preserves exact SKU and both specs',()=>{
 const query='stretch wrap 20 inch x 1000 ft';
 assert.deepEqual(dimensionTokens(query),[]);
 assert.deepEqual(parseSpecAttributes(query).inches,[20]);
 assert.equal(parseSpecAttributes(query).feet,1000);
 assert.equal(parseDimensions(query),null);
 const rows=APPROVED_CATALOG.map(r=>({r,...scoreRow(query,r)})).filter(x=>x.qualifies).sort((a,b)=>b.score-a.score);
 assert.equal(rows[0]?.r.sku,'SF2071PK');
 for(const {r} of rows) {
  assert.ok(parseSpecAttributes(r.title).inches.includes(20),r.title);
  assert.equal(parseSpecAttributes(r.title).feet,1000,r.title);
 }
 rejected(query,'20" x 1500\' Stretch Wrap');
 rejected(query,'18" x 1000\' Stretch Wrap');
 rejected(query,'20" Stretch Wrap');
 for(const q of ['stretch wrap 20 inch x 1000 feet','stretch wrap 20" x 1000\'']) {
  assert.equal(matchesRequiredSearchConstraints(q,APPROVED_CATALOG.find(r=>r.sku==='SF2071PK')),true,q);
 }
});
