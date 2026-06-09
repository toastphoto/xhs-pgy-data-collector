# 本地知识库（RAG v1：全文检索）设计（达人档案 + Top 笔记标题）

## 目标

在现有「AI 对话分析」基础上，新增一个**本地知识库**能力，让用户可以像“搜索知识库”一样通过自然语言/关键词检索达人，再结合 SQLite 的数值筛选能力，完成：

- “找风格/主题相近的达人”（语义/关键词检索）
- “再按指标阈值筛选/排序”（粉丝、互动率、报价、增长等）
- 在对话中持续追问、进一步缩小范围

> 方案选择：**本地全文检索（不引入本地 embedding 模型）**  
> 检索对象：**达人档案 + Top 笔记标题**（用户选择 A）

## 现状基础

已存在：
- 本地 SQLite（sql.js）数据库：`runs/creators/notes`
- AI 对话 UI：支持多轮对话、工具式 SQL 查询（`runSql`）并生成回答

## 核心方案（v1）

### 1) 新增“知识库索引”层（纯本地、可重建）

使用纯 JS 的全文检索索引库（推荐 MiniSearch/Lunr 这类）构建倒排索引。

索引文档（每个达人一条）：
- `creator_id`（优先：xhs_id；兜底：creator_url）
- `creator_name`
- `xhs_id`
- `region/tags`
- `metrics_text`（粉丝/报价/互动率等关键指标，用“可读文本”形式拼接）
- `notes_text`（Top10 笔记标题拼接）
- `full_text`（上述字段汇总，用于检索）

索引文件持久化（userData）：
- `kb/index.json`（索引结构）
- `kb/meta.json`（版本号、最后构建时间、使用的 run 数/creator 数）

> v1 优先“全量重建”即可；后续 v2 再做增量更新。

### 2) 知识库检索接口（main 进程提供 IPC）

新增 IPC：
- `kb:rebuild`：从 SQLite 读取 creators/notes → 生成文档 → 构建索引 → 写入本地文件
- `kb:stats`：返回索引规模、最后更新时间
- `kb:search`：输入 query → 返回 TopN 命中（含 score、命中片段摘要）

### 3) AI 工具调用扩展：kbSearch + runSql

将现有的“工具 JSON 协议”从仅 `runSql` 扩展为：

1) `{"tool":"kbSearch","query":"通勤穿搭 高级感","limit":50}`
2) `{"tool":"runSql","sql":"SELECT ... FROM creators WHERE creator_url IN (...) AND ... LIMIT 200"}`

对话策略（v1 推荐）：
- 当用户表达“风格/内容/主题”诉求时：先 kbSearch 找候选人
- 当用户表达“阈值/排序/增长”诉求时：直接 runSql
- 当两者同时出现：kbSearch → 将候选 id 交给 runSql 精筛 → AI 输出结论

### 4) UI（v1 最小）

在 AI 对话页增加两块信息：
- 知识库状态（是否已构建、文档数、更新时间）
- 按钮：`重建知识库`（首次必须点一次；后续可做自动）

对话仍保持“持续对话”，并允许用户追问：系统会携带上下文继续调用工具。

## 关键设计点

### 数据主键（保持未来上内网可迁移）

- `creator_id` 优先用 `xhs_id`（若有）
- 无 `xhs_id` 时用 `creator_url` 作为稳定标识（run 内已去重）

### 可解释性

kbSearch 返回结果应包含：
- 命中达人基本信息（name/id）
- 命中摘要（例如命中笔记标题片段）
- score（用于排序）

### 性能与规模

v1 默认：
- kbSearch `limit <= 200`
- 结果太多时提醒用户加限定词/加阈值

## 验收标准（v1）

1) 同步历史数据后，可一键重建知识库索引
2) 对话中提出“风格/主题/关键词”能命中达人列表
3) 对话中提出“阈值筛选”能用 SQL 精筛并输出结果
4) 支持持续对话：第二轮追问仍能基于上轮结果继续筛选/比较

