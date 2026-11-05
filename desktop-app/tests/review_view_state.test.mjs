import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  buildReviewViewportKey,
  captureReviewViewport,
  createReviewViewportStateRegistry,
  restoreReviewViewport
} from '../renderer/state/review_view_state.mjs';

function card(rowId, offsetTop, offsetHeight = 80) {
  return { dataset: { reviewRowId: rowId }, offsetTop, offsetHeight };
}

const runAAll = buildReviewViewportKey({
  runDir: 'C:/runs/a',
  filters: { search: ' Alice ', status: 'all', contact: 'missing' }
});
assert.equal(runAAll, buildReviewViewportKey({
  runDir: 'C:/runs/a',
  filters: { search: 'alice', status: 'all', contact: 'missing' }
}));
assert.notEqual(runAAll, buildReviewViewportKey({
  runDir: 'C:/runs/b',
  filters: { search: 'alice', status: 'all', contact: 'missing' }
}));
assert.notEqual(runAAll, buildReviewViewportKey({
  runDir: 'C:/runs/a',
  filters: { search: 'alice', status: 'selected', contact: 'missing' }
}));

const container = {
  scrollTop: 135,
  scrollHeight: 600,
  clientHeight: 180,
  children: [card('a', 0, 100), card('b', 110, 100), card('c', 220, 100)]
};
assert.deepEqual(captureReviewViewport(container, { activeRowId: 'b' }), {
  scrollTop: 135,
  anchorRowId: 'b',
  anchorOffset: -25,
  activeRowId: 'b'
});

const rerendered = {
  scrollTop: 0,
  scrollHeight: 720,
  clientHeight: 180,
  children: [card('a', 0, 120), card('b', 130, 120), card('c', 260, 120)]
};
assert.equal(restoreReviewViewport(rerendered, captureReviewViewport(container)), 155);
assert.equal(rerendered.scrollTop, 155);

// offsetTop may be relative to the workbench, not the scrolling list.
function positionedList(parentTop, scrollTop, border = 2) {
  const list = { scrollTop, scrollHeight:720, clientHeight:180, clientTop:border,
    getBoundingClientRect:()=>({top:parentTop}) };
  list.children = [0,110,220].map((top,i)=>({ ...card(String(i),parentTop+top,100),
    getBoundingClientRect:()=>({top:parentTop+border+top-list.scrollTop}) }));
  return list;
}
const embedded = positionedList(1800,135);
const embeddedState = captureReviewViewport(embedded, {activeRowId:'1'});
assert.deepEqual(embeddedState,{scrollTop:135,anchorRowId:'1',anchorOffset:-25,activeRowId:'1'});
const shifted = positionedList(2300,0);
assert.equal(restoreReviewViewport(shifted,embeddedState),135);
assert.equal(captureReviewViewport(shifted).anchorOffset,-25);

const renderer = fs.readFileSync(new URL('../renderer/views/exports.js',import.meta.url),'utf8');
const restoration = renderer.slice(renderer.indexOf('  if (contactReviewList) {'),renderer.indexOf('  // Keep column settings beside'));
assert.ok(restoration.includes('restoreReviewViewport'));
for (const interrupted of [false,true]) {
  const frames=[], list={...rerendered,isConnected:true,scrollTop:0};
  vm.runInNewContext(restoration,{contactReviewList:list,savedContactReviewViewport:captureReviewViewport(container),
    restoreReviewViewport,requestAnimationFrame:fn=>frames.push(fn)});
  frames.shift()(); assert.equal(list.scrollTop,155);
  if(interrupted)list.scrollTop=300;
  frames.shift()(); assert.equal(list.scrollTop,interrupted?300:155,'Second frame must not overwrite newer manual scrolling');
}

const changedList = {
  scrollTop: 0,
  scrollHeight: 260,
  clientHeight: 180,
  children: [card('x', 0, 100), card('y', 110, 100)]
};
assert.equal(restoreReviewViewport(changedList, { scrollTop: 500, anchorRowId: 'missing' }), 80);

const registry = createReviewViewportStateRegistry({ limit: 2 });
registry.capture(runAAll, container, { activeRowId: 'b' });
const runASelected = buildReviewViewportKey({ runDir: 'C:/runs/a', filters: { status: 'selected' } });
registry.capture(runASelected, { ...container, scrollTop: 20 }, { activeRowId: 'a' });
assert.equal(registry.get(runAAll).scrollTop, 135);
assert.equal(registry.get(runASelected).scrollTop, 20);
assert.equal(registry.get(runASelected).activeRowId, 'a');

const runB = buildReviewViewportKey({ runDir: 'C:/runs/b' });
registry.setActiveRow(runB, 'z');
assert.equal(registry.get(runAAll), null);
assert.equal(registry.get(runB).activeRowId, 'z');

console.log('review_view_state.test.mjs passed');
