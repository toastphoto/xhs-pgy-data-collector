export function chooseCalibrationSelector(field = {}, result = {}) {
  const exactSelector = String(result?.selector || '').trim();
  const fieldSelector = String(result?.fieldSelector || '').trim();
  const repeatSelector = String(result?.repeatSelector || '').trim();

  if (field?.key === 'candidate_row') return repeatSelector || fieldSelector || exactSelector || null;
  if (field?.key === 'candidate_name') return fieldSelector || exactSelector || null;
  if (field?.repeatable) return repeatSelector || fieldSelector || exactSelector || null;
  return exactSelector || fieldSelector || null;
}

export function isCandidateCalibrationPassed(result = {}) {
  return result?.passed === true;
}

export function normalizeCandidateValidationRecord(value = {}) {
  if (!value || typeof value !== 'object') return null;
  const firstPageCount = Number(value.firstPageCount || 0);
  const secondPageCount = Number(value.secondPageCount || 0);
  const restoredToPage = Number(value.restoredToPage || 0);
  const verifiedAt = String(value.verifiedAt || '').trim();
  if (
    !Number.isInteger(firstPageCount) || firstPageCount < 2 || firstPageCount > 50
    || !Number.isInteger(secondPageCount) || secondPageCount < 2 || secondPageCount > 50
    || restoredToPage !== 1
    || !verifiedAt || Number.isNaN(Date.parse(verifiedAt))
  ) return null;
  return {
    version: 1,
    verifiedAt,
    firstPageCount,
    secondPageCount,
    restoredToPage: 1
  };
}

export function assessCandidateResultsReturn(result = {}) {
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || 'PGY_RESULT_PAGE_RETURN_FAILED',
      error: result?.error || '没有恢复到蒲公英筛选结果页。'
    };
  }
  if (result?.restoredFromHistory === false || result?.warning) {
    return {
      ok: false,
      code: 'PGY_ORIGINAL_RESULT_PAGE_NOT_RESTORED',
      error: '没有恢复到原筛选结果页；已打开达人广场。请重新确认筛选条件和页码，再开始校准或验证。'
    };
  }
  return { ok: true, url: String(result?.url || '') };
}

const STATUS_META = Object.freeze({
  pending: Object.freeze({ key: 'pending', label: '未校准', tone: 'pending' }),
  running: Object.freeze({ key: 'running', label: '校准中', tone: 'running' }),
  saved: Object.freeze({ key: 'saved', label: '已完成', tone: 'saved' }),
  success: Object.freeze({ key: 'success', label: '校准成功', tone: 'success' }),
  failed: Object.freeze({ key: 'failed', label: '校准失败', tone: 'failed' }),
  unloaded: Object.freeze({ key: 'unloaded', label: '未加载', tone: 'neutral' })
});

export function candidateCalibrationStatusMeta(status = 'pending') {
  return STATUS_META[status] || STATUS_META.pending;
}

function resultFailed(result) {
  if (!result || typeof result !== 'object') return false;
  return result.passed === false || result.ok === false;
}

function resultFailureText(result) {
  return [
    result?.code,
    result?.error,
    ...(Array.isArray(result?.warnings) ? result.warnings : [])
  ].filter(Boolean).join('；');
}

export function resolveCandidateCalibrationSummary({
  hasDraft = false,
  savedCount = 0,
  busy = false,
  calibrationResult = null,
  paginationResult = null,
  previousValidation = null
} = {}) {
  if (!hasDraft) return { ...STATUS_META.unloaded };
  if (paginationResult?.status === 'running') {
    return { ...STATUS_META.running, label: '跨页验证中' };
  }
  if (paginationResult?.passed === true) {
    return { ...STATUS_META.success, detail: '本页、跨页与达人数据读取均已通过' };
  }
  if (paginationResult?.structurePassed === true) {
    return {
      key: 'data-not-ready',
      label: '数据未就绪',
      tone: 'failed',
      detail: '本页结构和跨页顺序已通过，无需重新校准位置'
    };
  }
  if (resultFailed(paginationResult) || resultFailed(calibrationResult)) {
    return { ...STATUS_META.failed, detail: '请查看失败步骤并重新校准' };
  }
  if (busy) return { ...STATUS_META.running };
  if (calibrationResult?.passed === true) {
    return { key: 'page-success', label: '本页成功，待跨页', tone: 'saved' };
  }
  if (savedCount <= 0) return { ...STATUS_META.pending };
  if (savedCount < 3) {
    return { ...STATUS_META.running, label: `校准中 ${savedCount}/3` };
  }
  if (normalizeCandidateValidationRecord(previousValidation)) {
    return {
      key: 'previous-success',
      label: '上次成功，需复验',
      tone: 'saved',
      detail: '已保留上次跨页证据；当前页面和筛选条件仍需重新验证'
    };
  }
  return { key: 'verify-pending', label: '待验证', tone: 'saved' };
}

function failedStepKeys(calibrationResult, paginationResult) {
  const failed = new Set();
  if (resultFailed(calibrationResult)) {
    const text = resultFailureText(calibrationResult);
    if (/达人整行|达人行|行数|一一对应/.test(text)) failed.add('candidate_row');
    if (/昵称|行数|一一对应/.test(text)) failed.add('candidate_name');
    if (/分页|页码|当前页/.test(text)) failed.add('candidate_pagination');
    if (!failed.size) {
      failed.add('candidate_row');
      failed.add('candidate_name');
      failed.add('candidate_pagination');
    }
  }
  if (resultFailed(paginationResult)) {
    if (paginationResult?.structurePassed) return failed;
    const text = resultFailureText(paginationResult);
    failed.add('candidate_pagination');
    if (/达人整行|昵称|一一对应/.test(text)) {
      failed.add('candidate_row');
      failed.add('candidate_name');
    }
  }
  return failed;
}

