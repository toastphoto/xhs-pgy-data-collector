const assert = require('assert');
const {
  MAX_CANDIDATE_COUNT,
  MAX_CANDIDATE_RANK,
  buildCandidatePageIdentityScript,
  buildCandidateSearchLayoutScript,
  buildSearchCandidateExtractionScript,
  buildSearchPaginationScript,
  hasCompleteCandidateSearchCalibration,
  parseCandidateInstruction,
  parseChineseNumber
} = require('../lib/pgy_candidate_command');

assert.strictEqual(parseChineseNumber('二十'), 20);
assert.strictEqual(parseChineseNumber('三十六'), 36);
assert.strictEqual(parseChineseNumber('十'), 10);
assert.strictEqual(parseChineseNumber('一百'), 100);
assert.strictEqual(parseChineseNumber('九十九'), 99);

assert.deepStrictEqual(
  parseCandidateInstruction('将目前页面前30名达人加入候选').requestedCount,
  30
);
assert.deepStrictEqual(
  parseCandidateInstruction('查找当前页面前二十名达人并加入候选').requestedCount,
  20
);
const range42to50 = parseCandidateInstruction('将当前页面第42位达人到第50位达人加入候选');
assert.strictEqual(range42to50.ok, true);
assert.strictEqual(range42to50.mode, 'range');
assert.strictEqual(range42to50.startRank, 42);
assert.strictEqual(range42to50.endRank, 50);
assert.strictEqual(range42to50.requestedCount, 9);
const range50to70 = parseCandidateInstruction('查找当前页面第50至70位达人并加入候选');
assert.strictEqual(range50to70.ok, true);
assert.strictEqual(range50to70.startRank, 50);
assert.strictEqual(range50to70.endRank, 70);
assert.strictEqual(range50to70.requestedCount, 21);
const chineseRange = parseCandidateInstruction('将第四十二位达人到第五十位达人加入候选');
assert.strictEqual(chineseRange.startRank, 42);
assert.strictEqual(chineseRange.endRank, 50);
assert.strictEqual(parseCandidateInstruction('加入候选').code, 'CANDIDATE_COMMAND_COUNT_MISSING');
assert.strictEqual(parseCandidateInstruction('将前51位达人加入候选').code, 'CANDIDATE_COMMAND_LIMIT_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第1位到第51位达人加入候选').code, 'CANDIDATE_COMMAND_LIMIT_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第50位到第101位达人加入候选').code, 'CANDIDATE_COMMAND_RANK_EXCEEDED');
assert.strictEqual(parseCandidateInstruction('将第70位到第50位达人加入候选').code, 'CANDIDATE_COMMAND_RANGE_INVALID');
assert.strictEqual(parseCandidateInstruction('帮我写一封邮件').code, 'CANDIDATE_COMMAND_UNSUPPORTED');
assert.strictEqual(hasCompleteCandidateSearchCalibration({
  rowSelector: '.candidate-row',
  nameSelector: '.candidate-name',
  paginationSelector: '.pagination'
}), true);
assert.strictEqual(hasCompleteCandidateSearchCalibration({
  rowSelector: '.candidate-row',
  nameSelector: '.candidate-row',
  paginationSelector: '.pagination'
}), false);

const script = buildSearchCandidateExtractionScript(30);
assert.ok(script.includes('const requestedCount = 30'));
assert.ok(script.includes('__vueParentComponent'));
assert.ok(script.includes('__reactFiber'));
assert.ok(script.includes('__reactProps'));
assert.ok(script.includes('/solar/pre-trade/blogger-detail/'));
assert.doesNotThrow(() => new Function(script));
const nextPageScript = buildSearchPaginationScript('next');
const gotoPageScript = buildSearchPaginationScript('goto', 2);
assert.doesNotThrow(() => new Function(nextPageScript));
assert.doesNotThrow(() => new Function(gotoPageScript));
assert.ok(nextPageScript.includes('currentPageKnown'));
assert.ok(gotoPageScript.includes('const targetPage = 2'));
assert.ok(gotoPageScript.includes("method: 'jump-input'"));
assert.ok(gotoPageScript.includes("new KeyboardEvent('keydown'"));
assert.doesNotThrow(() => new Function(buildCandidateSearchLayoutScript({
  rowSelector: '.candidate-row',
  nameSelector: '.candidate-name'
})));

