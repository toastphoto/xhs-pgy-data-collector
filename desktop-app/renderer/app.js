import { enhanceWorkspace } from './native-workflow.js';
import { store } from './state/store.js';
import { renderLogin } from './views/login.js';
import { renderRecordings } from './views/recordings.js';
import { renderTemplates } from './views/templates.js';
import { renderTasks } from './views/tasks.js';
import { renderExports } from './views/exports.js';
import { renderReport } from './views/report_chat.js';
import { renderToolbox } from './views/toolbox.js';
import {
  WORKSPACE_LAYOUT_LIMITS,
  getWorkspaceLayoutBounds,
  normalizeWorkspaceLayout,
  readWorkspaceLayout,
  writeWorkspaceLayout
} from './state/workspace_layout.mjs';

const views = {
  login: renderLogin,
  recordings: renderRecordings,
  templates: renderTemplates,
  tasks: renderTasks,
  exports: renderExports,
  report: renderReport,
  toolbox: renderToolbox
};

let lastRenderedView = '';

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
  });
  children.forEach((c) => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}

function renderSafely(name, render) {
  try {
    render();
  } catch (err) {
    console.error(`[renderer] ${name} render failed`, err);
    if (window.__renderAppError) window.__renderAppError(err);
  }
}

function renderSidebar(state) {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.childElementCount) {
    sidebar.querySelectorAll('.nav-item').forEach(item => {
      const active = item.dataset.view === state.view;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    sidebar.querySelectorAll('.flow-strip span').forEach((item, index) => {
      item.classList.toggle('current', ['login', 'tasks', 'exports'][index] === state.view);
    });
    return;
  }
  sidebar.setAttribute('aria-label', '工作台导航');
  sidebar.innerHTML = '';

  const iconSvg = (d) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const icons = {
    login: iconSvg('M15 3h4a2 2 0 0 1 2 2v4 M9 21H5a2 2 0 0 1-2-2v-4 M21 15v4a2 2 0 0 1-2 2h-4 M3 9V5a2 2 0 0 1 2-2h4'),
    recordings: iconSvg('M9 8l6 4-6 4V8 Z M21 12a9 9 0 1 1-9-9'),
    templates: iconSvg('M6 2h9l3 3v17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 Z M9 9h6 M9 13h6 M9 17h4'),
    tasks: iconSvg('M9 11l3 3L22 4 M2 12h6 M2 6h6 M2 18h6'),
    exports: iconSvg('M12 3v12 M8 7l4-4 4 4 M5 21h14a2 2 0 0 0 2-2v-4 M3 15v4a2 2 0 0 0 2 2'),
    report: iconSvg('M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-4-4H6a2 2 0 0 0-2 2v14 Z M8 11h8 M8 15h8'),
    toolbox: iconSvg('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a6 6 0 0 1-7.9 7.9l-5.6 5.6a2.1 2.1 0 0 1-3-3l5.6-5.6a6 6 0 0 1 7.9-7.9l-3.1 3.1 Z')
  };

  const groups = [
    {
      label: '日常流程',
      items: [
        ['login', '开始', '登录账号，确认右侧网页可用'],
        ['tasks', '找达人', '搜索、导入、整理候选达人'],
        ['exports', '复核建联', '筛选达人并导出建联表']
      ]
    },
    {
      label: '辅助能力',
      items: [
        ['templates', '采集校准', '点选页面，教系统采集'],
        ['report', 'AI 分析', '报告与问答'],
        ['toolbox', '工具箱', '维护、排查和低频工具']
      ]
    }
  ];

  const brand = h('div', { class: 'brand-block' }, [
    h('div', { class: 'brand' }, ['蒲公英达人工作台']),
    h('div', { class: 'sidebar-footer' }, ['找达人、复核名单、导出建联表'])
  ]);
  sidebar.appendChild(brand);

  const flow = h('div', { class: 'flow-strip' }, [
    h('span', { class: state.view === 'login' ? 'current' : '' }, ['01 准备']),
    h('span', { class: state.view === 'tasks' ? 'current' : '' }, ['02 采集']),
    h('span', { class: state.view === 'exports' ? 'current' : '' }, ['03 建联'])
  ]);
  sidebar.appendChild(flow);

  const navList = document.createElement('div');
  navList.className = 'nav-list';
  groups.forEach((group) => {
    navList.appendChild(h('div', { class: 'nav-group-label' }, [group.label]));
    group.items.forEach(([key, label, desc]) => {
      const icon = document.createElement('span');
      icon.className = 'nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = icons[key] || '';
      const text = h('span', { class: 'nav-text' }, [
        h('span', { class: 'nav-label' }, [label]),
        h('span', { class: 'nav-desc' }, [desc])
      ]);
      navList.appendChild(
        h(
          'button',
          {
            class: `nav-item ${state.view === key ? 'active' : ''}`,
            'data-view': key,
            'aria-label': label,
            title: `${label} · ${desc}`,
            'aria-current': state.view === key ? 'page' : null,
            onclick: () => store.set({ view: key })
          },
          [icon, text]
        )
      );
    });
  });
  sidebar.appendChild(navList);
}

function renderTopbar(state) {
  const topbar = document.getElementById('topbar');
  topbar.innerHTML = '';

  const titleMap = {
    login: ['开始', '先登录蒲公英，再进入找达人流程'],
    recordings: ['录制回放', '工具箱里的网页操作复现工具'],
    templates: ['点选采集内容', '页面变了再校准采集内容'],
    tasks: ['找达人', '按右侧当前结果建立候选并开始采集'],
    exports: ['复核建联', '填写话术、复核达人并导出建联表'],
    report: ['AI 分析', '后续用于总结和问答'],
    toolbox: ['工具箱', '低频维护、排查和分析入口']
  };

  const running = state.backend.running;
  const cls = running === true ? 'ok' : running === false ? 'bad' : 'unknown';
  const statusText =
    running === true ? '运行中' : running === false ? '未运行' : '未知';
  const backendText = running === true ? '服务正常' : `服务${statusText}`;
  const [pageTitle, pageSub] = titleMap[state.view] || ['', ''];

  const left = h('div', { class: 'topbar-left' }, [
    h('div', { class: 'page-title-wrap' }, [
      h('div', { class: 'title' }, [pageTitle]),
      h('div', { class: 'page-subtitle' }, [pageSub])
    ])
  ]);

  const center = h('div', { class: 'topbar-center' }, []);
  const tabStrip = h('div', { class: 'browser-tab-strip', role: 'tablist', 'aria-label': '内嵌浏览器标签' }, [
    h('span', { class: 'browser-tab-caption' }, ['网页标签'])
  ]);
  const tabs = Array.isArray(state.browser?.tabs) && state.browser.tabs.length
    ? state.browser.tabs
    : [{ id: 'collection', title: '采集', active: true, closable: false }];
  tabs.forEach((tab) => {
    const tabItem = h('div', { class: `browser-tab-item ${tab.active ? 'active' : ''}` }, []);
    const label = tab.role === 'mail'
      ? '企业邮箱'
      : (tab.role === 'collection'
          ? '采集页'
          : (tab.role === 'automation'
              ? '自动采集'
              : (tab.role === 'pgy-invite' ? '邀约账号' : (tab.title || '标签页'))));
    const tabButton = h('button', {
      class: 'browser-tab-button',
      role: 'tab',
      title: tab.url || label,
      'aria-selected': tab.active ? 'true' : 'false',
      onclick: async () => {
        const result = await window.desktopAPI.browser.activateTab(tab.id);
        if (!result?.ok) alert(result?.error || '切换标签失败');
      }
    }, [label]);
    tabItem.appendChild(tabButton);
    if (tab.closable) {
      tabItem.appendChild(h('button', {
        class: 'browser-tab-close',
        title: `关闭${label}标签`,
        'aria-label': `关闭${label}标签`,
        onclick: async () => {
          const result = await window.desktopAPI.browser.closeTab(tab.id);
          if (!result?.ok) alert(result?.error || '关闭标签失败');
        }
      }, ['×']));
    }
    tabStrip.appendChild(tabItem);
  });
  if (!tabs.some((tab) => tab.id === 'mail')) {
    tabStrip.appendChild(h('button', {
      class: 'browser-tab-new',
      title: '在独立标签打开企业邮箱',
      onclick: async () => {
        const result = await window.desktopAPI.contacts.openTencentEmail();
        if (!result?.ok) alert(result?.error || '打开企业邮箱失败');
      }
    }, ['+ 企业邮箱']));
  }
  if (!tabs.some((tab) => tab.id === 'pgy-invite')) {
    tabStrip.appendChild(h('button', {
      class: 'browser-tab-new',
      title: '使用独立 Cookie 打开第二个蒲公英邀约账号',
      onclick: async () => {
        const result = await window.desktopAPI.invites.openAccount();
        if (!result?.ok) alert(result?.error || '打开邀约账号失败');
      }
    }, ['+ 邀约账号']));
  }
  const activeTab = tabs.find((tab) => tab.id === state.browser?.activeTabId)
    || tabs.find((tab) => tab.active)
    || tabs[0];
  if (state.browser?.locked) {
    const taskRunningWithSearchVisible = Boolean(
      state.tasks?.running && activeTab?.role === 'collection'
    );
    tabStrip.appendChild(h('span', {
      class: 'browser-tab-lock',
      title: taskRunningWithSearchVisible
        ? '自动任务正在独立标签运行，当前采集页可继续人工核验'
        : (state.browser.lockReason || '自动化运行中')
    }, [taskRunningWithSearchVisible ? '搜索页可核验' : '自动化运行中']));
  }

  const controls = h('div', { class: 'browser-controls' }, []);
  const activeNavigationLocked = Boolean(activeTab?.navigationLocked);
  const inviteAddressReadOnly = activeTab?.role === 'pgy-invite';
  const roleSwitch = h('div', {
    class: 'browser-role-switch',
    role: 'tablist',
    'aria-label': '账号工作区切换'
  }, []);
  [
    { role: 'collection', label: '采集页', title: '切换到采集账号的搜索工作区' },
    { role: 'pgy-invite', label: '邀约账号', title: '切换到独立 Cookie 的邀约账号' }
  ].forEach((item) => {
    const tab = tabs.find((candidate) => candidate.role === item.role);
    const active = tab?.id === activeTab?.id;
    const button = h('button', {
      class: `browser-role-button ${active ? 'active' : ''}`,
      role: 'tab',
      title: item.title,
      'aria-selected': active ? 'true' : 'false',
      disabled: tab ? null : '',
      onclick: async () => {
        if (!tab) return;
        const result = await window.desktopAPI.browser.activateTab(tab.id);
        if (!result?.ok) alert(result?.error || '切换账号工作区失败');
      }
    }, [item.label]);
    roleSwitch.appendChild(button);
  });
  const runNav = async (action) => {
    const result = await window.desktopAPI.browser.nav(action);
    if (!result?.ok) alert(result?.error || '浏览器导航失败');
  };
  const navBack = h('button', {
    class: 'tb-btn ghost',
    title: '后退',
    disabled: activeTab?.canGoBack && !activeNavigationLocked ? null : '',
    onclick: () => runNav('back')
  }, ['←']);
  const navForward = h('button', {
    class: 'tb-btn ghost',
    title: '前进',
    disabled: activeTab?.canGoForward && !activeNavigationLocked ? null : '',
    onclick: () => runNav('forward')
  }, ['→']);
  const navReload = h('button', {
    class: 'tb-btn ghost',
    title: '刷新',
    disabled: activeNavigationLocked ? '' : null,
    onclick: () => runNav('reload')
  }, ['⟳']);
  const urlInput = h('input', {
    class: 'url-input',
    placeholder: inviteAddressReadOnly ? '邀约账号只从已采集名单打开达人' : '输入蒲公英网址，回车打开右侧网页',
    disabled: activeNavigationLocked ? '' : null,
    readonly: inviteAddressReadOnly ? '' : null,
    title: inviteAddressReadOnly ? '为防止账号角色混用，邀约标签不接受手工网址' : ''
  }, []);
  urlInput.value = state.browser?.url || '';
  urlInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const v = urlInput.value.trim();
    if (!v) return;
    const res = await window.desktopAPI.browser.open(v);
    if (!res?.ok) alert(`打开失败：${res?.error || 'unknown error'}`);
  });
  const goBtn = h('button', {
    class: 'tb-btn primary',
    title: '打开',
    disabled: activeNavigationLocked || inviteAddressReadOnly ? '' : null,
    onclick: async () => {
    const v = urlInput.value.trim();
    if (!v) return;
    const res = await window.desktopAPI.browser.open(v);
    if (!res?.ok) alert(`打开失败：${res?.error || 'unknown error'}`);
  }}, ['打开']);

  controls.appendChild(roleSwitch);
  controls.appendChild(navBack);
  controls.appendChild(navForward);
  controls.appendChild(navReload);
  controls.appendChild(urlInput);
  controls.appendChild(goBtn);
  center.appendChild(tabStrip);
  center.appendChild(controls);

  const right = h('div', { class: 'topbar-right' }, [
    h('div', { class: `backend ${cls}` }, [backendText]),
    h('div', { class: 'app-version', title: '当前应用版本' }, [
      state.appInfo?.version ? `v${state.appInfo.version}` : '版本读取中'
    ])
  ]);

  topbar.appendChild(left);
  topbar.appendChild(center);
  topbar.appendChild(right);
}

