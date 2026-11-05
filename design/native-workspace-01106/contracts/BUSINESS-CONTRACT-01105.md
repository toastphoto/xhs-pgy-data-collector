# 0.1.105 重构业务兼容契约

2026-10-16，只读审查；不修改业务文件、不启动真实账号流程。此清单供设计实现与后续差异复核使用，不代表新版已通过验收。

## 核实基线

- 当前 Windows daemon：`01a13ec9-47ac-73d8-badf-1e17c0822438`，设备 pr，与项目资源一致。
- 源仓库 HEAD：`0342968d19600f0507ac2434d6f763056aac1319`；分支 `design/toast-2-task-flow-prototype`。源码 package.json 为 0.1.105，但存在大量暂存、未暂存及未跟踪修复。HEAD 不能代表当前交付代码，禁止直接用旧提交覆盖。
- 安装目录 `content-analyzer-desktop/resources/app.asar`：实际 package.json 为 0.1.105，62183648 字节，SHA256 `38d1ae79bddd7f88214ef6c9571db8a24a1198859a2206d3671eff93f5385960`，与最新交付记忆一致。
- 交付记忆明确安装包保留旧交付 UI，未包含并行实验 UI。因此“源码同版本”不表示整个工作树与安装包一致；实现者需保留完整脏工作树，并单独记录运行文件差异。
- 本轮未检查可见窗口版本、快捷方式目标、服务身份或实时登录；这些仍需实机验收。历史两人同批不发送记录不能扩展为真实发送或任意规模通过。

## 接口与状态必须保留

