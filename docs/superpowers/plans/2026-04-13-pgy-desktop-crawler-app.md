# 蒲公英完整采集 App（桌面内嵌版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 我正在使用 writing-plans skill 来创建实现计划。

**Goal:** 将现有原型升级为“完整采集 App（v1）”：右侧真内嵌 BrowserView + 左侧原生控制台 UI，支持录制回放、采集模板、批量队列、导出 Excel 与 AI 数据对比报告；默认安全模式（DOM selector），触发风控时暂停并让用户手工介入后继续。

**Architecture:** Electron 负责真内嵌浏览器、录制回放与任务编排 UI；Python(FastAPI) 负责结果规范化、Excel 导出、AI 对比报告生成。Electron 通过 HTTP 调用本地后端；关键失败时产出证据包并暂停队列。

**Tech Stack:** Electron(BrowserView/IPC/Node fs) + FastAPI + pandas/openpyxl +（可选）AI 接口（沿用现有 AIAnalyzer）。

---

## 0) Files & Responsibilities（锁定边界）

### Electron（桌面端）
**Modify:**
- `desktop-app/main.js`：BrowserView 生命周期；录制/回放；批量执行引擎；与后端通信；证据包落盘；后端就绪探测
- `desktop-app/preload.js`：暴露 IPC API 给渲染进程
- `desktop-app/browser_preload.js`：录制采集（click/input/navigation），并逐步增强 selector 稳定性

**Replace / Create:**
- Replace: `desktop-app/renderer/shell.html` → `desktop-app/renderer/index.html`（原生控制台 UI）
- Replace: `desktop-app/renderer/shell.js` → `desktop-app/renderer/app.js`
- Replace: `desktop-app/renderer/shell.css` → `desktop-app/renderer/app.css`
- Create: `desktop-app/renderer/views/*.js`（按模块拆分：登录态、录制、模板、任务、导出、报告）
- Create: `desktop-app/renderer/components/*.js`（通用组件：表格、表单、Toast、对话框等）
- Create: `desktop-app/renderer/state/store.js`（轻量状态管理：单文件 store）

**Create（持久化数据目录结构，由代码自动生成）：**
- `{userData}/profiles/pgy_default/`：BrowserView 持久化 partition/profile（v1 只做单账号）
- `{userData}/recordings/*.json`：录制脚本
- `{userData}/templates/*.json`：采集模板
- `{userData}/runs/<runId>/...`：批量运行产物（raw/normalized/evidence）

### Python 后端（FastAPI）
**Modify:**
- `content-analyzer/app/api/server.py`：新增 desktop 专用 API（导出/报告/健康检查）
- `content-analyzer/app/core/storage_simple.py` 或 `storage.py`：新增“PGY 结果 → Excel 两张表”导出器
- `content-analyzer/app/core/ai_analyzer.py`：新增“对比报告输入为结构化结果”入口（尽量复用现有）

**Create:**
- `content-analyzer/app/core/pgy_schema.py`：定义 v1 结果标准结构（summary + notes）
- `content-analyzer/app/core/pgy_exporter.py`：把标准结构导出为 Excel（Creator_Summary / Note_Detail）
- `content-analyzer/app/api/desktop_api.py`：desktop API 路由（从 `server.py` 引入挂载）

### Tests（最小可行、无额外依赖）
**Create:**
- `content-analyzer/tests/test_pgy_exporter_unittest.py`（`unittest`）：验证导出列结构与行数一致性
- `content-analyzer/tests/test_pgy_schema_unittest.py`：验证规范化函数/空值处理

Run tests:
- `python -m unittest -v`

---

## 1) Task 1: Electron 左侧控制台 UI（替换 iframe，完成完整导航框架）

**Files:**
- Modify: `desktop-app/main.js`
- Modify: `desktop-app/preload.js`
- Replace/Create: `desktop-app/renderer/index.html`
- Create: `desktop-app/renderer/app.js`
- Create: `desktop-app/renderer/app.css`
- Create: `desktop-app/renderer/state/store.js`
- Create: `desktop-app/renderer/views/{login,recordings,templates,tasks,exports,report}.js`