function paginatorElement({ text = '', className = '', disabled = false, left = 0, attrs = {} } = {}) {
  return {
    nodeType: 1,
    innerText: text,
    textContent: text,
    className,
    disabled,
    parentElement: null,
    getAttribute: (name) => attrs[name] || null,
    getBoundingClientRect: () => ({ left, right: left + 28, top: 0, bottom: 28, width: 28, height: 28 })
  };
}

const previous = paginatorElement({ className: 'pagination-prev disabled', disabled: true, left: 0 });
const pageOne = paginatorElement({ text: '1', className: 'pagination-item active', disabled: true, left: 32 });
const pageTwo = paginatorElement({ text: '2', className: 'pagination-item', left: 64 });
const next = paginatorElement({ className: 'pagination-next', left: 96 });
const paginatorRoot = paginatorElement({ className: 'pagination', left: 0 });
paginatorRoot.getBoundingClientRect = () => ({ left: 0, right: 160, top: 0, bottom: 40, width: 160, height: 40 });
paginatorRoot.querySelectorAll = () => [previous, pageOne, pageTwo, next];
for (const element of [previous, pageOne, pageTwo, next]) element.parentElement = paginatorRoot;
const fakeDocument = {
  querySelectorAll: (selector) => selector === 'input' ? [] : [],
  querySelector: () => paginatorRoot
};
const executePagination = (source) => Function(
  'document',
  'getComputedStyle',
  'Event',
  'KeyboardEvent',
  `return (${source});`
)(
  fakeDocument,
  () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
  class {},
  class {}
);
const inspectedFirstPage = executePagination(buildSearchPaginationScript('inspect'));
assert.strictEqual(inspectedFirstPage.currentPage, 1);
assert.strictEqual(inspectedFirstPage.atFirstPage, true);
assert.strictEqual(inspectedFirstPage.previousDisabled, true);
const gotoVisibleFirstPage = executePagination(buildSearchPaginationScript('goto', 1));
assert.strictEqual(gotoVisibleFirstPage.alreadyAtTarget, true);
assert.strictEqual(gotoVisibleFirstPage.clicked, false);

