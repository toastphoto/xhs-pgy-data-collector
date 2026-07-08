"""
配置文件管理
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Config:
    """应用配置类"""
    
    @staticmethod
    def _csv_env_list(key: str, default: str = "") -> list:
        raw = os.getenv(key, default)
        return [item.strip() for item in raw.split(",") if item and item.strip()]
    
    # 规避型研究开关：默认关闭。代理、随机 UA、webdriver 隐藏等旧兼容能力必须同时显式开启此开关。
    ALLOW_STEALTH_EVASION = os.getenv('ALLOW_STEALTH_EVASION', 'false').lower() == 'true'

    # 代理配置：产品主线不使用代理轮换；旧兼容层研究时需显式打开 ALLOW_STEALTH_EVASION。
    USE_PROXY = ALLOW_STEALTH_EVASION and os.getenv('USE_PROXY', 'false').lower() == 'true'
    PROXY_LIST = os.getenv('PROXY_LIST', '').split(',') if USE_PROXY and os.getenv('PROXY_LIST') else []

    # 请求配置
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', 10))
    MIN_DELAY = float(os.getenv('MIN_DELAY', 3))
    MAX_DELAY = float(os.getenv('MAX_DELAY', 6))
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))

    # 旧采集 API 兼容开关：Electron 主线不依赖 /api/crawl/* 或 /api/prelogin/*。
    # 默认关闭，避免后台服务被误用成独立爬虫入口。
    ENABLE_LEGACY_CRAWL_API = os.getenv('ENABLE_LEGACY_CRAWL_API', 'false').lower() == 'true'
    LEGACY_CRAWL_MAX_URLS = int(os.getenv('LEGACY_CRAWL_MAX_URLS', 10))
    LEGACY_CRAWL_MAX_CONTENTS = int(os.getenv('LEGACY_CRAWL_MAX_CONTENTS', 5))
    
    # 浏览器配置：默认打开可见浏览器，避免旧兼容爬虫以 headless 方式误用。
    HEADLESS = ALLOW_STEALTH_EVASION and os.getenv('HEADLESS', 'false').lower() == 'true'
    BROWSER_TIMEOUT = int(os.getenv('BROWSER_TIMEOUT', 30))
    CHROME_ATTACH_EXISTING = os.getenv('CHROME_ATTACH_EXISTING', 'false').lower() == 'true'
    CHROME_DEBUGGER_ADDRESS = os.getenv('CHROME_DEBUGGER_ADDRESS', '127.0.0.1:9222')
    
    # 数据存储
    DATA_DIR = Path(os.getenv('DATA_DIR', './data'))
    OUTPUT_DIR = Path(os.getenv('OUTPUT_DIR', './output'))
    LOG_DIR = Path(os.getenv('LOG_DIR', './logs'))
    
    # API配置
    # 默认只监听本机。Electron 主线会显式传 127.0.0.1，独立启动也不应暴露到局域网。
    API_HOST = os.getenv('API_HOST', '127.0.0.1')
    API_PORT = int(os.getenv('API_PORT', 8010))
    DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'
    API_TOKEN = os.getenv('API_TOKEN', '')
    CORS_ORIGINS = _csv_env_list.__func__(
        'CORS_ORIGINS',
        'http://localhost:8010,http://127.0.0.1:8010'
    )
    
    @classmethod
    def init_dirs(cls):
        """初始化目录"""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOG_DIR.mkdir(parents=True, exist_ok=True)
