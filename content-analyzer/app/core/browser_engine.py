"""
浏览器引擎 - 模拟真实用户行为
使用标准 Selenium WebDriver
"""
import time
import random
from typing import Optional, Dict, Any, List, Union, Tuple
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from app.utils.config import Config
from app.utils.logger import get_logger
from app.utils.helpers import ua_pool, DelayController

logger = get_logger(__name__)

class BrowserEngine:
    """浏览器引擎类 - 模拟真实用户行为"""
    
    def __init__(self, headless: bool = None):
        self.headless = headless if headless is not None else Config.HEADLESS
        self.driver: Optional[webdriver.Chrome] = None
        self.delay = DelayController(Config.MIN_DELAY, Config.MAX_DELAY)
        self.wait: Optional[WebDriverWait] = None
        
    def start(self) -> 'BrowserEngine':
        """启动浏览器"""
        logger.info("正在启动浏览器...")
        print("[浏览器] 正在启动 Chrome...")
        
        options = webdriver.ChromeOptions()
        attach_existing = Config.CHROME_ATTACH_EXISTING
        
        if attach_existing:
            options.add_experimental_option("debuggerAddress", Config.CHROME_DEBUGGER_ADDRESS)
        else:
            if self.headless:
                options.add_argument('--headless=new')
            
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--disable-web-security')
            options.add_argument('--disable-features=IsolateOrigins,site-per-process')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--start-maximized')
            
            ua = ua_pool.get_random_ua()
            options.add_argument(f'--user-agent={ua}')
            options.add_argument('--lang=zh-CN')
            options.add_argument('--timezone=Asia/Shanghai')
            
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            prefs = {
                "credentials_enable_service": False,
                "profile.password_manager_enabled": False
            }
            options.add_experimental_option("prefs", prefs)
        
        try:
            if attach_existing:
                print(f"[浏览器] 使用已打开 Chrome: {Config.CHROME_DEBUGGER_ADDRESS}")
            else:
                print("[浏览器] 启动独立 Chrome 窗口")
            self.driver = webdriver.Chrome(options=options)
            self.wait = WebDriverWait(self.driver, Config.BROWSER_TIMEOUT)
            
            # 执行CDP命令隐藏webdriver
            self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': '''
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5]
                    });
                    window.chrome = {
                        runtime: {}
                    };
                '''
            })
            
            logger.info("浏览器启动成功")
            print("[浏览器] ✓ Chrome 启动成功")
            return self
            
        except Exception as e:
            logger.error(f"浏览器启动失败: {e}")
            print(f"[浏览器] ✗ 启动失败: {e}")
            raise
    
    def quit(self):
        """关闭浏览器"""
        if self.driver:
            logger.info("正在关闭浏览器...")
            self.driver.quit()
            self.driver = None
    
    def get(self, url: str):
        """访问页面"""
        logger.info(f"访问页面: {url}")
        print(f"[浏览器] 访问: {url[:60]}...")
        self.driver.get(url)
        self.delay.sleep_short()

    def open_new_tab(self, url: str):
        """在新标签页打开页面"""
        logger.info(f"新标签页访问: {url}")
        print(f"[浏览器] 新标签页打开: {url[:60]}...")
        self.driver.switch_to.new_window('tab')
        self.driver.get(url)
        self.delay.sleep_short()
    
    def random_wait(self, min_sec: float = 2, max_sec: float = 5):
        """随机等待"""
        wait_time = random.uniform(min_sec, max_sec)
        time.sleep(wait_time)
    
    def natural_scroll(self, scroll_amount: int = None):
        """自然滚动 - 模拟人类滚动行为"""
        if scroll_amount is None:
            scroll_amount = random.randint(300, 800)
        
        # 使用缓动函数模拟自然滚动
        steps = random.randint(10, 20)
        step_size = scroll_amount / steps
        delay = random.uniform(0.01, 0.05)
        
        for i in range(steps):
            self.driver.execute_script(
                f"window.scrollBy(0, {step_size});"
            )
            time.sleep(delay)
        
        logger.debug(f"向下滚动 {scroll_amount}px")
    
    def natural_mouse_move(self, element):
        """自然鼠标移动 - 贝塞尔曲线"""
        actions = ActionChains(self.driver)
        
        # 随机偏移
        offset_x = random.randint(-10, 10)
        offset_y = random.randint(-10, 10)
        
        actions.move_to_element_with_offset(element, offset_x, offset_y)
        actions.perform()
        time.sleep(random.uniform(0.1, 0.3))
    
    def natural_click(self, element):
        """自然点击"""
        self.natural_mouse_move(element)
        
        # 随机延迟（模拟人类反应时间）
        time.sleep(random.uniform(0.2, 0.5))
        
        actions = ActionChains(self.driver)
        actions.click(element)
        actions.perform()
    
    def _normalize_locator(
        self,
        selector_or_by: Union[str, By],
        value: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        统一定位器格式，兼容两种调用方式：
        1) find_element("css selector ...")
        2) find_element(By.CSS_SELECTOR, "css selector ...")
        """
        # selenium 的 By.CSS_SELECTOR 本质上是字符串 "css selector"
        if value is None:
            # 只传一个参数时，默认当作 CSS_SELECTOR
            return (By.CSS_SELECTOR, str(selector_or_by))
        return (str(selector_or_by), str(value))

    def find_element(
        self,
        selector_or_by: Union[str, By],
        value: Optional[str] = None,
        timeout: Optional[int] = None,
        condition: str = "presence",
    ):
        """
        查找元素（显式等待）

        Args:
            selector_or_by: CSS选择器字符串 或 By.*
            value: 当 selector_or_by 为 By.* 时，对应的定位值
            timeout: 超时时间
            condition: 等待条件
                - "presence": 元素出现在DOM即可（默认）
                - "visible": 元素可见
                - "clickable": 元素可点击
        """
        if timeout is None:
            timeout = Config.BROWSER_TIMEOUT

        by, v = self._normalize_locator(selector_or_by, value)
        wait = WebDriverWait(self.driver, timeout)

        if condition == "visible":
            return wait.until(EC.visibility_of_element_located((by, v)))
        if condition == "clickable":
            return wait.until(EC.element_to_be_clickable((by, v)))
        return wait.until(EC.presence_of_element_located((by, v)))

    def find_elements(
        self,
        selector_or_by: Union[str, By],
        value: Optional[str] = None,
    ) -> List:
        """查找多个元素（不做显式等待，保持轻量；需要等就用 find_element + 更长 timeout）"""
        by, v = self._normalize_locator(selector_or_by, value)
        return self.driver.find_elements(by, v)

    def click(
        self,
        selector_or_element,
        timeout: Optional[int] = None,
        use_js_fallback: bool = True,
    ):
        """
        更稳的点击封装：滚动到可视区域 + 等待可点击 + ActionChains 点击 + 兜底 JS click
        """
        try:
            element = selector_or_element
            if not hasattr(selector_or_element, "click"):
                # 当传入的是 selector
                element = self.find_element(selector_or_element, timeout=timeout, condition="clickable")

            # 滚动到可视区域，减少“点不到/被遮挡”
            try:
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
                time.sleep(random.uniform(0.1, 0.3))
            except Exception:
                pass

            self.natural_click(element)
            return True
        except Exception as e:
            if use_js_fallback:
                try:
                    element = selector_or_element
                    if not hasattr(selector_or_element, "click"):
                        element = self.find_element(selector_or_element, timeout=timeout, condition="presence")
                    self.driver.execute_script("arguments[0].click();", element)
                    return True
                except Exception:
                    pass
            logger.warning(f"点击失败: {e}")
            return False
    
    def execute_script(self, script: str, *args):
        """执行JavaScript"""
        return self.driver.execute_script(script, *args)
    
    @property
    def current_url(self) -> str:
        """当前URL"""
        return self.driver.current_url
    
    @property
    def title(self) -> str:
        """页面标题"""
        return self.driver.title
    
    @property
    def page_source(self) -> str:
        """页面源码"""
        return self.driver.page_source
