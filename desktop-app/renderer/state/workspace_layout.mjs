export const WORKSPACE_LAYOUT_STORAGE_KEY = 'pgy-workspace-layout-v1';

export const WORKSPACE_LAYOUT_LIMITS = Object.freeze({
  consoleMinWidth: 470,
  browserMinWidth: 260,
  contentMinWidth: 360,
  sidebarMinWidth: 220,
  sidebarMaxWidth: 380,
  splitterWidth: 14,
  defaultConsoleRatio: 0.72,
  defaultSidebarWidth: 250
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getWorkspaceLayoutBounds(viewportWidth, consoleWidth) {
  const limits = WORKSPACE_LAYOUT_LIMITS;
  const safeViewportWidth = Math.max(
    limits.consoleMinWidth + limits.browserMinWidth + limits.splitterWidth,
    Math.round(finiteNumber(viewportWidth, 0))
  );
  const consoleMaxWidth = Math.max(
    limits.consoleMinWidth,
    safeViewportWidth - limits.browserMinWidth - limits.splitterWidth
  );
  const safeConsoleWidth = clamp(
    Math.round(finiteNumber(consoleWidth, limits.consoleMinWidth)),
    limits.consoleMinWidth,
    consoleMaxWidth
  );
  const sidebarMaxWidth = Math.min(
    limits.sidebarMaxWidth,
    Math.max(
      limits.sidebarMinWidth,
      safeConsoleWidth - limits.contentMinWidth - limits.splitterWidth
    )
  );

  return {
    consoleMinWidth: limits.consoleMinWidth,
    consoleMaxWidth,
    sidebarMinWidth: limits.sidebarMinWidth,
    sidebarMaxWidth
  };
}

export function normalizeWorkspaceLayout({ viewportWidth, consoleWidth, sidebarWidth } = {}) {
  const limits = WORKSPACE_LAYOUT_LIMITS;
  const defaultConsoleWidth = Math.round(
    finiteNumber(viewportWidth, 0) * limits.defaultConsoleRatio
  );
  const firstBounds = getWorkspaceLayoutBounds(viewportWidth, defaultConsoleWidth);
  const normalizedConsoleWidth = clamp(
    Math.round(finiteNumber(consoleWidth, defaultConsoleWidth)),
    firstBounds.consoleMinWidth,
    firstBounds.consoleMaxWidth
  );
  const bounds = getWorkspaceLayoutBounds(viewportWidth, normalizedConsoleWidth);
  const normalizedSidebarWidth = clamp(
    Math.round(finiteNumber(sidebarWidth, limits.defaultSidebarWidth)),
    bounds.sidebarMinWidth,
    bounds.sidebarMaxWidth
  );

  return {
    consoleWidth: normalizedConsoleWidth,
    sidebarWidth: normalizedSidebarWidth,
    bounds
  };
}

export function readWorkspaceLayout(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(WORKSPACE_LAYOUT_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      consoleWidth: finiteNumber(parsed.consoleWidth, undefined),
      sidebarWidth: finiteNumber(parsed.sidebarWidth, undefined)
    };
  } catch (_) {
    return {};
  }
}

export function writeWorkspaceLayout(storage, layout) {
  try {
    storage?.setItem?.(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({
      consoleWidth: Math.round(layout.consoleWidth),
      sidebarWidth: Math.round(layout.sidebarWidth)
    }));
    return true;
  } catch (_) {
    return false;
  }
}
