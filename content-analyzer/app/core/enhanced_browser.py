#!/usr/bin/env python3
"""
增强版浏览器引擎 - 整合GitHub参考方案的安全策略
"""
import json
import random
import time
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from seleniumwire import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from loguru import logger

from app.utils.config import Config


class EnhancedBrowserEngine:
    """增强版浏览器引擎 - 更安全的反爬策略"""
    
    def __init__(self):
        self.driver: Optional[webdriver.Chrome] = None
        self.wait: Optional[WebDriverWait] = None
        self.cookie_path = Path(Config.DATA_DIR) / "cookies.json"
        
    def _setup_options(self) -> Options:
        """配置Chrome选项 - 参考GitHub方案的反指纹配置"""
        options = Options()
        
        # ===== 反自动化检测配置 =====
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        # ===== 禁用可能暴露自动化的服务 =====
        options.add_experimental_option("prefs", {
            "gcm": {"enabled": False},
            "push_messaging": {"enabled": False},
            "service_worker": {"enabled": False},
            "profile.managed_default_content_settings.images": 2,  # 可选：禁用图片加速加载
        })
        
        # ===== 证书和日志配置 =====
        options.add_argument("--ignore-certificate-errors")
        options.add_argument("--ignore-ssl-errors")
        options.add_experimental_option("excludeSwitches", ["enable-logging"])
        
        # ===== 基础配置 =====
        if Config.HEADLESS:
            options.add_argument("--headless=new")
        
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        
        # ===== 窗口尺寸 =====
        # 参考方案使用800x600，模拟普通用户窗口
        options.add_argument("--window-size=800,600")
        
        # ===== User-Agent =====
        user_agents = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ]
        options.add_argument(f"--user-agent={random.choice(user_agents)}")
        
        # ===== 代理配置 =====
        if Config.USE_PROXY and Config.PROXY_LIST:
            proxy = random.choice(Config.PROXY_LIST)
            options.add_argument(f"--proxy-server={proxy}")
            logger.info(f"使用代理: {proxy}")
        
        return options
    
    def init_browser(self) -> webdriver.Chrome:
        """初始化浏览器"""
        logger.info("初始化增强版浏览器引擎...")
        
        options = self._setup_options()
        
        # 使用selenium-wire的Chrome驱动
        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options
        )
        
        # 设置隐式等待
        self.driver.implicitly_wait(Config.BROWSER_TIMEOUT)
        
        # 设置显式等待
        self.wait = WebDriverWait(self.driver, Config.BROWSER_TIMEOUT)
        
        # 执行CDP命令隐藏webdriver属性
        self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
            """
        })
        
        logger.info("浏览器引擎初始化完成")
        return self.driver
    
    def save_cookies(self, domain: str = ""):
        """保存Cookie到文件"""
        if not self.driver:
            return
        
        try:
            cookies = self.driver.get_cookies()
            cookie_data = {
                "domain": domain,
                "saved_at": datetime.now().isoformat(),
                "cookies": cookies
            }
            
            # 如果文件已存在，加载并更新
            if self.cookie_path.exists():
                with open(self.cookie_path, 'r', encoding='utf-8') as f:
                    all_cookies = json.load(f)
            else:
                all_cookies = {}
            
            all_cookies[domain or "default"] = cookie_data
            
            with open(self.cookie_path, 'w', encoding='utf-8') as f:
                json.dump(all_cookies, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Cookie已保存: {domain}")
        except Exception as e:
            logger.error(f"保存Cookie失败: {e}")
    
    def load_cookies(self, domain: str = "") -> bool:
        """从文件加载Cookie"""
        if not self.cookie_path.exists():
            logger.info("Cookie文件不存在")
            return False
        
        try:
            with open(self.cookie_path, 'r', encoding='utf-8') as f:
                all_cookies = json.load(f)
            
            cookie_data = all_cookies.get(domain or "default", {})
            cookies = cookie_data.get("cookies", [])
            
            # 检查Cookie是否过期（7天）
            saved_at = cookie_data.get("saved_at", "")
            if saved_at:
                saved_time = datetime.fromisoformat(saved_at)
                if datetime.now() - saved_time > timedelta(days=7):
                    logger.info("Cookie已过期")
                    return False
            
            # 添加Cookie到浏览器
            for cookie in cookies:
                try:
                    self.driver.add_cookie(cookie)
                except Exception as e:
                    logger.debug(f"添加Cookie失败: {e}")
            
            logger.info(f"Cookie已加载: {domain}")
            return True
            
        except Exception as e:
            logger.error(f"加载Cookie失败: {e}")
            return False
    
    def check_login_status(self, selector: str, timeout: int = 30) -> bool:
        """检查登录状态"""
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return True
        except:
            return False
    
    def get_network_requests(self, url_pattern: str = None, timeout: int = 10) -> List[Dict]:
        """
        获取网络请求 - selenium-wire的核心功能
        
        Args:
            url_pattern: URL匹配模式，如 'aisubtitle.hdslb.com'
            timeout: 等待时间
        
        Returns:
            匹配的请求列表
        """
        if not self.driver:
            return []
        
        time.sleep(timeout)  # 等待请求完成
        
        matched_requests = []
        for request in self.driver.requests:
            if request.response and (not url_pattern or url_pattern in request.url):
                matched_requests.append({
                    "url": request.url,
                    "method": request.method,
                    "headers": dict(request.headers),
                    "response_status": request.response.status_code,
                    "response_headers": dict(request.response.headers),
                })
        
        return matched_requests
    
    def clear_network_requests(self):
        """清除已记录的网络请求"""
        if self.driver:
            del self.driver.requests
    
    def random_wait(self, min_seconds: float = None, max_seconds: float = None):
        """随机等待"""
        min_s = min_seconds or Config.MIN_DELAY
        max_s = max_seconds or Config.MAX_DELAY
        delay = random.uniform(min_s, max_s)
        time.sleep(delay)
    
    def human_like_scroll(self, times: int = 3):
        """模拟人类滚动行为"""
        for _ in range(times):
            # 随机滚动距离
            scroll_distance = random.randint(300, 800)
            self.driver.execute_script(f"window.scrollBy(0, {scroll_distance});")
            # 随机等待
            self.random_wait(0.5, 1.5)
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            self.driver = None
            logger.info("浏览器已关闭")


class CookieManager:
    """Cookie管理器"""
    
    def __init__(self, cookie_path: Path = None):
        self.cookie_path = cookie_path or Path(Config.DATA_DIR) / "cookies.json"
        self.cookie_path.parent.mkdir(parents=True, exist_ok=True)
    
    def save(self, driver: webdriver.Chrome, domain: str, login_indicator: str):
        """
        保存登录Cookie
        
        Args:
            driver: 浏览器实例
            domain: 域名标识
            login_indicator: 登录成功后的页面元素选择器，用于验证登录状态
        """
        try:
            # 验证登录状态
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, login_indicator))
            )
            
            # 保存Cookie
            cookies = driver.get_cookies()
            data = {
                "domain": domain,
                "saved_at": datetime.now().isoformat(),
                "cookies": cookies
            }
            
            # 读取现有数据
            if self.cookie_path.exists():
                with open(self.cookie_path, 'r', encoding='utf-8') as f:
                    all_data = json.load(f)
            else:
                all_data = {}
            
            all_data[domain] = data
            
            with open(self.cookie_path, 'w', encoding='utf-8') as f:
                json.dump(all_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Cookie保存成功: {domain}")
            return True
            
        except Exception as e:
            logger.error(f"保存Cookie失败: {e}")
            return False
    
    def load(self, driver: webdriver.Chrome, domain: str) -> bool:
        """加载Cookie"""
        if not self.cookie_path.exists():
            return False
        
        try:
            with open(self.cookie_path, 'r', encoding='utf-8') as f:
                all_data = json.load(f)
            
            data = all_data.get(domain, {})
            cookies = data.get("cookies", [])
            
            if not cookies:
                return False
            
            # 检查过期时间
            saved_at = data.get("saved_at", "")
            if saved_at:
                saved_time = datetime.fromisoformat(saved_at)
                if datetime.now() - saved_time > timedelta(days=7):
                    logger.info("Cookie已过期，需要重新登录")
                    return False
            
            # 添加Cookie
            for cookie in cookies:
                try:
                    driver.add_cookie(cookie)
                except:
                    pass
            
            logger.info(f"Cookie加载成功: {domain}")
            return True
            
        except Exception as e:
            logger.error(f"加载Cookie失败: {e}")
            return False


def is_within_time_limit(publish_date: str, limit_hours: int = 18) -> bool:
    """
    检查发布时间是否在限定时间内
    参考GitHub方案的时间过滤逻辑
    
    支持格式：
    - '今天'
    - 'X小时前'
    - '昨天'
    - 'X天前'
    - '2025-01-01'
    - '01-01'
    """
    now = datetime.now()
    
    # 处理日期格式：'YYYY-MM-DD' 或 'MM-DD'
    date_match = re.match(r'(\d{4}-)?(\d{1,2}-\d{1,2})', publish_date)
    if date_match:
        try:
            date_part = date_match.group(2)
            
            if date_match.group(1):
                full_date_str = f"{date_match.group(1)}{date_part}"
                video_date = datetime.strptime(full_date_str, '%Y-%m-%d')
            else:
                current_year = now.year
                full_date_str = f"{current_year}-{date_part}"
                video_date = datetime.strptime(full_date_str, '%Y-%m-%d')
                
                if video_date > now:
                    video_date = video_date.replace(year=current_year - 1)
            
            delta = now - video_date
            hours_diff = delta.total_seconds() / 3600
            return hours_diff <= limit_hours
            
        except ValueError:
            return False
    
    # 处理相对时间格式
    if "分钟" in publish_date or "今天" in publish_date:
        return True
    
    if "小时前" in publish_date:
        match = re.search(r'(\d+)小时前', publish_date)
        if match:
            hours = int(match.group(1))
            return hours <= limit_hours
        return True
    
    if "昨天" in publish_date:
        return True
    
    if "天前" in publish_date:
        match = re.search(r'(\d+)天前', publish_date)
        if match:
            days = int(match.group(1))
            return days <= 1
        return False
    
    return False
