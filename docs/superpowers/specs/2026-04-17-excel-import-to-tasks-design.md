# 批量任务页：导入 Excel 生成队列（设计）

## 目标

在「批量任务」页新增“导入 Excel”能力：用户选择媒介资源表（.xlsx），系统自动识别并提取 **蒲公英链接**（`pgy.xiaohongshu.com`），同时携带 **达人昵称**，去重后自动填入队列输入框，并提供导入预览与统计。

## 用户故事

- 作为媒介，我有一份 Excel（达人昵称 + 小红书主页链接 + 蒲公英链接），希望一键导入后自动生成批量任务队列，不需要手工复制链接。

## 范围

### 必做

- 批量任务页增加按钮「导入 Excel」
- 弹出文件选择器，选择 `.xlsx/.xlsm/.xls`
- 解析所有 sheet（跳过空 sheet），提取：
  - 达人昵称：优先匹配列名包含 `达人昵称/昵称/达人/博主/KOL`
  - 蒲公英链接：优先匹配列名包含 `蒲公英/pgy`；若列缺失则扫描整行字符串中包含 `pgy.xiaohongshu.com` 的 URL
- 去重：按“蒲公英链接”去重
- 将去重后的 URL 列表写入批量任务输入框（与“解析并加入队列”一致）
- 展示导入统计（总行数/提取条数/去重后条数/扫描 sheet 数）与前 10 条预览（昵称+链接）

### 不做（方案一）

- 不解析/补全 note_url（笔记链接）
- 不要求用户手动列映射（先走自动识别；后续可增强）

## 技术方案

- Electron 主进程（`main.js`）实现 `tasks:importExcel` IPC：
  - `dialog.showOpenDialog` 选择 Excel 文件
  - 使用 Node 侧 `xlsx` 包解析（SheetJS）
  - 返回 `{rows, urls, stats}` 给 renderer
- Renderer（`renderer/views/tasks.js`）调用 `desktopAPI.tasks.importExcel()`：
  - 填充输入框与内部草稿 URL 列表
  - 展示预览与统计

## 验收标准

- 在「批量任务」页点击「导入 Excel」后，可选中 Excel 并成功导入
- 能正确识别并提取 `pgy.xiaohongshu.com` 链接（与用户当前媒介资源表一致）
- 队列输入框被自动填充，点击「开始」可正常运行任务队列
- 预览与统计信息正确显示

