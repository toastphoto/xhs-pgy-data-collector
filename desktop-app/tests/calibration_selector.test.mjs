import assert from 'node:assert/strict';
import {
  assessCandidateResultsReturn,
  candidateCalibrationStatusMeta,
  chooseCalibrationSelector,
  isCandidateCalibrationPassed,
  normalizeCandidateValidationRecord,
  resolveCandidatePaginationFeedback,
  resolveCandidateCalibrationStepStatus,
  resolveCandidateCalibrationSummary
} from '../renderer/state/calibration_selector.mjs';

const pickedName = {
  selector: 'div.kol-info_detail:nth-of-type(2) > span.d-text:nth-of-type(1)',
  count: 1,
  fieldSelector: '.kol-name',
  fieldCount: 20,
  repeatSelector: 'div.kol-info_detail',
  repeatCount: 20
};

assert.equal(
  chooseCalibrationSelector({ key: 'candidate_name', repeatable: true }, pickedName),
  '.kol-name'
);
assert.equal(
  chooseCalibrationSelector({ key: 'candidate_row', repeatable: true }, pickedName),
  'div.kol-info_detail'
);
assert.equal(
  chooseCalibrationSelector({ key: 'note_card', repeatable: true }, pickedName),
  'div.kol-info_detail'
);
assert.equal(isCandidateCalibrationPassed({ ok: true, passed: false, rowCount: 20, nameCount: 20 }), false);
assert.equal(isCandidateCalibrationPassed({ ok: true, passed: true }), true);

const previousValidation = {
  version: 1,
  verifiedAt: '2026-08-21T02:00:00.000Z',
  firstPageCount: 20,
  secondPageCount: 20,
  restoredToPage: 1
};
assert.deepEqual(normalizeCandidateValidationRecord(previousValidation), previousValidation);
assert.equal(normalizeCandidateValidationRecord({ ...previousValidation, restoredToPage: 2 }), null);
assert.deepEqual(assessCandidateResultsReturn({ ok: true, restoredFromHistory: true, url: 'https://pgy.xiaohongshu.com/solar/pre-trade/note/kol' }), {
  ok: true,
  url: 'https://pgy.xiaohongshu.com/solar/pre-trade/note/kol'
});
assert.equal(assessCandidateResultsReturn({ ok: true, restoredFromHistory: false, warning: 'fallback' }).ok, false);
assert.equal(assessCandidateResultsReturn({ ok: false, error: 'busy' }).error, 'busy');

assert.deepEqual(candidateCalibrationStatusMeta('unknown'), {
  key: 'pending',
  label: '未校准',
  tone: 'pending'
});
assert.equal(resolveCandidateCalibrationSummary().label, '未加载');
assert.equal(resolveCandidateCalibrationSummary({ hasDraft: true }).label, '未校准');
assert.deepEqual(
  resolveCandidateCalibrationSummary({ hasDraft: true, savedCount: 2 }),
  { key: 'running', label: '校准中 2/3', tone: 'running' }
);
assert.equal(resolveCandidateCalibrationSummary({ hasDraft: true, savedCount: 3 }).label, '待验证');
assert.equal(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  calibrationResult: { ok: true, passed: true }
}).label, '本页成功，待跨页');
assert.deepEqual(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  calibrationResult: { ok: true, passed: true },
  paginationResult: { ok: true, passed: true }
}), {
  key: 'success',
  label: '校准成功',
  tone: 'success',
  detail: '本页、跨页与达人数据读取均已通过'
});
assert.equal(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  calibrationResult: { ok: true, passed: false, warnings: ['达人昵称未能一一对应'] }
}).label, '校准失败');
assert.equal(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  paginationResult: { status: 'running' }
}).label, '跨页验证中');
assert.deepEqual(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  calibrationResult: { ok: true, passed: true },
  paginationResult: { ok: false, structurePassed: true, error: '未取得达人详情 ID' }
}), {
  key: 'data-not-ready',
  label: '数据未就绪',
  tone: 'failed',
  detail: '本页结构和跨页顺序已通过，无需重新校准位置'
});
assert.deepEqual(resolveCandidateCalibrationSummary({
  hasDraft: true,
  savedCount: 3,
  previousValidation
}), {
  key: 'previous-success',
  label: '上次成功，需复验',
  tone: 'saved',
  detail: '已保留上次跨页证据；当前页面和筛选条件仍需重新验证'
});

