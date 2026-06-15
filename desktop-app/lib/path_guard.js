const path = require('path');

function normalizeRoot(root) {
  const resolved = path.resolve(String(root || ''));
  return resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
}

function resolveInsideRoot(maybePath, root) {
  const input = String(maybePath || '').trim();
  const base = String(root || '').trim();
  if (!input || !base) return null;

  const resolvedRoot = path.resolve(base);
  const resolved = path.resolve(input);
  if (resolved === resolvedRoot) return resolved;
  if (!resolved.startsWith(normalizeRoot(resolvedRoot))) return null;
  return resolved;
}

function resolveInsideAny(maybePath, roots) {
  const list = Array.isArray(roots) ? roots : [];
  for (const root of list) {
    const resolved = resolveInsideRoot(maybePath, root);
    if (resolved) return resolved;
  }
  return null;
}

module.exports = { resolveInsideRoot, resolveInsideAny };
