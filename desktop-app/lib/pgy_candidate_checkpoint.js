const PGY_CANDIDATE_CHECKPOINT_SIZE = 40;
const PGY_CANDIDATE_CHECKPOINT_WAIT_MS = 90 * 1000;
const PGY_CANDIDATE_CHECKPOINT_EXPIRE_MS = 5 * 60 * 1000;

function findPendingCheckpoint({
  available = 0,
  endRank = 0,
  waitedCheckpoints = [],
  checkpointSize = PGY_CANDIDATE_CHECKPOINT_SIZE
} = {}) {
  const safeAvailable = Math.max(0, Math.trunc(Number(available) || 0));
  const safeEndRank = Math.max(0, Math.trunc(Number(endRank) || 0));
  const safeSize = Math.max(1, Math.trunc(Number(checkpointSize) || PGY_CANDIDATE_CHECKPOINT_SIZE));
  const waited = new Set(
    (Array.isArray(waitedCheckpoints) ? waitedCheckpoints : [])
      .map((value) => Math.trunc(Number(value) || 0))
      .filter((value) => value > 0)
  );

  for (let checkpoint = safeSize; checkpoint <= safeAvailable && checkpoint < safeEndRank; checkpoint += safeSize) {
    if (!waited.has(checkpoint)) return checkpoint;
  }
  return null;
}

function findCheckpointBeforeNextPage({
  available = 0,
  nextPageSize = 0,
  endRank = 0,
  waitedCheckpoints = [],
  checkpointSize = PGY_CANDIDATE_CHECKPOINT_SIZE
} = {}) {
  const safeAvailable = Math.max(0, Math.trunc(Number(available) || 0));
  const safeNextPageSize = Math.max(0, Math.trunc(Number(nextPageSize) || 0));
  const safeEndRank = Math.max(0, Math.trunc(Number(endRank) || 0));
  const safeSize = Math.max(1, Math.trunc(Number(checkpointSize) || PGY_CANDIDATE_CHECKPOINT_SIZE));
  const waited = new Set(
    (Array.isArray(waitedCheckpoints) ? waitedCheckpoints : [])
      .map((value) => Math.trunc(Number(value) || 0))
      .filter((value) => value > 0)
  );
  if (!safeNextPageSize) return null;
  for (let checkpoint = safeSize; checkpoint < safeEndRank; checkpoint += safeSize) {
    if (waited.has(checkpoint)) continue;
    if (safeAvailable < checkpoint && safeAvailable + safeNextPageSize > checkpoint) return checkpoint;
  }
  return null;
}

function buildCheckpointWindow(now = Date.now()) {
  const createdAt = Math.max(0, Math.trunc(Number(now) || 0));
  return {
    createdAt,
    readyAt: createdAt + PGY_CANDIDATE_CHECKPOINT_WAIT_MS,
    expiresAt: createdAt + PGY_CANDIDATE_CHECKPOINT_EXPIRE_MS
  };
}

function assessCheckpointWindow(checkpoint, now = Date.now()) {
  if (!checkpoint || typeof checkpoint !== 'object') {
    return { ok: false, code: 'PGY_CANDIDATE_CHECKPOINT_MISSING' };
  }
  const current = Math.max(0, Math.trunc(Number(now) || 0));
  const readyAt = Math.max(0, Math.trunc(Number(checkpoint.readyAt) || 0));
  const expiresAt = Math.max(0, Math.trunc(Number(checkpoint.expiresAt) || 0));
  if (expiresAt && current > expiresAt) {
    return { ok: false, code: 'PGY_CANDIDATE_CHECKPOINT_EXPIRED' };
  }
  if (current < readyAt) {
    return {
      ok: false,
      code: 'PGY_CANDIDATE_CHECKPOINT_COOLDOWN',
      remainingMs: readyAt - current
    };
  }
  return { ok: true, remainingMs: 0 };
}

module.exports = {
  PGY_CANDIDATE_CHECKPOINT_EXPIRE_MS,
  PGY_CANDIDATE_CHECKPOINT_SIZE,
  PGY_CANDIDATE_CHECKPOINT_WAIT_MS,
  assessCheckpointWindow,
  buildCheckpointWindow,
  findCheckpointBeforeNextPage,
  findPendingCheckpoint
};
