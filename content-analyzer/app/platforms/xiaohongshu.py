"""
小红书爬虫实现
使用浏览器模拟真实用户行为
"""
import re
import json
import time
import os
from typing import List, Dict, Any, Optional
from urllib.parse import quote, unquote
from datetime import datetime

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from app.core.base_crawler import BaseCrawler
from app.core.browser_engine import BrowserEngine
from app.utils.logger import get_logger
from app.utils.helpers import clean_text, format_number, extract_user_id_from_url
from app.utils.config import Config

logger = get_logger(__name__)

class XiaoHongShuCrawler(BaseCrawler):
    """小红书爬虫"""
    
    platform_name = "xiaohongshu"
    base_url = "https://www.xiaohongshu.com"
    pgy_base_url = "https://pgy.xiaohongshu.com"
    
    # Cookie 文件路径：区分小红书站点(XHS) 与 蒲公英(PGY)
    COOKIE_FILE_PGY = os.path.join(Config.DATA_DIR, 'pgy_cookies.json')
    COOKIE_FILE_XHS = os.path.join(Config.DATA_DIR, 'xhs_cookies.json')
    
    def __init__(self, use_proxy: bool = None, use_browser: bool = True):
        super().__init__(use_proxy)
        self.use_browser = use_browser
        self.browser: Optional[BrowserEngine] = None
        self.is_logged_in_pgy = False
        self.is_logged_in_xhs = False
    
    def _init_browser(self):
        """初始化浏览器（或重新初始化已关闭的浏览器）"""
        if not self.use_browser:
            return
            
        # 检查浏览器是否还活着
        if self.browser and self.browser.driver:
            try:
                # 尝试获取当前URL来测试浏览器是否存活
                _ = self.browser.driver.current_url
                print("[浏览器] ✓ 浏览器实例正常")
                return
            except Exception as e:
                print(f"[浏览器] 浏览器窗口已关闭，需要重新创建: {e}")
                self.browser = None
        
        # 创建新的浏览器实例
        print("[浏览器] 正在创建新的浏览器实例...")
        self.browser = BrowserEngine()
        self.browser.start()
        
        # 启动时不强行加载 Cookie（因为 XHS / PGY 需要区分域名）
        # 具体在 crawl_user 中按目标 URL 决定加载哪一份 Cookie
    
    def _close_browser(self):
        """关闭浏览器"""
        if self.browser:
            self.browser.quit()
            self.browser = None
    
    def _is_pgy_url(self, url: str) -> bool:
        """判断是否为蒲公英链接"""
        return "pgy.xiaohongshu.com" in url or "blogger-detail" in url

    def _is_xhs_url(self, url: str) -> bool:
        """判断是否为小红书站点链接（非蒲公英）"""
        return ("xiaohongshu.com" in url) and (not self._is_pgy_url(url))

    def _wait_dom_ready(self, timeout: int = None):
        """等待页面 DOM ready（基础稳定性）"""
        timeout = timeout or Config.BROWSER_TIMEOUT
        end = time.time() + timeout
        while time.time() < end:
            try:
                state = self.browser.execute_script("return document.readyState;")
                if state in ("interactive", "complete"):
                    return True
            except Exception:
                pass
            time.sleep(0.2)
        return False

    def _close_common_popups(self):
        """
        关闭常见弹窗（尽量不依赖具体文案，避免中英文/AB实验导致失效）
        说明：这里只做“最好努力”，失败不抛异常。
        """
        if not self.browser or not self.browser.driver:
            return
        popup_close_selectors = [
            # 通用 close / x 按钮
            'button[class*="close"]',
            'div[class*="close"]',
            '[aria-label*="关闭"]',
            '[aria-label*="close"]',
            # 小红书站点可能出现的登录弹层关闭
            'div[class*="login"] [class*="close"]',
        ]
        for sel in popup_close_selectors:
            try:
                elems = self.browser.find_elements(By.CSS_SELECTOR, sel)
                if elems:
                    # 点击第一个即可
                    self.browser.click(elems[0], timeout=2)
                    time.sleep(0.3)
                    break
            except Exception:
                continue
    
    def _save_cookies(self, cookie_file: str, base_url: str, platform: str):
        """保存 Cookie 到指定文件（区分 XHS/PGY）"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(cookie_file), exist_ok=True)
            self.browser.get(base_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            
            # 获取当前cookie
            cookies = self.browser.driver.get_cookies()
            if not cookies:
                print("[Cookie] ✗ 当前页面未获取到任何Cookie")
                return False
            
            # 保存到文件
            with open(cookie_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'cookies': cookies,
                    'timestamp': datetime.now().isoformat(),
                    'platform': platform
                }, f, ensure_ascii=False, indent=2)
            
            print(f"[Cookie] ✓ 已保存 {len(cookies)} 个Cookie到文件")
            logger.info(f"Cookie已保存: {cookie_file}")
            return True
        except Exception as e:
            print(f"[Cookie] ✗ 保存失败: {e}")
            logger.error(f"保存Cookie失败: {e}")
            return False
    
    def _load_cookies(self, cookie_file: str, base_url: str) -> bool:
        """从指定文件加载 Cookie（区分 XHS/PGY）"""
        try:
            if not os.path.exists(cookie_file):
                print("[Cookie] 未找到Cookie文件，需要重新登录")
                return False
            
            with open(cookie_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            cookies = data.get('cookies', [])
            if not cookies:
                print("[Cookie] Cookie文件为空")
                return False
            
            # 先访问域名，才能添加cookie
            self.browser.get(base_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            
            # 添加cookie
            added_count = 0
            for cookie in cookies:
                try:
                    normalized_cookie = cookie.copy()
                    if 'expiry' in normalized_cookie:
                        try:
                            normalized_cookie['expiry'] = int(normalized_cookie['expiry'])
                        except (TypeError, ValueError):
                            del normalized_cookie['expiry']
                    if not normalized_cookie.get('name') or normalized_cookie.get('value') is None:
                        continue
                    self.browser.driver.add_cookie(normalized_cookie)
                    added_count += 1
                except Exception as e:
                    print(f"[Cookie] 添加单个Cookie失败: {e}")
            
            if added_count == 0:
                print("[Cookie] ✗ Cookie加载失败，未成功写入浏览器")
                return False
            
            self.browser.get(base_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            # 注意：登录态是否有效由各自的 _check_login_status_* 决定，这里不做“login in url”的粗判断
            
            print(f"[Cookie] ✓ 已加载 {added_count}/{len(cookies)} 个Cookie")
            logger.info(f"Cookie已加载: {added_count}/{len(cookies)}个")
            return True
            
        except Exception as e:
            print(f"[Cookie] ✗ 加载失败: {e}")
            logger.error(f"加载Cookie失败: {e}")
            return False
    
    def _check_login_status_pgy(self) -> bool:
        """检查蒲公英是否已登录"""
        try:
            # 访问蒲公英首页，看是否跳转到登录页
            self.browser.get(self.pgy_base_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            self._close_common_popups()
            
            current_url = self.browser.driver.current_url
            if "login" in current_url:
                print("[Cookie] 未登录状态，需要重新登录")
                return False
            
            print("[Cookie] ✓ 已登录状态")
            return True
        except Exception as e:
            print(f"[Cookie] 检查登录状态失败: {e}")
            return False

    def _check_login_status_xhs(self) -> bool:
        """检查小红书站点是否已登录（弱校验：尽量不依赖固定文案）"""
        try:
            self.browser.get(self.base_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            self._close_common_popups()

            # 经验上：未登录会出现明显的登录按钮/弹层。这里尽量用结构选择器（仍可能随版本变化）。
            possible_login_selectors = [
                '[class*="login"]',
                'a[href*="login"]',
            ]
            for sel in possible_login_selectors:
                try:
                    elems = self.browser.find_elements(By.CSS_SELECTOR, sel)
                    if elems and len(elems) > 0:
                        # 有登录相关元素，不代表一定未登录，但先判为“可能未登录”
                        return False
                except Exception:
                    continue
            return True
        except Exception:
            return False
    
    def _login_pgy(self) -> bool:
        """
        蒲公英平台登录
        优先使用已保存的Cookie，如果没有或失效则手动登录
        """
        try:
            print("\n" + "="*60)
            print("[蒲公英登录] 开始登录流程")
            print("="*60)
            
            # 第一步：尝试加载并使用已有Cookie
            if self._load_cookies(self.COOKIE_FILE_PGY, self.pgy_base_url):
                if self._check_login_status_pgy():
                    print("[蒲公英登录] ✓ 使用已有Cookie登录成功")
                    self.is_logged_in_pgy = True
                    return True
                else:
                    print("[Cookie] 已过期，需要重新登录")
            
            # 第二步：手动登录
            login_url = "https://pgy.xiaohongshu.com/login"
            print(f"\n[蒲公英登录] 打开登录页面: {login_url}")
            
            # 访问登录页
            self.browser.get(login_url)
            self._wait_dom_ready()
            self.browser.random_wait()
            
            print("\n" + "="*60)
            print("[蒲公英登录] 请在浏览器中完成登录")
            print("[蒲公英登录] 登录成功后，系统将自动保存Cookie")
            print("="*60 + "\n")
            
            # 等待用户手动登录
            max_wait = 180  # 最多等待180秒
            check_interval = 3
            waited = 0
            
            while waited < max_wait:
                current_url = self.browser.driver.current_url
                
                # 检查是否已登录
                if "login" not in current_url:
                    print(f"[蒲公英登录] ✓ 检测到登录成功: {current_url}")
                    self.browser.random_wait()
                    
                    # 保存Cookie供后续使用
                    self._save_cookies(self.COOKIE_FILE_PGY, self.pgy_base_url, "pgy")
                    self.is_logged_in_pgy = True
                    return True
                
                # 检查是否出现登录后的元素
                try:
                    user_elements = self.browser.driver.find_elements("css selector", 
                        '[class*="user"], [class*="avatar"], [class*="profile"]')
                    if user_elements:
                        print(f"[蒲公英登录] ✓ 检测到用户元素，登录成功")
                        self._save_cookies(self.COOKIE_FILE_PGY, self.pgy_base_url, "pgy")
                        self.is_logged_in_pgy = True
                        return True
                except:
                    pass
                
                time.sleep(check_interval)
                waited += check_interval
                
                if waited % 10 == 0:
                    print(f"[蒲公英登录] 等待中... {waited}/{max_wait}秒")
            
            print("[蒲公英登录] ✗ 登录超时")
            return False
            
        except Exception as e:
            print(f"[蒲公英登录] ✗ 登录过程出错: {e}")
            logger.error(f"蒲公英登录失败: {e}")
            return False
    
    def crawl_user(self, user_url: str, max_notes: int = 10) -> Dict[str, Any]:
        """
        爬取小红书/蒲公英用户数据
        
        Args:
            user_url: 用户主页URL（支持小红书主页或蒲公英详情页）
            max_notes: 最大采集笔记数
            
        Returns:
            用户数据字典
        """
        is_pgy = self._is_pgy_url(user_url)
        platform_type = "蒲公英" if is_pgy else "小红书"
        
        # 使用 print 确保在终端可见
        print(f"\n{'='*60}")
        print(f"[爬虫启动] 开始采集{platform_type}用户")
        print(f"[目标URL] {user_url}")
        print(f"[平台类型] {platform_type}")
        print(f"{'='*60}\n")
        
        logger.info(f"开始采集{platform_type}用户: {user_url}")
        
        try:
            # 只在浏览器未初始化时才初始化
            if not self.browser or not self.browser.driver:
                print("[步骤1] 初始化浏览器...")
                self._init_browser()
                print("[步骤1] ✓ 浏览器初始化完成")
            else:
                print("[步骤1] 浏览器已存在，复用当前实例")
            
            if is_pgy:
                print("\n[蒲公英登录] 检测到蒲公英链接，正在校验登录态")
                # 先尝试加载 PGY cookie
                if os.path.exists(self.COOKIE_FILE_PGY) and not self.is_logged_in_pgy:
                    print("[Cookie] 尝试加载蒲公英 Cookie...")
                    self._load_cookies(self.COOKIE_FILE_PGY, self.pgy_base_url)
                if not self._check_login_status_pgy():
                    self.is_logged_in_pgy = False
                    print("[蒲公英登录] 登录态无效，需要重新登录")
                    if not self._login_pgy():
                        print("[蒲公英登录] ✗ 登录失败，无法继续采集")
                        return None
                self.is_logged_in_pgy = True
                print("[蒲公英登录] ✓ 登录态有效")
            else:
                # 小红书站点：如果有 XHS cookie 就尝试加载（不强制要求登录）
                if os.path.exists(self.COOKIE_FILE_XHS) and not self.is_logged_in_xhs:
                    print("[Cookie] 尝试加载小红书站点 Cookie...")
                    self._load_cookies(self.COOKIE_FILE_XHS, self.base_url)
                    self.is_logged_in_xhs = self._check_login_status_xhs()
            
            # 访问用户主页
            print(f"[步骤2] 访问页面: {user_url}")
            self.browser.get(user_url)
            self._wait_dom_ready()
            self._close_common_popups()
            print("[步骤2] ✓ 页面加载完成")
            
            print("[步骤3] 等待页面渲染...")
            self.browser.random_wait()
            print("[步骤3] ✓ 等待完成")
            
            # 获取页面标题用于调试
            try:
                page_title = self.browser.driver.title
                print(f"[调试] 当前页面标题: {page_title}")
            except Exception as e:
                print(f"[调试] 获取页面标题失败: {e}")
            
            # 根据页面类型选择不同的提取方法
            if is_pgy:
                print("[步骤4] 使用蒲公英采集模式")
                logger.info("检测到蒲公英页面，使用蒲公英采集模式")
                user_info = self._extract_pgy_user_info()
                notes = self._extract_pgy_notes(max_notes)
            else:
                print("[步骤4] 使用标准小红书采集模式")
                logger.info("使用标准小红书采集模式")
                user_info = self._extract_user_info()
                notes = self._extract_notes(max_notes)
            
            print(f"\n[采集结果]")
            print(f"  - 用户昵称: {user_info.get('nickname', '未获取')}")
            print(f"  - 笔记数量: {len(notes)}")
            print(f"  - 粉丝数: {user_info.get('followers', '未获取')}")
            
            user_data = {
                "platform": self.platform_name,
                "user_url": user_url,
                "user_id": extract_user_id_from_url(user_url) or "pgy_user",
                "nickname": user_info.get("nickname", ""),
                "avatar": user_info.get("avatar", ""),
                "description": user_info.get("description", ""),
                "followers": user_info.get("followers", 0),
                "following": user_info.get("following", 0),
                "notes_count": len(notes),
                "notes": notes,
                "crawl_time": datetime.now().isoformat(),
                "source": "pgy" if is_pgy else "xhs"
            }
            
            print(f"\n{'='*60}")
            print(f"[爬虫完成] 成功采集 {len(notes)} 条笔记")
            print(f"{'='*60}\n")
            
            return user_data
            
        except Exception as e:
            print(f"\n[错误] 采集失败: {e}")
            logger.error(f"采集用户失败: {e}")
            import traceback
            traceback.print_exc()
            return None
        # 注意：不在此处关闭浏览器，由调用方控制浏览器生命周期
    
    def _extract_pgy_user_info(self) -> Dict[str, Any]:
        """从蒲公英页面提取用户信息"""
        user_info = {}
        
        print("\n[蒲公英-步骤1] 开始提取用户信息...")
        
        try:
            # 蒲公英页面的昵称通常在标题或特定区域，尝试多种选择器
            nickname_selectors = [
                'h1[class*="name"]',
                '[class*="blogger-name"]',
                'h1',
                '[class*="nickname"]',
                '[class*="title"]'
            ]
            print(f"[蒲公英-步骤1] 尝试 {len(nickname_selectors)} 个昵称选择器...")
            for i, selector in enumerate(nickname_selectors):
                try:
                    elem = self.browser.find_element(By.CSS_SELECTOR, selector)
                    if elem:
                        user_info["nickname"] = elem.text.strip()
                        print(f"[蒲公英-步骤1] ✓ 使用选择器 {i+1} 找到昵称: {user_info['nickname']}")
                        break
                except Exception as e:
                    print(f"[蒲公英-步骤1]   选择器 {i+1} 失败: {selector}")
                    continue
            
            if not user_info.get("nickname"):
                print("[蒲公英-步骤1] ✗ 未找到昵称")
            
            # 头像
            print("[蒲公英-步骤2] 提取头像...")
            avatar_selectors = [
                'img[class*="avatar"]',
                '[class*="blogger-avatar"] img',
                'img[class*="header"]'
            ]
            for selector in avatar_selectors:
                try:
                    elem = self.browser.find_element(By.CSS_SELECTOR, selector)
                    if elem:
                        user_info["avatar"] = elem.get_attribute('src')
                        print(f"[蒲公英-步骤2] ✓ 找到头像: {user_info['avatar'][:50]}...")
                        break
                except:
                    continue
            
            # 简介/标签
            print("[蒲公英-步骤3] 提取简介...")
            desc_selectors = [
                '[class*="intro"]',
                '[class*="description"]',
                '[class*="bio"]'
            ]
            for selector in desc_selectors:
                try:
                    elem = self.browser.find_element(By.CSS_SELECTOR, selector)
                    if elem:
                        user_info["description"] = elem.text.strip()
                        print(f"[蒲公英-步骤3] ✓ 找到简介: {user_info['description'][:50]}...")
                        break
                except:
                    continue
            
            # 粉丝数等统计数据
            print("[蒲公英-步骤4] 提取统计数据...")
            stats_selectors = [
                '[class*="stat"]',
                '[class*="count"]',
                '[class*="num"]'
            ]
            for selector in stats_selectors:
                try:
                    elems = self.browser.find_elements(By.CSS_SELECTOR, selector)
                    print(f"[蒲公英-步骤4] 找到 {len(elems)} 个统计元素")
                    for elem in elems:
                        text = elem.text.strip()
                        try:
                            parent = elem.find_element(By.XPATH, "..")
                            parent_text = parent.text.lower()
                            
                            if '粉丝' in parent_text or 'follower' in parent_text:
                                user_info["followers"] = format_number(text)
                                print(f"[蒲公英-步骤4] ✓ 粉丝数: {user_info['followers']}")
                            elif '关注' in parent_text or 'following' in parent_text:
                                user_info["following"] = format_number(text)
                                print(f"[蒲公英-步骤4] ✓ 关注数: {user_info['following']}")
                        except:
                            pass
                except Exception as e:
                    print(f"[蒲公英-步骤4] 提取统计失败: {e}")
                    continue
            
            logger.info(f"获取蒲公英用户信息: {user_info.get('nickname', 'Unknown')}")
            
        except Exception as e:
            print(f"[蒲公英-错误] 提取用户信息失败: {e}")
            logger.warning(f"提取蒲公英用户信息失败: {e}")
        
        return user_info
    
    def _extract_pgy_notes(self, max_notes: int = 10) -> List[Dict[str, Any]]:
        """从蒲公英页面提取笔记数据"""
        notes = []
        collected = 0
        scroll_count = 0
        max_scroll = (max_notes // 5) + 3
        
        print(f"\n[蒲公英-笔记] 开始提取笔记，目标数量: {max_notes}")
        
        while collected < max_notes and scroll_count < max_scroll:
            print(f"\n[蒲公英-笔记] 第 {scroll_count + 1} 次滚动查找...")
            
            # 蒲公英页面的笔记卡片选择器
            note_selectors = [
                '[class*="note-card"]',
                '[class*="content-card"]',
                '[class*="post-card"]',
                'a[href*="/explore/"]'
            ]
            
            note_cards = []
            for i, selector in enumerate(note_selectors):
                try:
                    cards = self.browser.find_elements(By.CSS_SELECTOR, selector)
                    if cards:
                        note_cards = cards
                        print(f"[蒲公英-笔记] 使用选择器 {i+1} 找到 {len(cards)} 个笔记卡片")
                        break
                except Exception as e:
                    print(f"[蒲公英-笔记] 选择器 {i+1} 失败: {selector}")
                    continue
            
            if not note_cards:
                print("[蒲公英-笔记] 未找到任何笔记卡片")
            
            for card_idx, card in enumerate(note_cards):
                if collected >= max_notes:
                    break
                
                try:
                    note = {}
                    print(f"\n[蒲公英-笔记] 处理第 {card_idx + 1} 个卡片...")
                    
                    # 标题
                    title_selectors = ['[class*="title"]', 'h3', 'h4', '.desc']
                    for sel_idx, sel in enumerate(title_selectors):
                        try:
                            elem = card.find_element(By.CSS_SELECTOR, sel)
                            if elem:
                                note["title"] = elem.text.strip()
                                print(f"  ✓ 标题: {note['title'][:30]}...")
                                break
                        except:
                            continue
                    
                    if not note.get("title"):
                        print("  ✗ 未找到标题")
                    
                    # 链接
                    try:
                        link_elem = card.find_element(By.CSS_SELECTOR, 'a')
                        href = link_elem.get_attribute('href')
                        if href:
                            note["url"] = href
                            note["note_id"] = href.split('/explore/')[-1].split('?')[0] if '/explore/' in href else ""
                            print(f"  ✓ 链接: {href[:50]}...")
                    except Exception as e:
                        print(f"  ✗ 链接提取失败: {e}")
                    
                    # 封面图
                    try:
                        img_elem = card.find_element(By.CSS_SELECTOR, 'img')
                        note["cover"] = img_elem.get_attribute('src')
                        print(f"  ✓ 封面: {note['cover'][:50]}...")
                    except:
                        print("  ✗ 封面提取失败")
                    
                    # 互动数据
                    try:
                        like_elem = card.find_element(By.CSS_SELECTOR, '[class*="like"], [class*="count"]')
                        note["likes"] = format_number(like_elem.text)
                        print(f"  ✓ 点赞: {note['likes']}")
                    except:
                        print("  ✗ 点赞数提取失败")
                    
                    if note.get("title") or note.get("url"):
                        notes.append(note)
                        collected += 1
                        print(f"  ✓✓ 成功采集第 {collected}/{max_notes} 条笔记")
                    else:
                        print(f"  ✗✗ 跳过此卡片（无标题和链接）")
                        
                except Exception as e:
                    print(f"  ✗✗ 解析卡片失败: {e}")
                    logger.warning(f"解析蒲公英笔记卡片失败: {e}")
                    continue
            
            # 滚动加载更多
            if collected < max_notes:
                print(f"[蒲公英-笔记] 滚动加载更多...")
                self.browser.natural_scroll()
                scroll_count += 1
                self.browser.delay.sleep_short()
        
        print(f"\n[蒲公英-笔记] 提取完成，共 {len(notes)} 条笔记")
        return notes
    
    def _extract_user_info(self) -> Dict[str, Any]:
        """提取用户信息"""
        user_info = {}
        
        try:
            # 昵称
            nickname_elem = self.browser.find_element(By.CSS_SELECTOR, 'div[class*="nickname"], h1[class*="nickname"], .user-nickname')
            if nickname_elem:
                user_info["nickname"] = nickname_elem.text.strip()
            
            # 头像
            avatar_elem = self.browser.find_element(By.CSS_SELECTOR, 'img[class*="avatar"], .user-avatar img')
            if avatar_elem:
                user_info["avatar"] = avatar_elem.get_attribute('src')
            
            # 简介
            desc_elem = self.browser.find_element(By.CSS_SELECTOR, 'div[class*="desc"], .user-desc, [class*="signature"]')
            if desc_elem:
                user_info["description"] = desc_elem.text.strip()
            
            # 粉丝数、关注数、笔记数
            stats_elems = self.browser.find_elements(By.CSS_SELECTOR, '[class*="stats"] div, [class*="count"]')
            for elem in stats_elems:
                text = elem.text.strip()
                if '粉丝' in text:
                    user_info["followers"] = format_number(text.replace('粉丝', '').strip())
                elif '关注' in text:
                    user_info["following"] = format_number(text.replace('关注', '').strip())
                elif '笔记' in text:
                    user_info["notes_count"] = format_number(text.replace('笔记', '').strip())
            
            logger.info(f"获取用户信息: {user_info.get('nickname', 'Unknown')}")
            
        except Exception as e:
            logger.warning(f"提取用户信息失败: {e}")
        
        return user_info
    
    def _extract_notes(self, max_notes: int = 10) -> List[Dict[str, Any]]:
        """提取笔记列表"""
        notes = []
        collected = 0
        scroll_count = 0
        max_scroll = (max_notes // 10) + 3  # 估算滚动次数
        
        while collected < max_notes and scroll_count < max_scroll:
            # 查找笔记卡片
            note_cards = self.browser.find_elements(By.CSS_SELECTOR, 'section[class*="note"], div[class*="note-card"], a[href*="/explore/"]')
            
            logger.info(f"找到 {len(note_cards)} 个笔记卡片")
            
            for card in note_cards:
                if collected >= max_notes:
                    break
                
                try:
                    note = self._parse_note_card(card)
                    if note and note not in notes:
                        notes.append(note)
                        collected += 1
                        logger.info(f"已采集 {collected}/{max_notes} 条笔记")
                except Exception as e:
                    logger.warning(f"解析笔记卡片失败: {e}")
                    continue
            
            # 滚动加载更多
            if collected < max_notes:
                self.browser.natural_scroll()
                scroll_count += 1
                self.browser.delay.sleep_short()
        
        return notes
    
    def _parse_note_card(self, card) -> Optional[Dict[str, Any]]:
        """解析单个笔记卡片"""
        try:
            note = {}
            
            # 笔记链接
            link_elem = card.find_element(By.CSS_SELECTOR, 'a[href*="/explore/"]')
            if link_elem:
                href = link_elem.get_attribute('href')
                note["url"] = href
                note["note_id"] = href.split('/explore/')[-1].split('?')[0]
            
            # 封面图
            img_elem = card.find_element(By.CSS_SELECTOR, 'img[class*="cover"], img')
            if img_elem:
                note["cover"] = img_elem.get_attribute('src')
            
            # 标题
            title_elem = card.find_element(By.CSS_SELECTOR, '[class*="title"], span[class*="desc"]')
            if title_elem:
                note["title"] = clean_text(title_elem.text)
            
            # 互动数据
            like_elem = card.find_element(By.CSS_SELECTOR, '[class*="like"], span[class*="count"]')
            if like_elem:
                note["likes"] = format_number(like_elem.text)
            
            return note
            
        except Exception as e:
            logger.debug(f"解析笔记卡片异常: {e}")
            return None
    
    def parse_note(self, note_data: Dict) -> Dict[str, Any]:
        """
        标准化笔记数据格式
        
        Args:
            note_data: 原始笔记数据
            
        Returns:
            标准化笔记数据
        """
        return {
            "platform": self.platform_name,
            "note_id": note_data.get("note_id", ""),
            "url": note_data.get("url", ""),
            "title": note_data.get("title", ""),
            "content": note_data.get("content", ""),
            "cover": note_data.get("cover", ""),
            "images": note_data.get("images", []),
            "likes": note_data.get("likes", 0),
            "comments": note_data.get("comments", 0),
            "collects": note_data.get("collects", 0),
            "shares": note_data.get("shares", 0),
            "publish_time": note_data.get("publish_time", ""),
            "tags": note_data.get("tags", []),
            "crawl_time": datetime.now().isoformat()
        }
    
    def crawl_note_detail(self, note_url: str) -> Dict[str, Any]:
        """
        爬取笔记详情
        
        Args:
            note_url: 笔记URL
            
        Returns:
            笔记详情数据
        """
        logger.info(f"采集笔记详情: {note_url}")
        
        try:
            self._init_browser()
            self.browser.get(note_url)
            self.browser.random_wait()
            
            detail = {}
            
            # 标题
            title_elem = self.browser.find_element(By.CSS_SELECTOR, 'div[class*="title"], h1[class*="title"]')
            if title_elem:
                detail["title"] = title_elem.text.strip()
            
            # 正文内容
            content_elem = self.browser.find_element(By.CSS_SELECTOR, 'div[class*="content"], div[class*="desc"]')
            if content_elem:
                detail["content"] = content_elem.text.strip()
            
            # 图片列表
            img_elems = self.browser.find_elements(By.CSS_SELECTOR, 'div[class*="swiper"] img, div[class*="image"] img')
            detail["images"] = [img.get_attribute('src') for img in img_elems if img.get_attribute('src')]
            
            # 互动数据
            detail["likes"] = self._extract_count('点赞')
            detail["collects"] = self._extract_count('收藏')
            detail["comments"] = self._extract_count('评论')
            detail["shares"] = self._extract_count('分享')
            
            # 发布时间
            time_elem = self.browser.find_element(By.CSS_SELECTOR, 'span[class*="time"], div[class*="publish-time"]')
            if time_elem:
                detail["publish_time"] = time_elem.text.strip()
            
            # 话题标签
            tag_elems = self.browser.find_elements(By.CSS_SELECTOR, 'a[href*="/search?"] span, span[class*="tag"]')
            detail["tags"] = [tag.text.strip() for tag in tag_elems if tag.text.strip().startswith('#')]
            
            return detail
            
        except Exception as e:
            logger.error(f"采集笔记详情失败: {e}")
            return {}
        finally:
            self._close_browser()
    
    def _extract_count(self, label: str) -> int:
        """提取计数数据"""
        try:
            elems = self.browser.find_elements(By.CSS_SELECTOR, 'span, div')
            for elem in elems:
                text = elem.text.strip()
                if label in text:
                    number = text.replace(label, '').strip()
                    return format_number(number)
        except:
            pass
        return 0