function renderContent(state) {
  const content = document.getElementById('content');
  const keepScroll = lastRenderedView === state.view;
  const scrollTop = keepScroll ? content.scrollTop : 0;
  content._routeGhost?.remove();
  let routeGhost = null;
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!keepScroll && motion && content.firstElementChild && content.animate) {
    const bounds = content.getBoundingClientRect();
    routeGhost = document.createElement('div');
    routeGhost.inert = true;
    routeGhost.setAttribute('aria-hidden', 'true');
    routeGhost.style.cssText = `position:fixed;left:${bounds.left}px;top:${bounds.top}px;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;pointer-events:none;z-index:4;box-sizing:border-box;padding:24px;background:var(--bg)`;
    const snapshot = content.firstElementChild.cloneNode(true);
    snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    snapshot.style.transform = `translateY(${-content.scrollTop}px)`;
    routeGhost.appendChild(snapshot);
  }
  content.innerHTML = '';
  const view = views[state.view] || views.login;
  const page = view(state);
  enhanceWorkspace(page, state);
  // Section navigation keeps the original controls, handlers and workflow order.
  const sections = state.view === 'tasks'
    ? [['.signing-panel', '搜索发现'], ['.task-panel:not(.signing-panel)', '导入名单'], ['.candidate-panel', '候选池'], ['.pre-run-panel', '采集检查'], ['.task-toolbar', '执行队列'], ['.execution-table', '执行记录']]
    : state.view === 'exports'
      ? [['.export-run-card', '当前结果'], ['.export-workbench', '复核与邀约'], ['.contact-review-list', '达人名单'], ['.feishu-workbench', '飞书项目']]
      : [];
  if (sections.length && state.view !== 'exports') {
    const outline = document.createElement('nav');
    outline.className = 'workspace-outline';
    outline.setAttribute('aria-label', '本页区域');
    sections.forEach(([selector, label]) => {
      const target = page.querySelector(selector);
      if (!target) return;
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
      outline.appendChild(button);
    });
    page.prepend(outline);
  }
  content.appendChild(page);
  if (!keepScroll && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && page.animate) {
    // Animate only route changes. Autosaves and list refreshes keep their position.
    Array.from(page.children).slice(0, 18).forEach((node, index) => {
      node.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 180, delay: Math.min(index * 18, 90), easing: 'ease-out' });
    });
  }
  if (routeGhost) {
    content.appendChild(routeGhost);
    content._routeGhost = routeGhost;
    const exit = routeGhost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-out' });
    exit.finished.catch(() => {}).finally(() => routeGhost.remove());
  }
  content.scrollTop = scrollTop;
  lastRenderedView = state.view;
}

