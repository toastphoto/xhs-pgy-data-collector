# Export Column Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「结果&导出」页增加“按列勾选 → 二次导出精简版资源表”的能力，并记住上次选择；精简版导出仍执行“全空列剔除”。

**Architecture:** Renderer 获取列定义与上次选择 → 用户勾选 → IPC 导出（传 selectedColumns）→ main 在导出时先按 selectedColumns 过滤，再执行全空列剔除，使用现有 ExcelJS 样式输出新文件。

**Tech Stack:** Electron main/preload/renderer + ExcelJS。

---

## Files

**Modify**
- `desktop-app/main.js`：导出逻辑支持 `selectedColumns`，并新增列定义/保存选择 IPC
- `desktop-app/preload.js`：暴露 `exports.getResourceColumns/loadColumnPreset/saveColumnPreset`
- `desktop-app/renderer/views/exports.js`：新增列勾选 UI + 搜索 + 导出精简版按钮

---

## Shared helpers (in main.js)

- `getResourceColumns()`：返回 `{columns, groups}`
  - `columns`: string[]
  - `groups`: `{name, columns: string[]}`[]
- `normalizeSelectedColumns(selected, all)`：
  - 过滤非法列
  - 保持用户顺序
  - 若为空则默认 all

Preset storage:
- Path: `<userData>/export_presets/resource_columns.json`
- Payload: `{ selectedColumns: string[], updatedAt: ISOString }`

---

### Task 1: Main — columns definition + preset persistence IPC

**Files:**
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Factor out the resource table columns list**

Extract the `cols` list from `exportRunToResourceXlsx()` into a shared function:

```js
function getResourceTableColumns() { return [ ...same cols... ]; }
function getResourceGroups(columns) { /* basic/quote/overview/fans/notes */ }
```

- [ ] **Step 2: Add IPC to return columns**

```js
ipcMain.handle('exports:getResourceColumns', async () => {
  const columns = getResourceTableColumns();
  return { ok:true, columns, groups: getResourceGroups(columns) };
});
```

- [ ] **Step 3: Add IPC for preset**

```js
ipcMain.handle('exports:loadColumnPreset', async () => { ...read json... });
ipcMain.handle('exports:saveColumnPreset', async (_e, selectedColumns) => { ...write json... });
```

- [ ] **Step 4: Syntax check**

Run:
```bash
node -c main.js
```

---

### Task 2: Main — export resource run supports selectedColumns

**Files:**
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Update `exportRunToResourceXlsx(runDir, selectedColumns)`**

Behavior:
1) If selectedColumns provided → `finalCols = selectedColumns`
2) Then apply existing “全空列剔除” on `finalCols`
3) Export Excel with existing style

- [ ] **Step 2: Wire to IPC**

Update `exports:exportResourceRun` to accept:
```js
payload: { runDir, selectedColumns, mode?: 'full' | 'slim' }
```

File naming:
- full: `媒介资源表_<runId>.xlsx` (existing)
- slim: `媒介资源表_<runId>_精简版.xlsx`

- [ ] **Step 3: Syntax check**

Run:
```bash
node -c main.js
```

---

### Task 3: Preload — expose new exports APIs

**Files:**
- Modify: `desktop-app/preload.js`

- [ ] Add:
```js
getResourceColumns: () => ipcRenderer.invoke('exports:getResourceColumns'),
loadColumnPreset: () => ipcRenderer.invoke('exports:loadColumnPreset'),
saveColumnPreset: (cols) => ipcRenderer.invoke('exports:saveColumnPreset', cols),
```

- [ ] Syntax check:
```bash
node -c preload.js
```

---

### Task 4: Renderer — exports page column picker UI

**Files:**
- Modify: `desktop-app/renderer/views/exports.js`

- [ ] **Step 1: Load columns + preset on first render**

Calls:
- `desktopAPI.exports.getResourceColumns()`
- `desktopAPI.exports.loadColumnPreset()`

Build renderer state:
- `allColumns`
- `groups`
- `checkedSet`
- `query`

Preset merge rule:
- for new columns not in preset → default checked

- [ ] **Step 2: UI**

Components:
- 搜索框
- 全选/全不选/反选
- 分组列表（每行一个 checkbox + 列名）
- 统计：已选 X / 总计 Y
- 按钮：`导出精简版（按勾选列）`

On export:
- gather selectedColumns in the order of `allColumns`
- call `saveColumnPreset(selectedColumns)`
- call `exportResourceRun({runDir:_selectedRunDir, selectedColumns, mode:'slim'})`

- [ ] **Step 3: Syntax check**

Run:
```bash
node -c renderer/views/exports.js
```

---

### Task 5: Manual verification

- [ ] Restart app (`npm run dev`)
- [ ] Go to “结果&导出”
- [ ] Choose a runDir
- [ ] 勾选少量列 → 导出精简版
- [ ] 打开文件确认：
  - 只包含勾选列
  - 全空列仍被剔除
  - 记住上次选择

