# TOAST-2 Windows UI 改版交付与功能映射

2026-10-15。源码分支 `ui/toast-2-workbench-redesign`，基点 `0342968d19600f0507ac2434d6f763056aac1319`，版本 `0.1.95`。Windows daemon 与登记值一致；入口 worktree 为 `agent/ui/toast-2`。业务分支从原 main 原地创建，全部原有暂存、未暂存及新增文件保留，未提交或推送。分支本身尚未包含提交；下附独立 UI 补丁供审查，不把旧 GitHub 快照当实现起点。

## 本轮变更

仅改 `renderer/app.js`、`renderer/index.html`，新增 `renderer/workbench.css`。沿用原生 JS 和现有所有视图、IPC、状态与数据格式。深绿导航、浅色工作区、统一表单与危险状态；开始页纵向流程；找达人／复核页增加可键盘操作的区域跳转。路由切换入场错峰、旧页面只读快照淡出后移除；连续切换清掉上次快照，自动保存不重新播放路由动画。导航节点复用，减少状态刷新造成的焦点丢失。减弱运动时取消动画。未引入外部 UI 代码或动效依赖。

原所有具体业务按钮、折叠区、数据列表及事件处理函数均保留。区域导航仅滚动／移焦，不触发采集、准备或外部写入。右侧网页仍按原 BrowserView 坐标管理，保留 88px 顶栏与分隔条契约。

## F01–F32 逐项映射

以下为审查员附件逐 ID 对齐当前工作树的源码保留记录，不能视为每条真实账号验收。UI 变更未编辑 tasks/exports/templates/recordings/report_chat/toolbox 或任何 main/preload/lib；当前文件 SHA256 另附用于审查。

