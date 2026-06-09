# 内网服务最小接口（v1）— 小红书相关信息采集工具

## 目标

为部门提供“统一历史库”的内网服务，使多人各自采集的数据可以汇总到同一个数据库中，并支持：
- 结构化筛选/对比/增长分析（供 AI 工具调用）
- 知识库检索（全文检索 v1；后续可升级向量检索）
- 幂等上传与去重（多人重复上传不污染数据）

---

## 核心原则（幂等 / 去重 / 可追溯）

### 1) Run（一次采集）是最小汇总单元
- 客户端每次采集产生一个 `run_id`（全局唯一）
- 服务器按 `run_id` 幂等：重复上传同一 run 不重复写入

建议 `run_id` 格式：
`run_<ISO时间>_<clientId>`  
例如：`run_2026-04-18T12-34-56-789Z_clientA`

### 2) 达人主键 creator_id
优先级：
1. `xhs_id`（若可获得，优先使用）
2. `creator_url`（或 URL 内稳定 id）

### 3) 推荐数据库唯一约束
- `runs(run_id)` UNIQUE
- `creator_snapshots(run_id, creator_id)` UNIQUE
- `notes(run_id, creator_id, idx)` UNIQUE

> 这样既能保留“同一达人不同日期快照”（用于趋势），又能避免重复导入导致数据膨胀。

---

## 认证（v1）

### 方式
先使用最简单的 API Key：

- Header：`Authorization: Bearer <INTRANET_API_KEY>`
- 服务端校验 token 是否在白名单/数据库中

后续可升级为公司 SSO / 网关鉴权。

---

## API 列表（v1）

### A. 健康检查

#### `GET /health`

返回：
```json
{ "ok": true, "version": "1.0.0" }
```

---

## B. Ingest（上传与幂等）

### 1) 上传一个 run（推荐：一次上传一个 run 的完整数据）

#### `POST /v1/ingest/run`

Header：
- `Authorization: Bearer <INTRANET_API_KEY>`
- `Content-Type: application/json`

Body（示例）：
```json
{
  "run": {
    "run_id": "run_2026-04-18T12-34-56-789Z_clientA",
    "created_at": "2026-04-18T12:34:56.789Z",
    "source": "desktop",
    "operator": "zhangsan",
    "platform": "pgy"
  },
  "creators": [
    {
      "creator_id": "xhs_12345",
      "creator_url": "https://pgy.../blogger-detail/xxx",
      "creator_name": "小王",
      "xhs_id": "xhs_12345",
      "region": "上海",
      "tags": "通勤 穿搭",
      "metrics": {
        "followers": 42000,
        "price_image": 3000,
        "interact_rate": 0.031,
        "fans_change_rate": 0.12
      },
      "metrics_raw": {
        "粉丝数": "4.2w",
        "图文笔记一口价": "¥3,000",
        "互动率": "3.1%"
      }
    }
  ],
  "notes": [
    {
      "creator_id": "xhs_12345",
      "idx": 1,
      "title": "通勤穿搭高级感",
      "read_cnt": 1200,
      "like_cnt": 30,
      "collect_cnt": 5,
      "publish_date": "2026-04-17",
      "is_promo": 1
    }
  ]
}
```

返回（幂等）：
```json
{
  "ok": true,
  "run_id": "run_2026-04-18T12-34-56-789Z_clientA",
  "inserted": { "runs": 1, "creators": 120, "notes": 1200 },
  "skipped": { "creators": 0, "notes": 0 }
}
```

---

### 2) 查询某个 run 是否已存在（可选但实用）

#### `GET /v1/ingest/run/{run_id}`

返回：
```json
{ "ok": true, "exists": true }
```

---

## C. Query（结构化筛选/对比/趋势）

### 1) 全局统计

#### `GET /v1/stats`

返回：
```json
{ "ok": true, "runs": 128, "creators_current": 5600, "snapshots": 24000, "notes": 180000 }
```

---

### 2) 筛选达人（结构化）

#### `POST /v1/query/creators/search`

Body：
```json
{
  "filters": {
    "followers_min": 50000,
    "followers_max": 200000,
    "interact_rate_min": 0.03,
    "price_image_max": 8000,
    "tags_include_any": ["通勤", "穿搭"]
  },
  "order_by": [{ "field": "interact_rate", "direction": "desc" }],
  "limit": 50
}
```

返回：
```json
{ "ok": true, "rows": [ { "creator_id": "xhs_123", "creator_name": "小王", "followers": 123000 } ] }
```

---

### 3) 对比达人

#### `POST /v1/query/creators/compare`

Body：
```json
{
  "creator_ids": ["xhs_1", "xhs_2"],
  "metrics": ["followers", "interact_rate", "price_image", "fans_change_rate"]
}
```

---

### 4) 增长/下滑分析

#### `POST /v1/query/creators/trends`

Body：
```json
{ "metric": "followers", "window_days": 30, "direction": "up", "limit": 50 }
```

---

## D. KB（知识库检索，v1：全文检索）

#### `POST /v1/kb/search`

Body：
```json
{ "query": "通勤穿搭 高级感", "limit": 50 }
```

返回：
```json
{
  "ok": true,
  "hits": [
    { "creator_id": "xhs_123", "creator_name": "小王", "score": 12.3, "snippet": "…通勤穿搭…高级感…" }
  ]
}
```

---

## 错误约定（建议）

- 401：鉴权失败（token 不正确/过期）
- 403：权限不足（无权限访问资源）
- 409：幂等冲突（可选；也可直接返回 ok+skipped）
- 422：参数校验失败（filters 不合法等）
- 500：服务器内部错误
