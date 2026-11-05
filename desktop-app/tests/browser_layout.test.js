const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BROWSER_LAYOUT_LIMITS, calculateBrowserLayout } = require('../lib/browser_layout');

function createWindow({ width = 1400, height = 900, zoom = 1 } = {}) {
  return {
    getContentSize: () => [width, height],
    webContents: { getZoomFactor: () => zoom }
  };
}

test('converts the reported 974 CSS edge to 731 DIP at 0.75 zoom', () => {
  assert.deepEqual(calculateBrowserLayout(createWindow({ zoom: 0.75 }), 960), {
    consoleWidth: 960,
    bounds: { x: 731, y: 66, width: 669, height: 834 }
  });
});

test('preserves default-zoom geometry and converts all edges at 1.25 zoom', () => {
  assert.deepEqual(calculateBrowserLayout(createWindow(), 960), {
    consoleWidth: 960,
    bounds: { x: 974, y: 88, width: 426, height: 812 }
  });
  assert.deepEqual(calculateBrowserLayout(createWindow({ zoom: 1.25 }), 760), {
    consoleWidth: 760,
    bounds: { x: 968, y: 110, width: 432, height: 790 }
  });
});

test('uses only the trusted main renderer zoom and reads it again on each call', () => {
  let zoom = 0.75;
  let reads = 0;
  const mainWindow = createWindow();
  mainWindow.webContents.getZoomFactor = () => { reads += 1; return zoom; };
  const payload = { consoleWidth: 760, zoomFactor: 5, devicePixelRatio: 9 };
  const first = calculateBrowserLayout(mainWindow, payload.consoleWidth);
  assert.equal(first.bounds.x, 581);
  assert.equal(first.bounds.y, 66);
  zoom = 1.25;
  const second = calculateBrowserLayout(mainWindow, payload.consoleWidth);
  assert.equal(second.bounds.x, 968);
  assert.equal(second.bounds.y, 110);
  assert.equal(reads, 2);
  assert.deepEqual(payload, { consoleWidth: 760, zoomFactor: 5, devicePixelRatio: 9 });
  // Passing the whole IPC payload cannot override trusted geometry either.
  assert.deepEqual(
    calculateBrowserLayout(mainWindow, payload),
    calculateBrowserLayout(mainWindow)
  );
});

test('rounds the combined splitter edge, not the individual CSS widths', () => {
  const layout = calculateBrowserLayout(createWindow({ zoom: 0.75 }), 901);
  assert.equal(layout.bounds.x, 686);
  assert.notEqual(layout.bounds.x, Math.round(901 * 0.75) + Math.round(14 * 0.75));
  assert.equal(layout.bounds.x + layout.bounds.width, 1400);
  assert.equal(layout.bounds.y + layout.bounds.height, 900);
});

test('matches renderer width clamps across zoom, resize and narrow windows', async () => {
  const { WORKSPACE_LAYOUT_LIMITS, normalizeWorkspaceLayout } = await import(
    '../renderer/state/workspace_layout.mjs'
  );
  for (const key of ['consoleMinWidth', 'browserMinWidth', 'splitterWidth', 'defaultConsoleRatio']) {
    assert.equal(BROWSER_LAYOUT_LIMITS[key], WORKSPACE_LAYOUT_LIMITS[key], key);
  }
  for (const zoom of [0.75, 1, 1.25]) {
    for (const width of [0, 300, 600, 715, 716, 800, 953, 954, 1100, 1192, 1193, 1400, 1920]) {
      for (const height of [0, 100, 300, 900]) {
        for (const consoleWidth of [undefined, -100, 0, 620, 760, 901.4, 960, 5000]) {
          const expected = normalizeWorkspaceLayout({ viewportWidth: width / zoom, consoleWidth });
          const actual = calculateBrowserLayout(createWindow({ width, height, zoom }), consoleWidth);
          assert.equal(actual.consoleWidth, expected.consoleWidth);
          assert.equal(actual.bounds.x, Math.round((expected.consoleWidth + 14) * zoom));
          assert.equal(actual.bounds.y, Math.round(88 * zoom));
          assert.equal(actual.bounds.width, Math.max(Math.round(BROWSER_LAYOUT_LIMITS.browserMinWidth * zoom), width - actual.bounds.x));
          assert.equal(actual.bounds.height, Math.max(Math.round(240 * zoom), height - actual.bounds.y));
          for (const value of Object.values(actual.bounds)) {
            assert.ok(Number.isInteger(value) && value >= 0);
          }
        }
      }
    }
  }
});

