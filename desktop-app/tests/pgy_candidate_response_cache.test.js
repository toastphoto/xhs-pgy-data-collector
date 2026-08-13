const assert = require('assert');
const {
  assessPgyPageAdvance,
  candidatePageFingerprint,
  extractPageNumberFromPayload,
  extractPageNumberFromUrl,
  normalizePgyRequestScope,
  PgyCandidateResponseCache,
  extractPgyCandidateSources,
  normalizePgyCandidateRecord,
  resolvePgyStartPage
} = require('../lib/pgy_candidate_response_cache');

const creator = (id, name) => ({
  userId: id,
  name,
  fansNum: 310000,
  clickMidNum: 8903,
  mEngagementNum: 239
});

assert.strictEqual(normalizePgyCandidateRecord({ id: 'setting-1', name: '筛选条件' }), null);
assert.strictEqual(
  normalizePgyCandidateRecord(creator('creator0001', '达人A')).pgy_url,
  'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/creator0001'
);
assert.deepStrictEqual(
  normalizePgyCandidateRecord({
    author_id: 'creator0099',
    bloggerName: '达人R',
    fans_count: 88000,
    read_count: 1200,
    engagement_count: 98
  }),
  {
    pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/creator0099',
    creator_name: '达人R',
    note: '粉丝 88000 / 阅读中位数 1200 / 互动中位数 98',
    status: 'candidate',
    priority: '',
    excludeReason: ''
  }
);

const payload = {
  success: true,
  data: {
    total: 5000,
    list: [creator('creator0001', '达人A'), creator('creator0002', '达人B')]
  }
};
const sources = extractPgyCandidateSources(payload);
assert.strictEqual(sources[0].rows.length, 2);
assert.deepStrictEqual(sources[0].rows.map((row) => row.creator_name), ['达人A', '达人B']);
const nestedPagerNoise = {
  data: {
    list: [
      { ...creator('creator0091', '达人N'), currentPage: 91 }
    ]
  }
};
assert.strictEqual(extractPgyCandidateSources(nestedPagerNoise)[0].pageNumber, null);
const nearbyPager = {
  data: {
    pagination: { currentPage: 1, pageSize: 20 },
    list: [{ ...creator('creator0092', '达人P'), currentPage: 92 }]
  }
};
assert.strictEqual(extractPgyCandidateSources(nearbyPager)[0].pageNumber, 1);
assert.strictEqual(extractPageNumberFromUrl('https://example.test/list?pageNum=2&pageSize=20'), 2);
assert.strictEqual(extractPageNumberFromPayload({ data: { currentPage: 3, list: [] } }), 3);
assert.deepStrictEqual(
  resolvePgyStartPage({
    pagination: { currentPageKnown: true, currentPage: 1, firstPageKnown: true, atFirstPage: true },
    responsePageNumber: 8
  }),
  {
    startPage: 1,
    visiblePageNumber: 1,
    responsePageNumber: 8,
    conflict: true,
    evidence: 'visible-pagination'
  }
);
assert.strictEqual(
  resolvePgyStartPage({
    pagination: { currentPageKnown: false, firstPageKnown: true, atFirstPage: true },
    responsePageNumber: 6
  }).startPage,
  1
);
assert.strictEqual(resolvePgyStartPage({ responsePageNumber: 3 }).startPage, 3);
assert.strictEqual(
  normalizePgyRequestScope('https://pgy.xiaohongshu.com/api/creator/list?page=2&token=do-not-store'),
  'https://pgy.xiaohongshu.com/api/creator/list'
);
assert.strictEqual(normalizePgyRequestScope('https://unrelated.example/api/creator/list?page=2'), null);

const cache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
const staleCapture = cache.capture(payload, {
  capturedAt: 1000,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1'
});
assert.strictEqual(staleCapture.captured, 2);
assert.strictEqual(cache.latest(1, { now: 2000 }), null);

