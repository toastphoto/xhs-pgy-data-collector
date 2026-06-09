# PGY Resource Table v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把蒲公英达人页（主页/数据概览/笔记数据/粉丝分析）中的“指标名+数值”结构化采集，并导出为“达人一行”的媒介资源表 Excel（缺失留空，笔记 Top10）。

**Architecture:**  
1) 采集：扩展模板能力，让每个 tab 输出结构化字段（数值/分布/TopN）。  
2) 存储：raw_result.json 增加 `metrics`（扁平字段）与 `notes_top10`（结构化数组）字段（保留现有 creator_summary/notes）。  
3) 导出：在导出时生成一个资源表 Sheet（达人一行），并可选额外明细 Sheet（v1 先只做资源表）。  

**Tech Stack:** Electron main/preload/renderer，DOM 抽取（executeJavaScript），`xlsx`（SheetJS）导出。

---

## Files to touch

**Modify**
- `desktop-app/templates/default_pgy_v1.json`（或复制出 `default_pgy_resource_v1.json`）：新增字段定义（主页/数据概览/笔记数据/粉丝分析）。
- `desktop-app/lib/extract_dom.js`：增强“按标签提取键值对/分布 TopN/卡片列表 TopN”的通用抽取器。
- `desktop-app/main.js`：`pgy:extractCurrentMultiPage` 合并结果时把 `metrics/notes_top10` 写入 raw_result.json；导出资源表时使用这些字段。
- `desktop-app/renderer/views/templates.js`：模板编辑 UI 增加 `metrics`/`notes_top10` 的显示（可先只在测试输出里展示 JSON）。
- `desktop-app/renderer/views/exports.js`：导出资源表 Sheet（达人一行，缺失留空），文件名默认 `蒲公英采集结果_<runId>.xlsx`。

**Create（可选，推荐）**
- `desktop-app/lib/pgy_extractors.js`：封装各 tab 的抽取逻辑（更清晰，便于维护）。

---

## Column schema (source of truth)

Use spec: `docs/superpowers/specs/2026-04-17-pgy-resource-table-fields.md`

---

### Task 1: 定义 v1 模板（字段字典）

**Files:**
- Create: `desktop-app/templates/default_pgy_resource_v1.json`

- [ ] **Step 1: Copy existing template**

From `desktop-app/templates/default_pgy_v1.json` copy to new file, keep existing basics.

- [ ] **Step 2: Add sections**

Add new sections:
- `metrics`: 扁平字段（A+B+D）
- `notes_top10`: 笔记数组（Top10）

Example skeleton:
```json
{
  "name": "default_pgy_resource_v1",
  "version": "1.0",
  "platform": "pgy",
  "tabs": ["数据概览", "笔记数据", "粉丝分析"],
  "creator_summary": [...],
  "notes": [...],
  "metrics": [
    { "name": "粉丝数", "selector": "...", "transform": "number" }
  ],
  "notes_top10": {
    "cardSelector": "...",
    "limit": 10,
    "fields": [...]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add desktop-app/templates/default_pgy_resource_v1.json
git commit -m "feat: add pgy resource v1 template schema"
```

---

### Task 2: extract_dom 增强：支持 metrics 与 notes_top10

**Files:**
- Modify: `desktop-app/lib/extract_dom.js`

- [ ] **Step 1: Add `extractMetrics(webContents, metricDefs, ctx)`**

For each metric def:
- support `selector` + `transform`
- support **label-value** extraction模式：
  - def: `{name, labelText, valueSelectorRelative}` or `{name, labelSelector, valueSelector}`
  - fallback: scan DOM for a label node containing labelText, then read sibling/nearby number text.

- [ ] **Step 2: Add `extractTopCards(webContents, config, ctx)`**

Input:
```js
{ cardSelector, limit, fields: [{name, selector, transform, attr?}] }
```
Return array of objects (Top10), plus internal debug selectors optional.

- [ ] **Step 3: Unit-ish test via node -c**

Run:
```bash
node -c lib/extract_dom.js
```

- [ ] **Step 4: Commit**

```bash
git add desktop-app/lib/extract_dom.js
git commit -m "feat: support metrics and top10 notes extraction"
```

---

### Task 3: MultiPage 合并：把 metrics/notes_top10 写进 raw_result.json

**Files:**
- Modify: `desktop-app/main.js`

- [ ] **Step 1: In `extractFromTemplate` call path, include new outputs**

Update `extractOnce()` / `extractFromTemplate()` usage to return:
- `creator_summary`
- `notes` (existing)
- `metrics`
- `notes_top10`

Merge rules:
- metrics: `mergePreferNonEmpty`（同名字段优先非空）
- notes_top10: 以“笔记数据 tab”结果为准（若缺失则空数组）

- [ ] **Step 2: Write to `raw_result.json`**

Add to rawResult:
```js
rawResult.metrics = mergedMetrics;
rawResult.notes_top10 = notesTop10;
```

- [ ] **Step 3: Syntax check**

Run:
```bash
node -c main.js
```

- [ ] **Step 4: Commit**

```bash
git add desktop-app/main.js
git commit -m "feat: persist metrics and notes_top10 to raw_result"
```

---

### Task 4: 导出资源表（达人一行）

**Files:**
- Modify: `desktop-app/main.js`（导出逻辑）
- Modify: `desktop-app/renderer/views/exports.js`（UI 展示导出统计）

- [ ] **Step 1: Implement `exportRunToResourceXlsx(runDir)`**

Build a single row per creator using:
- `creator_summary` basics
- `metrics` fields into columns (missing => '')
- `notes_top10` expanded columns `笔记1-标题/阅读/...` etc.

Use `xlsx` to write a single workbook:
- Sheet: `媒介资源表`

File name:
- default `蒲公英采集结果_<runDirName>.xlsx`

- [ ] **Step 2: Add export button in exports page**

Label: `导出媒介资源表（达人一行）`

- [ ] **Step 3: Manual verify**

Run:
1) 批量任务跑一个达人
2) 导出资源表
3) 打开 xlsx 检查列名与缺失留空符合 spec

- [ ] **Step 4: Commit**

```bash
git add desktop-app/main.js desktop-app/renderer/views/exports.js
git commit -m "feat: export pgy resource table xlsx (one row per creator)"
```

---

### Task 5: 回归：保持原有导出（达人汇总+笔记明细）可用

**Files:**
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Keep old export as secondary option**
- [ ] **Step 2: Add a toggle or second button**

---

## Self-review

- Spec 覆盖：A/B/C/D 所有字段均有对应抽取或明确“缺失留空”
- Top10 固定：不滚动、不翻页，避免风控与耗时
- 采集失败不阻塞：单字段失败不影响整体

---

## Execution choice

计划已写入 `docs/superpowers/plans/2026-04-17-pgy-resource-table-v1.md`。两种执行方式：

1) **Subagent-Driven（推荐）**：我按 Task 1~5 逐个派发并验收
2) **Inline Execution**：我在当前会话直接实现并带你验收

你选 1 还是 2？

