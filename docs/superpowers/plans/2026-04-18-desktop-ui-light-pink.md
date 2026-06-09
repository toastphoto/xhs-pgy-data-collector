# Desktop UI Light Pink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面端 UI 升级为“浅色 + 柔和粉”现代办公风格，并重点重做导出页的列勾选 UI（不拥挤、更美观），不改变业务逻辑。

**Architecture:** 仅改 renderer 的 CSS 与少量 DOM 结构/布局；保持 main/preload/采集导出 IPC 不变。

**Tech Stack:** Electron renderer（vanilla JS + app.css）。

---

## Spec（来源）

- `docs/superpowers/specs/2026-04-18-desktop-ui-light-pink-design.md`

---

## Files

**Modify**
- `desktop-app/renderer/app.css`：引入浅色主题 token、统一组件样式、调整布局密度
- `desktop-app/renderer/app.js`：必要时增加少量 class 便于样式应用（尽量少改）
- `desktop-app/renderer/views/exports.js`：列勾选区改为“两栏 + sticky 操作条”布局

---

### Task 1: app.css 引入浅色主题与组件规范

**Files:**
- Modify: `desktop-app/renderer/app.css`

- [ ] **Step 1: 定义 CSS 变量（tokens）**

在文件顶部替换/新增：

```css
:root{
  --bg: #FAFAFB;
  --panel: #FFFFFF;
  --line: #E7E8EE;
  --text: #111827;
  --muted: #6B7280;
  --primary: #E85A9A;
  --primary-weak: #FFE4F0;
  --shadow: 0 8px 24px rgba(17,24,39,0.08);
  --radius: 12px;
}
```

- [ ] **Step 2: 全局背景/字体**

```css
html,body{ background: var(--bg); color: var(--text); font-size:14px; }
```

- [ ] **Step 3: Topbar / Sidebar / Content**

将深色背景改为浅色面板，边框使用 `--line`，并提高间距。

- [ ] **Step 4: 组件统一**

统一 `.btn/.tpl-input/.nav-item`：
- 主按钮：粉色底
- 次按钮：描边
- 输入框：浅边框 + 聚焦粉色 ring

- [ ] **Step 5: 手动验收**

启动 `npm run dev`，确认整体变浅色且可读。

---

### Task 2: exports 列勾选 UI 重排（两栏 + sticky）

**Files:**
- Modify: `desktop-app/renderer/views/exports.js`

- [ ] **Step 1: 将列勾选区布局改为两栏**

结构：
- 左：分组列表（点击切换当前分组）
- 右：列 checkbox 列表（支持搜索）

- [ ] **Step 2: sticky 操作条**

底部固定：
- 已选/总计
- 导出精简版按钮

- [ ] **Step 3: 手动验收**

确认不拥挤、可滚动、按钮层级清晰。

---

### Task 3: 轻量 polish（可选）

**Files:**
- Modify: `desktop-app/renderer/app.js`（仅在需要更多 class 时）

- [ ] 增加少量 class 标记以便 CSS 定位（例如 `topbar` 内的 title/addr/status）

---

## Verification checklist

- 导出页列勾选区不再挤在一起
- 全局字体颜色对比正常，不出现“看不清”
- 不影响原有功能按钮与 IPC 调用