assert.equal(resolveCandidateCalibrationStepStatus({ stepKey: 'candidate_row' }).label, '未校准');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_row',
  isSaved: true
}).label, '已完成');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_row',
  runtimeStatus: 'running'
}).label, '校准中');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_name',
  isSaved: true,
  calibrationResult: { ok: true, passed: false, warnings: ['达人昵称未能一一对应'] }
}).label, '校准失败');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_pagination',
  isSaved: true,
  calibrationResult: { ok: true, passed: false, warnings: ['达人昵称未能一一对应'] }
}).label, '已完成');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_pagination',
  paginationResult: { ok: true, passed: true }
}).label, '校准成功');
assert.equal(resolveCandidateCalibrationStepStatus({
  stepKey: 'candidate_pagination',
  paginationResult: { status: 'running' }
}).label, '跨页验证中');
for (const stepKey of ['candidate_row', 'candidate_name', 'candidate_pagination']) {
  assert.equal(resolveCandidateCalibrationStepStatus({
    stepKey,
    isSaved: true,
    calibrationResult: { ok: true, passed: true },
    paginationResult: { ok: false, structurePassed: true, error: '未取得达人详情 ID' }
  }).label, '结构成功');
}

assert.deepEqual(resolveCandidatePaginationFeedback(), {
  key: 'pending',
  tone: 'pending',
  title: '等待定位分页栏',
  detail: '开始后，右侧结果页会短暂滚到底部再恢复，让蒲公英加载分页栏。',
  next: '定位时不会翻页；定位成功后还需要单独验证跨页。'
});
assert.equal(resolveCandidatePaginationFeedback({ isSaved: true }).title, '已有分页位置，等待验证');
assert.deepEqual(resolveCandidatePaginationFeedback({
  isSaved: true,
  previousValidation
}), {
  key: 'previous-verified',
  tone: 'saved',
  title: '上次跨页成功，本次需复验',
  detail: '上次第 1 页 20 位，第 2 页 20 位，并已返回第 1 页。',
  next: '页面和筛选条件可能变化；请先验证本页，再验证跨页。'
});
assert.equal(resolveCandidatePaginationFeedback({
  paginationResult: { status: 'running' }
}).title, '正在验证跨页');
assert.equal(resolveCandidatePaginationFeedback({
  discoveryResult: { status: 'running' }
}).next, '当前只读取分页结构，不会翻页，也不会采集达人。');
assert.deepEqual(resolveCandidatePaginationFeedback({
  discoveryResult: {
    status: 'success',
    currentPage: 1,
    pageNumbers: [1, 2, 3, 4, 5, 250],
    controlCount: 8
  }
}), {
  key: 'located',
  tone: 'saved',
  title: '分页栏定位成功，位置已保存',
  detail: '当前第 1 页；识别页码：1、2、3、4、5、250；分页控件 8 个。',
  next: '这一步没有翻页。请点击下方“验证跨页”，确认能进入第 2 页并返回第 1 页。'
});
assert.equal(resolveCandidatePaginationFeedback({
  discoveryResult: { status: 'failed', error: '没有分页栏' }
}).detail, '没有分页栏');
assert.deepEqual(resolveCandidatePaginationFeedback({
  paginationResult: { ok: true, passed: true, firstPageCount: 20, secondPageCount: 20 }
}), {
  key: 'verified',
  tone: 'success',
  title: '跨页与数据读取验证成功',
  detail: '第 1 页 20 位，第 2 页 20 位，已返回第 1 页并取得达人详情 ID。',
  next: '页码、达人顺序和数据读取通道均已确认，可以按排名采集。'
});
assert.equal(resolveCandidatePaginationFeedback({
  paginationResult: { ok: false, error: '无法返回第 1 页' }
}).title, '跨页验证失败');
assert.deepEqual(resolveCandidatePaginationFeedback({
  paginationResult: {
    ok: false,
    structurePassed: true,
    error: '未取得达人详情 ID'
  }
}), {
  key: 'data-not-ready',
  tone: 'failed',
  title: '页面结构通过，达人数据未就绪',
  detail: '未取得达人详情 ID',
  next: '无需重复标定位置；请按失败提示处理数据监听或账号页面结构问题。'
});

console.log('calibration_selector.test.mjs OK');
