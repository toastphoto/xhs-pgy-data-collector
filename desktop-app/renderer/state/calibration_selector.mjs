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
