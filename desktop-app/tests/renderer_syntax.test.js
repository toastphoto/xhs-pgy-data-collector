const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rendererRoot = path.resolve(__dirname, '..', 'renderer');

function collectScripts(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectScripts(absolute));
    else if (/\.(?:js|mjs)$/i.test(entry.name)) files.push(absolute);
  }
  return files;
}

const scripts = collectScripts(rendererRoot);
assert.ok(scripts.length > 0, 'renderer scripts should exist');

for (const filePath of scripts) {
  const source = fs.readFileSync(filePath, 'utf8');
  assert.ok(!source.includes('\\`'), `${path.basename(filePath)} contains an escaped template delimiter`);
  const parseable = source
    .replace(/^\s*import\b[\s\S]*?;\s*$/gm, '')
    .replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/g, '');
  assert.doesNotThrow(
    () => new vm.Script(parseable, { filename: filePath }),
    `renderer syntax failed: ${path.relative(rendererRoot, filePath)}`
  );
}

console.log('renderer_syntax.test.js OK');