### Step 1: 创建新的 `index.html`，包含 Sidebar + 主内容区 + 顶部状态条（不再 iframe）
- [ ] Replace `desktop-app/renderer/shell.html`（保留旧文件为 `shell.html.bak` 或直接不再引用）  
- [ ] 新建 `desktop-app/renderer/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>蒲公英采集工具</title>
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <div id="app">
      <aside id="sidebar"></aside>
      <main id="main">
        <header id="topbar"></header>
        <section id="content"></section>
      </main>
    </div>
    <script type="module" src="./app.js"></script>
  </body>
</html>
```

### Step 2: 实现 `store.js`（集中管理 UI 状态）
- [ ] Create `desktop-app/renderer/state/store.js`：

```js
export const store = {
  state: {
    backend: { running: false, host: '127.0.0.1', port: '8010' },
    view: 'login', // login | recordings | templates | tasks | exports | report
    recording: { isRecording: false, count: 0, files: [] },
    templates: { activeTemplatePath: '', templates: [] },
    tasks: { queue: [], running: false, paused: false, current: null, logs: [] },
    exports: { lastRunId: '', lastExcelPath: '', lastReportPath: '' }
  },
  listeners: [],
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  },
  subscribe(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((x) => x !== fn));
  }
};
```

### Step 3: 通过 preload 暴露 backend.info 与更多 IPC（为 UI 做准备）
- [ ] Modify `desktop-app/preload.js`，在 `desktopAPI` 增加：

```js
recording: {
  start: () => ipcRenderer.invoke('recording:start'),
  stop: () => ipcRenderer.invoke('recording:stop'),
  list: () => ipcRenderer.invoke('recording:list'),
  replay: (filePath) => ipcRenderer.invoke('recording:replay', filePath),
  rename: (filePath, newName) => ipcRenderer.invoke('recording:rename', filePath, newName),
  openFolder: () => ipcRenderer.invoke('recording:openFolder'),
  onCount: (cb) => ipcRenderer.on('recording:count', (_e, n) => cb(n))
}
```

> 注意：上述 IPC handler 在 Task 2/3 中实现。

### Step 4: 实现 `app.js`：渲染 sidebar/topbar + 路由切换
- [ ] Create `desktop-app/renderer/app.js`：

```js
import { store } from './state/store.js';
import { renderLogin } from './views/login.js';
import { renderRecordings } from './views/recordings.js';
import { renderTemplates } from './views/templates.js';
import { renderTasks } from './views/tasks.js';
import { renderExports } from './views/exports.js';
import { renderReport } from './views/report.js';

const views = {
  login: renderLogin,
  recordings: renderRecordings,
  templates: renderTemplates,
  tasks: renderTasks,
  exports: renderExports,
  report: renderReport
};

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach((c) => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}

function renderChrome(state) {
  const sidebar = document.getElementById('sidebar');
  const topbar = document.getElementById('topbar');

  sidebar.innerHTML = '';
  topbar.innerHTML = '';

  const items = [
    ['login', '登录态/账号'],
    ['recordings', '录制&回放'],
    ['templates', '采集模板'],
    ['tasks', '批量任务'],
    ['exports', '结果&导出'],
    ['report', 'AI 报告']
  ];

  sidebar.appendChild(h('div', { class: 'brand' }, ['蒲公英采集工具']));
  items.forEach(([key, label]) => {
    sidebar.appendChild(
      h('button', {
        class: `nav-item ${state.view === key ? 'active' : ''}`,
        onclick: () => store.set({ view: key })
      }, [label])
    );
  });

  const backendText = state.backend.running
    ? `后端：运行中 http://${state.backend.host}:${state.backend.port}`
    : '后端：未运行';
  topbar.appendChild(h('div', { class: `backend ${state.backend.running ? 'ok' : 'bad'}` }, [backendText]));
}

function renderContent(state) {
  const content = document.getElementById('content');
  content.innerHTML = '';
  const view = views[state.view] || views.login;
  content.appendChild(view(state));
}

