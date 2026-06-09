"""
日志配置
"""
import sys
from pathlib import Path
from loguru import logger
from .config import Config

Config.init_dirs()

logger.remove()

log_format = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"

logger.add(
    sys.stdout,
    format=log_format,
    level="INFO",
    colorize=True
)

logger.add(
    Config.LOG_DIR / "app.log",
    format=log_format,
    level="DEBUG",
    rotation="10 MB",
    retention="7 days",
    encoding="utf-8"
)

logger.add(
    Config.LOG_DIR / "error.log",
    format=log_format,
    level="ERROR",
    rotation="10 MB",
    retention="30 days",
    encoding="utf-8"
)

def get_logger(name: str = None):
    """获取logger实例"""
    return logger.bind(name=name) if name else logger
