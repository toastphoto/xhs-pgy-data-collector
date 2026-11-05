const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { parseCandidateInstruction } = require('../lib/pgy_candidate_command');
const { assessPgyPageAdvance } = require('../lib/pgy_candidate_response_cache');
const checkpoints = require('../lib/pgy_candidate_checkpoint');

test('explicit current-page wording retains its origin; unqualified ranks remain global', () => {
  for (const text of ['将当前页面前20位达人加入候选', '查找目前页面前二十名达人并加入候选', '从本页取20位达人']) {
    assert.equal(parseCandidateInstruction(text).rankOrigin, 'current_page');
  }
  for (const text of ['将前20位达人加入候选', '将第35位到第50位达人加入候选', '从第一页取20位达人']) {
    assert.equal(parseCandidateInstruction(text).rankOrigin, 'search_start');
  }
});

function fixture(startPage = 5, riskDetected = false, visibleKnown = true, behavior = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf('async function readPgyCandidatesFromResponsePages(');
  const end = source.indexOf('async function validateCandidateCheckpointSession', start);
  assert.ok(start >= 0 && end > start);
  let page = startPage;
  let sequence = 1;
  let clockTick = 0;
  const navigations = [];
  const snapshot = () => ({ pageNumber: page, sequence, fingerprint: 'page-' + page,
    items: Array.from({ length: 20 }, (_, i) => ({
      pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/fixture-' + page + '-' + i,
      creator_name: 'Fixture ' + page + '-' + i
    })) });
  const context = vm.createContext({ MAX_CANDIDATE_COUNT: 50, PGY_CANDIDATE_MAX_PAGES: 10,
    PGY_MIN_TAB_WAIT_MS: 0, Date: behavior.missingResponse ? { now: () => (clockTick += 4000) } : Date,
    Math, pgyCandidateResponseCache: { latest: snapshot },
    browserView: { webContents: { executeJavaScript: async script => {
      if (script.action === 'inspect') return { currentPageKnown: visibleKnown, currentPage: page };
      if (script.action === 'layout') return { rowCount: 20, nameCount: 20 };
      if (script.action === 'goto') { navigations.push(script.page); page = script.page; sequence++; return { clicked: true }; }
      if (script.action === 'next') {
        page++; sequence++; navigations.push(page);
        if (behavior.rejectAfterClick) throw new Error('Execution context destroyed after click');
        return { clicked: true, targetPage: page };
      }
      throw new Error('Unexpected navigation');
    }, id: 42, getURL: () => 'https://pgy.xiaohongshu.com/solar/pre-trade/note/kol' } },
    buildSearchPaginationScript: (action, target) => ({ action, page: target }),
    resolvePgyStartPage: ({ pagination }) => ({ startPage: pagination.currentPage, visiblePageNumber: pagination.currentPageKnown ? pagination.currentPage : 0 }),
    resolveCandidateSnapshotForVisiblePage: async () => behavior.missingResponse && navigations.length ? null : snapshot(),
    pgyDetectRiskOnCurrentPage: async () => {
      if (behavior.safetyThrowsAfterNavigation && navigations.length) throw new Error('Unavailable safety read');
      return { ok: !(behavior.safetyFailsAfterNavigation && navigations.length),
        riskDetected: riskDetected || Boolean(behavior.riskAfterNavigation && navigations.length) };
    },
    findPendingCheckpoint: () => null, findCheckpointBeforeNextPage: () => null,
    hasCompleteCandidateSearchCalibration: () => true, candidateRangeLabel: (a, b) => a + '-' + b,
    buildCandidateSearchLayoutScript: () => ({ action: 'layout' }),
    confirmCandidateSnapshotOnVisiblePage: async () => ({ ok: true }), assessPgyPageAdvance,
    candidatePageAnchorUrls: value => value.items.map(item => item.pgy_url),
    buildCheckpointWindow: checkpoints.buildCheckpointWindow, pgyCandidateCheckpointSequence: 0,
    sendBrowserTabsSnapshot: () => {}, PGY_CANDIDATE_CHECKPOINT_WAIT_MS: 90000,
    sleep: async () => {}, candidateResponseCaptureDiagnostics: () => ({ ready: true }),
    candidatePageFingerprint: items => items.map(i => i.pgy_url).join('|') });
  vm.runInContext(source.slice(start, end), context);
  return { context, navigations };
}

test('current-page intake starts on visible page5 without a page1 navigation', async () => {
  const f = fixture();
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 20, rankOrigin: 'current_page' });
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 20);
  assert.match(result.items[0].pgy_url, /fixture-5-0$/);
  assert.deepEqual(f.navigations, []);
  assert.equal(result.stats.startPage, 5);
  assert.equal(result.stats.rankOrigin, 'current_page');
});

