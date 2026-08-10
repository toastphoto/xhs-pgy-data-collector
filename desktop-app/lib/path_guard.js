const path = require('path');

function resolveInsideRoot(maybePath, root) {
  const input = String(maybePath || '').trim();
  const base = String(root || '').trim();
  if (!input || !base) return null;

  const resolvedRoot = path.resolve(base);
  const resolved = path.resolve(input);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === '') return resolved;
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
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
