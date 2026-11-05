import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WORKSPACE_LAYOUT_LIMITS,
  getWorkspaceLayoutBounds,
  normalizeWorkspaceLayout,
  readWorkspaceLayout,
  writeWorkspaceLayout
} from '../renderer/state/workspace_layout.mjs';

const defaultLayout = normalizeWorkspaceLayout({ viewportWidth: 1400 });
assert.equal(defaultLayout.consoleWidth, 1008);
assert.equal(defaultLayout.sidebarWidth, 250);
assert.equal(defaultLayout.bounds.consoleMaxWidth, 1126);

const clampedWide = normalizeWorkspaceLayout({
  viewportWidth: 1400,
  consoleWidth: 5000,
  sidebarWidth: 5000
});
assert.equal(clampedWide.consoleWidth, 1126);
assert.equal(clampedWide.sidebarWidth, WORKSPACE_LAYOUT_LIMITS.sidebarMaxWidth);

const clampedNarrow = normalizeWorkspaceLayout({
  viewportWidth: 1400,
  consoleWidth: 10,
  sidebarWidth: 10
});
assert.equal(clampedNarrow.consoleWidth, WORKSPACE_LAYOUT_LIMITS.consoleMinWidth);
assert.equal(clampedNarrow.sidebarWidth, WORKSPACE_LAYOUT_LIMITS.sidebarMinWidth);

const resized = normalizeWorkspaceLayout({
  viewportWidth: 1100,
  consoleWidth: 1008,
  sidebarWidth: 350
});
assert.equal(resized.consoleWidth, 826);
assert.equal(resized.sidebarWidth, 350);

const tightBounds = getWorkspaceLayoutBounds(954, 620);
assert.equal(tightBounds.consoleMaxWidth, 680);
assert.equal(tightBounds.sidebarMaxWidth, 246);

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value)
};
assert.equal(writeWorkspaceLayout(storage, { consoleWidth: 901.4, sidebarWidth: 277.7 }), true);
assert.deepEqual(readWorkspaceLayout(storage), { consoleWidth: 901, sidebarWidth: 278 });

values.set('pgy-workspace-layout-v1', '{broken-json');
assert.deepEqual(readWorkspaceLayout(storage), {});

const testDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(testDir, '..');
const rendererSource = fs.readFileSync(path.join(desktopRoot, 'renderer', 'app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(desktopRoot, 'renderer', 'app.css'), 'utf8');
const htmlSource = fs.readFileSync(path.join(desktopRoot, 'renderer', 'index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');

assert.match(rendererSource, /addEventListener\('pointerdown'/);
assert.match(rendererSource, /setPointerCapture\?\.\(pointerId\)/);
assert.match(rendererSource, /addEventListener\('lostpointercapture'/);
assert.match(rendererSource, /writeWorkspaceLayout\(window\.localStorage,/);
assert.match(cssSource, /\.splitter\s*\{[\s\S]*?width:\s*14px;[\s\S]*?touch-action:\s*none;/);
assert.match(htmlSource, /id="splitterSidebar"[^>]*role="separator"[^>]*tabindex="0"/);
assert.match(htmlSource, /id="splitterMain"[^>]*role="separator"[^>]*tabindex="0"/);
const { BROWSER_LAYOUT_LIMITS } = await import('../lib/browser_layout.js');
assert.equal(BROWSER_LAYOUT_LIMITS.splitterWidth, WORKSPACE_LAYOUT_LIMITS.splitterWidth);
assert.match(mainSource, /const layout = calculateBrowserLayout\(mainWindow, uiWidth\);/);
assert.match(mainSource, /view\.setBounds\(bounds\)/);

console.log('workspace_layout.test.mjs passed');
