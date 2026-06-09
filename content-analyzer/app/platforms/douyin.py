"""
抖音爬虫实现
"""
import re
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

from selenium.webdriver.common.by import By

from app.core.base_crawler import BaseCrawler
from app.core.browser_engine import BrowserEngine
from app.utils.logger import get_logger
from app.utils.helpers import clean_text, format_number, extract_user_id_from_url

logger = get_logger(__name__)

class DouYinCrawler(BaseCrawler):
    """抖音爬虫"""
    
    platform_name = "douyin"
    base_url = "https://www.douyin.com"
    
    def __init__(self, use_proxy: bool = None, use_browser: bool = True):
        super().__init__(use_proxy)
        self.use_browser = use_browser
        self.browser: Optional[BrowserEngine] = None
    
    def _init_browser(self):
        """初始化浏览器"""
        if self.use_browser and not self.browser:
            self.browser = BrowserEngine()
            self.browser.start()
    
    def _close_browser(self):
        """关闭浏览器"""
        if self.browser:
            self.browser.quit()
            self.browser = None
    
    def crawl_user(self, user_url: str, max_videos: int = 10) -> Dict[str, Any]:
        """
        爬取抖音用户数据
        
        Args:
            user_url: 用户主页URL
            max_videos: 最大采集视频数
            
        Returns:
            用户数据字典
        """
        logger.info(f"开始采集抖音用户: {user_url}")
        
        try:
            self._init_browser()
            
            # 访问用户主页
            self.browser.get(user_url)
            self.browser.random_wait()
            
            # 处理可能的登录弹窗
            self._handle_login_popup()
            
            # 获取用户信息
            user_info = self._extract_user_info()
            
            # 获取视频列表
            videos = self._extract_videos(max_videos)
            
            user_data = {
                "platform": self.platform_name,
                "user_url": user_url,
                "user_id": extract_user_id_from_url(user_url),
                "nickname": user_info.get("nickname", ""),
                "avatar": user_info.get("avatar", ""),
                "description": user_info.get("description", ""),
                "followers": user_info.get("followers", 0),
                "following": user_info.get("following", 0),
                "likes": user_info.get("likes", 0),
                "videos_count": user_info.get("videos_count", 0),
                "videos": videos,
                "crawl_time": datetime.now().isoformat()
            }
            
            return user_data
            
        except Exception as e:
            logger.error(f"采集抖音用户失败: {e}")
            return None
        finally:
            self._close_browser()
    
    def _handle_login_popup(self):
        """处理登录弹窗"""
        try:
            # 查找关闭按钮
            close_btn = self.browser.find_element(
                By.CSS_SELECTOR,
                'div[class*="close"], [class*="dismiss"], button[class*="close"]',
                timeout=3
            )
            if close_btn:
                self.browser.natural_click(close_btn)
                logger.info("关闭登录弹窗")
        except:
            pass
    
    def _extract_user_info(self) -> Dict[str, Any]:
        """提取用户信息"""
        user_info = {}
        
        try:
            # 昵称
            nickname_elem = self.browser.find_element(
                By.CSS_SELECTOR,
                'h1[class*="nickname"], span[class*="nickname"], [data-e2e="user-title"]'
            )
            if nickname_elem:
                user_info["nickname"] = nickname_elem.text.strip()
            
            # 头像
            avatar_elem = self.browser.find_element(By.CSS_SELECTOR, 'img[class*="avatar"], [class*="user-avatar"] img')
            if avatar_elem:
                user_info["avatar"] = avatar_elem.get_attribute('src')
            
            # 简介
            desc_elem = self.browser.find_element(
                By.CSS_SELECTOR,
                'div[class*="signature"], [class*="desc"], [data-e2e="user-desc"]'
            )
            if desc_elem:
                user_info["description"] = desc_elem.text.strip()
            
            # 统计数据
            stats = self._extract_stats()
            user_info.update(stats)
            
            logger.info(f"获取用户信息: {user_info.get('nickname', 'Unknown')}")
            
        except Exception as e:
            logger.warning(f"提取用户信息失败: {e}")
        
        return user_info
    
    def _extract_stats(self) -> Dict[str, int]:
        """提取统计数据"""
        stats = {}
        
        try:
            # 查找所有统计元素
            stat_elems = self.browser.find_elements(
                By.CSS_SELECTOR,
                '[class*="count"], [data-e2e="user-tab-count"], div[class*="number"]'
            )
            
            for elem in stat_elems:
                text = elem.text.strip()
                parent = elem.find_element(By.XPATH, '..')
                parent_text = parent.text.strip()
                
                if '粉丝' in parent_text or 'follower' in parent_text.lower():
                    stats["followers"] = format_number(text)
                elif '关注' in parent_text or 'following' in parent_text.lower():
                    stats["following"] = format_number(text)
                elif '获赞' in parent_text or 'like' in parent_text.lower():
                    stats["likes"] = format_number(text)
                elif '作品' in parent_text or 'video' in parent_text.lower():
                    stats["videos_count"] = format_number(text)
            
        except Exception as e:
            logger.warning(f"提取统计数据失败: {e}")
        
        return stats
    
    def _extract_videos(self, max_videos: int = 10) -> List[Dict[str, Any]]:
        """提取视频列表"""
        videos = []
        collected = 0
        scroll_count = 0
        max_scroll = (max_videos // 6) + 3
        
        while collected < max_videos and scroll_count < max_scroll:
            # 查找视频卡片
            video_cards = self.browser.find_elements(
                By.CSS_SELECTOR,
                'div[data-e2e="user-post-list"] a, div[class*="video-card"], a[href*="/video/"]'
            )
            
            logger.info(f"找到 {len(video_cards)} 个视频卡片")
            
            for card in video_cards:
                if collected >= max_videos:
                    break
                
                try:
                    video = self._parse_video_card(card)
                    if video and video not in videos:
                        videos.append(video)
                        collected += 1
                        logger.info(f"已采集 {collected}/{max_videos} 条视频")
                except Exception as e:
                    logger.warning(f"解析视频卡片失败: {e}")
                    continue
            
            # 滚动加载更多
            if collected < max_videos:
                self.browser.natural_scroll()
                scroll_count += 1
                self.browser.delay.sleep_short()
        
        return videos
    
    def _parse_video_card(self, card) -> Optional[Dict[str, Any]]:
        """解析单个视频卡片"""
        try:
            video = {}
            
            # 视频链接
            href = card.get_attribute('href')
            if href:
                video["url"] = href
                # 提取视频ID
                match = re.search(r'/video/(\d+)', href)
                if match:
                    video["video_id"] = match.group(1)
            
            # 封面图
            img_elem = card.find_element(By.CSS_SELECTOR, 'img')
            if img_elem:
                video["cover"] = img_elem.get_attribute('src')
            
            # 标题/描述
            title_elem = card.find_element(By.CSS_SELECTOR, '[class*="title"], [class*="desc"]')
            if title_elem:
                video["title"] = clean_text(title_elem.text)
            
            # 播放量
            play_elem = card.find_element(By.CSS_SELECTOR, '[class*="play-count"], span[class*="view"]')
            if play_elem:
                video["play_count"] = format_number(play_elem.text)
            
            # 点赞数
            like_elem = card.find_element(By.CSS_SELECTOR, '[class*="like"], [class*="heart"]')
            if like_elem:
                video["likes"] = format_number(like_elem.text)
            
            return video
            
        except Exception as e:
            logger.debug(f"解析视频卡片异常: {e}")
            return None
    
    def parse_note(self, note_data: Dict) -> Dict[str, Any]:
        """
        标准化视频数据格式
        
        Args:
            note_data: 原始视频数据
            
        Returns:
            标准化视频数据
        """
        return {
            "platform": self.platform_name,
            "video_id": note_data.get("video_id", ""),
            "url": note_data.get("url", ""),
            "title": note_data.get("title", ""),
            "cover": note_data.get("cover", ""),
            "play_count": note_data.get("play_count", 0),
            "likes": note_data.get("likes", 0),
            "comments": note_data.get("comments", 0),
            "shares": note_data.get("shares", 0),
            "duration": note_data.get("duration", 0),
            "publish_time": note_data.get("publish_time", ""),
            "crawl_time": datetime.now().isoformat()
        }
    
    def crawl_video_detail(self, video_url: str) -> Dict[str, Any]:
        """
        爬取视频详情
        
        Args:
            video_url: 视频URL
            
        Returns:
            视频详情数据
        """
        logger.info(f"采集视频详情: {video_url}")
        
        try:
            self._init_browser()
            self.browser.get(video_url)
            self.browser.random_wait()
            
            detail = {}
            
            # 标题
            title_elem = self.browser.find_element(
                By.CSS_SELECTOR,
                '[data-e2e="video-desc"], h1[class*="title"], span[class*="title"]'
            )
            if title_elem:
                detail["title"] = title_elem.text.strip()
            
            # 互动数据
            detail["likes"] = self._extract_detail_count('赞')
            detail["comments"] = self._extract_detail_count('评论')
            detail["shares"] = self._extract_detail_count('分享')
            detail["collects"] = self._extract_detail_count('收藏')
            
            # 发布时间
            time_elem = self.browser.find_element(By.CSS_SELECTOR, 'span[class*="time"], [class*="publish-time"]')
            if time_elem:
                detail["publish_time"] = time_elem.text.strip()
            
            # 视频标签
            tag_elems = self.browser.find_elements(By.CSS_SELECTOR, 'a[href*="/tag/"], span[class*="tag"]')
            detail["tags"] = [tag.text.strip() for tag in tag_elems]
            
            return detail
            
        except Exception as e:
            logger.error(f"采集视频详情失败: {e}")
            return {}
        finally:
            self._close_browser()
    
    def _extract_detail_count(self, label: str) -> int:
        """提取详情页计数"""
        try:
            elems = self.browser.find_elements(By.CSS_SELECTOR, '[data-e2e], span, div')
            for elem in elems:
                text = elem.text.strip()
                if label in text:
                    # 提取数字
                    numbers = re.findall(r'[\d.]+[w万k千]?', text)
                    if numbers:
                        return format_number(numbers[0])
        except:
            pass
        return 0