| ID | 旧入口 | 新入口 | 保留内容／源码证据 |
| --- | --- | --- | --- |
| F01 | 全局壳层 | 全局导航 | 日常流程“开始→找达人→复核建联”；辅助入口“采集校准、AI 分析、工具箱”；工具箱可进入录制回放；显示当前应用版本、服务未知/正常/异常；`desktop-app/renderer/app.js:11`、`:60`、`:116`（参考行号，仅用于定位模块） |
| F02 | 顶栏与右侧网页 | 顶栏／网页区／分隔条 | 采集页、自动采集、详情/联系方式、邀约账号、企业邮箱按角色工作；后退/前进/刷新/地址栏、标签切换/可关闭标签、工作区分隔条；受保护标签和自动化锁不能丢；`desktop-app/renderer/app.js:142`、`:342`；`desktop-app/lib/browser_tab_registry.js:1`（参考行号，仅用于定位模块） |
| F03 | 开始 | 开始 | 打开 PGY、人工登录、检测登录、检测后进入已登录工作台、转找达人/复核；保留未检测、检测中、未登录、异常反馈；`desktop-app/renderer/views/login.js:9`（参考行号，仅用于定位模块） |
| F04 | 找达人·来源 | 找达人 → 页内区域导航／原对应操作区 | 已有达人表/链接、PGY 搜索发现、导入+搜索三种来源；保留平台人工筛选和打开搜索入口，“加入当前达人”必须取采集页而非当前任意标签；`desktop-app/renderer/views/tasks.js:16`、`:1077`、`:1224`（参考行号，仅用于定位模块） |
| F05 | 找达人·导入 | 找达人 → 页内区域导航／原对应操作区 | 文本/剪贴板解析、去重、加入候选、替换导入 Excel、合并 Excel、导入摘要和取消/失败反馈；导入初筛状态、优先级、排除原因及备注；`desktop-app/renderer/views/tasks.js:1450`；`desktop-app/lib/pgy_excel.js:1`（参考行号，仅用于定位模块） |
| F06 | 找达人·自然语言指令 | 找达人 → 页内区域导航／原对应操作区 | 前 N 位、全局 A–B 位、分段累计、最近加入的一段；显示实际新增/重复/失败；单次读取最多 50、定位排名上限 100，二者不能混同；页面先加载再执行及连续指令均需可用；`desktop-app/renderer/views/tasks.js:337`、`:1089`；`desktop-app/lib/pgy_candidate_command.js:1`（参考行号，仅用于定位模块） |
| F07 | 找达人·跨页检查点 | 找达人 → 页内区域导航／原对应操作区 | 全局排名、完整有序页锚点；跨 40/80 位人工检查点、至少 90 秒倒计时、继续/结束；未完整读取不把部分结果当成功合并；风险状态优先；`desktop-app/renderer/views/tasks.js:1160`；`desktop-app/lib/pgy_candidate_checkpoint.js:1`；`desktop-app/main.js:5609`（参考行号，仅用于定位模块） |
| F08 | 候选池 | 找达人 → 页内区域导航／原对应操作区 | 搜索、状态筛选、数量、序号、昵称/链接；单条状态、达人/备注、优先级、排除原因编辑与删除；独立滚动、拖动滚动条、顶部/底部跳转、同筛选重绘位置保持；`desktop-app/renderer/views/tasks.js:1620`、`:1830`、`:1971`（参考行号，仅用于定位模块） |
| F09 | 候选池·批量 | 找达人 → 页内区域导航／原对应操作区 | 复制全部/当前筛选 URL；当前筛选设为优先/待复核/排除；移除当前筛选与清空全部的作用范围/确认；再次读取公共搜索事实不得覆盖人工判断；`desktop-app/renderer/views/tasks.js:299`、`:1670`、`:1714`；`desktop-app/renderer/state/candidate_merge.mjs:1`（参考行号，仅用于定位模块） |
| F10 | 候选初筛表 | 找达人 → 页内区域导航／原对应操作区 | 导出 `候选初筛表` 与 `筛选条件`；同事编辑后替换/合并导回，保留未出现在合并文件里的候选与人工字段；此功能不依赖已完成的 run；`desktop-app/renderer/views/tasks.js:1741`；`desktop-app/lib/candidate_sheet.js:1`（参考行号，仅用于定位模块） |
| F11 | 历史任务与草稿 | 找达人 → 页内区域导航／原对应操作区 | 保存/选择/刷新/删除签约搜索任务；恢复来源、条件、渠道/建联计划、候选状态与范围；候选草稿恢复、未保存提示；启动采集使用当前状态且说明未保存；`desktop-app/renderer/views/tasks.js:68`、`:557`、`:623`、`:1260`（参考行号，仅用于定位模块） |
| F12 | 开始采集前 | 找达人 → 页内区域导航／原对应操作区 | 模板选择/刷新，标准与更保守模式；候选/实际采集/备注覆盖/条件/登录/上限摘要；四种范围：最近一段、优先+待复核、只采优先、全部候选；默认排除已排除项，显式“全部候选”语义另行保持；`desktop-app/renderer/views/tasks.js:981`、`:2030`、`:2124`（参考行号，仅用于定位模块） |
| F13 | 采集执行 | 找达人 → 页内区域导航／原对应操作区 | 人工启动确认后串行运行，逐条待处理/处理中/暂停/成功/失败/跳过、当前项、进度及日志；暂停请求/取消待暂停/已暂停/继续，跳过请求/生效，停止请求/已停止须区分；`desktop-app/renderer/views/tasks.js:800`、`:2191`；`desktop-app/lib/task_runner.js:734`（参考行号，仅用于定位模块） |
| F14 | 采集中断与收尾 | 找达人 → 页内区域导航／原对应操作区 | 异常中断恢复旧 run 且先暂停；持久化错误可见；清空执行队列不删除候选和已落盘结果；本次结果/总目录、去复核、历史执行记录、质量问题摘要；用户停止不得自动进入下一流程；`desktop-app/renderer/views/tasks.js:686`、`:2170`、`:2274`；`desktop-app/lib/task_runner.js:460`、`:840`（参考行号，仅用于定位模块） |
| F15 | 采集完成→复核 | 找达人 → 页内区域导航／原对应操作区 | 正常完成的对应 run 转入复核并触发后续联系方式处理条件；仅对实际已选且有结果的目标继续；停止整批不能触发；不能因页面重绘重复启动补采；`desktop-app/renderer/views/tasks.js:800`；`desktop-app/renderer/views/exports.js:1068`（参考行号，仅用于定位模块） |
| F16 | 复核·结果选择 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 下拉/刷新/从任务或执行记录预选 run、自动载入与手动刷新；无结果/加载中/失败/无 raw/有 raw 无达人/筛选后空，分别提供可理解反馈；`desktop-app/renderer/views/exports.js:100`、`:1010`、`:1138`、`:2165`（参考行号，仅用于定位模块） |
| F17 | 复核·逐人编辑 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 新/迁移旧复核行默认不勾选，人工选择“要建联”；保留昵称/指标/推荐理由/来源，跟进状态、执行方式、优先级、邮箱/微信/手机、排除原因与备注；已有保存的人工状态优先；`desktop-app/renderer/views/exports.js:688`、`:766`、`:2222`；`desktop-app/lib/contact_sheet.js:224`（参考行号，仅用于定位模块） |
| F18 | 复核·筛选与批量 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 搜索、已选/未选、有无联系方式/优先级、跟进状态和建联方式；整批全选/清空与当前筛选全选/取消、改状态/方式分开；复制链接/摘要、清空筛选、整批与当前筛选指标；`desktop-app/renderer/views/exports.js:715`、`:1903`、`:1998`（参考行号，仅用于定位模块） |
| F19 | 复核·保存与往返 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 自动保存和手动保存的进度/结果；切 run 前先保存，失败留在旧 run，不能串写；导入编辑后的建联表及待补表，按规范化 PGY URL 匹配，显示更新/未匹配数量；不改 raw；`desktop-app/renderer/views/exports.js:811`、`:879`、`:938`；`desktop-app/lib/contact_review_store.js:1`；`desktop-app/lib/contact_review_excel.js:1`（参考行号，仅用于定位模块） |
| F20 | 复核·联系方式补采 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 打开独立 XHS 登录/检测；显式补采当前筛选中已勾选达人；串行进度、找到/失败计数、暂停请求/已暂停/继续、安全停止、返回筛选结果；默认只补空字段，不覆盖手填、不自动改建联通道；`desktop-app/renderer/views/exports.js:175`、`:257`、`:1550`；`desktop-app/main.js:4197`（参考行号，仅用于定位模块） |
| F21 | 补采身份与失败诊断 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | PGY→XHS 来源对应、目标页稳定再读取；页面加载失败/未找到主页/未登录/风控/超时/未公开分别呈现；持久化来源、时间、状态和错误，防跨行串联；`desktop-app/lib/xhs_contact_enrichment.js:1`；`desktop-app/renderer/views/exports.js:2345`（参考行号，仅用于定位模块） |
| F22 | 建联设置与分流 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 默认方式、微信分组/招呼/智能备注/执行账号、邮件标题正文、PGY 模板和日期；自动分流与逐行通道；设置要随对应复核结果恢复，修改会使相关执行审批/准备失效；`desktop-app/renderer/views/exports.js:488`、`:1248`、`:1377`、`:1400`（参考行号，仅用于定位模块） |
| F23 | 整批/当前筛选导出 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 完整建联工作簿及当前筛选 Excel；6 张 sheet：建联概览、建联表、PGY 邀约表、邮件建联表、小蜜蜂导入表、待补联系方式（实际 sheet 名见下方用例）；显示处理中/成功/失败、计数、实际路径和打开最近文件；文件占用时安全另存；`desktop-app/renderer/views/exports.js:1324`、`:1831`、`:2060`；`desktop-app/lib/contact_sheet.js:607`、`:682`（参考行号，仅用于定位模块） |
| F24 | 原始/资源/精简导出 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 导出原始明细、完整达人资源表；二次导出按列选择、列搜索/分组/预设记忆、剔除全空列；打开结果目录与文件保持路径白名单；`desktop-app/renderer/views/exports.js:1163`、`:1181`、`:2540`；`desktop-app/main.js:7323`、`:7544`（参考行号，仅用于定位模块） |
| F25 | 小蜜蜂准备与审批 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 当前人/通道/话术/标签/备注/执行账号指纹；提交确认、人工确认、内容变化失效、通过后才允许独立执行文件导出；普通复核工作簿与已审批执行文件是两个入口；`desktop-app/renderer/views/exports.js:1631`；`desktop-app/main.js:7484`；`desktop-app/lib/execution_approval.js:1`（参考行号，仅用于定位模块） |
| F26 | 邮箱交接 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 仅当前筛选中明确勾选的已有邮箱，展示/复制有效去重邮箱、无邮箱反馈、打开隔离企业邮箱；不触发补采、不自动写信/填收件人/发送；`desktop-app/renderer/views/exports.js:324`、`:1760`；`desktop-app/main.js:3765`（参考行号，仅用于定位模块） |
| F27 | PGY 邀约账号与单人准备 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 独立账号登录检测；从已采集 run+rowId 主进程解析目标，采集账号查看和邀约账号打开不能混用；入口弹窗→详细表单，模板必填/日期/长度校验，逐项回读并滚动到最终按钮后停住；`desktop-app/renderer/views/exports.js:531`、`:564`、`:2250`；`desktop-app/main.js:3944`、`:4032`（参考行号，仅用于定位模块） |
| F28 | 最终发送控制 | 复核建联 → 当前结果／复核与邀约／达人名单／原高级区 | 准备与真实发送保持分步；当前目标/表单/内容指纹和短时一次性令牌校验，修改、换人、失效需重新准备；提交与平台确认成功不能混作一个状态。本轮及改版验收只验证“不发送”分支；`desktop-app/renderer/views/exports.js:596`、`:2280`；`desktop-app/main.js:4148`（参考行号，仅用于定位模块） |
| F29 | 采集校准 | 采集校准 | 搜索结果三步：昵称字段、重复行容器、语义分页；开始/重做、下一步提示、验证本页、验证跨页(1→2→1)、返回筛选结果；结构和数据就绪分别验证，历史成功需复验；缺前置仍保留动作名及解锁说明；`desktop-app/renderer/views/templates.js:744`、`:1053`；`desktop-app/main.js:4412`、`:4445`（参考行号，仅用于定位模块） |
| F30 | 校准·详情与维护 | 采集校准 | 详情字段点选/网页编号标注、候选块列表/清标记、精确点选兜底；自动笔记卡片/测试当前页；规则刷新/保存/复制/选择/更新时间；高级字段映射、selector/attr/transform 等仍能维护；`desktop-app/renderer/views/templates.js:465`、`:1171`、`:1360`（参考行号，仅用于定位模块） |
| F31 | 工具箱·录制回放 | 工具箱 → 录制回放 | PGY 范围内开始/停止保存、动作计数、文件列表/刷新、回放、重命名/确认删除/开目录；登录敏感输入隐私过滤，越域/风控停止；邮箱与邀约隔离页不得被录制；`desktop-app/renderer/views/recordings.js:41`；`desktop-app/lib/recording_privacy.js:1`；`desktop-app/main.js:6394`（参考行号，仅用于定位模块） |
| F32 | AI 分析与本地结果 | AI 分析／工具箱 | 同步历史 run 到本地 SQLite/知识库、状态、问答/检索证据、导出上次筛选结果；高级配置 provider/模型/API endpoint 与密钥、获取模型列表、重建知识库；工具箱打开结果目录。配置缺失/请求失败不得影响主采集流程；`desktop-app/renderer/views/report_chat.js:121`、`:345`；`desktop-app/renderer/views/toolbox.js:10`；`desktop-app/main.js:7560`（参考行号，仅用于定位模块） |

