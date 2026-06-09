"""
基础爬虫类 - 整合反爬策略
"""
import json
import time
import random
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from app.utils.config import Config
from app.utils.logger import get_logger
from app.utils.helpers import (
    ProxyPool, DelayController, ua_pool,
    clean_text, format_number
)

logger = get_logger(__name__)

class BaseCrawler(ABC):
    """基础爬虫类"""
    
    platform_name = "base"
    base_url = ""
    
    def __init__(self, use_proxy: bool = None):
        self.use_proxy = use_proxy if use_proxy is not None else Config.USE_PROXY
        self.proxy_pool = ProxyPool(Config.PROXY_LIST) if self.use_proxy else None
        self.delay = DelayController(Config.MIN_DELAY, Config.MAX_DELAY)
        self.session = requests.Session()
        self._init_session()
    
    def _init_session(self):
        """初始化请求会话"""
        self.session.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
        })
    
    def _update_headers(self, headers: Dict[str, str] = None):
        """更新请求头"""
        if headers:
            self.session.headers.update(headers)
        self.session.headers['User-Agent'] = ua_pool.get_random_ua()
    
    def _make_request(
        self, 
        url: str, 
        method: str = 'GET',
        params: Dict = None,
        data: Dict = None,
        headers: Dict = None,
        json_data: Dict = None,
        retry_count: int = 0
    ) -> Optional[requests.Response]:
        """
        带重试机制的请求封装
        
        Args:
            url: 请求URL
            method: 请求方法
            params: URL参数
            data: 表单数据
            headers: 自定义请求头
            json_data: JSON数据
            retry_count: 当前重试次数
            
        Returns:
            Response对象或None
        """
        if retry_count >= Config.MAX_RETRIES:
            logger.error(f"达到最大重试次数: {url}")
            return None
        
        self._update_headers(headers)
        
        proxy = self.proxy_pool.get_proxy() if self.proxy_pool else None
        
        try:
            logger.debug(f"请求: {method} {url}")
            
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                data=data,
                json=json_data,
                proxies=proxy,
                timeout=Config.REQUEST_TIMEOUT,
                allow_redirects=True
            )
            
            if response.status_code == 200:
                return response
            elif response.status_code == 403:
                logger.warning(f"触发反爬机制(403): {url}")
                if self.proxy_pool:
                    self.proxy_pool.rotate()
                time.sleep(5)
                return self._make_request(url, method, params, data, headers, json_data, retry_count + 1)
            elif response.status_code == 429:
                logger.warning(f"请求过于频繁(429): {url}")
                time.sleep(10)
                return self._make_request(url, method, params, data, headers, json_data, retry_count + 1)
            else:
                logger.warning(f"请求失败({response.status_code}): {url}")
                return None
                
        except requests.exceptions.ProxyError as e:
            logger.warning(f"代理错误: {e}")
            if self.proxy_pool and proxy:
                self.proxy_pool.mark_failed(proxy.get('http', ''))
            return self._make_request(url, method, params, data, headers, json_data, retry_count + 1)
        except requests.exceptions.Timeout:
            logger.warning(f"请求超时: {url}")
            return self._make_request(url, method, params, data, headers, json_data, retry_count + 1)
        except Exception as e:
            logger.error(f"请求异常: {e}")
            return self._make_request(url, method, params, data, headers, json_data, retry_count + 1)
    
    def _get_json(self, url: str, **kwargs) -> Optional[Dict]:
        """获取JSON数据"""
        response = self._make_request(url, **kwargs)
        if response:
            try:
                return response.json()
            except json.JSONDecodeError:
                logger.error(f"JSON解析失败: {url}")
        return None
    
    def _get_html(self, url: str, **kwargs) -> Optional[BeautifulSoup]:
        """获取HTML并解析"""
        response = self._make_request(url, **kwargs)
        if response:
            return BeautifulSoup(response.text, 'lxml')
        return None
    
    @abstractmethod
    def crawl_user(self, user_url: str, max_notes: int = 10) -> Dict[str, Any]:
        """
        爬取用户数据
        
        Args:
            user_url: 用户主页URL
            max_notes: 最大采集笔记数
            
        Returns:
            用户数据字典
        """
        pass
    
    @abstractmethod
    def parse_note(self, note_data: Dict) -> Dict[str, Any]:
        """
        解析单条笔记数据
        
        Args:
            note_data: 原始笔记数据
            
        Returns:
            标准化笔记数据
        """
        pass
    
    def crawl_users(self, user_urls: List[str], max_notes: int = 10) -> List[Dict[str, Any]]:
        """
        批量爬取多个用户
        
        Args:
            user_urls: 用户URL列表
            max_notes: 每个用户最大采集数
            
        Returns:
            用户数据列表
        """
        results = []
        total = len(user_urls)
        
        for idx, url in enumerate(user_urls, 1):
            logger.info(f"[{idx}/{total}] 正在采集: {url}")
            
            try:
                user_data = self.crawl_user(url, max_notes)
                if user_data:
                    results.append(user_data)
                    logger.success(f"成功采集用户: {user_data.get('nickname', 'Unknown')}")
                else:
                    logger.warning(f"采集失败: {url}")
            except Exception as e:
                logger.error(f"采集异常: {url}, 错误: {e}")
            
            # 用户间延迟
            if idx < total:
                self.delay.sleep()
        
        return results
