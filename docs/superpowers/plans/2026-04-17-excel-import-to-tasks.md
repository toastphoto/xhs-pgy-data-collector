# Excel Import to Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add “导入 Excel” on the Batch Tasks page to extract `pgy.xiaohongshu.com` links + creator names from a media resource spreadsheet and populate the task queue automatically.

**Architecture:** Renderer triggers `tasks:importExcel` → Main process opens file picker and parses Excel with `xlsx` (SheetJS) → returns `{items, stats}` → Renderer fills textarea/queue preview and can immediately start tasks.

**Tech Stack:** Electron (main/preload/renderer), vanilla JS, `xlsx` npm package.

---

## Files to change

**Modify**
- `desktop-app/package.json` — add dependency `xlsx`.
- `desktop-app/main.js` — add IPC `tasks:importExcel` using `dialog.showOpenDialog` and Excel parsing helper.
- `desktop-app/preload.js` — expose `desktopAPI.tasks.importExcel()`.
- `desktop-app/renderer/views/tasks.js` — add “导入Excel” button, preview panel, and merge imported urls into current draft.

---

## Data rules (must match user expectation)

- Identify PGY links by host: `pgy.xiaohongshu.com` (any path).
- Identify creator name column by header keywords (priority): `达人昵称`, `昵称`, `达人`, `博主`, `KOL`.
- Prefer a column whose header includes: `蒲公英`, `pgy`, `PGY`; fallback to scanning whole row strings for a PGY URL.
- Deduplicate by PGY URL.
- Return both: `creator_name` + `pgy_url`.

---

### Task 1: Add `xlsx` dependency

**Files:**
- Modify: `desktop-app/package.json`

- [ ] Add dependency:

```json
{
  "dependencies": {
    "electron": "^30.0.0",
    "xlsx": "^0.18.5"
  }
}
```

- [ ] Install:

Run (in `desktop-app`):
```bash
npm install
```

- [ ] Commit:
```bash
git add desktop-app/package.json desktop-app/package-lock.json
git commit -m "chore: add xlsx dependency for excel import"
```

---

### Task 2: Main process IPC `tasks:importExcel`

**Files:**
- Modify: `desktop-app/main.js`

- [ ] Add `dialog` import:
```js
const { app, BrowserWindow, BrowserView, ipcMain, shell, clipboard, dialog } = require('electron');
```

- [ ] Add helper `parseExcelToPgyItems(filePath)`:
  - load workbook with `xlsx.readFile(filePath)`
  - iterate sheets; convert to rows with `xlsx.utils.sheet_to_json(ws, { defval: '' })`
  - detect columns by header keyword search
  - output items: `{ creator_name, pgy_url, sheet, row_index }`
  - dedupe by `pgy_url`
  - return `{ ok:true, items, stats }`

- [ ] Add IPC:
```js
ipcMain.handle('tasks:importExcel', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: '选择媒介资源表（Excel）',
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xlsm', 'xls'] }]
  });
  if (r.canceled || !r.filePaths?.[0]) return { ok: false, canceled: true };
  return await parseExcelToPgyItems(r.filePaths[0]);
});
```

- [ ] Minimal manual test:
  - select user-provided file
  - confirm returned `items.length > 0`

- [ ] Commit:
```bash
git add desktop-app/main.js
git commit -m "feat: add tasks excel import ipc"
```

---

### Task 3: Preload API surface

**Files:**
- Modify: `desktop-app/preload.js`

- [ ] Add:
```js
tasks: {
  // ...existing
  importExcel: () => ipcRenderer.invoke('tasks:importExcel')
}
```

- [ ] Commit:
```bash
git add desktop-app/preload.js
git commit -m "feat: expose tasks.importExcel in preload"
```

---

### Task 4: Tasks page UI (button + preview)

**Files:**
- Modify: `desktop-app/renderer/views/tasks.js`

- [ ] Add button next to “从剪贴板读取”:
  - label: `导入Excel`
  - onClick: `window.desktopAPI.tasks.importExcel()`
  - on success: show stats + preview top 10 (nickname + url)
  - fill textarea with imported urls (one per line), and set `_draftUrls` accordingly

- [ ] Display preview area:
  - `导入统计：sheet数/提取条数/去重后条数`
  - `预览（前10条）：昵称 - URL`

- [ ] Commit:
```bash
git add desktop-app/renderer/views/tasks.js
git commit -m "feat: add excel import button and preview to tasks page"
```

---

### Task 5: End-to-end verification

- [ ] Run: `npm run dev`
- [ ] Go to “批量任务” → Click “导入Excel” → select the media sheet
- [ ] Confirm textarea auto-filled with PGY urls and preview shows nickname+url
- [ ] Click “解析并加入队列” (optional) then “开始” to run 2-3 urls

---

## Plan self-review (quick)

- No usage of browser injection/hook.
- Extractor is deterministic and safe: only reads local file.
- UI degrades gracefully when user cancels the file dialog.