function initSplitters() {
  const body = document.getElementById('body');
  const consoleEl = document.getElementById('console');
  const sidebar = document.getElementById('sidebar');
  const splitMain = document.getElementById('splitterMain');
  const splitSidebar = document.getElementById('splitterSidebar');
  if (!body || !consoleEl || !sidebar || !splitMain || !splitSidebar) return;

  const rootStyle = document.documentElement.style;
  const savedLayout = readWorkspaceLayout(window.localStorage);
  let layout = normalizeWorkspaceLayout({
    viewportWidth: body.getBoundingClientRect().width,
    ...savedLayout
  });
  // A temporary viewport clamp must not replace the user's committed preference.
  let preferredConsoleWidth = Number.isFinite(savedLayout.consoleWidth)
    ? savedLayout.consoleWidth : layout.consoleWidth;
  let browserLayoutFrame = 0;

  const syncBrowserLayout = () => {
    if (browserLayoutFrame) return;
    browserLayoutFrame = window.requestAnimationFrame(() => {
      browserLayoutFrame = 0;
      try {
        window.desktopAPI?.browser?.setLayout?.({ consoleWidth: layout.consoleWidth });
      } catch (_) {}
    });
  };

  const updateSplitterAria = () => {
    const bounds = getWorkspaceLayoutBounds(
      body.getBoundingClientRect().width,
      layout.consoleWidth
    );
    splitMain.setAttribute('aria-valuemin', String(bounds.consoleMinWidth));
    splitMain.setAttribute('aria-valuemax', String(bounds.consoleMaxWidth));
    splitMain.setAttribute('aria-valuenow', String(layout.consoleWidth));
    splitSidebar.setAttribute('aria-valuemin', String(bounds.sidebarMinWidth));
    splitSidebar.setAttribute('aria-valuemax', String(bounds.sidebarMaxWidth));
    splitSidebar.setAttribute('aria-valuenow', String(layout.sidebarWidth));
  };

  const applyLayout = (next = {}, { persist = false } = {}) => {
    layout = normalizeWorkspaceLayout({
      viewportWidth: body.getBoundingClientRect().width,
      consoleWidth: next.consoleWidth ?? layout.consoleWidth,
      sidebarWidth: next.sidebarWidth ?? layout.sidebarWidth
    });
    if (persist && next.consoleWidth != null) preferredConsoleWidth = layout.consoleWidth;
    document.body.classList.toggle('compact-workspace', layout.consoleWidth < 800);
    rootStyle.setProperty('--w-console', `${layout.consoleWidth}px`);
    rootStyle.setProperty('--w-sidebar', `${layout.sidebarWidth}px`);
    updateSplitterAria();
    syncBrowserLayout();
    if (persist) writeWorkspaceLayout(window.localStorage, { ...layout, consoleWidth: preferredConsoleWidth });
  };

  const bindSplitter = (el, { valueFromPointer, valueFromLayout, applyValue, resetValue }) => {
    let pointerId = null;

    const finish = (event) => {
      if (pointerId === null || (event?.pointerId != null && event.pointerId !== pointerId)) return;
      const capturedPointerId = pointerId;
      pointerId = null;
      el.classList.remove('dragging');
      document.body.classList.remove('layout-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        if (el.hasPointerCapture?.(capturedPointerId)) el.releasePointerCapture(capturedPointerId);
      } catch (_) {}
      // Commit the normalized final value through the same path as keyboard edits.
      applyValue(valueFromLayout(), true);
    };

    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      pointerId = event.pointerId;
      try { el.setPointerCapture?.(pointerId); } catch (_) {}
      el.classList.add('dragging');
      document.body.classList.add('layout-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    el.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      applyValue(valueFromPointer(event), false);
    });
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('lostpointercapture', finish);
    window.addEventListener('blur', () => finish());
    el.addEventListener('dblclick', (event) => {
      event.preventDefault();
      applyValue(resetValue(), true);
    });
    el.addEventListener('keydown', (event) => {
      const bounds = getWorkspaceLayoutBounds(
        body.getBoundingClientRect().width,
        layout.consoleWidth
      );
      const min = el === splitMain ? bounds.consoleMinWidth : bounds.sidebarMinWidth;
      const max = el === splitMain ? bounds.consoleMaxWidth : bounds.sidebarMaxWidth;
      const step = event.shiftKey ? 50 : 20;
      let next = valueFromLayout();
      if (event.key === 'ArrowLeft') next -= step;
      else if (event.key === 'ArrowRight') next += step;
      else if (event.key === 'Home') next = min;
      else if (event.key === 'End') next = max;
      else return;
      event.preventDefault();
      applyValue(next, true);
    });
  };

  bindSplitter(splitMain, {
    valueFromPointer: (event) => event.clientX - body.getBoundingClientRect().left,
    valueFromLayout: () => layout.consoleWidth,
    applyValue: (consoleWidth, persist) => applyLayout({ consoleWidth }, { persist }),
    resetValue: () => Math.round(
      body.getBoundingClientRect().width * WORKSPACE_LAYOUT_LIMITS.defaultConsoleRatio
    )
  });

  bindSplitter(splitSidebar, {
    valueFromPointer: (event) => event.clientX - consoleEl.getBoundingClientRect().left,
    valueFromLayout: () => layout.sidebarWidth,
    applyValue: (sidebarWidth, persist) => applyLayout({ sidebarWidth }, { persist }),
    resetValue: () => WORKSPACE_LAYOUT_LIMITS.defaultSidebarWidth
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      applyLayout({ consoleWidth: preferredConsoleWidth }, { persist: false });
    });
  });

  applyLayout(savedLayout, { persist: false });
}

