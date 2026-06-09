# 达人账号内容分析工具

模拟真实用户行为，安全采集社交媒体数据的分析工具。

## 功能特点

- **多平台支持**: 小红书、抖音、微博、B站
- **反爬策略**: 浏览器指纹伪装、真实行为模拟、智能代理轮换
- **批量处理**: 支持Excel导入，批量采集多个账号
- **数据导出**: 支持Excel、JSON、CSV格式导出
- **苹果风格UI**: 简洁美观的Web界面

## 技术架构

```
content-analyzer/
├── app/
│   ├── api/              # FastAPI后端
│   │   └── server.py
│   ├── core/             # 核心模块
│   │   ├── base_crawler.py      # 基础爬虫类
│   │   ├── browser_engine.py    # 浏览器引擎
│   │   └── storage.py           # 数据存储
│   ├── platforms/        # 平台适配器
│   │   ├── xiaohongshu.py       # 小红书
│   │   └── douyin.py            # 抖音
│   ├── utils/            # 工具模块
│   │   ├── config.py            # 配置管理
│   │   ├── helpers.py           # 辅助函数
│   │   └── logger.py            # 日志配置
│   └── static/           # 前端资源
│       ├── style.css
│       └── app.js
├── data/                 # 数据目录
├── output/               # 输出目录
├── logs/                 # 日志目录
├── main.py              # 启动脚本
├── requirements.txt     # 依赖列表
└── .env.example         # 环境变量示例
```

## 安装部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd content-analyzer
```

### 2. 创建虚拟环境

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 安装Chrome浏览器

工具使用Chrome浏览器进行数据采集，请确保已安装Chrome。

### 5. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，根据需要进行配置：

```env
# 代理配置（可选）
USE_PROXY=false
PROXY_LIST=http://127.0.0.1:1080,http://127.0.0.1:1081

# 请求配置
REQUEST_TIMEOUT=10
MIN_DELAY=3
MAX_DELAY=6
MAX_RETRIES=3

# 浏览器配置
HEADLESS=true
BROWSER_TIMEOUT=30

# API配置
API_HOST=0.0.0.0
API_PORT=8000
```

### 6. 启动服务

```bash
python main.py
```

服务启动后，在浏览器中访问：`http://localhost:8000`

## 使用说明

### 1. 准备账号列表

创建一个Excel文件，包含以下列：

| 平台 | 账号名称 | 主页链接 | 备注 |
|------|---------|---------|------|
| 小红书 | 时尚博主小王 | https://www.xiaohongshu.com/user/xxx | 重点关注 |
| 抖音 | 美妆达人Lisa | https://www.douyin.com/user/xxx | |

### 2. 上传文件

在Web界面中，点击上传区域或拖放Excel文件到指定区域。

### 3. 配置采集参数

- 设置每个账号采集的内容数量（5/10/20/50条）
- 选择要采集的平台类型

### 4. 开始采集

点击"开始采集"按钮，系统将自动：

1. 解析账号列表
2. 启动浏览器模拟真实用户访问
3. 采集用户信息和内容数据
4. 自动处理反爬机制
5. 生成数据报告

### 5. 下载报告

采集完成后，可以下载：

- **Excel报告**: 包含数据汇总和详细数据两个工作表
- **JSON数据**: 原始数据格式，便于二次开发

## 反爬策略

### 浏览器指纹伪装

- 随机User-Agent
- 屏幕分辨率模拟
- WebGL指纹伪装
- Canvas指纹噪声
- WebDriver检测绕过

### 真实行为模拟

- 自然鼠标移动（贝塞尔曲线）
- 模拟人类滚动行为
- 随机点击位置
- 随机延迟（3-6秒）

### 请求策略

- 自动重试机制（最多3次）
- 代理IP轮换
- 请求频率控制
- 错误状态码处理

## 数据字段

### 用户信息

- 平台类型
- 用户ID
- 昵称
- 头像
- 简介
- 粉丝数
- 关注数
- 内容总数

### 内容信息（小红书）

- 笔记ID
- 标题
- 内容
- 封面图
- 图片列表
- 点赞数
- 评论数
- 收藏数
- 分享数
- 发布时间
- 话题标签

### 内容信息（抖音）

- 视频ID
- 标题
- 封面图
- 播放量
- 点赞数
- 评论数
- 分享数
- 发布时间

## API接口

### 上传文件

```http
POST /api/upload
Content-Type: multipart/form-data

file: <Excel文件>
```

### 开始采集

```http
POST /api/crawl/start
Content-Type: application/json

{
    "urls": ["https://...", "https://..."],
    "max_contents": 10,
    "platforms": ["xiaohongshu", "douyin"]
}
```

### 查询任务状态

```http
GET /api/crawl/status/{task_id}
```

### 下载结果

```http
GET /api/download/{filename}
```

## 注意事项

1. **遵守法规**: 请遵守各平台的使用条款和相关法律法规
2. **频率控制**: 建议适当调整请求延迟，避免对平台造成压力
3. **数据隐私**: 采集的数据仅用于个人分析，请勿用于商业用途
4. **账号安全**: 建议使用小号进行数据采集，降低封号风险

## 常见问题

### Q: 启动时提示Chrome未找到？

A: 请确保已安装Chrome浏览器，或设置Chrome路径：

```python
# 在 browser_engine.py 中添加
options.binary_location = "/path/to/chrome"
```

### Q: 采集速度太慢？

A: 可以通过调整 `.env` 中的延迟参数：

```env
MIN_DELAY=1
MAX_DELAY=3
```

注意：过快的采集速度可能导致IP被封。

### Q: 如何配置代理？

A: 在 `.env` 中配置：

```env
USE_PROXY=true
PROXY_LIST=http://user:pass@host:port,http://host:port
```

### Q: 支持哪些平台？

A: 目前支持：
- ✅ 小红书
- ✅ 抖音
- 🚧 微博（开发中）
- 🚧 B站（开发中）

## 开发计划

- [ ] 微博平台支持
- [ ] B站平台支持
- [ ] 数据可视化分析
- [ ] 定时自动采集
- [ ] 数据对比分析
- [ ] 导出PDF报告

## 技术栈

- **后端**: Python 3.9+, FastAPI, Playwright
- **前端**: Vanilla JavaScript, CSS3
- **数据**: Pandas, OpenPyXL
- **浏览器**: Chrome, undetected-chromedriver

## 许可证

MIT License

## 免责声明

本工具仅供学习研究使用，用户需自行承担使用风险。请遵守相关平台的使用条款和法律法规，不得用于非法用途。