## 0.1.49 → 当前 0.1.95 增量

旧提交 `824d590` 在本机可读。核对提交差异并同时读取当前未提交／新增文件；大量飞书实现未在旧提交中，不能只用 git diff --stat 覆盖未跟踪增量。

| ID | 当前新旧入口映射 | 保留证据和验收边界 |
| --- | --- | --- |
| W01 | 复核建联 → 蒲公英邀约 → 批量准备 → 不发送，准备下一位／完成本批准备 | exports.js 中 awaiting_confirmation 分支，pgy_invite_batch.test.js；保持同批 ID、索引及冷却，prepared-unsent 计数，不改选中/待建联，不保留可发送 payload；未知发送仍阻断。历史安装版证据不当本轮证据。 |
| W02 | 复核建联 → 飞书项目 → 正式补录 | feishu.js、feishu_workbench.js：独立 enrich 差异预览/写入/回读，精确账号、平台、经纪人匹配，只核对将写字段。正向正式写入仍未验收，本轮禁止云端写入。 |
| W03 | 飞书项目 → 连接／保存／断开／忘记 | feishu_connection_store.js、feishu_plugin_auth.js；safeStorage 持久连接，配置变更撤销旧授权；忘记需确认，用户密钥不入包。 |
| W04 | 飞书项目 → 经纪人检索／显式选择／确认 | feishu_maintainer_store.js、feishu_workbench.js：唯一身份、角色绑定、实时核验、变更撤销；不能默认 API actor 或第一项。 |
| W05 | 飞书项目 → 联系方式查询／来源确认／本地回填／批量回补 | feishu_contact_reader/preview/workflow.js、feishu.js；有界串行查询、确认来源/类型/身份、只补空、run/row 绑定、保存失败回滚，不把本地回填当云端改写。 |
| W06 | 飞书项目 → 正式建档／AI 测试／批量差异表 | feishu_workbench.js、feishu.js：昵称标题、提交时建联时间，正式记录与测试隔离，必填检查不放宽，审批绑定实时计划。 |
| W07 | 飞书项目 → 提交历史／结果不明核对／精确测试清理／本地历史移除 | feishu_record_history.js、feishu_workbench.js、feishu.js；禁止正式记录测试清理，精确对象/批次/标志/新鲜确认，结果不明不自动重试；本地移除不发送 DELETE、保留审计。 |
| W08 | 复核 → 话术模板新增／另存／命名／保存 | exports.js、outreach_templates.mjs：不使用 Electron 不支持的 prompt；自动保存保持输入节点，变更撤销旧准备及审批。 |
| W09 | 复核 → 邀约账号 → 自动打开／准备 | pgy_invite.js/main.js：离开文档 history 更新、目标 commit 证明、有界恢复，收件人/运行/导航世代仍匹配，未知发送不重试。 |
| W10 | 复核 → 补采／导出／Excel 往返 | contact_review_store/contact_sheet.js：字段来源与账号传递、每字段人工值保护、多联系方式保留、预览只因身份及写字段变化失效。 |

