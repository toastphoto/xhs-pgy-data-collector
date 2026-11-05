验收记录补强：仅离线审阅，不是新产品候选

固定输入是正式112 ASAR dac62f7ffd178f7aa4f0d97ce14f249d5484f159b4be6c12cbd59d734512256c，以及现有formal-acceptance.cjs。prepare脚本仅离线读取该精确ASAR风险词表，生成静态allowlist并将验收登录分支接入记录模块；未修改desktop-app/main.js或产品风险库，未打包。集成差异见patch，输入和输出SHA256见manifest。

记录顺序：导航返回先脱敏落盘，失败即停；登录探测返回后先存response/ok/riskDetected/loggedIn类型、严格布尔值（非布尔记null）、命中词、角色、阶段和脱敏URL分类，然后才执行停止判断。检查调用异常也先保存统一异常类别，绝不记录异常原文。
风险字段必须是boolean，非布尔/缺失均以类型异常停止，不再使用!!；risk=true优先风险停止；ok非true停止；loggedIn非布尔或false停止；risk=false却带已知命中词记冲突停止。正常且类型正确才允许后续步骤。记录落盘失败直接抛错，后续探测不执行。

隐私：命中词只接受精确112静态词表中的完整已知值，不保存原riskText全文、页面正文、标题、账号、凭证、完整URL、查询参数、fragment或达人路径ID。只按返回URL输出home/search/login/creator/form/unknown等粗分类，这不等于页面DOM或加载完成验收；URL缺失记unknown，命中词缺失/不识别也记unknown，不从预定入口推断实际页面。未采集截图或页面正文。

formal-acceptance-recorded.cjs是现有完整验收脚本的审阅副本，沿用备份/安装分支，本轮仅补记录与类型检查。顶部REVIEW_ONLY_NOT_ACTIVATED保护默认禁止运行，不能用本轮离线通过作为启用真实验收的许可。尚未复制到PGY-Formal-Handoff或替换计划任务；105、QA110、原会话、恢复点及历史探测结果均未操作。仍需人工信息明确及产品经理安排，才在既有授权范围内启用审阅后的脚本。使用时需将模块和静态词表与脚本放同目录，保留固定112版本/ASAR校验。

离线验证：node acceptance-probe-record.test.cjs，21项自然退出0；包含正常/风险/命中词缺失、对象/字符串/数字/null/undefined/array类型、失败返回（含不带风险字段的失败）、调用异常、未登录、字段冲突、两角色导航失败、敏感原文不留存、写入失败阻断及真实文件写出回读。OFFLINE-PROBE-RECORDS.jsonl全部为虚构输入。node --check formal-acceptance-recorded.cjs通过。没有启动Electron、请求平台、运行升级或操作账号；未执行产品全套测试，产品资产未改，不重跑无关用例。

历史证据仍未知：新记录只能改善下一次获安排的探测，不能补回上次命中词或实际页面。本人没有当时页面/提示的可核实观察，不据此回答用户记忆问题。105保持最终安装版本，112最终验收仍暂停，服务P2保持已关闭；父任务继续进行中。