async function bootstrap() {
  try {
    const info = await window.desktopAPI.app.info();
    if (info?.ok) store.set({ appInfo: { version: info.version || '' } });
  } catch (_) {}

  const applyBackendStatus = (status) => {
    if (!status) return;
    const next = {
      ...store.state.backend,
      running: typeof status.running === 'boolean' ? status.running : store.state.backend.running,
      host: status.host || store.state.backend.host,
      port: status.port || store.state.backend.port,
      code: status.code || ''
    };
    if (
      next.running !== store.state.backend.running ||
      next.host !== store.state.backend.host ||
      next.port !== store.state.backend.port ||
      next.code !== store.state.backend.code
    ) {
      store.set({
        backend: next
      });
    }
  };

  const refreshBackendStatus = async () => {
    try {
      const info = await window.desktopAPI.backend.info();
      if (info?.ok) applyBackendStatus(info);
    } catch (_) {
      applyBackendStatus({ running: false, code: 'BACKEND_INFO_FAILED' });
    }
  };

  // 先订阅再查询，避免后端在 renderer 初始化期间就绪时丢失状态事件。
  window.desktopAPI.backend.onStatus(applyBackendStatus);
  await refreshBackendStatus();
  window.setInterval(refreshBackendStatus, 10000);

  window.desktopAPI.recording.onCount((n) => {
    store.set({
      recording: { ...store.state.recording, count: n }
    });
  });

  // 全局加载一次模板列表（否则“批量任务”页下拉可能为空，需先进入“采集模板”页才会刷新）
  try {
    const r = await window.desktopAPI.template.list();
    if (r?.ok) {
      const files = r.files || [];
      const nextActive = store.state.templates.activeTemplatePath || files?.[0]?.path || '';
      store.set({
        templates: {
          ...store.state.templates,
          templates: files,
          activeTemplatePath: nextActive
        }
      });
    }
  } catch (_) {}

  // URL 地址栏同步：初始化拉一次 + 后续订阅变化
  try {
    const r = await window.desktopAPI.browser.getUrl();
    if (r?.ok) {
      store.set({
        browser: {
          ...store.state.browser,
          activeTabId: r.tabId || store.state.browser.activeTabId,
          url: r.url || ''
        }
      });
    }
  } catch (_) {}
  window.desktopAPI.browser.onUrlChange((payload) => {
    const url = payload?.url || '';
    store.set({
      browser: {
        ...store.state.browser,
        activeTabId: payload?.tabId || store.state.browser.activeTabId,
        url
      }
    });
  });
  window.desktopAPI.browser.onTabsChange((payload) => {
    if (!payload || !Array.isArray(payload.tabs)) return;
    const activeTabId = payload.activeTabId || store.state.browser.activeTabId;
    const active = payload.tabs.find((tab) => tab.id === activeTabId);
    store.set({
      browser: {
        ...store.state.browser,
        activeTabId,
        tabs: payload.tabs,
        url: active?.url || store.state.browser.url,
        locked: Boolean(payload.locked),
        lockReason: payload.lockReason || ''
      }
    });
  });
  try {
    const tabs = await window.desktopAPI.browser.listTabs();
    if (tabs?.ok) {
      const active = tabs.tabs?.find((tab) => tab.id === tabs.activeTabId);
      store.set({
        browser: {
          ...store.state.browser,
          activeTabId: tabs.activeTabId || 'collection',
          tabs: tabs.tabs || [],
          url: active?.url || store.state.browser.url,
          locked: Boolean(tabs.locked),
          lockReason: tabs.lockReason || ''
        }
      });
    }
  } catch (_) {}

  // Task 6：任务队列状态推送
  try {
    window.desktopAPI.tasks.onState((payload) => {
      if (!payload || typeof payload !== 'object') return;
      store.set({
        tasks: {
          ...store.state.tasks,
          ...payload,
          current: payload.currentId ?? payload.current ?? null
        }
      });
    });
  } catch (_) {}

  store.subscribe((s) => {
    renderSafely('sidebar', () => renderSidebar(s));
    renderSafely('topbar', () => renderTopbar(s));
    renderSafely('content', () => renderContent(s));
  });

  renderSafely('sidebar', () => renderSidebar(store.state));
  renderSafely('topbar', () => renderTopbar(store.state));
  renderSafely('content', () => renderContent(store.state));

  // 分割条拖拽（左右宽度/侧栏宽度）
  initSplitters();
}

bootstrap();
