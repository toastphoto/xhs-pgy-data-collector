const MANUAL_REVIEW_FIELDS = new Set(['status', 'priority', 'excludeReason', 'note']);

export function buildCandidateMergePatch(existing, incomingPatch, {
  preserveManualReview = false
} = {}) {
  return Object.fromEntries(
    Object.entries(incomingPatch || {}).filter(([key, value]) => {
      if (preserveManualReview && MANUAL_REVIEW_FIELDS.has(key)) return false;
      const next = String(value || '').trim();
      if (!next) return false;
      const current = key === 'status'
        ? String(existing?.status || 'candidate').trim() || 'candidate'
        : String(existing?.[key] || '').trim();
      return current !== next;
    })
  );
}