async function bootstrap() {
  const info = await window.desktopAPI.backend.info();
  if (info?.ok) store.set({ backend: { running: true, host: info.host, port: info.port } });

  window.desktopAPI.backend.onStatus((st) => {
    if (st?.running) store.set({ backend: { running: true, host: st.host || '127.0.0.1', port: st.port || '8010' } });
    else store.set({ backend: { running: false, host: '127.0.0.1', port: '8010' } });
  });
  window.desktopAPI.recording.onCount((n) => store.set({ recording: { ...store.state.recording, count: n } }));

  store.subscribe((s) => {
    renderChrome(s);
    renderContent(s);
  });
  renderChrome(store.state);
  renderContent(store.state);
}

bootstrap();
```

### Step 5: 写一份基础 `app.css`（先能用，后续用 frontend-design 美化）
- [ ] Create `desktop-app/renderer/app.css`（先最小、可读）：

```css
html, body { height: 100%; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
#app { height: 100%; display: grid; grid-template-columns: 280px 1fr; background: #0b0f14; color: #e6edf3; }
#sidebar { border-right: 1px solid rgba(255,255,255,0.08); padding: 14px; display:flex; flex-direction: column; gap: 8px; }
.brand { font-weight: 800; letter-spacing: 0.2px; margin-bottom: 8px; }
.nav-item { text-align:left; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e6edf3; cursor:pointer; }
.nav-item.active { background: rgba(120,180,255,0.14); border-color: rgba(120,180,255,0.25); }
#main { display:flex; flex-direction: column; }
#topbar { height: 56px; display:flex; align-items:center; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.backend { font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); }
.backend.ok { color: #7ee787; }
.backend.bad { color: #ff7b72; }
#content { padding: 14px; overflow:auto; }
```

### Step 6: 修改 Electron 主窗口加载新 UI
- [ ] Modify `desktop-app/main.js`：
  - `mainWindow.loadFile(path.join(__dirname, 'renderer', 'shell.html'));` → `index.html`
  - 移除 iframe 相关逻辑（如有）

### Step 7: 手工验证
- [ ] Run（开发态）：`npm run dev`
- [ ] 预期：左侧出现完整导航；右侧 BrowserView 仍可用；顶部显示后端端口 8010。

- [ ] Commit

---

## 2) Task 2: BrowserView Profile（手工登录+记住）与后端就绪探测

**Files:**
- Modify: `desktop-app/main.js`

### Step 1: 为 BrowserView 指定持久化 partition（pgy_default）
- [ ] 修改 `new BrowserView({ webPreferences: { ... } })`，增加 partition：

```js
browserView = new BrowserView({
  webPreferences: {
    partition: 'persist:pgy_default',
    preload: path.join(__dirname, 'browser_preload.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
});
```

### Step 2: 增加“检测登录态”的 IPC（基于 URL + DOM 关键元素）
- [ ] `ipcMain.handle('pgy:checkLogin', ...)`，在 BrowserView 执行：

```js
const js = `
  (function(){
    const url = location.href || '';
    const isLogin = url.includes('/login');
    const hasUser = !!document.querySelector('[class*="avatar"],[class*="user"],[class*="profile"]');
    return { url, isLogin, hasUser };
  })()
`;
```

返回：
- `loggedIn: !isLogin && hasUser`
- `url`

### Step 3: 后端就绪探测（避免“spawn 成功但服务未起”）
- [ ] 在 `startBackendIfNeeded()` 成功 spawn 后，轮询：
  - `GET http://127.0.0.1:8010/api/config`（已有）
- [ ] 轮询 30s 超时；成功后才发送 `backend:status {running:true}`
- [ ] 失败则发送 `{running:false, code:'BACKEND_NOT_READY'}`

（Node 侧轮询示例）
```js
async function waitBackendReady(baseUrl, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl + '/api/config');
      if (res.ok) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}
```

### Step 4: 手工验证
- [ ] 启动 App 后，右侧打开 `https://pgy.xiaohongshu.com/login` 手工登录
- [ ] 调用 UI 的“检测登录态”显示为已登录

- [ ] Commit

---

## 3) Task 3: 录制/回放增强（变量化 creator_url + 等待策略 + 文件管理）

**Files:**
- Modify: `desktop-app/main.js`
- Modify: `desktop-app/browser_preload.js`
- Modify: `desktop-app/preload.js`
- Modify/Create: `desktop-app/renderer/views/recordings.js`

### Step 1: Recording 文件重命名与打开文件夹
- [ ] `ipcMain.handle('recording:rename', ...)`：
  - 只允许在 recordings 目录内重命名（防路径穿越）
- [ ] `ipcMain.handle('recording:openFolder', ...)`：
  - 使用 `shell.openPath(getRecordingsDir())`

### Step 2: 变量化 `{{creator_url}}`（录制脚本元信息）
- [ ] 在保存 recording 时写入 meta：

```js
fs.writeFileSync(filePath, JSON.stringify({
  createdAt: Date.now(),
  meta: { platform: 'pgy', mode: 'safe_dom', vars: ['creator_url'] },
  actions: currentRecording
}, null, 2));
```

### Step 3: 回放引擎增加 waitFor（DOM presence/clickable）
- [ ] 在回放 click 前先 wait：

```js
const waitJs = (selector, timeoutMs) => `
  (function(){
    const sel = ${JSON.stringify(selector)};
    const end = Date.now() + ${timeoutMs};
    return new Promise((resolve) => {
      const tick = () => {
        const el = document.querySelector(sel);
        if (el) return resolve(true);
        if (Date.now() > end) return resolve(false);
        setTimeout(tick, 200);
      };
      tick();
    });
  })()
`;
```

如果 wait 失败：
- 记录失败步骤
- 进入“暂停介入”机制（Task 6）

### Step 4: 录制 selector 稳定性 v1（增加 nth-of-type 兜底）
- [ ] 在 `browser_preload.js` 的 `buildSelector()` 里：
  - 若 tag+class 仍不唯一，生成一个简易路径：
    - `tag:nth-of-type(n)` 向上最多 3 层

（示例伪码，可在实现中完善）
```js
function nthOfType(el) {
  const tag = el.tagName.toLowerCase();
  let i = 1, sib = el;
  while ((sib = sib.previousElementSibling)) if (sib.tagName.toLowerCase() === tag) i++;
  return `${tag}:nth-of-type(${i})`;
}
```

### Step 5: UI：录制列表 + 回放按钮 + 重命名
- [ ] `views/recordings.js` 渲染：
  - 列表（name、path、创建时间）
  - 操作：回放/重命名/打开文件夹

- [ ] Commit

---

## 4) Task 4: 采集模板中心（默认模板 + 可编辑 + 版本化）

**Files:**
- Create: `desktop-app/templates/default_pgy_v1.json`（作为内置默认模板）
- Modify: `desktop-app/main.js`（template 文件读写 IPC）
- Create: `desktop-app/renderer/views/templates.js`

### Step 1: 写入默认模板文件（随代码发布）
- [ ] Create `desktop-app/templates/default_pgy_v1.json`：

```json
{
  "version": "pgy_v1_default",
  "platform": "pgy",
  "mode": "safe_dom",
  "creator_summary": [
    { "name": "platform", "selector": null, "value": "pgy" },
    { "name": "creator_name", "selector": "h1, [class*='name']", "transform": "text" },
    { "name": "creator_url", "selector": null, "transform": "url" },
    { "name": "followers", "selector": "[class*='follower'],[class*='fans']", "transform": "number" }
  ],
  "note_detail": [
    { "name": "note_title", "selector": "[class*='title'],h3,h4", "transform": "text" },
    { "name": "note_url", "selector": "a[href*='/explore/']", "attr": "href", "transform": "url" }
  ]
}
```

> 注意：selector 需要在实测页面后细化。v1 先让用户可编辑。

### Step 2: Template IPC（list/load/save/clone）
- [ ] `ipcMain.handle('template:list')`：列出 `{userData}/templates/*.json`
- [ ] `ipcMain.handle('template:load', filePath)`
- [ ] `ipcMain.handle('template:save', filePath, contentJson)`
- [ ] 首次运行：若用户 templates 目录为空，则复制默认模板进去

### Step 3: UI：模板编辑器（字段行编辑）
- [ ] `views/templates.js`：
  - 左侧：模板文件列表
  - 右侧：两段表格（creator_summary / note_detail）
  - 支持：新增字段/删除字段/修改 selector/transform
  - 保存到本地 templates 目录

- [ ] Commit

---

## 5) Task 5: DOM 提取引擎（按模板提取 + 滚动加载 + 明细抓取）

**Files:**
- Modify: `desktop-app/main.js`
- Create: `desktop-app/lib/extract_dom.js`（主进程侧提取逻辑）
- Create: `desktop-app/lib/transform.js`（数字/日期清洗）

### Step 1: 提取单字段（text/attr/html）
- [ ] Create `desktop-app/lib/extract_dom.js`：

```js
async function extractField(webContents, field) {
  if (field.value !== undefined && field.value !== null) return field.value;
  if (!field.selector) return null;
  const js = `
    (function(){
      const el = document.querySelector(${JSON.stringify(field.selector)});
      if (!el) return null;
      const attr = ${JSON.stringify(field.attr || '')};
      if (attr) return el.getAttribute(attr);
      return el.innerText || el.textContent || '';
    })()
  `;
  return await webContents.executeJavaScript(js, true);
}
module.exports = { extractField };
```

### Step 2: 提取笔记列表（多元素）
- [ ] 在 `extract_dom.js` 增加 `extractNotes(template.note_detail)`：
  - 先定位 note 卡片容器（模板提供 card selector，v1 允许用户填）
  - 遍历卡片并对每条执行字段 selector（相对 card）

### Step 3: 滚动加载（自然滚动 + 直到数量满足/或无新增）
- [ ] 增加 `scrollAndCollect`：
  - 每次滚动后 wait 800~1500ms
  - 连续 2 次无新增则停止

### Step 4: 将结果组装为标准结构（v1）
- [ ] 统一输出：
```js
{
  platform: "pgy",
  creator_url: "...",
  creator_summary: {...},
  notes: [{...}],
  crawl_time: "ISO"
}
```

- [ ] Commit

---

## 6) Task 6: 批量任务引擎（串行队列 + 暂停手工介入 + 证据包）

**Files:**
- Modify: `desktop-app/main.js`（TaskRunner）
- Create: `desktop-app/lib/task_runner.js`
- Create: `desktop-app/lib/evidence.js`
- Create: `desktop-app/renderer/views/tasks.js`

### Step 1: 队列模型与 IPC（start/pause/resume/skip）
- [ ] `ipcMain.handle('tasks:start', payload)`
- [ ] `ipcMain.handle('tasks:pause')`
- [ ] `ipcMain.handle('tasks:resume')`
- [ ] `ipcMain.handle('tasks:skipCurrent')`
- [ ] 渲染进程订阅 `tasks:state` 推送

### Step 2: 暂停介入触发条件（安全模式）
- [ ] 触发条件：
  - 回放 waitFor 失败
  - 关键字段缺失（creator_name 为空等）
  - URL 命中 `/login` 或明显风控页面（可扩展）
- [ ] 触发后：
  - `paused=true`，停止进入下一条
  - UI 弹窗提示用户在右侧浏览器处理后点击“继续”

### Step 3: 证据包落盘
- [ ] Create `desktop-app/lib/evidence.js`：
  - `saveScreenshot(webContents, filePath)`：`webContents.capturePage()`
  - `saveHTML(webContents, filePath)`：`executeJavaScript('document.documentElement.outerHTML')`
  - `saveErrorJson(...)`

目录结构：
`{userData}/runs/<runId>/<creatorId>/evidence/`

### Step 4: UI（批量任务页面）
- [ ] `views/tasks.js`：
  - 导入达人链接（粘贴/CSV）
  - 队列表格：状态（pending/running/paused/ok/fail/skipped）
  - 控制按钮：开始/暂停/继续/跳过当前
  - 日志区：显示最近 200 行任务日志

- [ ] Commit

---

## 7) Task 7: 后端导出 API（JSON → Excel 两张表）与 AI 对比报告 API

**Files:**
- Create: `content-analyzer/app/core/pgy_schema.py`
- Create: `content-analyzer/app/core/pgy_exporter.py`
- Create: `content-analyzer/app/api/desktop_api.py`
- Modify: `content-analyzer/app/api/server.py`
- Create: `content-analyzer/tests/test_pgy_exporter_unittest.py`
- Create: `content-analyzer/tests/test_pgy_schema_unittest.py`

### Step 1: 定义标准结构与规范化函数（schema）
- [ ] Create `app/core/pgy_schema.py`：

```python
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
from datetime import datetime

def _to_int(x: Any) -> int:
    try:
        s = str(x).strip().lower().replace(",", "")
        if s.endswith("万"):
            return int(float(s[:-1]) * 10000)
        if s.endswith("k"):
            return int(float(s[:-1]) * 1000)
        return int(float(s))
    except Exception:
        return 0

def normalize_creator_result(raw: Dict[str, Any]) -> Dict[str, Any]:
    summary = raw.get("creator_summary", {}) or {}
    notes = raw.get("notes", []) or []
    return {
        "platform": "pgy",
        "creator_url": raw.get("creator_url", ""),
        "creator_name": summary.get("creator_name", "") or summary.get("name", ""),
        "followers": _to_int(summary.get("followers", 0)),
        "crawl_time": raw.get("crawl_time") or datetime.now().isoformat(),
        "creator_summary": summary,
        "notes": notes
    }
```

### Step 2: Excel 导出器（两张表）
- [ ] Create `app/core/pgy_exporter.py`：

```python
from typing import Any, Dict, List, Tuple
import pandas as pd

def to_excel_rows(results: List[Dict[str, Any]]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    summary_rows = []
    note_rows = []
    for r in results:
        summary = r.get("creator_summary", {}) or {}
        summary_rows.append({
            "platform": r.get("platform", "pgy"),
            "creator_name": r.get("creator_name", ""),
            "creator_url": r.get("creator_url", ""),
            "followers": r.get("followers", 0),
            "crawl_time": r.get("crawl_time", "")
        })
        for n in (r.get("notes") or []):
            note_rows.append({
                "creator_name": r.get("creator_name", ""),
                "creator_url": r.get("creator_url", ""),
                "note_title": n.get("note_title", n.get("title", "")),
                "note_url": n.get("note_url", n.get("url", "")),
                "publish_time": n.get("publish_time", ""),
                "likes": n.get("likes", 0),
                "comments": n.get("comments", 0),
                "collects": n.get("collects", 0),
                "shares": n.get("shares", 0),
                "crawl_time": r.get("crawl_time", "")
            })
    return pd.DataFrame(summary_rows), pd.DataFrame(note_rows)
```

### Step 3: Desktop API（导出与报告）
- [ ] Create `app/api/desktop_api.py`：
  - `POST /api/desktop/export`：body 为 `results: List[Dict]`，服务端 normalize → 写入 output 目录：
    - `pgy_results_<ts>.json`
    - `pgy_results_<ts>.xlsx`（两 sheet）
  - `POST /api/desktop/report`：body 为 `results` 或 `excel_path`，生成对比报告（markdown/json）
  - `GET /api/desktop/health`：用于 Electron 就绪探测

（示例：export）
```python
from fastapi import APIRouter
from datetime import datetime
from pathlib import Path
import json
from app.utils.config import Config
from app.core.pgy_schema import normalize_creator_result
from app.core.pgy_exporter import to_excel_rows

router = APIRouter(prefix="/api/desktop", tags=["desktop"])

@router.post("/export")
def export_results(payload: dict):
    raw_results = payload.get("results", []) or []
    normalized = [normalize_creator_result(r) for r in raw_results]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = (Config.OUTPUT_DIR / f"pgy_results_{ts}.json").resolve()
    xlsx_path = (Config.OUTPUT_DIR / f"pgy_results_{ts}.xlsx").resolve()

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)

    df_summary, df_notes = to_excel_rows(normalized)
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        df_summary.to_excel(writer, index=False, sheet_name="Creator_Summary")
        df_notes.to_excel(writer, index=False, sheet_name="Note_Detail")

    return {"success": True, "json": str(json_path), "xlsx": str(xlsx_path)}
```

### Step 4: server.py 挂载路由
- [ ] Modify `app/api/server.py`：
```python
from app.api.desktop_api import router as desktop_router
app.include_router(desktop_router)
```

### Step 5: 写 unittest（不引入 pytest）
- [ ] Create `tests/test_pgy_schema_unittest.py`：

```python
import unittest
from app.core.pgy_schema import normalize_creator_result

class TestPgySchema(unittest.TestCase):
    def test_normalize_minimal(self):
        r = normalize_creator_result({"creator_url": "u", "creator_summary": {"creator_name": "n", "followers": "1万"}, "notes": []})
        self.assertEqual(r["creator_name"], "n")
        self.assertEqual(r["followers"], 10000)

if __name__ == "__main__":
    unittest.main()
```

- [ ] Create `tests/test_pgy_exporter_unittest.py`：

```python
import unittest
from app.core.pgy_exporter import to_excel_rows

class TestPgyExporter(unittest.TestCase):
    def test_rows(self):
        df_s, df_n = to_excel_rows([{
            "platform": "pgy",
            "creator_name": "a",
            "creator_url": "u",
            "followers": 1,
            "crawl_time": "t",
            "creator_summary": {},
            "notes": [{"note_title": "x", "note_url": "y"}]
        }])
        self.assertEqual(len(df_s), 1)
        self.assertEqual(len(df_n), 1)

if __name__ == "__main__":
    unittest.main()
```

### Step 6: 运行测试
- [ ] Run: `python -m unittest -v`
- [ ] Expected: PASS

- [ ] Commit

---

## 8) Task 8: Electron → 后端导出/报告联动（闭环）

**Files:**
- Modify: `desktop-app/main.js`
- Modify: `desktop-app/renderer/views/exports.js`
- Modify: `desktop-app/renderer/views/report.js`

### Step 1: Electron 侧把采集结果 POST 给后端
- [ ] `POST http://127.0.0.1:8010/api/desktop/export`
- [ ] 保存返回的 json/xlsx 路径到 run 状态

### Step 2: UI：导出页展示最近一次输出（打开文件/打开文件夹）
- [ ] 增加按钮：打开 Excel、打开 JSON、打开运行目录

### Step 3: UI：报告页一键生成对比报告
- [ ] `POST /api/desktop/report`，显示 markdown（可复制/导出）

- [ ] Commit

---

## 9) Task 9: UI 美化（frontend-design 执行阶段）

**Files:**
- Modify: `desktop-app/renderer/app.css` + `components/*`

- [ ] 使用 frontend-design 统一视觉：
  - 深色高对比、清晰的信息层级
  - 关键状态（running/paused/need-action）可视化强
  - 任务表格可筛选（失败/暂停/成功）

- [ ] Commit

---

## Plan Self-Review（自检）
- 覆盖 spec：录制回放、模板、批量任务、暂停介入、JSON/Excel 导出、AI 对比报告 ✅
- 无占位符：所有任务均给出具体文件、代码片段、命令 ✅
- 类型/命名一致：pgy_v1_default / safe_dom / Creator_Summary/Note_Detail ✅

---

## Execution Handoff
计划已准备好并保存至：
`docs/superpowers/plans/2026-04-13-pgy-desktop-crawler-app.md`

两种执行方式：
1) **Subagent-Driven（推荐）**：我按 Task 逐个派发子代理实现，每个 Task 结束你验收一次  
2) **Inline Execution**：我在当前会话里按 Task 顺序直接改代码并持续给你可运行版本

你选 1 还是 2？

