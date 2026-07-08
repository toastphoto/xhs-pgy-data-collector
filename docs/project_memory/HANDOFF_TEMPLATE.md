# Handoff Template

Use this as a short starter for a new continuation thread:

```text
这是一个简洁续接线程。请先读取当前项目的：
1. AGENTS.md
2. docs/project_memory/ACTIVE_CONTEXT.md
3. docs/project_memory/DECISIONS.md
4. docs/project_memory/HANDOFF_TEMPLATE.md

工作路径：
/Users/workstudio/Downloads/数据收集/xhs-pgy-data-collector

第一批需要读取的文件：
- README.md
- desktop-app/README.md
- desktop-app/package.json
- desktop-app/main.js
- desktop-app/lib/task_runner.js
- desktop-app/lib/signing_task.js
- desktop-app/lib/signing_task_store.js
- desktop-app/lib/quality_report.js
- desktop-app/lib/path_guard.js
- docs/project_memory/PRODUCT_ARCHITECTURE_ROADMAP.md
- docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md
- docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md
- docs/project_memory/MVP_ACCEPTANCE_PLAN.md
- skills/pgy-desktop-workflow/SKILL.md

项目边界：
- 不要提交真实链接、任务表、cookies、.env、日志、runs、数据库或账号/session 信息。
- 不要删除本地数据文件或运行产物，除非用户明确要求。
- 不要绕过平台登录、验证码、风控或速率限制。
- 不要为了“更不容易识别”引入 stealth webdriver、代理轮换、随机 UA、headless 批跑或高并发；安全方向是人工登录、低频串行、遇风控暂停。
- 先判断改动是否属于 desktop-app；content-analyzer 多数情况下是兼容后端/旧参考。

当前状态摘要：
- 主线是 Electron 桌面应用 desktop-app。
- Python/FastAPI content-analyzer 是兼容后端。
- 已有质量报告、任务状态落盘、路径白名单和相关测试。
- 已有第一版建联表复核导出：`desktop-app/lib/contact_sheet.js` + `desktop-app/renderer/views/exports.js` 支持预览、选择/排除、优先级、联系方式、备注、排除原因，并生成 `建联概览`、`建联表`、可执行的 `小蜜蜂导入表` 和 `待补联系方式`。
- `建联概览` 是第一张 sheet，汇总总达人、已选/排除、可进小蜜蜂、待补联系方式和跟进状态分布；导入逻辑仍以明细 sheet 为准，不读取概览。
- `小蜜蜂导入表` 只放已选择且有微信号或手机号的达人；已选择但缺联系方式的达人进入 `待补联系方式`，避免下游 RPA/微信 AI 表混入不可执行行。
- `待补联系方式` 包含空白微信号/手机号列，可给同事补全；导入复核表时会同时读取 `建联表` 和 `待补联系方式`，按蒲公英链接合并回当前 run 的复核状态。
- 复核池和 `建联表` 已支持 `跟进状态`，默认已选为 `待建联`、排除为 `不建联`；结果页可按跟进状态筛选，并可把当前筛选结果批量改状态。这是人工建联跟进状态，不属于小蜜蜂执行表的来源字段。
- 复核状态通过 `desktop-app/lib/contact_review_store.js` 按 run 保存到 Electron `userData/contact_reviews/`，不要提交这些运行期数据。
- 复核池已支持搜索、已选/已排除、缺联系方式、有无优先级、跟进状态筛选，以及对当前筛选结果批量选择/取消/改跟进状态；当前筛选结果也可以复制蒲公英链接、复制简短复核摘要，或单独导出带筛选条件与时间戳的四张 sheet 建联工作簿，方便发给同事补联系方式/复查且不覆盖旧批次。结果页会显示自动保存状态，也有 run 级“保存复核”按钮。
- 复核池顶部会同时显示整批和当前筛选结果里的“可进小蜜蜂/待补联系方式”数量，用于判断当前筛选批次该导出给 RPA 还是交给同事补联系方式。
- 完整建联表或当前筛选 Excel 导出后，结果页会记住最近一次建联工作簿路径，并提供“打开最近建联表”按钮；打开路径仍走 runs/export 白名单。
- `desktop-app/lib/contact_review_excel.js` 支持把同事编辑后的 `建联表` 导回复核池，按蒲公英链接匹配当前 preview，并保存到 run 级复核状态；导入摘要会列出未匹配示例，方便发现选错 run/表格版本。
- 不做 Chrome 浏览器插件路线；重点是蒲公英找达人、筛选复核、生成建联表。
- 小蜜蜂 RPA 只作为可选下游工具，优先支持适配它的 Excel，而不是直接控制它。
- 签约搜索任务已有来源模式：`已有达人表/链接`、`蒲公英搜索发现`、`导入 + 搜索`。上传表/粘贴链接采集要保留；蒲公英搜索发现流程是登录蒲公英、用平台自带条件筛选、打开详情页加入候选，再进入候选初筛和采集。
- 任务页已有轻量蒲公英发现入口：打开达人广场、复制搜索清单、将当前右侧蒲公英达人页加入候选队列。
- 候选队列已支持搜索、按状态筛选、复制全部/当前显示 URL、批量标优先/待复核/排除、编辑达人/备注、状态、优先级、排除原因、删除单条，以及移除当前筛选结果。
- 候选队列可通过 `desktop-app/lib/candidate_sheet.js` 导出采集前 Excel：`候选初筛表` + `筛选条件`，用于采集前给同事确认。
- `desktop-app/lib/pgy_excel.js` 支持把同事编辑后的候选初筛 Excel 导回候选队列，包含状态、优先级、排除原因和备注；任务页区分“替换导入Excel”和“合并Excel”。
- 保存签约搜索任务时会一起保存候选队列和采集范围；选择历史任务会恢复筛选条件、候选链接、达人/备注、状态、优先级、排除原因和采集范围。
- 候选队列或采集范围有本地改动但尚未保存任务时，任务页和启动采集确认框都会提示；保存成功或加载历史任务后清除。
- 启动采集默认只跑“优先 + 待复核”，不会跑已排除达人；也可以切为“只采优先”或“全部候选”。
- 候选阶段的状态/优先级/排除原因会写入 run `meta.json`，建联复核预览会把它们作为默认值；复核页保存的 per-run 编辑优先级更高。
- 启动采集前会显示候选数、本次采集数、备注覆盖、模板、筛选条件和蒲公英登录态，并在启动时弹出确认摘要。
- 任务页和执行记录已有“复核导出”入口，可切到结果页并预选对应 runDir。
- 结果页会自动加载当前选中/预选 run 的建联复核预览；仍保留手动刷新。
- 结果页会区分无 run、加载中、加载失败、无 `raw_result.json`、有 raw 但无达人行、筛选后为空等状态。
- 已有 `docs/project_memory/PGY_ANTI_BOT_SAFETY_AUDIT.md`。当前安全方向是：主线 Electron BrowserView、人工登录/搜索、串行低频、默认单批最多 50 个、风险页暂停。旧 `content-analyzer/` Selenium 兼容层的 stealth/headless/random-UA 行为已默认关闭或挂到显式研究开关，不作为产品主线。
- 真实账号安全验收必须按 `docs/project_memory/PGY_LIVE_VALIDATION_PROTOCOL.md` 记录 sanitized JSON；不要把达人链接、账号、cookies、截图或任务表提交进仓库。
- `采集校准` 已按 Codex 注释体验改为右侧网页直接点编号块保存规则；左侧候选列表和手动精确点选仍是 fallback。不要把 selector/DOM/transform 重新暴露为普通用户主流程。
- 任何 branch/service/auth/port 状态都需要重新检查。

建议第一步验证：
- git status --branch --short
- lsof -nP -iTCP:8010 -sTCP:LISTEN || true
- lsof -nP -iTCP:8000 -sTCP:LISTEN || true
- cd desktop-app && npm test
- python scripts/verify_project_memory.py
- python scripts/audit_pgy_safety.py
- python scripts/probe_pgy_runtime_safety.py
- python scripts/check_mvp_readiness.py
- python scripts/check_mvp_readiness.py --run-commands
- python scripts/prepare_pgy_live_validation.py --output tmp/pgy_live_validation_YYYYMMDD.json
- python scripts/validate_pgy_live_validation.py --print-template
- python scripts/test_pgy_live_validation.py

下一步目标：
先根据用户新请求选择一个小目标推进；不要依赖旧聊天记忆直接下结论。
```
