// CSS-pixel contract with renderer/state/workspace_layout.mjs and app.css.
const BROWSER_LAYOUT_LIMITS = Object.freeze({
  consoleMinWidth: 470,
  browserMinWidth: 260,
  browserMinHeight: 240,
  splitterWidth: 14,
  topbarHeight: 88,
  defaultConsoleRatio: 0.72
});

// The window and its webContents must come from main-process ownership, not IPC.
// Only consoleWidth is renderer input; it and the returned consoleWidth stay CSS px.
function calculateBrowserLayout(mainWindow, consoleWidth) {
  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  const zoomFactor = mainWindow.webContents.getZoomFactor();
  if (!Number.isFinite(zoomFactor) || zoomFactor <= 0) {
    throw new RangeError('Invalid main renderer zoom factor');
  }
  if (![contentWidth, contentHeight].every((value) => (
    Number.isInteger(value) && value >= 0 && value <= 0x7fffffff
  ))) {
    throw new RangeError('Invalid window content size');
  }

  const limits = BROWSER_LAYOUT_LIMITS;
  const viewportWidth = contentWidth / zoomFactor;
  // Match renderer normalization before converting. Narrow windows retain the
  // CSS minimums and clip overflow; moving x left would cover the workbench.
  const safeViewportWidth = Math.max(
    limits.consoleMinWidth + limits.browserMinWidth + limits.splitterWidth,
    Math.round(viewportWidth)
  );
  const consoleMaxWidth = Math.max(
    limits.consoleMinWidth,
    safeViewportWidth - limits.browserMinWidth - limits.splitterWidth
  );
  const requestedWidth = Number.isFinite(consoleWidth)
    ? consoleWidth
    : viewportWidth * limits.defaultConsoleRatio;
  const normalizedConsoleWidth = Math.max(
    limits.consoleMinWidth,
    Math.min(consoleMaxWidth, Math.round(requestedWidth))
  );

  // Round the shared edges once, then subtract from the DIP content size.
  // OS display scale/devicePixelRatio must not be applied a second time.
  const x = Math.round((normalizedConsoleWidth + limits.splitterWidth) * zoomFactor);
  const y = Math.round(limits.topbarHeight * zoomFactor);
  const bounds = {
    x,
    y,
    width: Math.max(1, Math.round(limits.browserMinWidth * zoomFactor), contentWidth - x),
    height: Math.max(1, Math.round(limits.browserMinHeight * zoomFactor), contentHeight - y)
  };
  if (!Object.values(bounds).every((value) => (
    Number.isInteger(value) && value >= 0 && value <= 0x7fffffff
  ))) {
    throw new RangeError('Browser bounds exceed the native rectangle range');
  }

  return { consoleWidth: normalizedConsoleWidth, bounds };
}

module.exports = { BROWSER_LAYOUT_LIMITS, calculateBrowserLayout };
