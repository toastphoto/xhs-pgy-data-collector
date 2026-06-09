#!/usr/bin/env python3
"""
创建示例Excel文件
"""
import pandas as pd
from pathlib import Path

def create_sample_excel():
    """创建示例账号列表Excel文件"""
    
    # 示例数据
    data = {
        '平台': ['小红书', '抖音', '小红书', '抖音'],
        '账号名称': ['时尚博主小王', '美妆达人Lisa', '旅行摄影师', '美食探店达人'],
        '主页链接': [
            'https://www.xiaohongshu.com/user/profile/xxx',
            'https://www.douyin.com/user/xxx',
            'https://www.xiaohongshu.com/user/profile/yyy',
            'https://www.douyin.com/user/yyy'
        ],
        '备注': ['重点关注', '', '旅行内容', '美食内容']
    }
    
    # 创建DataFrame
    df = pd.DataFrame(data)
    
    # 保存Excel
    output_path = Path(__file__).parent / 'sample_accounts.xlsx'
    df.to_excel(output_path, index=False, engine='openpyxl')
    
    print(f"示例文件已创建: {output_path}")
    print("\n文件内容:")
    print(df.to_string())

if __name__ == "__main__":
    create_sample_excel()
