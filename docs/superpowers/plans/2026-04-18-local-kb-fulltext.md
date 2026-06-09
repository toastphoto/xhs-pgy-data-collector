# Local KB Full-text (RAG v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有本地 SQLite（sql.js）历史库之上，增加“达人档案 + Top 笔记标题”的本地全文检索知识库，并让 AI 对话可以通过 `kbSearch + runSql` 联动完成“像知识库一样找 + 像数据库一样筛”的持续对话分析。

**Architecture:** main 进程维护 KB 索引（纯 JS 倒排/全文检索）与持久化；renderer 仅负责按钮与状态展示；AI 工具协议扩展新增 `kbSearch`，并与现有 `runSql` 组合。

**Tech Stack:** Electron main/renderer + sql.js（SQLite）+ minisearch（全文检索，纯 JS）。

---

## Spec

- `docs/superpowers/specs/2026-04-18-local-kb-fulltext-design.md`

---

## Files

**Add**
- `desktop-app/lib/kb/index.js`：构建索引 / 搜索 / 持久化（userData/kb）

**Modify**
- `desktop-app/package.json`：增加 `minisearch`
- `desktop-app/main.js`：新增 IPC（kb:stats/kb:rebuild/kb:search）+ AI 工具协议支持 kbSearch
- `desktop-app/preload.js`：暴露 `desktopAPI.kb.*`
- `desktop-app/renderer/views/report_chat.js`：展示 KB 状态 + “重建知识库”按钮

**Tests**
- `desktop-app/tests/kb.test.js`

---

### Task 1: Add dependency + minimal failing test (RED)

**Files:**
- Modify: `desktop-app/package.json`
- Create: `desktop-app/tests/kb.test.js`

- [ ] **Step 1: Add minisearch dependency**

Add to dependencies:
```json
"minisearch": "^7.1.2"
```

- [ ] **Step 2: Write failing test**

Create `tests/kb.test.js`:
- build index with 2 creators + notes text
- search “通勤 穿搭” returns expected creator
- ensure highlight/snippet exists (optional)

- [ ] **Step 3: Verify failing**

Run:
```bash
node tests/kb.test.js
```
Expected: FAIL (module not found / function missing)

---

### Task 2: Implement KB module (GREEN)

**Files:**
- Create: `desktop-app/lib/kb/index.js`

- [ ] **Step 1: Implement `buildDocumentsFromDb(db)`**

Inputs: sql.js db instance  
Outputs: `{ docs: Array<{id, creator_url, creator_name, xhs_id, region, tags, full_text}> }`

Rules:
- `id = xhs_id || creator_url`
- `full_text = [name,xhs_id,region,tags,metrics_text,notes_titles].join(' ')`

- [ ] **Step 2: Implement `buildIndex(docs)`**

Use MiniSearch with fields:
- fields: `['full_text']`
- storeFields: `['id','creator_url','creator_name','xhs_id','region','tags']`

- [ ] **Step 3: Implement persistence**

Paths under userData:
- `kb/index.json`
- `kb/meta.json`

Provide:
- `saveIndex(index, meta)`
- `loadIndex()`

- [ ] **Step 4: Re-run tests**

Run:
```bash
node tests/kb.test.js
```
Expected: PASS

---

### Task 3: Main IPC for KB + integrate with existing DB

**Files:**
- Modify: `desktop-app/main.js`

- [ ] **Step 1: Add kb IPC**

Handlers:
- `kb:stats` -> meta
- `kb:rebuild` -> load db -> build docs -> build index -> save
- `kb:search` -> load index -> search -> return topN with score

- [ ] **Step 2: Add `kbSearch` tool to ai:chat**

Extend system prompt:
- allow JSON tool call: `{"tool":"kbSearch","query":"...","limit":50}`

When tool requested:
- execute `kb:search` internally
- append result as tool message
- call model again to produce final answer

- [ ] **Step 3: Syntax check**

Run:
```bash
node -c main.js
```

---

### Task 4: Preload + UI controls

**Files:**
- Modify: `desktop-app/preload.js`
- Modify: `desktop-app/renderer/views/report_chat.js`

- [ ] **Step 1: Expose desktopAPI.kb**

```js
kb: { stats, rebuild, search }
```

- [ ] **Step 2: UI**

Add:
- KB 状态行（是否已构建、文档数、更新时间）
- 按钮：重建知识库（调用 kb:rebuild）

---

### Task 5: Manual verification

- [ ] Restart app (`npm run dev`)
- [ ] AI 报告页：先 “同步历史数据”
- [ ] 点 “重建知识库”
- [ ] 在对话里问：`找通勤穿搭 高级感 的达人`
- [ ] 观察：模型先触发 kbSearch，再给出候选/结论

