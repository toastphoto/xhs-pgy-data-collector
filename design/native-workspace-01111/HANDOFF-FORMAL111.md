正式111两项P2修复交接（2026-10-19）

固定基线：正式110安装器 a39dd227387dda38c930f5b7eebb83a119fe3863fdea342e5f6a95291f280efe，ASAR0702d19386d93e7928f2e19e39f63fb1759010bfb5f5e66c419b143c659706f2。新候选安装器SHA256 0df8ccd7621ff8d116a277e5d0d3e2e87970d2585aee1a38172685ff9975b242，109727695字节；ASAR da0b935db3f047590fba1c256cbe7982b754e1478f2eb823e4981cb176ddec29。110正式候选被111替代且禁止升级使用；已安装QA110和正式105保持原包。

源码仍在原design/toast-2-native-01105、HEAD0342968的脏工作树，未提交/推送；候选以manifest与资产哈希固定，不能把HEAD当作候选身份。相对正式110仅main.js、lib/qa_backend_supervisor.js、package.json变化；无新增删除，148个外部资源逐文件一致，2077个ASAR文件读出与有摘要项完整性核验通过。

修复：backend:info和异步状态均绑定本次存活ChildProcess、token、启动代次；无本次拥有后端不进行匿名health/config回退。停止使旧探测失效；失败/超时保留句柄、显示失败，确认exit才清理。退出前等待，失败保留窗口以便再次退出。所有打包渠道使用当前子进程监管，Windows只对本轮spawn的活动子PID树执行taskkill /PID /T，禁止按名称、端口或历史PID清理；父进程IPC断开/死亡触发自有树收尾，失败保留重试。

验证层次：
1. 生产函数配替身定向12项通过，覆盖未拥有/缺后端、迟到探测、旧exit、停止失败false/throw、IPC失败重试、窗口保留与重试、Windows树清理失败；不冒充真实进程验收。
2. 完整pretest/test共49条命令链通过；无npm，用既有Node执行package.json原命令链。新回归单独执行并存于tests/backend_lifecycle.test.js。
3. 最终包Windows解包副本：使用临时bootstrap显式设置userData/sessionData及后端数据根、独立18111、屏蔽外部DNS；正式metadata未启用QA，main及监管源码与最终包逐字节一致。正常退出、异常主进程退出、再次启动退出三轮均记录实际PID树并确认全退出、端口释放；合成保护文件字节未变。测试入口新增和package.main改动仅存在临时副本，不进入候选。不是NSIS安装，不是105升级/回退演练。
4. 本轮没有新真实业务验收、未发邀约/写飞书/读取账号。首次空白保持关闭，IME补验沿用审查待人工结论，不重跑不改结果。

正式数据路径补核：以实际已安装105元数据，使用本机Electron就绪前getPath只读解析，未加载业务主程序。userData及sessionData均为%APPDATA%\content-analyzer-desktop，现场目录存在；当前解析host127.0.0.1、port8010，DATA_DIR/OUTPUT_DIR/LOG_DIR分别为该根content-analyzer\data、output、logs，本次启动环境五项无覆盖。原正式进程不在运行，无法追溯其上一次进程环境；正式升级启动前必须复核实际解析值，不能将本次默认解析冒充历史服务取证。私有绝对路径留在本机FORMAL105-PATHS-LOCAL.json，不上传真实数据。

恢复点方案（尚未创建/验收）：
- 所有者批准具体范围、介质、保管者与恢复办法后，在正式主程序及自有后端全部退出后，由所有者制作并保管一致恢复点。不能把未复制数据说成已有备份。
- 范围包括整个正式userData/sessionData及有效外置后端data/output/logs，包含runs、templates、signing_tasks、contact_reviews、execution_approvals、recordings、db、export_presets、加密连接及工作台/Chromium存储；不上传或移入仓库/QA。
- 升级门槛：新精确包独立审查、恢复点存在且恢复办法可用、隔离Windows环境完成105→111→105合成数据演练、确认本次正式进程树退出及端口归属后，另获升级授权再安装。仅换NSIS目录不隔离身份；本机不覆盖105。
- 回退触发：路径/数据读写/服务退出/关键流程异常即停止操作，保留现场。精确105仅恢复程序，不撤销新数据写入；数据恢复由所有者使用已验证恢复点完成，恢复后复核内容与数据库完整性，不能只比数量。

精确105回退包本轮实读校验：109726667字节，SHA256 c4d28c9eba07080fd2459b6a20f4e22ce0053316737fe781cae7ceb91610a3a4。随本次评论提供三卷可获取副本，不仅是本地路径或哈希。三ZIP解压后把对应Merge脚本放同目录运行，合并并检验SHA256，均不执行安装器。正式111也采用同法。

默认QA窗口交接：本轮复核时旧1084和18010已不存在，旧日志无退出记录，退出原因未确认；本轮没有向这些旧PID发出结束指令。经原PGY-QA-Manual-Handoff任务恢复已安装QA110，当前24656→监管512→后端31680/18010健康，原profile未复制/清理，两角色登录有效性未重新操作验证。任务无自动重启，持久日志和精确句柄位于用户PGY-QA-Handoff/logs；关闭QA窗口停止，任务计划程序运行PGY-QA-Manual-Handoff可重开，存活最佳努力。不要使用旧PID做清理。

剩余：正式安装/运行中拒绝/105升级与回退演练、所有者恢复点、缩放IME人工确认和真实两人授权不发送；readiness仍须读block，不宣称完整稳定版。父任务保持进行中，交产品经理组织精确候选独立复验。
