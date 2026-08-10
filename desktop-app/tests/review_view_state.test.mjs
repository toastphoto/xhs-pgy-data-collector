import assert from 'node:assert/strict';
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
