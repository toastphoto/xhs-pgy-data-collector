#!/usr/bin/env python3
"""
AI 分析模块 - 集成 comfly.chat API
用于分析社交媒体内容
"""
import os
import json
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from loguru import logger

from app.utils.config import Config


@dataclass
class AnalysisResult:
    """分析结果"""
    summary: str  # 内容摘要
    keywords: List[str]  # 关键词
    sentiment: str  # 情感倾向（正面/负面/中性）
    tags: List[str]  # 标签
    suggestions: str  # 建议
    raw_response: str  # 原始响应


class AIAnalyzer:
    """
    AI 内容分析器
    使用 comfly.chat API 进行内容分析
    """
    
    def __init__(self, api_key: str = None, base_url: str = None):
        """
        初始化 AI 分析器
        
        Args:
            api_key: API 密钥，默认从环境变量读取
            base_url: API 基础 URL
        """
        self.api_key = api_key or os.getenv("COMFLY_API_KEY")
        self.base_url = base_url or os.getenv("COMFLY_BASE_URL", "https://ai.comfly.chat/v1")
        self.model = os.getenv("COMFLY_MODEL", "gpt-5.4")
        
        if not self.api_key:
            logger.warning("未设置 API Key，AI 分析功能将不可用")
    
    def _call_api(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> Optional[str]:
        """
        调用 comfly.chat API
        
        Args:
            messages: 消息列表
            temperature: 温度参数
            
        Returns:
            AI 响应内容
        """
        if not self.api_key:
            logger.error("API Key 未设置")
            return None
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2000
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API 调用失败: {e}")
            return None
        except (KeyError, IndexError) as e:
            logger.error(f"解析响应失败: {e}")
            return None
    
    def analyze_content(self, content: str, content_type: str = "笔记") -> Optional[AnalysisResult]:
        """
        分析单条内容
        
        Args:
            content: 内容文本
            content_type: 内容类型（笔记/视频/文章）
            
        Returns:
            分析结果
        """
        system_prompt = f"""你是一个专业的社交媒体内容分析专家。请分析以下{content_type}内容，并以 JSON 格式返回分析结果。

请返回以下格式的 JSON：
{{
    "summary": "内容的简短摘要，50字以内",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "sentiment": "正面/负面/中性",
    "tags": ["标签1", "标签2"],
    "suggestions": "针对这条内容的运营建议"
}}

注意：
1. 必须返回合法的 JSON 格式
2. 关键词提取 3-5 个最核心的
3. 标签应该是内容分类，如：美妆、穿搭、美食、旅行等
4. 情感倾向只能是：正面、负面、中性 三者之一"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content}
        ]
        
        response = self._call_api(messages, temperature=0.5)
        
        if not response:
            return None
        
        try:
            # 提取 JSON 部分
            json_str = self._extract_json(response)
            result = json.loads(json_str)
            
            return AnalysisResult(
                summary=result.get("summary", ""),
                keywords=result.get("keywords", []),
                sentiment=result.get("sentiment", "中性"),
                tags=result.get("tags", []),
                suggestions=result.get("suggestions", ""),
                raw_response=response
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            logger.debug(f"原始响应: {response}")
            return None
    
    def analyze_user_profile(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        分析用户画像
        
        Args:
            user_data: 用户数据字典
            
        Returns:
            用户画像分析结果
        """
        system_prompt = """你是一个专业的社交媒体用户画像分析专家。请分析以下用户数据，并以 JSON 格式返回分析结果。

请返回以下格式的 JSON：
{
    "profile_summary": "用户整体画像描述，100字以内",
    "content_style": "内容风格特点",
    "audience_analysis": "目标受众分析",
    "strengths": ["优势1", "优势2"],
    "improvements": ["改进建议1", "改进建议2"],
    "collaboration_value": "合作价值评估（高/中/低）",
    "suitable_brands": ["适合合作的品牌类型1", "类型2"]
}

注意：必须返回合法的 JSON 格式。"""

        # 构建用户数据文本
        user_text = f"""
平台：{user_data.get('platform', '')}
昵称：{user_data.get('nickname', '')}
简介：{user_data.get('description', '')}
粉丝数：{user_data.get('followers', 0)}
关注数：{user_data.get('following', 0)}
内容数：{user_data.get('notes_count', 0)}

最新内容：
"""
        
        contents = user_data.get('notes', []) or user_data.get('videos', [])
        for i, content in enumerate(contents[:5], 1):
            user_text += f"\n{i}. {content.get('title', '')}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ]
        
        response = self._call_api(messages, temperature=0.7)
        
        if not response:
            return None
        
        try:
            json_str = self._extract_json(response)
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            return None
    
    def compare_users(self, users_data: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        对比多个用户
        
        Args:
            users_data: 多个用户的数据列表
            
        Returns:
            对比分析结果
        """
        system_prompt = """你是一个专业的社交媒体数据分析专家。请对比分析以下多个账号，并以 JSON 格式返回分析结果。

请返回以下格式的 JSON：
{
    "comparison_summary": "整体对比总结",
    "ranking": [
        {"rank": 1, "nickname": "昵称", "reason": "排名原因"}
    ],
    "similarities": "共同点分析",
    "differences": "差异点分析",
    "recommendations": "针对不同需求的推荐"
}

注意：必须返回合法的 JSON 格式。"""

        # 构建对比文本
        comparison_text = "需要对比的账号：\n\n"
        
        for i, user in enumerate(users_data, 1):
            comparison_text += f"""账号 {i}：
- 平台：{user.get('platform', '')}
- 昵称：{user.get('nickname', '')}
- 粉丝数：{user.get('followers', 0)}
- 简介：{user.get('description', '')}
- 内容数：{len(user.get('notes', []) or user.get('videos', []))}

"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": comparison_text}
        ]
        
        response = self._call_api(messages, temperature=0.7)
        
        if not response:
            return None
        
        try:
            json_str = self._extract_json(response)
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            return None
    
    def generate_report(self, crawl_data: List[Dict[str, Any]]) -> Optional[str]:
        """
        生成整体分析报告
        
        Args:
            crawl_data: 采集的所有数据
            
        Returns:
            报告文本
        """
        system_prompt = """你是一个专业的社交媒体数据分析专家。请根据以下采集的数据，生成一份详细的分析报告。

报告应该包含：
1. 执行摘要
2. 账号概览
3. 内容分析
4. 趋势洞察
5. 建议与结论

请用 Markdown 格式输出报告。"""

        # 构建数据摘要
        data_summary = f"""本次共采集 {len(crawl_data)} 个账号的数据

"""
        
        for user in crawl_data:
            data_summary += f"""账号：{user.get('nickname', '')}
平台：{user.get('platform', '')}
粉丝数：{user.get('followers', 0)}
内容数：{len(user.get('notes', []) or user.get('videos', []))}

"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": data_summary}
        ]
        
        return self._call_api(messages, temperature=0.7)
    
    def _extract_json(self, text: str) -> str:
        """
        从文本中提取 JSON 字符串
        
        Args:
            text: 包含 JSON 的文本
            
        Returns:
            JSON 字符串
        """
        # 尝试直接解析
        text = text.strip()
        
        # 如果文本被 ```json 和 ``` 包裹
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            return text[start:end].strip()
        
        # 如果文本被 ``` 和 ``` 包裹
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            return text[start:end].strip()
        
        # 直接返回
        return text


# 便捷函数
def analyze_single_content(content: str, api_key: str = None) -> Optional[AnalysisResult]:
    """便捷函数：分析单条内容"""
    analyzer = AIAnalyzer(api_key)
    return analyzer.analyze_content(content)


def analyze_user(user_data: Dict[str, Any], api_key: str = None) -> Optional[Dict[str, Any]]:
    """便捷函数：分析用户"""
    analyzer = AIAnalyzer(api_key)
    return analyzer.analyze_user_profile(user_data)
