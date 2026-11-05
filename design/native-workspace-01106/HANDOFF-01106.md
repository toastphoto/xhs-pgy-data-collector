0.1.106 原生工作台改版候选

这是接入真实业务的 Electron 实现，供独立审查和后续安装验收；尚未覆盖现有安装版，也未宣称真实业务验收完成。

基线与范围

- Windows daemon 与登记一致。重新读取源码 package 和安装 ASAR 均为0.1.105；安装ASAR SHA256为38d1ae79bddd7f88214ef6c9571db8a24a1198859a2206d3671eff93f5385960。实际exe版本元数据0.1.105.0。没有读取操作员Cookie、账号、数据库或模板。
- 从完整当前工作树新建 `design/toast-2-native-01105`，HEAD仍0342968；所有已有暂存、未暂存和新增业务修复保留，没有用旧分支覆盖最新文件。源与安装运行资产比对见baseline-01105.json；主进程/preload/业务视图与安装包相同，app.js/index.html与未交付workbench.css是已有实验差异。
- 新增 native-workflow.js、native-workbench.css，改app.js/index.html接入；只移动原业务DOM，不替换业务处理函数。调整原有 renderer/state/workspace_layout.mjs 与 lib/browser_layout.js 的共享最小宽度和对应测试；顶栏88 CSS px、DIP换算、WebContents/partition/锁/文档依据均保留。package和lock仅递增版本0.1.106。
- 入口记忆冲突已解决：保留用户最新0.1.105真实安装记录，原型信息改为历史记录。未解决冲突为0；未提交、推送或发布。

视觉与流程

浅灰白基底、石墨/灰绿操作色、轻边框、细密层级与留白；按钮不用蓝色。按照 Apple [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials) 以及 Linear [calmer interface](https://linear.app/now/behind-the-latest-design-refresh) 的层级原则：导航退后、内容优先、透明材质只用于控件层，内容保持实色。实际读取官方规范；未复制第三方代码、素材或SF字体，使用系统字体。

复核与交付分为五个阶段，名单筛选提前，补采渐进展开，话术/品牌/批次状态独立呈现；完整流程保留所有原入口。窄工作区导航自动收成图标，拖宽后缩窗再放大保留原宽度偏好。按钮/状态/输入过渡与路由进退场沿现有动画系统；阶段进入有轻量过渡，支持方向键/Home/End、焦点样式和reduced-motion。未引入框架或动画依赖。

验证

- 配置的pretest7组+test42条命令，使用已有Node逐条执行；修改前及最终源码均通过。没有为此安装npm或依赖。
- 真实Electron + 独立临时userData + PGY本地协议夹具 + 阻断外网：六轮销毁重建、三次直接准备、延迟品牌选择及同批复用、三人不发送推进、原有虚构发送/重放检查、100行滚动、慢速编辑、模板新增/另存/保存、分隔条与重载、0.75/1/1.25原生缩放。不是实际PGY账号验收。
- 首轮默认静态品牌夹具在改动前源和0.1.105精确包均报BRAND_FOCUS_FAILED；保留失败记录，完整回归使用已有PGY_BRAND_SEARCH_TEST=1的交互品牌夹具，未放宽业务检查。脚本仅通过新增“完整流程”公开入口承接旧全页流程，并聚焦本次隔离窗口。
- 新阶段显隐、840/1100/1600缩窗和回放大、原生缩放几何、控制台与无蓝按钮另有定向检查。标准renderer截图无法含原生BrowserView；合成截图API没有取得测试窗口，原生capturePage/CDP截图均返回黑图（旧0.1.105对照也相同），正文读取确认是本地夹具。没有拼接或冒称完整桌面截图；本轮缺少BrowserView可见像素的合成截图验收，须审查员在实际窗口补核。布局/生命周期/输入及真实IPC的通过与这一截图限制分开。
- 安全审计通过；readiness 32/0/1，block为缺少新版脱敏真实验证记录。没有把退出0当全业务通过。

制品与审查

安装包位于 `desktop-app/dist-native-workspace-01106`，未签名、未安装。仅生成可审查候选；保留现有0.1.105安装版。后端资源直接沿用已核实0.1.105最终候选，31源文件及115后端/Python文件逐字节比对；应用运行资产与当前源码逐文件核对。准确字节数与SHA256见release-verification.json，候选程序原生回归见artifact-native-result.json。

审查请先读FUNCTION-MAP-01106.md及业务/前端独立契约。优先复验阶段切换是否保留原对象、异步状态、模板焦点、导出范围；再核对BrowserView缩窗/原生缩放。不得把本地夹具当真实登录、品牌或实际发送证据。

尚未实测：新版安装、真实账号/登录/站点重定向、真实中文IME、云端飞书读写、真实最终邀约、其他机器。未覆盖的真实验证需另行组织。禁止通过安装此候选覆盖现有数据来“完成”本轮测试；本轮不迁移数据、不真实发送、不写飞书、不生成可执行小蜜蜂文件。
