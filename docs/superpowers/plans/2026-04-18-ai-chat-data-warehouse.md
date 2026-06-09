# AI Chat + History Data Warehouse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在桌面端新增 AI 对话分析：接入 DeepSeek 官方与 OpenAI 兼容 API；导入历史 runs 数据到 SQLite；支持对话筛选/对比/分析并可导出结果。

**Architecture:** Electron main 负责：数据入库(SQLite)、模型调用(provider)、工具执行；renderer 提供对话 UI 与配置界面，通过 IPC 调用 main。

**Tech Stack:** Electron + Node.js（sqlite3/better-sqlite3 二选一）+ fetch + ExcelJS（导出）.

---

## Spec

- `docs/superpowers/specs/2026-04-18-ai-chat-data-warehouse-design.md`

---

## Files (proposed)

**Create**
- `desktop-app/lib/db/sqlite.js`：SQLite 封装（open/init/migrate/query）
- `desktop-app/lib/db/import_runs.js`：扫描 runs → 解析 raw_result.json → upsert
- `desktop-app/lib/db/normalize.js`：数值标准化（w/万/%/¥/--/暂未入驻）
- `desktop-app/lib/ai/providers.js`：DeepSeek/OpenAI-compat provider
- `desktop-app/lib/ai/tools.js`：db.search/compare/trend/runSql/export 等工具
- `desktop-app/renderer/views/report_chat.js`：AI 对话 UI（替换/扩展现有 report 页）

**Modify**
- `desktop-app/main.js`：新增 IPC：ai:*、db:*；启动时可懒加载 DB
- `desktop-app/preload.js`：暴露 desktopAPI.ai/db
- `desktop-app/renderer/app.js`：views.report 指向 report_chat

---

### Task 1: 选型与初始化 SQLite

**Files:**
- Create: `desktop-app/lib/db/sqlite.js`
- Modify: `desktop-app/package.json`（增加依赖）

- [ ] **Step 1: Choose dependency**

优先 `better-sqlite3`（同步、简单、性能好）。若 Electron 打包/原生编译有问题，回退 `sqlite3`.

- [ ] **Step 2: Implement `openDb()` and migrations**

Create tables:
- runs
- creators
- notes

Include `metrics_json` column.

- [ ] **Step 3: Smoke test**

Run:
```bash
node -e "require('./lib/db/sqlite').openDb().prepare('select 1').get()"
```

---

### Task 2: 数值标准化 normalize

**Files:**
- Create: `desktop-app/lib/db/normalize.js`

- [ ] **Step 1: Implement parsers**

```js
parseCount('4.2w') -> 42000
parsePercent('3.1%') -> 0.031
parseMoney('¥3,000') -> 3000
toNull('--'/'暂未入驻') -> null
```

- [ ] **Step 2: Unit-like checks**

Run:
```bash
node -e "const n=require('./lib/db/normalize'); console.log(n.parseCount('4.2w'), n.parsePercent('3.1%'), n.parseMoney('¥3,000'))"
```

---

### Task 3: 导入历史 runs（增量）

**Files:**
- Create: `desktop-app/lib/db/import_runs.js`
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Scan runs dir**

Reuse existing `getRunsDir()`; for each `run_*` directory:
- find raw_result.json (direct or subdir)
- parse JSON

- [ ] **Step 2: Map into DB**

Upsert:
- runs(run_id, run_dir, created_at, platform)
- creators(run_id + creator_url unique constraint建议；或先简单插入)
- notes (Top10)

Store original `metrics` into `metrics_json` and also fill normalized fields if present.

- [ ] **Step 3: Add IPC**

`db:syncRuns` → returns stats `{runs, creators, notes, updated}`  
`db:stats` → counts

- [ ] **Step 4: Manual**

Run app, click “同步历史数据”，检查 counts 增长。

---

### Task 4: AI Provider（DeepSeek + OpenAI compatible）

**Files:**
- Create: `desktop-app/lib/ai/providers.js`
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Implement provider interface**

```js
async function chat({messages, model, apiKey, baseUrl?}) -> {text, usage?}
```

DeepSeek: fixed baseUrl per官方  
Compat: user baseUrl

- [ ] **Step 2: Add config persistence**

Store in `<userData>/ai_config.json`:
- deepseek: {apiKey, model}
- compat: {baseUrl, apiKey, model}
- activeProvider: 'deepseek'|'compat'

IPC: `ai:getConfig`, `ai:setConfig`, `ai:testConnection`

---

### Task 5: 工具调用：查询/筛选/对比/导出

**Files:**
- Create: `desktop-app/lib/ai/tools.js`
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Implement DB tools**

Functions:
- `searchCreators(filters, limit, orderBy)`
- `trendAnalysis(metric, direction, limit)`
- `compareCreators(urls, metrics)`
- `runSql(sql)`（加开关）

- [ ] **Step 2: Tool calling protocol（简化版）**

v1：采用“函数工具 + 约定 JSON”：
- 先让模型输出 `{"tool":"searchCreators","args":{...}}`
- main 执行工具后再把结果拼回 messages 让模型生成最终回答

（后续 v2 再做完整 function calling）

- [ ] **Step 3: 导出工具**

将工具结果按列导出 Excel（复用现有 ExcelJS 样式）：
- `导出筛选结果.xlsx`

---

### Task 6: Renderer 对话 UI（AI 报告页）

**Files:**
- Create: `desktop-app/renderer/views/report_chat.js`
- Modify: `desktop-app/renderer/app.js`
- Modify: `desktop-app/preload.js`

- [ ] **Step 1: UI skeleton**

页面结构：
- 顶部：模型选择 + 配置按钮 + 数据库统计
- 中部：消息列表（用户/AI 气泡）
- 底部：输入框 + 发送按钮

- [ ] **Step 2: IPC wiring**

Calls:
- `db:stats`
- `db:syncRuns`
- `ai:chat`（携带对话历史）
- `ai:exportLastResult`（可选）

- [ ] **Step 3: Manual verify**

同步历史 → 提问筛选 → 得到列表 → 导出 Excel。

---

## Self-review

- 任何外发数据都来自 DB 查询结果（而非整库文件），但用户允许整批，因此 UI 只做提示与限流
- 入库可重复执行（幂等或去重）
- 不阻塞采集主流程（同步可在用户点击时执行）

