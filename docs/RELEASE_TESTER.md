# 每版发布验收器

## 日常入口

把待交付的 **Windows NSIS setup.exe** 拖到 `scripts/release-test.cmd`，或在仓库执行：

```powershell
python -B scripts/release_tester.py run --installer "C:\build\setup.exe"
```

使用已有 Python、Node、Electron、7zip 和 Playwright，不自动安装依赖。可用 `--node`、`--node-path`、`--chrome` 指定已有运行时。批处理支持 `PGY_TEST_PYTHON`；优先发现本机 Codex 缓存运行时。浏览器使用新临时 profile，不复用个人 Chrome。

每次生成独立的 `tmp/release-tests/<批次>/report.html`、`report.json`、逐项日志和原生截图。启动后即持续写报告，中断不会留下“已通过”。不要删除证据目录后继续使用报告。

退出码：`0` 全部自动和真实验收已满足；`1` 有失败或证据失效；`2` 有待验/缺项。首次自动运行通常以 `2` 结束，因为不会自动替人签真实验收。`--source-only` 仅供开发检查，不能放行安装包。失败时看具体日志，不把所有失败都解释为业务故障。

## 自动覆盖

- 执行现有 `package.json` 的完整 `pretest` 和 `test`，含采集恢复、校准/跨页、候选去重、补采、邀约状态机、品牌、飞书身份/查重/报价/写入保护、导入导出、模板及数据持久化。
- 补充滚动和输入稳定性、导出选列、飞书界面、原生加密配置读写、后端生命周期/监管器、QA runtime、邀约 DOM 等独立回归。
- 对**指定安装包**直接解包：检查产品、版本、核心文件、SQLite WASM、Python 后端及明显不应入包的运行文件；记录整个解包文件清单和 SHA256。
- 启动该包内 Python 后端两次：只用随机本地端口和虚构目录，校验实例身份、鉴权、旧采集 API 关闭、退出后释放端口。只发本机 GET，不触发采集。
- 启动该包内 Electron：旧任务可见、恢复后不继续直接停止、结果保留、整个进程重启后可新建采集；同批连续准备、多义品牌选择、WebContents 销毁/重建、滚动输入及布局。
- 邀约原生回归中的发送/防重复断言仅针对拦截的虚构页面，真实账号不登录、不发送。自动结果绝不等于真实平台验收。

测试脚本使用显式白名单，不递归执行所有脚本。`probe_pgy_runtime_safety.py` / `prepare_pgy_live_validation.py`、真实账号探测和安装脚本不进入默认套件。DNS/页面拦截不是操作系统级网络沙箱，新增测试仍必须审查其副作用。

必需测试跳过、超时、缺依赖、只返回零但没完成原生步骤，均不能冒充通过。保留原始失败报告；修复后新开一轮，不改旧结果“变绿”。测试器自身也有退出码、缺项、换包、改源码、超时、环境覆盖和交付拦截回归。

## 真实验收

报告生成五份 `manual-*.json` 待填记录。由实际验收者完成对应场景，保留脱敏说明；不要填写密钥、Cookie、联系人或真实达人链接：

1. 安装升级：精确安装包启动、保留账号/连接/名单/模板、重启和后端服务。
2. 真实采集：可见跨页顺序、暂停/停止/恢复、联系方式正样本及勾选列导出回读。
3. 真实邀约准备：同批连续三位、品牌真实选中及表单回读、最终发送零次。
4. 飞书往返：查找回补、经纪人/同经纪人查重/暂未报价为零、授权的标记测试建单/回读/精确清理。
5. 另一台 Windows：安装提示/签名风险、启动/输入、不同 DPI 布局和登录。

人工记录必须引用此次安装包哈希，填写验收人代号、观察时间、脱敏摘要，并逐项将实际通过的 `checks` 改为 `passed`。不设毫秒级时间一致性或短期过期限制。未验项保留 `pending`，真实写入/清理/安装仍按用户授权操作，不因有清单而自动获得权限。

```powershell
python scripts/release_tester.py record --report "...\report.json" --evidence "...\manual-live-invite-prepare.json"
python scripts/release_tester.py verify --report "...\report.json"
```

`record` 记录的是人的证据，不自动证明操作真实发生，也不是防恶意篡改的签名系统。源代码和包内代码分别标注范围：冻结基线热修包可能与当前源码版本不同，源码测试不能替包内运行背书。

## 交付门槛

必须先跑上述验收，修复失败、补齐真实验收，然后使用：

```powershell
python scripts/release_tester.py deliver --report "...\report.json" --to "releases\approved-版本号"
```

`deliver` 重新核对源码/测试文件、完整检查清单、安装包、解包文件和日志/人工证据，再复制安装包和 `ACCEPTED.json` 到全新目录。失败或待验时不会复制；不覆盖旧目录、不安装、不提交、不推送或上传 Release。

`npm run test:release -- --installer ...`、`npm run release:verify -- --report ...`、`npm run release:deliver -- --report ... --to ...` 是等价入口，要求 `python` 在 PATH。

现有 `dist:win` 仍可产出**候选包**，不是交付通过。每次改版都重新运行；源码、测试或包内容变了就不能复用旧报告。绕过 `deliver` 手工复制文件不是工具能够物理禁止的行为，仓库规则明确不允许将其当作验收交付。

## 边界

此验收器不能保证零 bug，不能证明未覆盖的 UI/账号/平台变更，也不能仅凭包内进程测试证明安装程序、升级、真实输入法和另一台电脑正常。当前范围不含 AI 分析外部服务、企业邮箱真实发信、小蜜蜂执行及最终邀约发送；涉及这些功能的改版需新增相应验收，不得沿用本清单宣称全功能已验。