所有新增入口仍在原复核页面次序中，飞书位于邀约和达人复核之后。无拆路由造成卸载/重进副作用；未把连接设置自动搬到其他页面。

## 验证记录

结果另见最终评论及 verification.log。浏览器截图是本地真实 renderer + 空数据 IPC 桩，右侧是占位区；不证明真实网站或安装版业务。Electron 测试使用临时 userData、本地虚构平台页，验证源码开发态全链；测试中的虚构发送不代表真实发送授权。未覆盖安装版、真实登录/采集/补录/发送，未打包、安装、发布。

readiness 实测 pass=32 fail=0 block=1，阻断为缺失规范化脱敏实机验收 JSON，不能称全部交付可用。原安装版 0.1.95 及账号数据未操作。

## 提交差异概览（不含未跟踪文件）

```text
 desktop-app/lib/contact_review_store.js            |   58 +-
 desktop-app/lib/contact_sheet.js                   |   14 +
 desktop-app/lib/pgy_candidate_command.js           |   59 +-
 desktop-app/lib/pgy_invite.js                      |  225 ++-
 desktop-app/main.js                                |  925 +++++++--
 desktop-app/package-lock.json                      |    4 +-
 desktop-app/package.json                           |    7 +-
 desktop-app/preload.js                             |   20 +
 desktop-app/renderer/app.css                       |  384 +++-
 desktop-app/renderer/app.js                        |  241 ++-
 desktop-app/renderer/index.html                    |    5 +-
 desktop-app/renderer/state/outreach_templates.mjs  |  212 ++
 desktop-app/renderer/state/review_view_state.mjs   |   14 +-
 desktop-app/renderer/state/workspace_layout.mjs    |  102 +
 desktop-app/renderer/views/exports.js              | 2112 +++++++++++++++-----
 desktop-app/renderer/views/tasks.js                |   11 +-
 desktop-app/tests/contact_review_store.test.js     |   23 +-
 desktop-app/tests/contact_sheet.test.js            |   32 +
 desktop-app/tests/outreach_composer_ui.test.js     |   48 +
 desktop-app/tests/outreach_templates.test.mjs      |   61 +
 .../tests/pagination_autocalibration.test.js       |    3 +
 desktop-app/tests/pgy_candidate_command.test.js    |   69 +-
 .../tests/pgy_invite_account_isolation.test.js     |   43 +-
 desktop-app/tests/review_view_state.test.mjs       |   29 +
 desktop-app/tests/workspace_continuity.test.js     |   34 +
 desktop-app/tests/workspace_layout.test.mjs        |   76 +
 26 files changed, 3893 insertions(+), 918 deletions(-)
```

