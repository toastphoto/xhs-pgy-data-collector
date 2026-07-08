"""
工具函数集合
"""
import re
import time
import random
from urllib.parse import urlparse, parse_qs
from .config import Config
from .logger import get_logger

logger = get_logger(__name__)

DEFAULT_BROWSER_UA = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/120.0.0.0 Safari/537.36'
)

class ProxyPool:
    """代理池管理"""
    
    def __init__(self, proxies: list = None):
        self.proxies = proxies or []
        self.current_index = 0
        self.failed_proxies = set()
    
    def get_proxy(self) -> dict:
        """获取一个可用代理"""
        if not Config.ALLOW_STEALTH_EVASION:
            logger.warning("代理池默认禁用；如为隔离研究环境，需显式设置 ALLOW_STEALTH_EVASION=true")
            return None
        if not self.proxies:
            return None
        
        available = [p for p in self.proxies if p not in self.failed_proxies]
        if not available:
            self.failed_proxies.clear()
            available = self.proxies
        
        proxy = random.choice(available)
        return {"http": proxy, "https": proxy}
    
    def mark_failed(self, proxy: str):
        """标记代理为失败"""
        self.failed_proxies.add(proxy)
        logger.warning(f"代理 {proxy} 已标记为失败")
    
    def rotate(self):
        """轮换到下一个代理"""
        if self.proxies:
            self.current_index = (self.current_index + 1) % len(self.proxies)

class UserAgentPool:
    """User-Agent池"""
    
    def __init__(self):
        self.ua = None
    
    def get_random_ua(self) -> str:
        """获取随机User-Agent"""
        if not Config.ALLOW_STEALTH_EVASION:
            return DEFAULT_BROWSER_UA
        try:
            if self.ua is None:
                from fake_useragent import UserAgent
                self.ua = UserAgent(fallback=DEFAULT_BROWSER_UA)
            return self.ua.random
        except:
            return DEFAULT_BROWSER_UA

class DelayController:
    """延迟控制器"""
    
    def __init__(self, min_delay: float = 3, max_delay: float = 6):
        self.min_delay = min_delay
        self.max_delay = max_delay
    
    def sleep(self):
        """随机延迟"""
        delay = random.uniform(self.min_delay, self.max_delay)
        logger.debug(f"延迟 {delay:.2f} 秒")
        time.sleep(delay)
    
    def sleep_short(self):
        """短延迟"""
        delay = random.uniform(1, 2)
        time.sleep(delay)

def extract_platform_from_url(url: str) -> str:
    """从URL提取平台名称"""
    domain = urlparse(url).netloc.lower()
    
    if 'xiaohongshu' in domain or 'xhs' in domain:
        return 'xiaohongshu'
    elif 'douyin' in domain:
        return 'douyin'
    elif 'weibo' in domain:
        return 'weibo'
    elif 'bilibili' in domain or 'b23.tv' in domain:
        return 'bilibili'
    else:
        return 'unknown'

def extract_user_id_from_url(url: str) -> str:
    """从URL提取用户ID"""
    parsed = urlparse(url)
    path = parsed.path
    
    patterns = [
        r'/user/([^/?]+)',
        r'/u/([^/?]+)',
        r'/profile/([^/?]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, path)
        if match:
            return match.group(1)
    
    return None

def clean_text(text: str) -> str:
    """清理文本内容"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def format_number(num_str: str) -> int:
    """格式化数字（处理万、千等单位）"""
    if not num_str:
        return 0
    
    num_str = str(num_str).strip()
    
    if '万' in num_str:
        return int(float(num_str.replace('万', '')) * 10000)
    elif '千' in num_str:
        return int(float(num_str.replace('千', '')) * 1000)
    elif 'w' in num_str.lower():
        return int(float(num_str.lower().replace('w', '')) * 10000)
    elif 'k' in num_str.lower():
        return int(float(num_str.lower().replace('k', '')) * 1000)
    else:
        try:
            return int(float(num_str))
        except:
            return 0

ua_pool = UserAgentPool()
