"""
FastAPI 后端服务
"""
import asyncio
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
from uuid import uuid4
from threading import Lock

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.utils.config import Config
from app.utils.logger import get_logger
from app.utils.helpers import extract_platform_from_url
from app.core.storage_simple import DataStorage, ExcelImporter
from app.platforms.xiaohongshu import XiaoHongShuCrawler
from app.platforms.douyin import DouYinCrawler
from app.core.ai_analyzer import AIAnalyzer, AnalysisResult

logger = get_logger(__name__)

# 全局任务状态存储
task_status: Dict[str, Dict[str, Any]] = {}

ALLOWED_UPLOAD_SUFFIXES = {".xlsx", ".xls", ".csv"}
ALLOWED_DOWNLOAD_SUFFIXES = {".xlsx", ".xls", ".json", ".csv"}

def _safe_upload_file_path(filename: str) -> Path:
    safe_name = Path(filename or "").name
    suffix = Path(safe_name).suffix.lower()
    if not safe_name or suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(status_code=400, detail="仅支持 .xlsx/.xls/.csv 文件")
    upload_dir = Config.DATA_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    stored_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}{suffix}"
    file_path = (upload_dir / stored_name).resolve()
    upload_dir_resolved = upload_dir.resolve()
    if file_path.parent != upload_dir_resolved:
        raise HTTPException(status_code=400, detail="无效文件名")
    return file_path

def _safe_output_file_path(filename: str, allowed_suffixes: set) -> Path:
    safe_name = Path(filename or "").name
    suffix = Path(safe_name).suffix.lower()
    if not safe_name or suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail="无效文件类型")
    output_dir = Config.OUTPUT_DIR.resolve()
    file_path = (output_dir / safe_name).resolve()
    if file_path.parent != output_dir:
        raise HTTPException(status_code=400, detail="无效文件路径")
    return file_path

def _require_legacy_crawl_api_enabled() -> None:
    if not Config.ENABLE_LEGACY_CRAWL_API:
        raise HTTPException(
            status_code=403,
            detail=(
                "旧采集 API 默认禁用。请使用 Electron BrowserView 主流程；"
                "如需隔离研究旧后端，显式设置 ENABLE_LEGACY_CRAWL_API=true。"
            )
        )

def _validate_legacy_crawl_task(task: "CrawlTask") -> None:
    if not task.urls:
        raise HTTPException(status_code=400, detail="URL 列表为空")
    if len(task.urls) > Config.LEGACY_CRAWL_MAX_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"旧采集 API 单次最多 {Config.LEGACY_CRAWL_MAX_URLS} 个 URL，请拆小批执行"
        )
    if task.max_contents < 1 or task.max_contents > Config.LEGACY_CRAWL_MAX_CONTENTS:
        raise HTTPException(
            status_code=400,
            detail=f"旧采集 API 每个账号最多 {Config.LEGACY_CRAWL_MAX_CONTENTS} 条内容"
        )

class CrawlTask(BaseModel):
    urls: List[str]
    max_contents: int = 10
    platforms: List[str] = []

class CrawlConfig(BaseModel):
    min_delay: float = 3.0
    max_delay: float = 6.0
    max_retries: int = 3
    use_proxy: bool = False

class TaskResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    total: int
    message: str
    result: Optional[List[Dict]] = None
    output_files: Optional[Dict[str, str]] = None

class AIAnalysisRequest(BaseModel):
    content: str
    content_type: str = "笔记"

class AIUserAnalysisRequest(BaseModel):
    user_data: Dict[str, Any]

class AICompareRequest(BaseModel):
    users_data: List[Dict[str, Any]]

class AIReportRequest(BaseModel):
    crawl_data: List[Dict[str, Any]]

class AIAnalysisResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    Config.init_dirs()
    logger.info("应用启动")
    yield
    logger.info("应用关闭")

app = FastAPI(
    title="达人账号内容分析工具",
    description="模拟真实用户行为采集社交媒体数据",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def api_token_auth(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)
    if request.method.upper() == "OPTIONS":
        return await call_next(request)
    if not Config.API_TOKEN:
        return await call_next(request)
    request_token = request.headers.get("X-API-Token", "")
    if not request_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            request_token = auth_header[7:].strip()
    if request_token != Config.API_TOKEN:
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "未授权访问，请提供有效 API Token"}
        )
    return await call_next(request)

