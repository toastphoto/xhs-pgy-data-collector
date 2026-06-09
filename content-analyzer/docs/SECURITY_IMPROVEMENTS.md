# 安全策略改进文档

## 概述

参考 GitHub 仓库 `ypat999/KOL_daily_analyzer` 的代码后，我们对项目进行了以下安全策略改进。

---

## 主要改进点

### 1. 浏览器引擎升级

#### 原方案
- 使用标准 Selenium WebDriver
- 基础反检测配置

#### 改进后
- **使用 selenium-wire**：可以拦截和分析所有网络请求
  ```python
  from seleniumwire import webdriver
  
  # 获取拦截的请求
  for request in driver.requests:
      if 'api.xiaohongshu.com' in request.url:
          print(request.url, request.response.status_code)
  ```

- **增强的反指纹配置**：
  ```python
  # 禁用自动化特征
  options.add_argument("--disable-blink-features=AutomationControlled")
  options.add_experimental_option("excludeSwitches", ["enable-automation"])
  options.add_experimental_option("useAutomationExtension", False)
  
  # 禁用可能暴露自动化的服务
  options.add_experimental_option("prefs", {
      "gcm": {"enabled": False},
      "push_messaging": {"enabled": False},
      "service_worker": {"enabled": False},
  })
  ```

### 2. Cookie 持久化管理

#### 原方案
- 每次运行都需要重新登录
- 无Cookie保存机制

#### 改进后
- **自动保存Cookie**：
  ```python
  class CookieManager:
      def save(self, driver, domain, login_indicator):
          # 验证登录状态后保存
          cookies = driver.get_cookies()
          data = {
              "domain": domain,
              "saved_at": datetime.now().isoformat(),
              "cookies": cookies
          }
          # 保存到文件
  ```

- **自动加载Cookie**：
  ```python
  def load(self, driver, domain):
      # 从文件加载Cookie
      # 检查是否过期（7天）
      # 自动添加到浏览器
  ```

- **过期检查**：Cookie超过7天自动重新登录

### 3. 智能时间过滤

#### 原方案
- 无时间过滤功能
- 采集所有内容

#### 改进后
- **支持多种时间格式**：
  ```python
  def is_within_time_limit(publish_date: str, limit_hours: int = 18) -> bool:
      """
      支持格式：
      - '今天'
      - 'X小时前'
      - '昨天'
      - 'X天前'
      - '2025-01-01'
      - '01-01'
      """
  ```

- **灵活的时间控制**：
  - 可以只采集最近N小时的内容
  - 自动识别相对时间和绝对时间

### 4. 登录流程优化

#### 原方案
- 无登录状态管理
- 每次都需要处理登录

#### 改进后
- **智能登录检测**：
  ```python
  def _login(self):
      # 1. 尝试加载已保存的Cookie
      if self.cookie_manager.load(self.browser.driver, self.domain):
          # 2. 刷新验证登录状态
          if self.browser.check_login_status(self.login_selector):
              return True
      
      # 3. Cookie失效，需要手动登录
      print("请在浏览器中完成登录...")
      if self.browser.check_login_status(self.login_selector, timeout=120):
          # 4. 保存新Cookie
          self.cookie_manager.save(...)
          return True
  ```

### 5. 窗口尺寸优化

#### 原方案
- 使用标准窗口尺寸（1920x1080）
- 容易被识别为自动化工具

#### 改进后
- **使用较小的窗口尺寸**：
  ```python
  # 参考GitHub方案使用800x600
  options.add_argument("--window-size=800,600")
  ```
  - 更接近真实用户的浏览习惯
  - 降低被检测概率

### 6. 网络请求拦截

#### 新增功能
- **API请求捕获**：
  ```python
  def get_network_requests(self, url_pattern: str = None):
      """
      获取拦截的网络请求
      可用于提取API数据、分析请求参数等
      """
      for request in self.driver.requests:
          if request.response and url_pattern in request.url:
              yield {
                  "url": request.url,
                  "method": request.method,
                  "headers": dict(request.headers),
                  "response": request.response.body
              }
  ```

---

## 文件变更

### 新增文件

1. **`app/core/enhanced_browser.py`**
   - 增强版浏览器引擎
   - Cookie管理器
   - 时间过滤工具

2. **`app/platforms/xiaohongshu_enhanced.py`**
   - 小红书增强版爬虫
   - 整合所有安全策略

### 修改文件

1. **`requirements.txt`**
   - 添加 `selenium-wire==5.1.0`

---

## 使用示例

### 基础使用

```python
from app.platforms.xiaohongshu_enhanced import XiaohongshuEnhancedCrawler

# 创建爬虫实例
crawler = XiaohongshuEnhancedCrawler()

# 采集用户数据
user_data = crawler.crawl_user(
    user_url="https://www.xiaohongshu.com/user/profile/xxx",
    max_notes=10
)

print(f"用户: {user_data['nickname']}")
print(f"笔记数: {len(user_data['notes'])}")
```

### 使用网络请求拦截

```python
# 获取笔记详情并拦截API请求
note_detail = crawler.get_note_detail("https://www.xiaohongshu.com/explore/xxx")

# 查看拦截的API请求
print(f"拦截到 {note_detail['api_requests']} 个API请求")
```

### Cookie管理

```python
from app.core.enhanced_browser import CookieManager

cookie_manager = CookieManager()

# 保存Cookie
cookie_manager.save(driver, "xiaohongshu.com", ".user-info")

# 加载Cookie
cookie_manager.load(driver, "xiaohongshu.com")
```

---

## 安全建议

1. **首次登录**：
   - 首次运行时需要手动登录
   - 登录成功后Cookie会自动保存
   - 后续运行会自动使用保存的Cookie

2. **Cookie过期**：
   - Cookie有效期为7天
   - 过期后会提示重新登录
   - 建议定期更新Cookie

3. **使用代理**：
   - 在 `.env` 文件中配置代理
   - 每次请求会随机选择代理
   - 降低IP被封风险

4. **请求频率**：
   - 保持默认的3-6秒随机延迟
   - 不要过于频繁地采集
   - 建议每次采集间隔1小时以上

---

## 与原方案的对比

| 功能 | 原方案 | 改进后 |
|------|--------|--------|
| 浏览器引擎 | 标准Selenium | selenium-wire |
| Cookie管理 | 无 | 自动保存/加载 |
| 时间过滤 | 无 | 智能时间过滤 |
| 窗口尺寸 | 1920x1080 | 800x600 |
| 网络拦截 | 无 | 支持API拦截 |
| 反检测 | 基础 | 增强 |
| 登录流程 | 每次手动 | Cookie自动管理 |

---

## 参考项目

- **GitHub**: https://github.com/ypat999/KOL_daily_analyzer
- **主要参考**: `bili_summary.py` 中的浏览器配置和Cookie管理

---

## 后续优化方向

1. **多线程支持**：参考GitHub方案实现多账号并行采集
2. **智能重试**：增强错误处理和自动重试机制
3. **数据缓存**：实现本地数据缓存，避免重复采集
4. **定时任务**：支持定时自动采集更新
