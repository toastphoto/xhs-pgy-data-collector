# 批量任务：显示 runId/runDir 并一键打开目录（设计）

## 目标

在「批量任务」页补齐可追溯信息与快捷入口：

1. 运行开始后展示本次 `runId` 与 `runDir`（保存结果的目录）
2. 提供按钮：
   - 「打开本次运行目录」
   - 「打开 runs 总目录」

## 背景

当前任务日志仅显示“打开/抽取/完成”，用户无法从 UI 直接获知结果落盘路径，导致进入 B（导出 Excel）前需要手工在文件系统里找最新 run 目录。

## 方案

### UI（renderer）

在「批量任务」页顶部（模板选择与预设下方、URL 输入框上方）新增“运行信息”卡片：

- 状态：未运行 / 运行中 / 已结束
- `runId`（若存在）
- `runDir`（若存在，允许复制/选中）
- 操作按钮：
  - 打开本次运行目录（仅当 runDir 存在时启用）
  - 打开 runs 总目录

### IPC（main）

新增两个 IPC（由 preload 暴露）：

- `tasks:openRunDir`：用 `shell.openPath(taskRunner.state.runDir)`
- `tasks:openRunsDir`：用 `shell.openPath(getRunsDir())`

### 数据来源

`TaskRunner` 已在 `tasks:state` 推送中包含 `runId/runDir`，renderer 只需要读取 `state.tasks.runId/runDir` 展示即可。

## 验收标准

- 任务启动后，批量任务页能看到 runId/runDir
- 点击「打开本次运行目录」能打开 Finder/文件管理器到对应目录
- 点击「打开 runs 总目录」能打开 runs 目录
- 不影响原有“开始/暂停/继续/跳过”逻辑

