const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const templatesSource = fs.readFileSync(path.join(appRoot, 'renderer', 'views', 'templates.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(appRoot, 'renderer', 'app.css'), 'utf8');

assert.match(
  templatesSource,
  /_candidateCalibrationStarted \|\| completedCalibrationSteps\.length/,
  'a loaded calibration must keep the restart action instead of looking like a new setup'
);
assert.match(
  templatesSource,
  /button\.textContent\s*=\s*isSaved\s*\?\s*'重新校准'\s*:\s*'校准这一步'/,
  'all calibration step actions must use one vocabulary'
);
assert.match(
  templatesSource,
  /number\.textContent\s*=\s*String\(index \+ 1\)/,
  'step markers must keep their stable numbers'
);
assert.doesNotMatch(
  templatesSource,
  /number\.textContent\s*=\s*isSaved\s*\?\s*'OK'/,
  'a saved selector must not replace the step number with an ambiguous OK marker'
);
assert.match(templatesSource, /candidate-calibration-status \$\{stepStatus\.tone\}/);
assert.match(templatesSource, /statusBadge\.setAttribute\('role', 'status'\)/);
assert.match(
  templatesSource,
  /busy:\s*Object\.values\(_candidateCalibrationStepStates\)\.includes\('running'\)/,
  'unrelated page loading must not make calibration look active'
);
assert.doesNotMatch(
  templatesSource,
  /savedCount:\s*savedCandidateCount,\s*busy:\s*_busy/,
  'the page-wide busy flag is not calibration status evidence'
);
assert.match(templatesSource, /本页验证失败/);
assert.match(templatesSource, /跨页验证失败/);
assert.match(templatesSource, /页面结构和跨页顺序已通过，但达人数据读取未就绪/);
assert.match(templatesSource, /页面结构通过，但达人数据读取失败/);
assert.match(templatesSource, /跨页与达人数据读取验证通过/);
assert.match(templatesSource, /右侧会短暂滚到底部再恢复，只为触发分页栏加载并读取位置；本步骤不会翻页/);
assert.match(templatesSource, /data-role', 'pagination-feedback'/);
assert.match(templatesSource, /currentPage:\s*pagination\.currentPage/);
assert.match(templatesSource, /pageNumbers,/);
assert.match(templatesSource, /controlCount:\s*Number\(pagination\.controlCount \|\| 0\)/);
assert.match(templatesSource, /_candidatePaginationResult\s*=\s*\{ status: 'running' \}/);
assert.match(templatesSource, /\? '跨页验证中\.\.\.'[\s\S]{0,80}: '验证跨页'/);
assert.doesNotMatch(templatesSource, /verifyPaginationBtn\.textContent[\s\S]{0,160}:\s*'先验证本页'/);
assert.match(templatesSource, /跨页验证：等待本页验证通过/);
assert.match(templatesSource, /verifyPaginationBtn\.title = currentPageValidated/);
assert.match(templatesSource, /dataset\.role = 'cross-page-gate-status'/);
assert.match(templatesSource, /_candidatePaginationResult\.status !== 'running'/);
assert.match(templatesSource, /assessCandidateResultsReturn\(returned\)/);
assert.match(templatesSource, /本页验证未开始/);
assert.match(templatesSource, /跨页验证未开始/);
assert.match(templatesSource, /currentPageValidated = isCandidateCalibrationPassed/);
assert.match(templatesSource, /\|\| !currentPageValidated/);
assert.match(templatesSource, /lastValidation = normalizeCandidateValidationRecord/);
assert.match(templatesSource, /上次成功，需复验/);
assert.ok(
  templatesSource.indexOf("_candidateCalibrationResult?.passed\n        ? '本页验证成功")
    < templatesSource.indexOf(": !_candidateCalibrationStarted"),
  'a successful current-page check must override the not-started session hint'
);
assert.match(cssSource, /\.rule-summary-status\.success/);
assert.match(cssSource, /\.rule-summary-status\.failed/);
assert.match(cssSource, /\.candidate-calibration-status\.running/);
assert.match(cssSource, /\.candidate-calibration-status\.saved/);
assert.match(cssSource, /\.candidate-calibration-status\.success/);
assert.match(cssSource, /\.candidate-calibration-status\.failed/);
assert.match(cssSource, /\.candidate-calibration-copy \.candidate-calibration-status span/);
assert.match(cssSource, /\.candidate-pagination-feedback\.success b/);
assert.match(cssSource, /\.candidate-pagination-feedback\.failed b/);

console.log('calibration_status_ui.test.js OK');