## 最终实测结果

- 源码基线与改后均执行 package.json 中全部 7 个 pretest、42 个 test 命令，通过。PATH 未含 npm/node；直接用已有 Node 逐条执行原脚本，没有安装依赖。最初 pnpm 试跑尝试自动安装但因 PATH 缺 pnpm 在执行前失败，未据此判断测试结果。
- 最终 Windows Electron 源码开发态隔离回归通过：三次单人准备、防重放、延迟目标 commit、三人同批不发送完成（一次确认、实际本地发送点击 0、保留勾选）、虚构页面确认发送与缺失 commit 恢复；真实网络被阻断。100 人滚动 top=8064、外层2070、首行位置 -186.875px 前后一致；连续输入/焦点/落盘、模板新增/另存/原模板保留通过。
- 分隔条鼠标拖动、键盘调整、重载恢复、0.75/1/1.25 三档 renderer 缩放与原生 BrowserView 对齐通过。全部 Electron 会话测试后正常退出。
- Chromium 实际当前 renderer 六页面截图与错误采集通过；1100/1280 宽度无窗口横向溢出；区域跳转焦点、快速切页退场清理、reduced-motion 无动画通过。
- 带新版视觉层执行 100 人浏览器复核测试、飞书界面假数据测试、950/650/400px 导出工具栏测试均通过，无真实平台访问。
- 业务视图与 lib 文件哈希在改版后及最终回归后相同；只含本轮 UI 修改的补丁通过 git apply --check --reverse。
- 源与入口记忆检查通过，入口8单测通过；安全审计通过；git diff --check 通过。readiness pass=32 fail=0 block=1（缺规范化实机记录）。

截图 before/after 为同一隔离 renderer 空数据，不包含用户数据、凭证或真实达人。native 截图与 electron-result.json 为最终源码的全链虚构数据。未打包、安装、改写当前安装版、真实邀约或飞书写入；不能推导已通过新布局的安装版/真实账号验收。所交 UI 补丁依赖当前 0.1.95 工作树及原有未提交文件，不能直接套用到旧 0.1.49。

末次截图检查修正：筛选栏、跟进编辑字段与批量邀约面板改按工作区容器宽度换行。带100人假数据的1600/1280/1100宽度全部筛选控件边界检查通过；批量按钮完整可见。末次Electron完整回归再次通过，外层滚动2070前后一致。
