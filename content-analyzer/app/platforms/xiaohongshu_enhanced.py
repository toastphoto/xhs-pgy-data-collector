#!/usr/bin/env python3
"""
小红书平台爬虫 - 增强版（整合GitHub安全策略）
"""
import re
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from urllib.parse import quote

from loguru import logger

from app.core.enhanced_browser import EnhancedBrowserEngine, CookieManager, is_within_time_limit
from app.utils.helpers import extract_user_id_from_url


class XiaohongshuEnhancedCrawler:
    """小红书增强版爬虫"""
    
    def __init__(self):
        self.platform_name = "小红书"
        self.domain = "xiaohongshu.com"
        self.browser = EnhancedBrowserEngine()
        self.cookie_manager = CookieManager()
        self.login_selector = ".user-info"  # 登录成功后的元素选择器
        
    def _login(self) -> bool:
        """
        登录并保存Cookie
        参考GitHub方案的登录流程
        """
        try:
            # 访问小红书首页
            self.browser.driver.get("https://www.xiaohongshu.com")
            self.browser.random_wait(2, 3)
            
            # 尝试加载已保存的Cookie
            if self.cookie_manager.load(self.browser.driver, self.domain):
                # 刷新页面验证登录状态
                self.browser.driver.refresh()
                self.browser.random_wait(2, 3)
                
                if self.browser.check_login_status(self.login_selector, timeout=10):
                    logger.info("使用已保存的Cookie登录成功")
                    return True
                else:
                    logger.info("Cookie已失效，需要重新登录")
            
            # 需要手动登录 - 使用蒲公英平台登录
            logger.info("未找到有效Cookie，请手动登录...")
            logger.info("正在打开蒲公英平台登录页面...")
            self.browser.driver.get("https://pgy.xiaohongshu.com")
            
            # 等待用户手动登录（最多120秒）
            print("\n" + "="*50)
            print("请在浏览器中完成登录")
            print("登录成功后会自动保存Cookie")
            print("="*50 + "\n")
            
            if self.browser.check_login_status(self.login_selector, timeout=120):
                # 保存Cookie
                self.cookie_manager.save(
                    self.browser.driver, 
                    self.domain, 
                    self.login_selector
                )
                logger.info("登录成功，Cookie已保存")
                return True
            else:
                logger.error("登录超时")
                return False
                
        except Exception as e:
            logger.error(f"登录失败: {e}")
            return False
    
    def _extract_user_info(self) -> Dict[str, Any]:
        """提取用户信息"""
        try:
            # 等待用户信息加载
            self.browser.wait.until(
                lambda d: d.find_element("css selector", ".user-nickname")
            )
            
            # 提取用户昵称
            nickname_elem = self.browser.driver.find_element("css selector", ".user-nickname")
            nickname = nickname_elem.text.strip()
            
            # 提取头像
            try:
                avatar_elem = self.browser.driver.find_element("css selector", ".user-avatar img")
                avatar = avatar_elem.get_attribute("src")
            except:
                avatar = ""
            
            # 提取简介
            try:
                desc_elem = self.browser.driver.find_element("css selector", ".user-desc")
                description = desc_elem.text.strip()
            except:
                description = ""
            
            # 提取统计数据
            stats = {}
            try:
                stats_elems = self.browser.driver.find_elements("css selector", ".user-stats .stat-item")
                for elem in stats_elems:
                    label = elem.find_element("css selector", ".stat-label").text
                    value = elem.find_element("css selector", ".stat-value").text
                    if "关注" in label:
                        stats["following"] = self._parse_count(value)
                    elif "粉丝" in label:
                        stats["followers"] = self._parse_count(value)
                    elif "获赞" in label:
                        stats["likes"] = self._parse_count(value)
            except:
                pass
            
            return {
                "nickname": nickname,
                "avatar": avatar,
                "description": description,
                **stats
            }
            
        except Exception as e:
            logger.error(f"提取用户信息失败: {e}")
            return {}
    
    def _extract_notes(self, max_notes: int = 10) -> List[Dict[str, Any]]:
        """
        提取笔记列表
        参考GitHub方案的时间过滤逻辑
        """
        notes = []
        
        try:
            # 滚动加载笔记
            last_height = self.browser.driver.execute_script("return document.body.scrollHeight")
            scroll_attempts = 0
            max_scrolls = max_notes // 3 + 3  # 估算需要的滚动次数
            
            while len(notes) < max_notes and scroll_attempts < max_scrolls:
                # 提取当前可见的笔记
                note_elements = self.browser.driver.find_elements("css selector", ".note-item")
                
                for elem in note_elements:
                    if len(notes) >= max_notes:
                        break
                    
                    try:
                        # 提取笔记ID
                        note_id = elem.get_attribute("data-note-id") or ""
                        
                        # 提取标题
                        try:
                            title_elem = elem.find_element("css selector", ".note-title")
                            title = title_elem.text.strip()
                        except:
                            title = ""
                        
                        # 提取发布时间
                        try:
                            date_elem = elem.find_element("css selector", ".note-date")
                            publish_date = date_elem.text.strip()
                        except:
                            publish_date = "今天"
                        
                        # 检查时间限制（可选：只采集最近的内容）
                        # if not is_within_time_limit(publish_date, limit_hours=72):
                        #     continue
                        
                        # 提取互动数据
                        interactions = {}
                        try:
                            like_elem = elem.find_element("css selector", ".like-count")
                            interactions["likes"] = self._parse_count(like_elem.text)
                        except:
                            interactions["likes"] = 0
                        
                        # 提取封面图
                        try:
                            img_elem = elem.find_element("css selector", "img")
                            cover_image = img_elem.get_attribute("src")
                        except:
                            cover_image = ""
                        
                        note = {
                            "note_id": note_id,
                            "title": title,
                            "cover_image": cover_image,
                            "publish_date": publish_date,
                            "interactions": interactions,
                            "crawl_time": datetime.now().isoformat()
                        }
                        
                        # 避免重复
                        if not any(n["note_id"] == note_id for n in notes):
                            notes.append(note)
                            logger.info(f"提取笔记: {title[:30]}... ({publish_date})")
                        
                    except Exception as e:
                        logger.debug(f"提取单条笔记失败: {e}")
                        continue
                
                # 滚动页面
                self.browser.human_like_scroll(1)
                
                # 检查是否到达底部
                new_height = self.browser.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
                scroll_attempts += 1
            
            return notes
            
        except Exception as e:
            logger.error(f"提取笔记列表失败: {e}")
            return notes
    
    def _parse_count(self, count_text: str) -> int:
        """解析数量文本"""
        if not count_text:
            return 0
        
        count_text = count_text.strip().replace(",", "")
        
        # 处理 "1.2万" 格式
        if "万" in count_text:
            try:
                num = float(count_text.replace("万", ""))
                return int(num * 10000)
            except:
                return 0
        
        # 处理纯数字
        try:
            return int(count_text)
        except:
            return 0
    
    def _is_pgy_url(self, url: str) -> bool:
        """判断是否为蒲公英链接"""
        return "pgy.xiaohongshu.com" in url or "blogger-detail" in url
    
    def _extract_pgy_user_info(self) -> Dict[str, Any]:
        """从蒲公英页面提取用户信息"""
        try:
            # 等待页面加载
            self.browser.random_wait(3, 5)
            
            # 提取用户昵称 - 蒲公英页面的昵称通常在标题或特定区域
            nickname = ""
            try:
                # 尝试多种可能的选择器
                selectors = [
                    "h1.blogger-name",
                    ".blogger-name",
                    "h1",
                    ".name",
                    "[class*='name']",
                    "[class*='nickname']"
                ]
                for selector in selectors:
                    try:
                        elem = self.browser.driver.find_element("css selector", selector)
                        nickname = elem.text.strip()
                        if nickname:
                            break
                    except:
                        continue
            except:
                pass
            
            # 提取头像
            avatar = ""
            try:
                avatar_selectors = [
                    ".blogger-avatar img",
                    "img[class*='avatar']",
                    ".avatar img"
                ]
                for selector in avatar_selectors:
                    try:
                        elem = self.browser.driver.find_element("css selector", selector)
                        avatar = elem.get_attribute("src")
                        if avatar:
                            break
                    except:
                        continue
            except:
                pass
            
            # 提取简介/标签
            description = ""
            try:
                desc_selectors = [
                    ".blogger-intro",
                    ".intro",
                    "[class*='intro']",
                    ".description"
                ]
                for selector in desc_selectors:
                    try:
                        elem = self.browser.driver.find_element("css selector", selector)
                        description = elem.text.strip()
                        if description:
                            break
                    except:
                        continue
            except:
                pass
            
            # 提取粉丝数等统计数据
            stats = {}
            try:
                # 蒲公英页面通常有粉丝数、笔记数等数据
                stat_selectors = [
                    ".stat-value",
                    ".stat-num",
                    "[class*='stat']",
                    ".num"
                ]
                stat_elems = self.browser.driver.find_elements("css selector", ", ".join(stat_selectors))
                for elem in stat_elems:
                    text = elem.text.strip()
                    # 尝试解析数字
                    try:
                        value = self._parse_count(text)
                        if value > 0:
                            # 根据上下文判断是哪个统计项
                            parent = elem.find_element("xpath", "..")
                            label = parent.text.lower()
                            if "粉丝" in label:
                                stats["followers"] = value
                            elif "关注" in label:
                                stats["following"] = value
                            elif "赞" in label or "like" in label:
                                stats["likes"] = value
                    except:
                        pass
            except:
                pass
            
            return {
                "nickname": nickname,
                "avatar": avatar,
                "description": description,
                **stats
            }
            
        except Exception as e:
            logger.error(f"提取蒲公英用户信息失败: {e}")
            return {}
    
    def _extract_pgy_notes(self, max_notes: int = 10) -> List[Dict[str, Any]]:
        """从蒲公英页面提取笔记数据"""
        notes = []
        
        try:
            # 蒲公英页面可能有笔记展示区域
            # 尝试滚动加载
            last_height = self.browser.driver.execute_script("return document.body.scrollHeight")
            scroll_attempts = 0
            max_scrolls = max_notes // 3 + 3
            
            while len(notes) < max_notes and scroll_attempts < max_scrolls:
                # 尝试多种笔记卡片选择器
                note_selectors = [
                    ".note-card",
                    ".note-item",
                    "[class*='note']",
                    ".content-card",
                    ".post-card"
                ]
                
                note_elements = []
                for selector in note_selectors:
                    try:
                        elems = self.browser.driver.find_elements("css selector", selector)
                        if elems:
                            note_elements = elems
                            break
                    except:
                        continue
                
                for elem in note_elements:
                    if len(notes) >= max_notes:
                        break
                    
                    try:
                        note_data = {}
                        
                        # 提取标题
                        try:
                            title_selectors = [".title", ".note-title", "h3", "h4"]
                            for sel in title_selectors:
                                try:
                                    title_elem = elem.find_element("css selector", sel)
                                    note_data["title"] = title_elem.text.strip()
                                    break
                                except:
                                    continue
                        except:
                            note_data["title"] = ""
                        
                        # 提取互动数据
                        try:
                            interact_selectors = [".interact", ".stats", ".count"]
                            for sel in interact_selectors:
                                try:
                                    interact_elem = elem.find_element("css selector", sel)
                                    text = interact_elem.text
                                    # 解析互动数据
                                    if "赞" in text or "like" in text.lower():
                                        note_data["likes"] = self._parse_count(text.split()[0])
                                    break
                                except:
                                    continue
                        except:
                            pass
                        
                        # 提取链接
                        try:
                            link_elem = elem.find_element("css selector", "a")
                            note_data["url"] = link_elem.get_attribute("href")
                        except:
                            note_data["url"] = ""
                        
                        if note_data.get("title") or note_data.get("url"):
                            notes.append(note_data)
                            
                    except Exception as e:
                        logger.debug(f"提取单条笔记失败: {e}")
                        continue
                
                # 滚动页面
                self.browser.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                self.browser.random_wait(2, 3)
                
                new_height = self.browser.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
                scroll_attempts += 1
            
            return notes
            
        except Exception as e:
            logger.error(f"提取蒲公英笔记失败: {e}")
            return []
    
    def crawl_user(self, user_url: str, max_notes: int = 10) -> Optional[Dict[str, Any]]:
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
        logger.info(f"开始采集{platform_type}用户: {user_url}")
        
        try:
            # 初始化浏览器
            self.browser.init_browser()
            
            # 登录
            if not self._login():
                logger.error("登录失败，无法继续采集")
                return None
            
            # 访问用户主页
            self.browser.driver.get(user_url)
            self.browser.random_wait(3, 5)
            
            # 根据页面类型选择不同的提取方法
            if is_pgy:
                logger.info("检测到蒲公英页面，使用蒲公英采集模式")
                user_info = self._extract_pgy_user_info()
                notes = self._extract_pgy_notes(max_notes)
            else:
                logger.info("使用标准小红书采集模式")
                user_info = self._extract_user_info()
                notes = self._extract_notes(max_notes)
            
            user_data = {
                "platform": self.platform_name,
                "user_url": user_url,
                "user_id": extract_user_id_from_url(user_url) or "pgy_user",
                "nickname": user_info.get("nickname", ""),
                "avatar": user_info.get("avatar", ""),
                "description": user_info.get("description", ""),
                "followers": user_info.get("followers", 0),
                "following": user_info.get("following", 0),
                "likes": user_info.get("likes", 0),
                "notes_count": len(notes),
                "notes": notes,
                "crawl_time": datetime.now().isoformat(),
                "source": "pgy" if is_pgy else "xhs"
            }
            
            logger.info(f"用户采集完成: {user_info.get('nickname', '')}, 共 {len(notes)} 条笔记")
            return user_data
            
        except Exception as e:
            logger.error(f"采集用户失败: {e}")
            return None
        finally:
            self.browser.close()
    
    def get_note_detail(self, note_url: str) -> Optional[Dict[str, Any]]:
        """
        获取笔记详情（使用selenium-wire拦截API请求）
        
        Args:
            note_url: 笔记详情页URL
        
        Returns:
            笔记详情数据
        """
        try:
            self.browser.init_browser()
            
            if not self._login():
                return None
            
            # 清除之前的网络请求记录
            self.browser.clear_network_requests()
            
            # 访问笔记详情页
            self.browser.driver.get(note_url)
            self.browser.random_wait(3, 5)
            
            # 获取拦截的API请求
            api_requests = self.browser.get_network_requests(
                url_pattern="edith.xiaohongshu.com",
                timeout=5
            )
            
            # 解析API响应数据
            note_detail = {
                "url": note_url,
                "api_requests": len(api_requests),
                "crawl_time": datetime.now().isoformat()
            }
            
            # 提取页面内容
            try:
                title_elem = self.browser.driver.find_element("css selector", "h1.title")
                note_detail["title"] = title_elem.text.strip()
            except:
                pass
            
            try:
                content_elem = self.browser.driver.find_element("css selector", ".content")
                note_detail["content"] = content_elem.text.strip()
            except:
                pass
            
            return note_detail
            
        except Exception as e:
            logger.error(f"获取笔记详情失败: {e}")
            return None
        finally:
            self.browser.close()


# 兼容性：保持原有接口
class XiaohongshuCrawler(XiaohongshuEnhancedCrawler):
    """兼容旧版接口"""
    pass