test('800 CSS pixel windows fit both panes without covering the left workbench', () => {
  for (const zoom of [0.75, 1, 1.25]) {
    const width = Math.round(800 * zoom);
    const height = Math.round(200 * zoom);
    const layout = calculateBrowserLayout(createWindow({ width, height, zoom }), 5000);
    assert.equal(layout.consoleWidth, 526);
    assert.equal(layout.bounds.x, Math.round(540 * zoom));
    assert.equal(layout.bounds.width, Math.round(BROWSER_LAYOUT_LIMITS.browserMinWidth * zoom));
    assert.equal(layout.bounds.height, Math.round(240 * zoom));
    assert.ok(layout.bounds.x + layout.bounds.width <= width);
    assert.ok(layout.bounds.y + layout.bounds.height > height);
  }
});

test('persisted widths remain CSS pixels through shrink, grow and reload', async () => {
  const { normalizeWorkspaceLayout, readWorkspaceLayout, writeWorkspaceLayout } = await import(
    '../renderer/state/workspace_layout.mjs'
  );
  for (const zoom of [0.75, 1, 1.25]) {
    let stored;
    const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
    let layout = { consoleWidth: 901, sidebarWidth: 278 };
    for (const cssViewportWidth of [1400, 1100, 940, 1400]) {
      const width = Math.round(cssViewportWidth * zoom);
      layout = normalizeWorkspaceLayout({ viewportWidth: width / zoom, ...layout });
      const native = calculateBrowserLayout(createWindow({ width, zoom }), layout.consoleWidth);
      assert.equal(native.consoleWidth, layout.consoleWidth);
      assert.equal(writeWorkspaceLayout(storage, layout), true);
      const restored = readWorkspaceLayout(storage);
      assert.deepEqual(restored, { consoleWidth: layout.consoleWidth, sidebarWidth: layout.sidebarWidth });
      assert.deepEqual(calculateBrowserLayout(createWindow({ width, zoom }), restored.consoleWidth), native);
    }
    assert.equal(layout.consoleWidth, 666);
    assert.equal(layout.sidebarWidth, 278);
  }
});

test('invalid renderer widths use the default, while finite extremes clamp', () => {
  const mainWindow = createWindow();
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '', '960', {}, [], true]) {
    assert.deepEqual(calculateBrowserLayout(mainWindow, value), calculateBrowserLayout(mainWindow));
  }
  assert.equal(calculateBrowserLayout(mainWindow, -Number.MAX_VALUE).consoleWidth, 470);
  assert.equal(calculateBrowserLayout(mainWindow, Number.MAX_VALUE).consoleWidth, 1126);
});

test('invalid or unavailable trusted geometry fails instead of guessing 100% zoom', () => {
  for (const zoom of [0, -1, NaN, Infinity, null, undefined, '0.75']) {
    const mainWindow = createWindow();
    mainWindow.webContents.getZoomFactor = () => zoom;
    assert.throws(() => calculateBrowserLayout(mainWindow, 960), /Invalid main renderer zoom/);
  }
  for (const value of [-1, NaN, Infinity, null, '1400', 1400.5, 0x80000000]) {
    assert.throws(() => calculateBrowserLayout(createWindow({ width: value }), 960), /Invalid window content/);
    assert.throws(() => calculateBrowserLayout(createWindow({ height: value }), 960), /Invalid window content/);
  }
  const destroyedWindow = createWindow();
  destroyedWindow.webContents.getZoomFactor = () => { throw new Error('Object has been destroyed'); };
  assert.throws(() => calculateBrowserLayout(destroyedWindow, 960), /destroyed/);
  for (const zoom of [Number.MAX_VALUE, Number.MIN_VALUE]) {
    assert.throws(() => calculateBrowserLayout(createWindow({ zoom })), /native rectangle range/);
  }
});