export function resolveCandidateCalibrationStepStatus({
  stepKey = '',
  isSaved = false,
  runtimeStatus = '',
  calibrationResult = null,
  paginationResult = null
} = {}) {
  if (runtimeStatus === 'running') return { ...STATUS_META.running };
  if (runtimeStatus === 'failed') return { ...STATUS_META.failed };
  if (stepKey === 'candidate_pagination' && paginationResult?.status === 'running') {
    return { ...STATUS_META.running, label: '跨页验证中' };
  }
  if (paginationResult?.passed === true) return { ...STATUS_META.success };
  if (paginationResult?.structurePassed === true && calibrationResult?.passed === true) {
    return { ...STATUS_META.success, label: '结构成功' };
  }
  if (failedStepKeys(calibrationResult, paginationResult).has(stepKey)) {
    return { ...STATUS_META.failed };
  }
  if (runtimeStatus === 'saved' || isSaved) return { ...STATUS_META.saved };
  return { ...STATUS_META.pending };
}

export function resolveCandidatePaginationFeedback({
  isSaved = false,
  discoveryResult = null,
  paginationResult = null,
  previousValidation = null
} = {}) {
  if (paginationResult?.status === 'running') {
    return {
      key: 'verifying',
      tone: 'running',
      title: '正在验证跨页',
      detail: '系统会进入第 2 页，确认页码和达人顺序已经变化，然后自动返回第 1 页。',
      next: '这次页面切换属于验证动作；完成前不会开始正式采集。'
    };
  }
  if (paginationResult?.passed === true) {
    return {
      key: 'verified',
      tone: 'success',
      title: '跨页与数据读取验证成功',
      detail: `第 1 页 ${Number(paginationResult.firstPageCount || 0)} 位，第 2 页 ${Number(paginationResult.secondPageCount || 0)} 位，已返回第 1 页并取得达人详情 ID。`,
      next: '页码、达人顺序和数据读取通道均已确认，可以按排名采集。'
    };
  }
  if (resultFailed(paginationResult)) {
    if (paginationResult?.structurePassed) {
      return {
        key: 'data-not-ready',
        tone: 'failed',
        title: '页面结构通过，达人数据未就绪',
        detail: paginationResult?.error || '页码和达人顺序正常，但未取得达人详情 ID。',
        next: '无需重复标定位置；请按失败提示处理数据监听或账号页面结构问题。'
      };
    }
    return {
      key: 'verify-failed',
      tone: 'failed',
      title: '跨页验证失败',
      detail: paginationResult?.error || '未能确认第 2 页和新的达人顺序。',
      next: '请先处理失败原因，再重新验证跨页。'
    };
  }
  if (discoveryResult?.status === 'running') {
    return {
      key: 'locating',
      tone: 'running',
      title: '正在定位分页栏',
      detail: '右侧结果页会短暂滚到底部再恢复，这是为了让蒲公英加载分页栏。',
      next: '当前只读取分页结构，不会翻页，也不会采集达人。'
    };
  }
  if (discoveryResult?.status === 'failed') {
    return {
      key: 'locate-failed',
      tone: 'failed',
      title: '分页栏定位失败，位置未保存',
      detail: discoveryResult?.error || '没有识别到可确认当前页的完整分页栏。',
      next: '确认右侧是蒲公英筛选结果页，等待列表稳定后再试。'
    };
  }
  if (discoveryResult?.status === 'success') {
    const pageNumbers = Array.isArray(discoveryResult.pageNumbers)
      ? discoveryResult.pageNumbers.filter((value) => Number.isFinite(Number(value)))
      : [];
    const currentPage = Number(discoveryResult.currentPage || 0);
    const pageLabel = currentPage > 0 ? `当前第 ${currentPage} 页` : '当前页已确认';
    const pagesLabel = pageNumbers.length ? `识别页码：${pageNumbers.join('、')}` : '页码按钮已识别';
    const controls = Number(discoveryResult.controlCount || 0);
    return {
      key: 'located',
      tone: 'saved',
      title: '分页栏定位成功，位置已保存',
      detail: `${pageLabel}；${pagesLabel}${controls > 0 ? `；分页控件 ${controls} 个` : ''}。`,
      next: '这一步没有翻页。请点击下方“验证跨页”，确认能进入第 2 页并返回第 1 页。'
    };
  }
  const previous = normalizeCandidateValidationRecord(previousValidation);
  if (previous) {
    return {
      key: 'previous-verified',
      tone: 'saved',
      title: '上次跨页成功，本次需复验',
      detail: `上次第 1 页 ${previous.firstPageCount} 位，第 2 页 ${previous.secondPageCount} 位，并已返回第 1 页。`,
      next: '页面和筛选条件可能变化；请先验证本页，再验证跨页。'
    };
  }
  if (isSaved) {
    return {
      key: 'saved',
      tone: 'saved',
      title: '已有分页位置，等待验证',
      detail: '当前记录里已有分页位置，但本次会话还没有证明它能正常翻页。',
      next: '重新校准会短暂滚到底部再恢复；只有“验证跨页”才会进入第 2 页并返回第 1 页。'
    };
  }
  return {
    key: 'pending',
    tone: 'pending',
    title: '等待定位分页栏',
    detail: '开始后，右侧结果页会短暂滚到底部再恢复，让蒲公英加载分页栏。',
    next: '定位时不会翻页；定位成功后还需要单独验证跨页。'
  };
}