const pgyPageOne = paginatorElement({
  text: '1 1',
  className: 'd-pagination-page --color-bg-primary-light',
  left: 32
});
const pgyPageTwo = paginatorElement({ text: '2 2', className: 'd-pagination-page', left: 64 });
const pgyNext = paginatorElement({ className: 'd-pagination-page', left: 96 });
const pgyPaginatorRoot = paginatorElement({ className: 'd-pagination hide-pagination-page-size' });
pgyPaginatorRoot.innerText = '1 1 2 2 跳至 页';
pgyPaginatorRoot.textContent = pgyPaginatorRoot.innerText;
pgyPaginatorRoot.getBoundingClientRect = () => ({ left: 0, right: 180, top: 4000, bottom: 4032, width: 180, height: 32 });
pgyPaginatorRoot.querySelectorAll = () => [pgyPageOne, pgyPageTwo, pgyNext];
for (const element of [pgyPageOne, pgyPageTwo, pgyNext]) element.parentElement = pgyPaginatorRoot;
const pgyControlsWrapper = paginatorElement({ className: 'd-space d-space-horizontal', left: 24 });
pgyControlsWrapper.innerText = pgyPaginatorRoot.innerText;
pgyControlsWrapper.textContent = pgyControlsWrapper.innerText;
pgyControlsWrapper.querySelectorAll = () => [pgyPageOne, pgyPageTwo, pgyNext];
pgyControlsWrapper.parentElement = pgyPaginatorRoot;
const pgyGotoWrapper = paginatorElement({ className: 'd-pagination-goto', left: 132 });
pgyGotoWrapper.querySelectorAll = () => [];
pgyGotoWrapper.parentElement = pgyControlsWrapper;
const pgyJumpInput = paginatorElement({ left: 140 });
pgyJumpInput.parentElement = pgyGotoWrapper;
pgyJumpInput.closest = () => pgyGotoWrapper;
const unrelatedPageRoot = paginatorElement({ className: 'page-shell' });
unrelatedPageRoot.innerText = '搜索条件 1 1 2 2 跳至 页';
unrelatedPageRoot.textContent = unrelatedPageRoot.innerText;
unrelatedPageRoot.getBoundingClientRect = () => ({ left: 0, right: 1200, top: 0, bottom: 900, width: 1200, height: 900 });
unrelatedPageRoot.querySelectorAll = () => [pgyPageOne, pgyPageTwo];
const unrelatedSearchInput = paginatorElement({ left: 20 });
unrelatedSearchInput.parentElement = unrelatedPageRoot;
unrelatedSearchInput.closest = () => null;
const pgyPaginationDocument = {
  querySelectorAll: (selector) => {
    if (selector === 'input') return [unrelatedSearchInput, pgyJumpInput];
    if (selector === '.d-pagination.hide-pagination-page-size') return [pgyPaginatorRoot];
    return [];
  },
  querySelector: () => null
};
const inspectedPgyPagination = Function(
  'document',
  'getComputedStyle',
  'Event',
  'KeyboardEvent',
  `return (${buildSearchPaginationScript('inspect')});`
)(
  pgyPaginationDocument,
  () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
  class {},
  class {}
);
assert.strictEqual(inspectedPgyPagination.currentPage, 1);
assert.deepStrictEqual(inspectedPgyPagination.pageNumbers, [1, 2]);
assert.strictEqual(inspectedPgyPagination.selector, '.d-pagination.hide-pagination-page-size');