const passiveCache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
const passiveContext = 'web-contents:7:navigation:3';
const passiveCapture = passiveCache.capture(payload, {
  capturedAt: 1500,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1&token=do-not-store',
  sourceContext: passiveContext
});
assert.strictEqual(passiveCapture.captured, 2);
assert.strictEqual(passiveCache.capture(nestedPagerNoise, {
  capturedAt: 1600,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1',
  sourceContext: passiveContext
}).captured, 1);
const seededWindow = passiveCache.beginCommandWindow({
  startedAt: 2000,
  maxAgeMs: 5000,
  sourceContext: passiveContext
});
assert.strictEqual(passiveCache.latest(2, { now: 2000, commandWindow: seededWindow }), null);
const seeded = passiveCache.seedCommandWindow(seededWindow, {
  now: 2000,
  sourceContext: passiveContext,
  expectedPage: 1
});
assert.strictEqual(seeded.seeded, 2);
assert.deepStrictEqual(
  passiveCache.latest(2, { now: 2100, commandWindow: seededWindow }).items.map((row) => row.creator_name),
  ['达人A', '达人B']
);
const promoted = passiveCache.promoteVerifiedSnapshot(seededWindow, {
  now: 2150,
  capturedAt: 2150,
  sourceContext: passiveContext,
  pageNumber: 1,
  sequence: seeded.sequence,
  fingerprint: seeded.fingerprint
});
assert.strictEqual(promoted.promoted, 2);
assert.strictEqual(passiveCache.endCommandWindow(seededWindow), true);
const repeatedWindow = passiveCache.beginCommandWindow({
  startedAt: 2200,
  maxAgeMs: 5000,
  sourceContext: passiveContext
});
const repeatedSeed = passiveCache.seedCommandWindow(repeatedWindow, {
  now: 2200,
  sourceContext: passiveContext,
  expectedPage: 1
});
assert.strictEqual(repeatedSeed.seeded, 2);
assert.deepStrictEqual(
  passiveCache.latest(2, { now: 2250, commandWindow: repeatedWindow }).items.map((row) => row.creator_name),
  ['达人A', '达人B']
);
assert.strictEqual(passiveCache.promoteVerifiedSnapshot(repeatedWindow, {
  capturedAt: 2260,
  sourceContext: passiveContext,
  pageNumber: 2,
  sequence: repeatedSeed.sequence,
  fingerprint: repeatedSeed.fingerprint
}).code, 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISMATCH');
const pageUnknownCache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
const pageUnknownWindow = pageUnknownCache.beginCommandWindow({
  startedAt: 3000,
  sourceContext: passiveContext
});
const pageUnknownCapture = pageUnknownCache.capture(payload, {
  capturedAt: 3100,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list',
  commandWindow: pageUnknownWindow,
  sourceContext: passiveContext
});
assert.strictEqual(pageUnknownCapture.pageNumber, null);
assert.strictEqual(pageUnknownCache.promoteVerifiedSnapshot(pageUnknownWindow, {
  capturedAt: 3200,
  sourceContext: passiveContext,
  pageNumber: 1,
  sequence: pageUnknownCapture.sequence,
  fingerprint: pageUnknownCapture.fingerprint
}).promoted, 2);
pageUnknownCache.endCommandWindow(pageUnknownWindow);
const navigatedContext = 'web-contents:7:navigation:4';
const adoptedWindow = pageUnknownCache.beginCommandWindow({
  startedAt: 3300,
  sourceContext: navigatedContext
});
const recentAcrossNavigation = pageUnknownCache.recentCandidates(10, {
  now: 3300,
  sourceContext: navigatedContext
});
assert.ok(recentAcrossNavigation.some((snapshot) => snapshot.fingerprint === pageUnknownCapture.fingerprint));
const adopted = pageUnknownCache.adoptVerifiedSnapshot(adoptedWindow, {
  capturedAt: 3350,
  sourceContext: navigatedContext,
  pageNumber: 1,
  sequence: recentAcrossNavigation[0].sequence,
  fingerprint: recentAcrossNavigation[0].fingerprint
});
assert.strictEqual(adopted.adopted, 2);
assert.strictEqual(pageUnknownCache.latest(10, {
  now: 3400,
  commandWindow: adoptedWindow,
  expectedPage: 1
}).items.length, 2);
const otherWebContentsWindow = pageUnknownCache.beginCommandWindow({
  startedAt: 3500,
  sourceContext: 'web-contents:8:navigation:4'
});
assert.deepStrictEqual(pageUnknownCache.recentCandidates(10, {
  now: 3500,
  sourceContext: 'web-contents:8:navigation:4'
}), []);
assert.strictEqual(pageUnknownCache.adoptVerifiedSnapshot(otherWebContentsWindow, {
  capturedAt: 3550,
  sourceContext: 'web-contents:8:navigation:4',
  pageNumber: 1,
  sequence: recentAcrossNavigation[0].sequence,
  fingerprint: recentAcrossNavigation[0].fingerprint
}).code, 'PGY_RESPONSE_VERIFIED_SNAPSHOT_MISSING');
assert.ok(!JSON.stringify(passiveCache.entries).includes('do-not-store'));
const alternativeCache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
const alternativePayload = {
  data: {
    recommendations: [
      creator('creator0101', '推荐A'),
      creator('creator0102', '推荐B'),
      creator('creator0103', '推荐C')
    ],
    list: [creator('creator0201', '页面甲'), creator('creator0202', '页面乙')]
  }
};
alternativeCache.capture(alternativePayload, {
  capturedAt: 1800,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1',
  sourceContext: passiveContext
});
const alternativeWindow = alternativeCache.beginCommandWindow({
  startedAt: 2000,
  sourceContext: passiveContext
});
assert.ok(alternativeCache.seedCommandWindow(alternativeWindow, {
  now: 2000,
  sourceContext: passiveContext,
  expectedPage: 1
}).seeded > 0);
const alternativeSnapshots = alternativeCache.latestCandidates(10, {
  now: 2100,
  commandWindow: alternativeWindow,
  expectedPage: 1
});
assert.ok(alternativeSnapshots.length >= 2);
assert.ok(alternativeSnapshots.some((snapshot) => (
  snapshot.items.map((row) => row.creator_name).join(',') === '页面甲,页面乙'
)));
const wrongContextWindow = passiveCache.beginCommandWindow({
  startedAt: 2200,
  sourceContext: 'web-contents:7:navigation:4'
});
assert.strictEqual(
  passiveCache.seedCommandWindow(wrongContextWindow, {
    now: 2200,
    sourceContext: 'web-contents:7:navigation:4'
  }).code,
  'PGY_RESPONSE_PASSIVE_SNAPSHOT_MISSING'
);
const wrongPageWindow = passiveCache.beginCommandWindow({
  startedAt: 2300,
  sourceContext: passiveContext
});
assert.strictEqual(
  passiveCache.seedCommandWindow(wrongPageWindow, {
    now: 2300,
    sourceContext: passiveContext,
    expectedPage: 2
  }).code,
  'PGY_RESPONSE_PASSIVE_SNAPSHOT_MISSING'
);

const commandWindow = cache.beginCommandWindow({ startedAt: 2000, maxAgeMs: 5000 });
assert.strictEqual(cache.latest(1, { now: 2000, commandWindow }), null);
assert.strictEqual(cache.capture(payload, {
  capturedAt: 1999,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1',
  commandWindow
}).code, 'PGY_RESPONSE_OUTSIDE_COMMAND_WINDOW');

const scopedCapture = cache.capture(payload, {
  capturedAt: 2100,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=1&token=do-not-store',
  commandWindow
});
assert.strictEqual(scopedCapture.captured, 2);
assert.deepStrictEqual(
  cache.latest(1, { now: 2200, commandWindow, expectedPage: 1 }).items.map((row) => row.creator_name),
  ['达人A']
);
const sameTimestampCapture = cache.capture({
  data: {
    currentPage: 2,
    list: [creator('creator0003', '达人C')]
  }
}, {
  capturedAt: 2100,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=2',
  commandWindow
});
assert.strictEqual(
  cache.latest(1, {
    now: 2200,
    commandWindow,
    expectedPage: 2,
    afterSequence: scopedCapture.sequence
  }).sequence,
  sameTimestampCapture.sequence
);
assert.strictEqual(cache.latest(1, {
  now: 2200,
  commandWindow,
  expectedPage: 1,
  afterSequence: scopedCapture.sequence
}), null);
assert.strictEqual(cache.latest(1, { now: 7001, commandWindow }), null);
assert.ok(!JSON.stringify(cache.entries).includes('do-not-store'));
assert.ok(!JSON.stringify(cache.entries).includes('token='));

assert.strictEqual(cache.capture(payload, {
  capturedAt: 2200,
  requestUrl: 'https://pgy.xiaohongshu.com/api/other/list?page=1',
  commandWindow
}).code, 'PGY_RESPONSE_REQUEST_SCOPE_MISMATCH');
assert.strictEqual(cache.capture(payload, {
  capturedAt: 2200,
  requestUrl: 'https://unrelated.example/api/creator/list?page=1',
  commandWindow
}).code, 'PGY_RESPONSE_REQUEST_SCOPE_INVALID');
assert.strictEqual(cache.capture({
  data: {
    currentPage: 3,
    list: [creator('creator0005', '达人E')]
  }
}, {
  capturedAt: 2200,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=2',
  commandWindow
}).code, 'PGY_RESPONSE_PAGE_CONFLICT');

const pageOneRows = sources[0].rows;
const pageTwoPayload = {
  success: true,
  data: {
    total: 5000,
    list: [creator('creator0003', '达人C'), creator('creator0004', '达人D')]
  }
};
const pageTwoRows = extractPgyCandidateSources(pageTwoPayload)[0].rows;
const pageCache = new PgyCandidateResponseCache({ maxAgeMs: 5000 });
const pageWindow = pageCache.beginCommandWindow({ startedAt: 3000 });
const capture = pageCache.capture(pageTwoPayload, {
  capturedAt: 3000,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=2&pageSize=20',
  commandWindow: pageWindow
});
assert.strictEqual(capture.pageNumber, 2);
assert.strictEqual(pageCache.latest(10, {
  now: 3500,
  commandWindow: pageWindow,
  expectedPage: 2
}).pageNumber, 2);

assert.deepStrictEqual(
  assessPgyPageAdvance({
    expectedPage: 2,
    domPageKnown: false,
    previousFingerprint: candidatePageFingerprint(pageOneRows),
    nextFingerprint: candidatePageFingerprint(pageTwoRows),
    previousUrls: pageOneRows.map((row) => row.pgy_url),
    nextUrls: pageTwoRows.map((row) => row.pgy_url)
  }),
  { ok: true, evidence: 'response-content', uniqueCount: 2, overlapCount: 0 }
);
assert.strictEqual(
  assessPgyPageAdvance({
    expectedPage: 2,
    responsePageNumber: 2,
    nextFingerprint: candidatePageFingerprint(pageTwoRows),
    previousUrls: pageOneRows.map((row) => row.pgy_url),
    nextUrls: pageTwoRows.map((row) => row.pgy_url)
  }).ok,
  false
);
assert.strictEqual(
  assessPgyPageAdvance({
    expectedPage: 2,
    responsePageNumber: 1,
    previousFingerprint: candidatePageFingerprint(pageOneRows),
    nextFingerprint: candidatePageFingerprint(pageTwoRows),
    previousUrls: pageOneRows.map((row) => row.pgy_url),
    nextUrls: pageTwoRows.map((row) => row.pgy_url)
  }).code,
  'PGY_PAGINATION_PAGE_MISMATCH'
);
assert.strictEqual(
  assessPgyPageAdvance({
    expectedPage: 2,
    responsePageNumber: 2,
    previousFingerprint: candidatePageFingerprint(pageOneRows),
    nextFingerprint: candidatePageFingerprint(pageOneRows),
    previousUrls: pageOneRows.map((row) => row.pgy_url),
    nextUrls: pageOneRows.map((row) => row.pgy_url)
  }).code,
  'PGY_PAGINATION_PAGE_OVERLAP'
);
const overlappingPageRows = extractPgyCandidateSources({
  data: {
    list: [creator('creator0002', '达人B'), creator('creator0003', '达人C')]
  }
})[0].rows;
const overlapResult = assessPgyPageAdvance({
  expectedPage: 2,
  responsePageNumber: 2,
  previousFingerprint: candidatePageFingerprint(pageOneRows),
  nextFingerprint: candidatePageFingerprint(overlappingPageRows),
  previousUrls: pageOneRows.map((row) => row.pgy_url),
  nextUrls: overlappingPageRows.map((row) => row.pgy_url)
});
assert.strictEqual(overlapResult.ok, false);
assert.strictEqual(overlapResult.code, 'PGY_PAGINATION_PAGE_OVERLAP');
assert.strictEqual(overlapResult.overlapCount, 1);
assert.strictEqual(overlapResult.uniqueCount, 1);
assert.strictEqual(
  assessPgyPageAdvance({
    expectedPage: 2,
    responsePageNumber: 2,
    previousFingerprint: candidatePageFingerprint(pageOneRows),
    nextFingerprint: 'duplicate-url-fingerprint',
    previousUrls: pageOneRows.map((row) => row.pgy_url),
    nextUrls: [pageTwoRows[0].pgy_url, pageTwoRows[0].pgy_url]
  }).evidence,
  'duplicate-next-url'
);

const closedWindow = pageCache.beginCommandWindow({ startedAt: 4000 });
assert.strictEqual(pageCache.endCommandWindow(closedWindow), true);
assert.strictEqual(pageCache.capture(pageTwoPayload, {
  capturedAt: 4100,
  requestUrl: 'https://pgy.xiaohongshu.com/api/creator/list?page=2',
  commandWindow: closedWindow
}).code, 'PGY_RESPONSE_COMMAND_WINDOW_INVALID');

console.log('pgy_candidate_response_cache.test.js OK');