| 范围与源码定位 | 契约 | 验证办法 |
| --- | --- | --- |
| `desktop-app/preload.js` | 保留 desktopAPI 的 app/backend/browser/pgy/recording/template/tasks/signingTasks/exports/approvals/contacts/invites/feishu/db/kb/ai 全部命名空间及参数、返回错误码、事件语义。新导航应映射实际接口，不能以模拟状态替代。 | 从 preload 导出调用表，与新界面逐项映射；检查 invoke 参数与 main handler 一致，尤其 runDir、rowId、模板和 sessionId。 |
| `main.js:430`、`:486`、`:554`、`:635`；`lib/browser_tab_registry.js` | 保留 collection、automation、mail、xhs-profile、pgy-invite 角色及原生 WebContents；邀约 persist:pgy_invite 与采集 persist:pgy_default 隔离，邮箱 persist:mail_default。保护搜索页；批次间复用合法实例，不每次重载入口。will-destroy 原生脱离、精确实例退休及旧凭证撤销不能回退。 | browser_tab_registry、task_browser_isolation、workspace_continuity、pgy_invite_account_isolation；原生连续销毁/重建、返回搜索、跨批复用测试。不得在真实响应捕获拥有 debugger 时另接 CDP。 |
| `main.js:2576`；`lib/browser_layout.js` | browser:setLayout 当前输入为 CSS 像素 consoleWidth，只信任主窗口主 frame；原生矩形由主进程结合 zoomFactor 算出。现契约顶栏88、分隔14、工作台最小620、浏览器最小320。改版若改几何须同步 renderer/main，不能仅改 CSS；DPI 不重复乘。 | browser_layout、workspace_layout；原生缩窗、拖拽、缩放和输入焦点/中文输入法。隐藏浏览器不得销毁会话。 |
| `main.js:6163`、`:6213`、`:6266`；`lib/task_runner.js:744`、`:819` | PGY 域限制、50人硬上限、串行低频与冷却、排名40人工检查点；跨页顺序、当前页起点、取消恢复起页、风控停止后不额外导航。暂停/停止请求与已生效状态独立。 | candidate_origin/lifecycle/checkpoint/response_cache、task_runner_safety；分别验证全局前50与35-50，不能互代。DOM校准、数据就绪、历史复验独立显示。 |
| `main.js:4519`、`:4651`；`renderer/views/exports.js:1105` | prepare 与 sendPrepared 分开；token/fingerprint/10分钟有效期绑定 runDir、rowId、达人、formUrl、WebContents、pageGeneration、模板。换人/换批/导航/改内容必须撤销旧确认。提交后不明为 submitted-unconfirmed，人工核验，禁止自动重试。 | pgy_invite_ipc、pgy_invite_batch、pgy_invite_dom；延迟返回、旧按钮、旧页面history事件、目标commit、重放和内容变更测试。真实最终发送另行授权。 |
| `renderer/views/exports.js:1175`、`:1275`、`:2960`；`lib/pgy_invite.js` | awaiting_brand 必须显示软件端候选并明确选择完整品牌，再同批继续；搜索文字不代表选中。保留0.1.105弹层关联、具名候选过滤、真实选中值、隐藏旧搜索框处理和可信Tab离开。unsent-next/complete 与 manual/sent 分开；unsent 不标已建联、不取消勾选，旧发送凭证移除，后续发送重新准备。 | 单次启动至少两人，模糊品牌选择后第二人复用完整品牌，最终unsent2/sent0/manual0/skipped0；无需先点击采集账号，也不能靠停止重启替代同批。 |
| `main.js:679` 至 `:746`、`:8088`、`:8103`；`lib/contact_review_store.js` | userData 的 runs、templates、contact_reviews、recordings、signing_tasks、execution_approvals、db、ai_config 及后端数据保留；原始证据与逐字段人工编辑分离。错误runDir不能静默切最新批次；损坏复核文件不得覆盖。自动保存不能重建当前编辑器。 | contact_review_ipc/store、review_view_state、outreach_composer_ui；跨批延迟回调、连续慢速输入/组合事件、失败重试、重启回读；只用虚构数据。 |
| `main.js:7929` 至 `:8038`、`:8137` 至 `:8182` | 保留原始/资源/建联/当前选择导出及列预设；预览与真实导出同一批次和范围，原值/来源/人工编辑完整传播。小蜜蜂可执行文件须有当前接收人、渠道、内容指纹对应审批。 | export_run_handoff、export_review_safety、resource_export、contact_sheet、execution_approval；实际写出并回读虚构工作簿。本轮不生成可执行小蜜蜂。 |
| `main.js:8047` 至 `:8085`；`lib/feishu_workbench.js` | safeStorage连接/经纪人存储及主renderer主frame授权保留；恢复只恢复连接不恢复业务执行。prepare/execute/reconcile 独立，异步前后校验当前计划与审批。production正式建档、enrich正式补录、AI测试变更/清理隔离。 | feishu_workbench及IPC/renderer、connection_store、record_history；纯本地stub验证模式切换、旧回调失效、operationId恢复。禁止真实飞书写入。 |
| `lib/feishu_quotes.js` | 两平台明确“暂未报价/暂无报价/未报价”映射数值0（文本模式为字符串0）；空/缺失/暂停接单不冒充0，非法价格不吞掉。 | feishu_quotes、feishu_workbench；覆盖新建与enrich两个方向，不改变云端必填配置或填假值。 |

## 交付验证分层

1. 源码：保存完整变更清单与关键文件哈希，完成 npm test、npm run test:invite-dom、安全审计、记忆验证、readiness（报告block数）、git diff --check。此处为待执行清单，本轮没有声称测试通过。
2. 隔离开发态：复用 `tests/pgy_invite_flow.electron.test.js` 的临时 user-data-dir 与阻断外网方式，虚构名单和本地页面；覆盖完整renderer/preload/IPC/main持久化及真实BrowserView。禁止读取/复制操作员profile、Cookie、数据库或模板。
3. 精确安装包：设置 PGY_APP_EXE 指向候选制品重跑同一隔离测试，核对ASAR、后端与Python资源、单实例及实例token；源码通过不能替代制品通过。本轮不覆盖现有安装版。
4. 后续实机验收：需要单独安排，只准备不发送、平台人工登录/验证码；真实云端写入和最终发送仍不在本轮授权范围。

## 本轮限制

只读源码与包身份检查，无业务修改、安装、迁移、云写入、邀约发送或账号截图。默认命令沙箱因 Windows 1326 无法创建进程，已通过获准的沙箱外命令完成只读核对。当前命令环境 PATH 未找到 node，常见 nodejs 安装路径也不存在；没有为此安装依赖或改运行环境。后续测试需先定位已有解释器，不能据历史测试记录声称当前工作树通过。