const identityItems = [
  { creator_name: '达人甲' },
  { creator_name: '达人乙' },
  { creator_name: '达人丙' },
  { creator_name: '达人丁' }
];
const executeIdentity = (bodyText) => Function(
  'document',
  `return (${buildCandidatePageIdentityScript(identityItems)});`
)({ body: { innerText: bodyText } });
assert.deepStrictEqual(
  executeIdentity('筛选区 达人甲 粉丝 1万 达人乙 粉丝 2万 达人丙 粉丝 3万'),
  {
    ok: true,
    orderedMatch: true,
    required: 3,
    matchedCount: 3,
    candidateNameCount: 4,
    visibleNameCount: 0,
    calibratedRowCount: 0,
    evidence: 'body-text'
  }
);
assert.strictEqual(
  executeIdentity('达人丙 达人乙 达人甲').orderedMatch,
  false
);
const calibratedNameElements = ['达人甲', '达人乙', '达人丙', '达人丁'].map((text) => ({
  nodeType: 1,
  innerText: text,
  textContent: text,
  getBoundingClientRect: () => ({ width: 80, height: 24 })
}));
const calibratedIdentity = Function(
  'document',
  'getComputedStyle',
  `return (${buildCandidatePageIdentityScript(identityItems, { nameSelector: '.candidate-name' })});`
)(
  {
    body: { innerText: '无关文本' },
    querySelectorAll: (selector) => selector === '.candidate-name' ? calibratedNameElements : []
  },
  () => ({ display: 'block', visibility: 'visible', opacity: '1' })
);
assert.strictEqual(calibratedIdentity.orderedMatch, true);
assert.strictEqual(calibratedIdentity.visibleNameCount, 4);
assert.strictEqual(calibratedIdentity.evidence, 'calibrated-name-selector');
const sameFirstThreeWrongFourth = Function(
  'document',
  'getComputedStyle',
  `return (${buildCandidatePageIdentityScript([
    { creator_name: '达人甲' },
    { creator_name: '达人乙' },
    { creator_name: '达人丙' },
    { creator_name: '另一个达人' }
  ], { nameSelector: '.candidate-name' })});`
)(
  {
    body: { innerText: '无关文本' },
    querySelectorAll: (selector) => selector === '.candidate-name' ? calibratedNameElements : []
  },
  () => ({ display: 'block', visibility: 'visible', opacity: '1' })
);
assert.strictEqual(sameFirstThreeWrongFourth.orderedMatch, false);
const substringCollision = Function(
  'document',
  'getComputedStyle',
  `return (${buildCandidatePageIdentityScript([
    { creator_name: '小王' },
    { creator_name: '达人乙' }
  ], { nameSelector: '.candidate-name' })});`
)(
  {
    body: { innerText: '无关文本' },
    querySelectorAll: (selector) => selector === '.candidate-name'
      ? calibratedNameElements.slice(0, 2).map((element, index) => ({
          ...element,
          innerText: index === 0 ? '小王妈妈' : '达人乙',
          textContent: index === 0 ? '小王妈妈' : '达人乙'
        }))
      : []
  },
  () => ({ display: 'block', visibility: 'visible', opacity: '1' })
);
assert.strictEqual(substringCollision.orderedMatch, false);
const calibratedRows = calibratedNameElements.map((nameElement) => ({
  nodeType: 1,
  matches: () => false,
  querySelectorAll: (selector) => selector === '.candidate-name' ? [nameElement] : [],
  getBoundingClientRect: () => ({ width: 400, height: 80 })
}));
const calibratedRowIdentity = Function(
  'document',
  'getComputedStyle',
  `return (${buildCandidatePageIdentityScript(identityItems, {
    rowSelector: '.candidate-row',
    nameSelector: '.candidate-name'
  })});`
)(
  {
    body: { innerText: '无关文本' },
    querySelectorAll: (selector) => selector === '.candidate-row' ? calibratedRows : []
  },
  () => ({ display: 'block', visibility: 'visible', opacity: '1' })
);
assert.strictEqual(calibratedRowIdentity.orderedMatch, true);
assert.strictEqual(calibratedRowIdentity.calibratedRowCount, 4);
assert.strictEqual(calibratedRowIdentity.evidence, 'calibrated-row-name-order');
const missingRowName = Function(
  'document',
  'getComputedStyle',
  `return (${buildCandidatePageIdentityScript(identityItems, {
    rowSelector: '.candidate-row',
    nameSelector: '.candidate-name'
  })});`
)(
  {
    body: { innerText: '达人甲 达人乙 达人丙 达人丁' },
    querySelectorAll: (selector) => selector === '.candidate-row'
      ? calibratedRows.map((row, index) => index === 3 ? { ...row, querySelectorAll: () => [] } : row)
      : []
  },
  () => ({ display: 'block', visibility: 'visible', opacity: '1' })
);
assert.strictEqual(missingRowName.orderedMatch, false);
assert.strictEqual(missingRowName.evidence, 'calibrated-row-name-count-mismatch');
const calibratedPagination = executePagination(buildSearchPaginationScript(
  'inspect',
  1,
  { paginationSelector: '.verified-pagination' }
));
assert.strictEqual(calibratedPagination.calibrated, true);
assert.deepStrictEqual(calibratedPagination.pageNumbers, [1, 2]);
assert.strictEqual(calibratedPagination.selector, '.verified-pagination');
assert.strictEqual(MAX_CANDIDATE_COUNT, 50);
assert.strictEqual(MAX_CANDIDATE_RANK, 100);

console.log('pgy_candidate_command.test.js OK');