test('current-page origin crosses page5 to6 in order and an unknown visible page cannot navigate', async () => {
  const f = fixture();
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 30, rankOrigin: 'current_page' });
  assert.equal(result.ok, true);
  assert.match(result.items[19].pgy_url, /fixture-5-19$/);
  assert.match(result.items[20].pgy_url, /fixture-6-0$/);
  assert.deepEqual(f.navigations, [6]);
  const unknown = fixture(5, false, false);
  const rejected = await unknown.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 20, rankOrigin: 'current_page' });
  assert.equal(rejected.code, 'PGY_CURRENT_PAGE_UNCONFIRMED');
  assert.deepEqual(unknown.navigations, []);
});

test('relative rank40 checkpoint preserves page origin for a manual continuation', async () => {
  const f = fixture();
  f.context.findPendingCheckpoint = checkpoints.findPendingCheckpoint;
  f.context.findCheckpointBeforeNextPage = checkpoints.findCheckpointBeforeNextPage;
  const paused = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 50, rankOrigin: 'current_page' });
  assert.equal(paused.paused, true);
  assert.deepEqual(f.navigations, [6]);
  assert.equal(f.context.pgyCandidateCheckpointSession.rankOrigin, 'current_page');
  assert.equal(f.context.pgyCandidateCheckpointSession.startPage, 5);
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 50,
    resumeSession: f.context.pgyCandidateCheckpointSession });
  assert.equal(result.ok, true);
  assert.equal(result.stats.rankOrigin, 'current_page');
  assert.match(result.items[40].pgy_url, /fixture-7-0$/);
  assert.deepEqual(f.navigations, [6, 7]);
});

test('a rejected next-page read restores the actual current-page origin', async () => {
  const f = fixture();
  f.context.assessPgyPageAdvance = () => ({ ok: false, code: 'PGY_PAGINATION_PAGE_MISMATCH' });
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 30, rankOrigin: 'current_page' });
  assert.equal(result.code, 'PGY_PAGINATION_PAGE_MISMATCH');
  assert.deepEqual(f.navigations, [6, 5]);
});

test('global intake still returns page1 ranking and a risk stop never navigates', async () => {
  const f = fixture();
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 20, rankOrigin: 'search_start' });
  assert.equal(result.ok, true);
  assert.match(result.items[0].pgy_url, /fixture-1-0$/);
  assert.deepEqual(f.navigations, [1]);
  const risk = fixture(5, true);
  const stopped = await risk.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 20, rankOrigin: 'current_page' });
  assert.equal(stopped.code, 'PGY_RISK_STOP');
  assert.deepEqual(risk.navigations, []);
});

test('risk appearing only after a page click stops reading without recovery navigation', async () => {
  const f = fixture(5, false, true, { riskAfterNavigation: true, missingResponse: true });
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 30, rankOrigin: 'current_page' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PGY_RISK_STOP');
  assert.equal(result.stats.stoppedForRisk, true);
  assert.deepEqual(f.navigations, [6]);
});

test('a click followed by script rejection restores the origin only after a successful safety read', async () => {
  const f = fixture(5, false, true, { rejectAfterClick: true });
  const result = await f.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 30, rankOrigin: 'current_page' });
  assert.equal(result.code, 'PGY_PAGINATION_NEXT_NOT_FOUND');
  assert.deepEqual(f.navigations, [6, 5]);
  for (const behavior of [
    { rejectAfterClick: true, riskAfterNavigation: true },
    { rejectAfterClick: true, safetyFailsAfterNavigation: true },
    { rejectAfterClick: true, safetyThrowsAfterNavigation: true }
  ]) {
    const blocked = fixture(5, false, true, behavior);
    const failure = await blocked.context.readPgyCandidatesFromResponsePages({ startRank: 1, endRank: 30, rankOrigin: 'current_page' });
    assert.equal(failure.code, 'PGY_RISK_STOP');
    assert.deepEqual(blocked.navigations, [6]);
  }
});

test('canceling a checkpoint cannot restore through a newly unsafe or unreadable page', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const begin = source.indexOf('async function cancelCandidateCheckpointSession(');
  const end = source.indexOf('function createMainWindow(', begin);
  assert.ok(begin >= 0 && end > begin);
  for (const safety of [{ ok: true, riskDetected: true }, { ok: false }, null, new Error('fixture unreadable')]) {
    const navigations = [];
    const context = vm.createContext({
      pgyCandidateCheckpointSession: { id: 'fixture', currentPage: 6, startPage: 5,
        webContentsId: 42, url: 'https://fixture.invalid/search' },
      browserView: { webContents: { id: 42, getURL: () => 'https://fixture.invalid/search',
        executeJavaScript: async () => { navigations.push(5); return { clicked: true }; } } },
      pgyDetectRiskOnCurrentPage: async () => { if (safety instanceof Error) throw safety; return safety; },
      buildSearchPaginationScript: () => 'fixture', sleep: async () => {}, PGY_MIN_TAB_WAIT_MS: 0,
      sendBrowserTabsSnapshot: () => {}
    });
    vm.runInContext(source.slice(begin, end), context);
    const result = await context.cancelCandidateCheckpointSession('fixture');
    assert.equal(result.canceled, true);
    assert.equal(context.pgyCandidateCheckpointSession, null);
    assert.equal(result.restoreSkipped, true);
    assert.deepEqual(navigations, []);
  }
});
