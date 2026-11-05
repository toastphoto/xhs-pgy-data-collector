112正式采集登录探测：已留存证据离线核对

范围仅为本机已保存的verify112-first-result.json、formal-acceptance.cjs及acceptance-output/error.log；没有访问当前应用、平台、Cookie、浏览器缓存或恢复点内容，没有补抓页面。原始日志不上传。

固定探测版本为0.1.112，结果内ASAR=dac62f7ffd178f7aa4f0d97ce14f249d5484f159b4be6c12cbd59d734512256c。该验收阶段为2026-10-19 13:57:47.852–13:57:59.654 UTC（北京时间21:57:47.852–21:57:59.654）。

可确认：
- 结果只保存collectionLoggedIn=true、collectionRisk=true及脚本错误类别PLATFORM_RISK_STOP。
- 脚本取值为result.collectionLoggedIn=!!collection.loggedIn、result.collectionRisk=!!collection.riskDetected，随后断言!result.collectionRisk。原始响应和字段类型没有保存。故证据证明归一化真值触发脚本停止，不能把它写成已证实原始riskDetected是boolean true，更不能据此断定平台实际风控。非空对象等值也会被!!转为true，是否属于本次情况交后端精确包核对。
- acceptance-output.log只含阶段状态摘要，PLATFORM_RISK_STOP出现一次；acceptance-error.log为零字节。未发现预设提示词的日志文本，但不能据日志未含文本排除页面曾有提示。
- 预定打开采集角色公共搜索路径/solar/pre-trade/note/kol，等待2000ms后做一次checkLogin；openCollection返回值、提交后实际URL/标题/页面类型均未留存。因此只能说预定入口，不能证明当时停在搜索、首页、登录、验证或加载页。
- 风险断言在邀约入口调用前；页面截图在该断言和邀约检查之后。本次verify112-first-sanitized.png不存在，不能提供当时112平台页面截图。已有105遮挡截图来自回退后的另一轮本地检查，不得充当本次页面证据。

无法补充：具体命中提示、规则ID、页面实际类型、原始riskDetected字段结构，均未留存。没有以现有页面/重复请求补抓，也不从当前状态倒推历史。

脚本身份限制：当前留存formal-acceptance.cjs后续增加过audit分支，报告中其整体SHA256只标识当前留存文件，不作为探测当时冻结脚本的哈希。阶段结果文件的SHA256及字段清单、日志摘要见JSON。没有把整份脚本或原始日志上传。

处置边界：105、QA110、恢复点及既有授权保持，不修改风险检测，不重开已关闭服务P2。最小缺口是先由后端确认精确包riskDetected返回结构及检测链；若仍需历史页面提示，这次记录无法恢复，只能由产品经理汇总必要人工核实，不能自行重复导航、刷新、重登或切角色。安装验收继续暂停；父任务仍进行中。
