# 桌面内嵌版（Electron）

这是“内容采集工具”的桌面壳：左侧内嵌你的原有工具面板（FastAPI 提供的 UI），右侧是**真内嵌浏览器**（Electron `BrowserView`），可以直接手工点击/登录/滚动，并支持最小版“录制/回放”。

## 运行方式（开发态）

1. 先确保你已经装好 Node.js（建议 18+）与 Python（用于启动后端）。
2. 在 `desktop-app` 目录安装依赖：

```bash
npm install
```

3. 启动桌面 App：

```bash
npm run dev
```

默认会自动拉起同级目录的 Python 后端（`../content-analyzer/main.py`），默认端口为 **8010**（可通过 `API_PORT` 覆盖）。

## 如果 npm install 卡在 Electron 下载（国内网络常见）

Electron 依赖安装时会下载 Electron 二进制；如果你遇到超时/断连，可以切到国内镜像：

**macOS / Linux（bash/zsh）**
```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

**Windows（PowerShell）**
```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

## 常用说明

- 右侧地址栏：打开网址后，右侧为真内嵌浏览器。
- “开始录制 / 停止并保存”：会把你在右侧浏览器里的点击/输入/导航记录为 JSON，保存到系统的用户数据目录下的 `recordings/`。
- “回放”：选择一个录制文件后，会在右侧浏览器按步骤回放。

## 环境变量

- `ELECTRON_START_BACKEND=false`：不自动启动 Python 后端（你可以自己手动启动后端）。
- `PYTHON=python3`：指定启动后端的 python 命令（Windows 上也可能是 `py`，或 `C:\\Python311\\python.exe` 这种全路径）。
- `API_HOST` / `API_PORT`：指定后端启动的 host/port（默认 `127.0.0.1:8010`）。

## 验证

```bash
npm test
```

当前测试覆盖：数值/URL 清洗、AI Provider URL 规整、runs 入库、知识库索引、SQLite 基础读写。

## 打包（下一步）

本仓库已写入 `electron-builder` 的基础配置，但要做成真正的一键安装包，还需要把 Python 后端一起打包/内置（Windows/macOS 的方案不同）。
我们可以先把功能跑通，再决定用：

- `PyInstaller`（把 FastAPI 后端打成可执行文件，再随 Electron 一起发）
- 或者把后端改成 Node 侧服务（长期更统一）
