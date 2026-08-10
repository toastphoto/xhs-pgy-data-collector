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
- 顶部“网页标签”栏：`采集页` 是固定且不可关闭的自动化目标；`+ 企业邮箱` 会用独立会话打开企业邮箱，切回采集不会丢失原页面。自动采集、补采或候选分页期间会锁定切换和导航。
- 候选范围跨过第 40/80 位时会进入 90 秒安全暂停，倒计时结束后必须手动继续；继续前会重新检查页面、排名锚点和风险提示。暂停时间不是平台官方安全值，也不保证不会触发风控。
- 翻页确认优先使用列表响应中的页码和达人顺序指纹，可见页码只作为辅助证据；下一页缺失、响应超时、响应页码冲突、重复页或风险提示都会使本次范围失败，部分结果不会自动加入候选。
- “开始录制 / 停止并保存”：会把你在右侧浏览器里的点击/输入/导航记录为 JSON，保存到系统的用户数据目录下的 `recordings/`。
- “回放”：选择一个录制文件后，会在右侧浏览器按步骤回放。
- 批量任务会在系统用户数据目录的 `runs/run_*/` 下保存采集结果、证据截图、`quality_report.json` 和 `task_state.json`，方便排查缺失字段、失败页面和队列进度。

## 环境变量

- `ELECTRON_START_BACKEND=false`：不自动启动 Python 后端（你可以自己手动启动后端）。
- `PYTHON=python3`：指定启动后端的 python 命令（Windows 上也可能是 `py`，或 `C:\\Python311\\python.exe` 这种全路径）。
- `API_HOST` / `API_PORT`：指定后端启动的 host/port（默认 `127.0.0.1:8010`）。

## 验证

```bash
npm test
```

当前测试覆盖：数值/URL 清洗、AI Provider URL 规整、runs 入库、知识库索引、SQLite 基础读写。
同时覆盖导出路径白名单与采集质量报告生成，避免高权限 IPC 和数据质检逻辑回退。

## Windows 打包

Windows 安装包会先用 PyInstaller 生成内置后端，再用 electron-builder 生成 x64 NSIS 安装器。构建必须在 Windows 上执行；macOS 产物不能复用。

1. 创建后端虚拟环境并安装构建依赖：

```powershell
cd content-analyzer
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements_packaging_win.txt
```

2. 安装桌面端依赖并运行测试：

```powershell
cd ..\desktop-app
npm ci
npm test
```

3. 生成目录版、NSIS 安装器或无需安装的便携 EXE：

```powershell
npm run dist:win:dir
npm run dist:win
npm run dist:win:portable
```

目录版位于 `desktop-app/dist/win-unpacked/`，安装器和便携 EXE 位于 `desktop-app/dist/`。三种 Windows 产物都内置 Electron、Python 后端和运行依赖，目标电脑不需要单独安装 Python、Node.js 或项目依赖。NSIS 升级会重建桌面快捷方式；若目标电脑不适合安装或快捷方式受企业策略影响，直接使用便携 EXE。

当前 Windows 包未配置代码签名，适合作为内部验收包；正式外发前必须补充签名并在干净 Windows 设备上验证 SmartScreen、安装、升级和卸载行为。
