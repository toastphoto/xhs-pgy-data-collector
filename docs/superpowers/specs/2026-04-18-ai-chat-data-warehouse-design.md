# AI 对话分析（支持 DeepSeek + OpenAI 兼容）设计

## 目标

在桌面端提供一个“AI 对话 + 读取全部历史采集数据 + 可筛选/对比/分析”的完整能力：

1. **对话式**：用户用自然语言提出“找达人/对比/复盘/增长分析”等需求
2. **可读取历史**：AI 能访问**历史所有 run** 的结构化数据（不是只看当前导出的 Excel）
3. **可计算/可审计**：筛选/排序/阈值判断尽量在本地完成，可输出“筛选依据”
4. **多模型接入**：同时支持
   - DeepSeek 官方 API
   - OpenAI 兼容 API（可接聚合 Key、ChatGPT/Gemini 等兼容网关）
5. **数值标准化**：入库时将 `4.2w/3.1%/--/暂未入驻` 等转为可计算字段

## 核心方案

### 1) 本地数据仓库（SQLite）

将 runs 目录中的 `raw_result.json`（以及后续资源表导出结果）增量导入本地 SQLite，提供统一查询能力。

**存放位置：**
- `<userData>/db/content_analyzer.sqlite`（随 App 安装目录隔离，便于持久化）

**数据表（v1）：**

#### `runs`
- `run_id` TEXT PRIMARY KEY
- `run_dir` TEXT
- `created_at` TEXT (ISO)
- `platform` TEXT
- `source` TEXT (optional：批量任务/单次测试/导入Excel等)

#### `creators`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `run_id` TEXT
- `creator_url` TEXT
- `creator_name` TEXT
- `xhs_id` TEXT
- `tags` TEXT
- `region` TEXT
- `updated_at_text` TEXT（原始“数据更新至”文本）

**标准化数值字段（示例，按现有 metrics 列名映射）：**
- `followers` INTEGER NULL
- `likes_fav` INTEGER NULL
- `price_image` INTEGER NULL（图文报价：人民币元）
- `price_video` INTEGER NULL（视频报价：人民币元）
- `exposure_median` INTEGER NULL
- `read_median` INTEGER NULL
- `interact_median` INTEGER NULL
- `interact_rate` REAL NULL（0~1）
- `fans_change_rate` REAL NULL（0~1，粉丝量变化幅度）

此外保留一列 JSON 以容纳扩展字段：
- `metrics_json` TEXT（原始 metrics 扁平键值，便于未来新增字段不迁表）

#### `notes`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `run_id` TEXT
- `creator_url` TEXT
- `creator_name` TEXT
- `idx` INTEGER（1~10）
- `title` TEXT
- `read_cnt` INTEGER NULL
- `like_cnt` INTEGER NULL
- `collect_cnt` INTEGER NULL
- `publish_date` TEXT NULL（YYYY-MM-DD）
- `is_promo` INTEGER NULL（0/1）

> 注：同一达人可能在多个 run 重复出现；v1 先按 run 维度存一份快照，后续可做“按达人去重/聚合”。

### 2) 数值标准化规则（v1）

将字符串统一解析为数值或 NULL：

- `--`、空字符串、`暂未入驻`、`暂无` → `NULL`
- `4.2w` / `4.2万` → `42000`
- `3,400` → `3400`
- `3.1%` → `0.031`
- `¥3,000` / `￥3000` → `3000`

保存两份：
- 标准化字段（用于筛选/计算）
- 原始文本（用于回显/审计）

### 3) AI Provider 接入层

提供统一配置模型接口：

**Provider A：DeepSeek 官方**
- `apiKey`
- `model`

**Provider B：OpenAI 兼容**
- `baseUrl`
- `apiKey`
- `model`

配置保存在本机（userData），并在 UI 中可切换当前模型。

### 4) 对话 + 工具调用（关键：让 AI “读得到历史数据”）

AI 不直接吞全部文件，而是通过“工具函数”访问 SQLite，然后（按你的偏好）可以把较大规模结果发给模型：

**工具集合（v1）：**

1. `db.searchCreators(filters, limit, orderBy)`
2. `db.compareCreators(creatorUrls, metrics)`
3. `db.trendAnalysis(metric, direction, limit)`
4. `db.runSql(sql, params)`（高级模式，可开关）
5. `export.toExcel(rows, columns)`（把筛选结果一键导出精简版）

**外发策略（你已选择）：允许整表/整批**
- v1 仍保留安全阈值：若结果行数过多，UI 提示“行数过大，建议先加过滤条件/或只发送前 N 行”，避免 token 爆炸导致失败

### 5) UI：AI 报告页升级为“对话框”

在 `AI 报告` 页提供：
- 模型选择器（DeepSeek / OpenAI 兼容）
- 配置入口（Key/baseUrl/model）
- 对话区（消息列表）
- 输入框（支持回车发送，Shift+Enter 换行）
- “使用数据范围”提示（当前库中 run 数、达人行数、笔记行数）
- 一键动作：导出本次筛选结果 Excel

### 6) 结果可追溯

每次 AI 回答应附带：
- 本次使用的数据范围（run 数/筛选条件/limit）
- 关键 SQL（或规则）摘要
- 可选：把本次会话保存为 `sessions`（后续 v2）

## 验收标准（v1）

1. 能配置 DeepSeek 与 OpenAI 兼容两套配置并切换
2. 能从 runs 扫描/导入历史 `raw_result.json` 到 SQLite
3. 支持自然语言提问：
   - “筛选符合条件达人”
   - “找增长/下滑达人”
   - “对比几个达人”
4. 支持把筛选结果导出为一个新的 Excel

