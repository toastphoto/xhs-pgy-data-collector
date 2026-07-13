#!/usr/bin/env python3
"""
达人账号内容分析工具 - 启动脚本
"""
import sys
import os

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    os.chdir(sys._MEIPASS)
    sys.path.insert(0, sys._MEIPASS)
else:
    # 添加项目根目录到Python路径
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.api.server import app
from app.utils.config import Config

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("达人账号内容分析工具")
    print("=" * 60)
    print(f"\n服务地址: http://{Config.API_HOST}:{Config.API_PORT}")
    print(f"调试模式: {'开启' if Config.DEBUG else '关闭'}")
    print("\n按 Ctrl+C 停止服务\n")
    
    uvicorn.run(
        app,
        host=Config.API_HOST,
        port=Config.API_PORT,
        log_level="info"
    )