# 静态文件
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    """主页"""
    if not Config.ENABLE_LEGACY_CRAWL_API:
        return """
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>旧采集台已禁用</title>
            <style>
                body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;background:#f8fafc;color:#111827;}
                main{max-width:720px;margin:12vh auto;padding:28px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.08);}
                h1{margin:0 0 12px;font-size:26px;}
                p{margin:8px 0;color:#4b5563;line-height:1.7;}
                code{padding:2px 6px;border-radius:6px;background:#f1f5f9;color:#0f172a;}
            </style>
        </head>
        <body>
            <main>
                <h1>旧采集台已禁用</h1>
                <p>当前产品主线是 Electron 内的蒲公英达人工作台，使用可见 BrowserView、人工登录、低频串行和风控暂停。</p>
                <p>旧 FastAPI 采集/预登录入口默认关闭，避免绕过主工作台的安全边界。</p>
                <p>隔离研究旧后端时，需显式设置 <code>ENABLE_LEGACY_CRAWL_API=true</code> 并重新评估风险。</p>
            </main>
        </body>
        </html>
        """
    return """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>达人账号内容分析工具</title>
        <link rel="stylesheet" href="/static/style.css">
    </head>
    <body>
        <div id="root"></div>
        <script src="/static/app.js"></script>
    </body>
    </html>
    """

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传Excel文件
    
    Args:
        file: Excel文件
        
    Returns:
        解析的账号列表
    """
    try:
        file_path = _safe_upload_file_path(file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 解析Excel
        importer = ExcelImporter()
        accounts = importer.import_accounts(file_path)
        
        return {
            "success": True,
            "filename": Path(file.filename or "").name,
            "total": len(accounts),
            "accounts": accounts
        }
        
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/crawl/start")
async def start_crawl(task: CrawlTask, background_tasks: BackgroundTasks):
    """
    开始采集任务
    
    Args:
        task: 采集任务配置
        
    Returns:
        任务ID
    """
    _require_legacy_crawl_api_enabled()
    _validate_legacy_crawl_task(task)

    # 简单串行化：如果已有任务在跑，直接拒绝，避免共享浏览器并发混乱
    if _has_running_task() or _single_task_lock.locked():
        raise HTTPException(status_code=409, detail="已有采集任务正在运行，请等待当前任务完成后再启动")

    task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(task)}"
    
    task_status[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "progress": 0,
        "total": len(task.urls),
        "message": "任务已创建",
        "result": None,
        "output_files": None
    }
    
    # 后台执行采集
    background_tasks.add_task(run_crawl_task, task_id, task)
    
    return {"task_id": task_id, "message": "任务已启动"}

def run_crawl_task(task_id: str, task: CrawlTask):
    """执行采集任务 - 逐个账号顺序采集，每个完成后立即保存"""
    global shared_crawlers
    
    acquired_single_lock = False
    try:
        # 再次兜底：后台线程真正开始执行时获取全局锁，确保单任务运行
        acquired_single_lock = _single_task_lock.acquire(blocking=False)
        if not acquired_single_lock:
            task_status[task_id]["status"] = "failed"
            task_status[task_id]["message"] = "已有采集任务正在运行，请稍后重试"
            return

        task_status[task_id]["status"] = "running"
        task_status[task_id]["message"] = "正在采集..."
        
        results = []
        total = len(task.urls)
        
        # 创建存储实例
        storage = DataStorage()
        
        for idx, url in enumerate(task.urls):
            try:
                task_status[task_id]["progress"] = idx
                task_status[task_id]["message"] = f"正在采集第 {idx+1}/{total} 个账号: {url[:50]}..."
                logger.info(f"开始采集第 {idx+1}/{total} 个账号: {url}")
                
                # 检测平台
                platform = extract_platform_from_url(url)
                
                # 根据平台选择爬虫（使用全局共享实例以保持登录状态）
                if platform == "xiaohongshu":
                    if "xiaohongshu" not in shared_crawlers:
                        logger.info("创建小红书爬虫实例（复用浏览器）")
                        shared_crawlers["xiaohongshu"] = XiaoHongShuCrawler()
                    crawler = shared_crawlers["xiaohongshu"]
                    with _get_crawler_lock("xiaohongshu"):
                        data = crawler.crawl_user(url, task.max_contents)
                elif platform == "douyin":
                    if "douyin" not in shared_crawlers:
                        logger.info("创建抖音爬虫实例（复用浏览器）")
                        shared_crawlers["douyin"] = DouYinCrawler()
                    crawler = shared_crawlers["douyin"]
                    with _get_crawler_lock("douyin"):
                        data = crawler.crawl_user(url, task.max_contents)
                else:
                    logger.warning(f"不支持的平台: {platform}")
                    continue
                
                if data:
                    results.append(data)
                    
                    # 每采集完成一个账号，立即保存中间结果
                    temp_output_files = storage.export(results, formats=['json', 'excel'], 
                                                       suffix=f"_progress_{idx+1}")
                    logger.info(f"第 {idx+1} 个账号采集完成，已保存中间结果")
                    
                    # 更新任务状态中的实时结果
                    task_status[task_id]["result"] = results
                    task_status[task_id]["output_files"] = {
                        k: str(v) for k, v in temp_output_files.items()
                    }
                
                # 延迟避免被封
                time.sleep(3)
                
            except Exception as e:
                logger.error(f"采集失败 {url}: {e}")
                task_status[task_id]["message"] = f"第 {idx+1} 个账号采集失败: {str(e)}，继续下一个..."
                continue
        
        # 注意：不在这里关闭浏览器，保持登录状态供后续任务使用
        # 浏览器会在应用关闭时自动清理
        
        # 保存最终结果
        if results:
            final_output_files = storage.export(results, formats=['json', 'excel'])
            
            task_status[task_id]["output_files"] = {
                k: str(v) for k, v in final_output_files.items()
            }
            task_status[task_id]["result"] = results
        
        task_status[task_id]["status"] = "completed"
        task_status[task_id]["progress"] = total
        task_status[task_id]["message"] = f"采集完成，成功 {len(results)}/{total} 个账号"
        
    except Exception as e:
        logger.error(f"任务执行失败: {e}")
        task_status[task_id]["status"] = "failed"
        task_status[task_id]["message"] = f"任务失败: {str(e)}"
    finally:
        try:
            if acquired_single_lock:
                _single_task_lock.release()
        except Exception:
            pass

@app.get("/api/crawl/status/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """获取任务状态"""
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return TaskResponse(**task_status[task_id])

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """下载结果文件"""
    file_path = _safe_output_file_path(filename, ALLOWED_DOWNLOAD_SUFFIXES)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type='application/octet-stream'
    )

# 预登录任务状态
prelogin_status: Dict[str, Dict[str, Any]] = {}
prelogin_crawler: Optional[XiaoHongShuCrawler] = None

# 全局共享的爬虫实例（保持浏览器实例和Cookie）
shared_crawlers: Dict[str, Any] = {}
_crawler_locks: Dict[str, Lock] = {}
_single_task_lock: Lock = Lock()

def _get_crawler_lock(platform: str) -> Lock:
    """同一平台共享浏览器实例时，用锁避免并发互相抢 driver。"""
    if platform not in _crawler_locks:
        _crawler_locks[platform] = Lock()
    return _crawler_locks[platform]

def _has_running_task() -> bool:
    """是否已经存在运行中的采集任务（简单串行化，先保证稳定）。"""
    for st in task_status.values():
        if st.get("status") == "running":
            return True
    return False

@app.get("/api/platforms")
async def get_supported_platforms():
    """获取支持的平台列表"""
    return {
        "platforms": [
            {"id": "xiaohongshu", "name": "小红书", "icon": "📕"},
            {"id": "douyin", "name": "抖音", "icon": "🎵"},
            {"id": "weibo", "name": "微博", "icon": "📱"},
            {"id": "bilibili", "name": "B站", "icon": "📺"}
        ]
    }

@app.post("/api/prelogin/start")
async def start_prelogin():
    """
    开始预登录流程
    使用全局共享的爬虫实例，保持浏览器会话
    """
    global shared_crawlers
    _require_legacy_crawl_api_enabled()
    
    task_id = f"prelogin_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    prelogin_status[task_id] = {
        "task_id": task_id,
        "status": "running",
        "message": "浏览器已打开，请完成登录",
        "platform": "xiaohongshu_pgy"
    }
    
    try:
        # 使用全局共享的小红书爬虫实例
        if "xiaohongshu" not in shared_crawlers:
            logger.info("创建小红书爬虫实例（预登录）")
            shared_crawlers["xiaohongshu"] = XiaoHongShuCrawler()
        
        crawler = shared_crawlers["xiaohongshu"]
        
        # 初始化浏览器（如果还没初始化）
        crawler._init_browser()
        
        # 打开登录页面（不自动等待登录完成）
        login_url = "https://pgy.xiaohongshu.com/login"
        crawler.browser.open_new_tab(login_url)
        
        return {"task_id": task_id, "message": "浏览器已打开，请完成登录后点击'确认已登录'按钮"}
        
    except Exception as e:
        logger.error(f"预登录启动失败: {e}")
        prelogin_status[task_id]["status"] = "failed"
        prelogin_status[task_id]["message"] = f"启动失败: {str(e)}"
        return {"task_id": task_id, "error": str(e)}

@app.post("/api/prelogin/confirm")
async def confirm_prelogin():
    """
    确认已完成登录，保存Cookie
    不关闭浏览器，保持会话供后续采集使用
    """
    global shared_crawlers
    _require_legacy_crawl_api_enabled()
    
    if "xiaohongshu" not in shared_crawlers or not shared_crawlers["xiaohongshu"].browser:
        return {"success": False, "message": "没有正在进行的预登录任务"}
    
    try:
        crawler = shared_crawlers["xiaohongshu"]
        if not crawler._check_login_status():
            return {"success": False, "message": "当前仍未登录成功，请先在浏览器里完成登录后再确认"}
        
        # 保存Cookie到文件
        if not crawler._save_cookies():
            return {"success": False, "message": "登录态校验通过，但保存 Cookie 失败，请重试"}
        crawler.is_logged_in = True
        for prelogin_task in prelogin_status.values():
            if prelogin_task.get("status") == "running" and prelogin_task.get("platform") == "xiaohongshu_pgy":
                prelogin_task["status"] = "completed"
                prelogin_task["message"] = "预登录完成，Cookie已保存"
        
        # 不关闭浏览器，保持会话
        logger.info("预登录完成，浏览器保持打开状态供后续采集使用")
        
        return {"success": True, "message": "预登录成功，Cookie已保存，可以开始采集"}
        
    except Exception as e:
        logger.error(f"确认登录失败: {e}")
        return {"success": False, "message": f"保存Cookie失败: {str(e)}"}

@app.post("/api/prelogin/cancel")
async def cancel_prelogin():
    """
    取消预登录
    """
    _require_legacy_crawl_api_enabled()
    # 只是重置状态，不关闭浏览器（因为可能还有其他任务在使用）
    return {"success": True, "message": "已取消预登录"}

@app.get("/api/prelogin/status/{task_id}")
async def get_prelogin_status(task_id: str):
    """获取预登录状态"""
    _require_legacy_crawl_api_enabled()
    if task_id not in prelogin_status:
        raise HTTPException(status_code=404, detail="预登录任务不存在")
    
    return prelogin_status[task_id]

@app.get("/api/prelogin/check-cookie")
async def check_prelogin_cookie():
    """检查是否已有保存的Cookie"""
    _require_legacy_crawl_api_enabled()
    cookie_file = Path(Config.DATA_DIR) / "pgy_cookies.json"
    
    if cookie_file.exists():
        try:
            with open(cookie_file, "r", encoding="utf-8") as f:
                cookie_data = json.load(f)
            cookies = cookie_data.get("cookies", [])
            if not isinstance(cookies, list) or len(cookies) == 0:
                return {
                    "has_cookie": False,
                    "message": "Cookie 文件存在但内容无效，请重新预登录"
                }
        except Exception:
            return {
                "has_cookie": False,
                "message": "Cookie 文件损坏或不可读取，请重新预登录"
            }
        return {
            "has_cookie": True,
            "message": "检测到有效 Cookie 文件，可尝试直接采集"
        }
    else:
        return {
            "has_cookie": False,
            "message": "未找到Cookie，建议先进行预登录"
        }

@app.get("/api/prelogin/validate-login")
async def validate_prelogin_login():
    global shared_crawlers
    _require_legacy_crawl_api_enabled()
    cookie_file = Path(Config.DATA_DIR) / "pgy_cookies.json"
    if not cookie_file.exists():
        return {
            "success": True,
            "is_valid": False,
            "message": "未找到 Cookie，请先预登录"
        }
    try:
        if "xiaohongshu" not in shared_crawlers:
            shared_crawlers["xiaohongshu"] = XiaoHongShuCrawler()
        crawler = shared_crawlers["xiaohongshu"]
        crawler._init_browser()
        is_valid = crawler._check_login_status()
        crawler.is_logged_in = is_valid
        return {
            "success": True,
            "is_valid": is_valid,
            "message": "登录态有效，可开始采集" if is_valid else "登录态已失效，请先重新预登录"
        }
    except Exception as e:
        logger.error(f"校验登录态失败: {e}")
        return {
            "success": False,
            "is_valid": False,
            "message": f"登录态校验失败: {str(e)}"
        }

@app.get("/api/config")
async def get_config():
    """获取当前配置"""
    return {
        "min_delay": Config.MIN_DELAY,
        "max_delay": Config.MAX_DELAY,
        "max_retries": Config.MAX_RETRIES,
        "use_proxy": Config.USE_PROXY,
        "headless": Config.HEADLESS,
        "legacy_crawl_api_enabled": Config.ENABLE_LEGACY_CRAWL_API,
        "legacy_crawl_max_urls": Config.LEGACY_CRAWL_MAX_URLS,
        "legacy_crawl_max_contents": Config.LEGACY_CRAWL_MAX_CONTENTS
    }

@app.post("/api/config")
async def update_config(config: CrawlConfig):
    """更新配置"""
    return {
        "message": "运行时配置接口仅回显，不会修改采集安全边界；请通过环境变量和重启调整兼容层配置。",
        "config": config
    }


# ==================== AI 分析 API ====================

@app.post("/api/ai/analyze-content", response_model=AIAnalysisResponse)
async def analyze_content(request: AIAnalysisRequest):
    """
    AI 分析单条内容
    
    Args:
        request: 包含内容文本和类型
        
    Returns:
        分析结果
    """
    try:
        analyzer = AIAnalyzer()
        result = analyzer.analyze_content(request.content, request.content_type)
        
        if result:
            return AIAnalysisResponse(
                success=True,
                data={
                    "summary": result.summary,
                    "keywords": result.keywords,
                    "sentiment": result.sentiment,
                    "tags": result.tags,
                    "suggestions": result.suggestions
                }
            )
        else:
            return AIAnalysisResponse(
                success=False,
                error="分析失败，请检查 API 配置"
            )
            
    except Exception as e:
        logger.error(f"AI 分析失败: {e}")
        return AIAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/api/ai/analyze-user", response_model=AIAnalysisResponse)
async def analyze_user(request: AIUserAnalysisRequest):
    """
    AI 分析用户画像
    
    Args:
        request: 用户数据
        
    Returns:
        用户画像分析结果
    """
    try:
        analyzer = AIAnalyzer()
        result = analyzer.analyze_user_profile(request.user_data)
        
        if result:
            return AIAnalysisResponse(success=True, data=result)
        else:
            return AIAnalysisResponse(
                success=False,
                error="分析失败，请检查 API 配置"
            )
            
    except Exception as e:
        logger.error(f"AI 用户分析失败: {e}")
        return AIAnalysisResponse(success=False, error=str(e))

@app.post("/api/ai/compare-users", response_model=AIAnalysisResponse)
async def compare_users(request: AICompareRequest):
    """
    AI 对比多个用户
    
    Args:
        request: 多个用户数据
        
    Returns:
        对比分析结果
    """
    try:
        analyzer = AIAnalyzer()
        result = analyzer.compare_users(request.users_data)
        
        if result:
            return AIAnalysisResponse(success=True, data=result)
        else:
            return AIAnalysisResponse(
                success=False,
                error="对比分析失败，请检查 API 配置"
            )
            
    except Exception as e:
        logger.error(f"AI 对比分析失败: {e}")
        return AIAnalysisResponse(success=False, error=str(e))

# 本地数据缓存（用于存储最近采集的数据）
local_data_cache: Dict[str, List[Dict[str, Any]]] = {}

@app.post("/api/ai/analyze-local-file")
async def analyze_local_file(request: dict):
    """
    分析本地保存的数据文件
    
    Args:
        request: 包含文件名和分析类型
        
    Returns:
        AI 分析结果
    """
    try:
        filename = request.get('filename')
        analysis_type = request.get('type', 'report')  # report, user, compare
        
        if not filename:
            return {"success": False, "error": "未指定文件名"}
        
        file_path = _safe_output_file_path(filename, {".json"})
        
        if not file_path.exists():
            return {"success": False, "error": f"文件不存在: {filename}"}
        
        # 读取本地数据
        with open(file_path, 'r', encoding='utf-8') as f:
            crawl_data = json.load(f)
        
        if not crawl_data:
            return {"success": False, "error": "文件内容为空"}
        
        # 根据类型执行不同分析
        analyzer = AIAnalyzer()
        
        if analysis_type == 'report':
            report = analyzer.generate_report(crawl_data)
            if report:
                return {"success": True, "report": report}
            else:
                return {"success": False, "error": "报告生成失败"}
                
        elif analysis_type == 'user':
            if len(crawl_data) == 0:
                return {"success": False, "error": "没有用户数据"}
            user_data = crawl_data[0]
            result = analyzer.analyze_user_profile(user_data)
            if result:
                return {"success": True, "data": result}
            else:
                return {"success": False, "error": "用户分析失败"}
                
        elif analysis_type == 'compare':
            if len(crawl_data) < 2:
                return {"success": False, "error": "需要至少 2 个用户才能对比"}
            result = analyzer.compare_users(crawl_data)
            if result:
                return {"success": True, "data": result}
            else:
                return {"success": False, "error": "对比分析失败"}
        else:
            return {"success": False, "error": "未知的分析类型"}
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON 解析失败: {e}")
        return {"success": False, "error": "文件格式错误，无法解析 JSON"}
    except Exception as e:
        logger.error(f"分析本地文件失败: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/ai/analyze-local-content")
async def analyze_local_content(request: dict):
    """
    分析本地文件中的单条内容
    
    Args:
        request: 包含文件名、用户索引和内容索引
        
    Returns:
        AI 分析结果
    """
    try:
        filename = request.get('filename')
        user_index = request.get('user_index', 0)
        content_index = request.get('content_index', 0)
        
        if not filename:
            return {"success": False, "error": "未指定文件名"}
        
        file_path = _safe_output_file_path(filename, {".json"})
        
        if not file_path.exists():
            return {"success": False, "error": f"文件不存在: {filename}"}
        
        # 读取本地数据
        with open(file_path, 'r', encoding='utf-8') as f:
            crawl_data = json.load(f)
        
        if not crawl_data or user_index >= len(crawl_data):
            return {"success": False, "error": "用户索引超出范围"}
        
        user = crawl_data[user_index]
        contents = user.get('notes', []) or user.get('videos', [])
        
        if not contents or content_index >= len(contents):
            return {"success": False, "error": "内容索引超出范围"}
        
        content = contents[content_index]
        content_text = content.get('title', '') + '\n' + content.get('desc', '')
        
        # 分析内容
        analyzer = AIAnalyzer()
        result = analyzer.analyze_content(content_text, content.get('type', '笔记'))
        
        if result:
            return {
                "success": True,
                "data": {
                    "summary": result.summary,
                    "keywords": result.keywords,
                    "sentiment": result.sentiment,
                    "tags": result.tags,
                    "suggestions": result.suggestions
                }
            }
        else:
            return {"success": False, "error": "内容分析失败"}
            
    except Exception as e:
        logger.error(f"分析本地内容失败: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/ai/list-local-files")
async def list_local_files():
    """
    列出所有本地保存的数据文件
    
    Returns:
        文件列表
    """
    try:
        files = []
        for file_path in Config.OUTPUT_DIR.glob("*.json"):
            stat = file_path.stat()
            files.append({
                "filename": file_path.name,
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S'),
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            })
        
        # 按创建时间倒序
        files.sort(key=lambda x: x['created'], reverse=True)
        
        return {"success": True, "files": files}
        
    except Exception as e:
        logger.error(f"列出本地文件失败: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/ai/status")
async def get_ai_status():
    """获取 AI 服务状态"""
    import os
    
    api_key = os.getenv("COMFLY_API_KEY")
    
    return {
        "enabled": bool(api_key),
        "message": "AI 分析已启用" if api_key else "AI 分析未启用，请设置 COMFLY_API_KEY 环境变量"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.API_HOST, port=Config.API_PORT)
