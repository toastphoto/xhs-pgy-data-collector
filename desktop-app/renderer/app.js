import { store } from './state/store.js';
import { renderLogin } from './views/login.js';
import { renderRecordings } from './views/recordings.js';
import { renderTemplates } from './views/templates.js';
import { renderTasks } from './views/tasks.js';
import { renderExports } from './views/exports.js';
import { renderReport } from './views/report_chat.js';
import { renderToolbox } from './views/toolbox.js';

const views = {
  login: renderLogin,
  recordings: renderRecordings,
  templates: renderTemplates,
  tasks: renderTasks,
  exports: renderExports,
  report: renderReport,
  toolbox: renderToolbox
};

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach((c) => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}

function renderSidebar(state) {
  const sidebar = document.getElementById('sidebar');
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
    h('span', {}, ['搜索']),
    h('span', {}, ['复核']),
    h('span', {}, ['建联'])
  ]);
  sidebar.appendChild(flow);

  const navList = document.createElement('div');
  navList.className = 'nav-list';
  groups.forEach((group) => {
    navList.appendChild(h('div', { class: 'nav-group-label' }, [group.label]));
    group.items.forEach(([key, label, desc]) => {
      const icon = document.createElement('span');
      icon.className = 'nav-icon';
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
  const navBack = h('button', { class: 'tb-btn ghost', title: '后退', onclick: () => window.desktopAPI.browser.nav('back') }, ['←']);
  const navForward = h('button', { class: 'tb-btn ghost', title: '前进', onclick: () => window.desktopAPI.browser.nav('forward') }, ['→']);
  const navReload = h('button', { class: 'tb-btn ghost', title: '刷新', onclick: () => window.desktopAPI.browser.nav('reload') }, ['⟳']);
  const urlInput = h('input', { class: 'url-input', placeholder: '输入蒲公英网址，回车打开右侧网页' }, []);
  urlInput.value = state.browser?.url || '';
  urlInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const v = urlInput.value.trim();
    if (!v) return;
    const res = await window.desktopAPI.browser.open(v);
    if (!res?.ok) alert(`打开失败：${res?.error || 'unknown error'}`);
  });
  const goBtn = h('button', { class: 'tb-btn primary', title: '打开', onclick: async () => {
    const v = urlInput.value.trim();
    if (!v) return;
    const res = await window.desktopAPI.browser.open(v);
    if (!res?.ok) alert(`打开失败：${res?.error || 'unknown error'}`);
  }}, ['打开']);

  center.appendChild(navBack);
  center.appendChild(navForward);
  center.appendChild(navReload);
  center.appendChild(urlInput);
  center.appendChild(goBtn);

  const right = h('div', { class: 'topbar-right' }, [
    h('div', { class: `backend ${cls}` }, [backendText])
  ]);

  topbar.appendChild(left);
  topbar.appendChild(center);
  topbar.appendChild(right);
}

function renderContent(state) {
  const content = document.getElementById('content');
  content.innerHTML = '';
  const view = views[state.view] || views.login;
  content.appendChild(view(state));
}

function initSplitters() {
  const body = document.getElementById('body');
  const consoleEl = document.getElementById('console');
  const sidebar = document.getElementById('sidebar');
  const splitMain = document.getElementById('splitterMain');
  const splitSidebar = document.getElementById('splitterSidebar');
  if (!body || !consoleEl || !sidebar || !splitMain || !splitSidebar) return;

  const rootStyle = document.documentElement.style;
  const browserMinWidth = 320;
  const splitterWidth = 10;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const drag = (el, onMove) => {
    let dragging = false;
    const onMouseMove = (e) => {
      if (!dragging) return;
      onMove(e);
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      el.classList.add('dragging');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  };

  // 默认让日常操作台占主要空间；右侧网页保留登录和人工点击所需宽度。
  try {
    const rect = body.getBoundingClientRect();
    const min = 620;
    const max = Math.max(min, rect.width - browserMinWidth - splitterWidth);
    const w = clamp(Math.round(rect.width * 0.72), min, max);
    rootStyle.setProperty('--w-console', `${w}px`);
    if (w && window.desktopAPI?.browser?.setLayout) window.desktopAPI.browser.setLayout({ consoleWidth: w });
  } catch (_) {}

  drag(splitMain, (e) => {
    const rect = body.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // 工作台宽度：控制左侧工具区与右侧网页区比例
    const min = 620;
    const max = Math.max(min, rect.width - browserMinWidth - splitterWidth);
    const w = clamp(x, min, max);
    rootStyle.setProperty('--w-console', `${Math.round(w)}px`);
    try {
      if (window.desktopAPI?.browser?.setLayout) window.desktopAPI.browser.setLayout({ consoleWidth: Math.round(w) });
    } catch (_) {}
  });

  drag(splitSidebar, (e) => {
    const rect = consoleEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // sidebar 宽度：控制左侧导航与中间内容比例
    const min = 180;
    const max = Math.min(320, Math.max(min, rect.width - 360)); // 内容至少 360
    const w = clamp(x, min, max);
    rootStyle.setProperty('--w-sidebar', `${Math.round(w)}px`);
  });
}

async function bootstrap() {
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
    if (r?.ok) store.set({ browser: { url: r.url || '' } });
  } catch (_) {}
  window.desktopAPI.browser.onUrlChange((payload) => {
    const url = payload?.url || '';
    store.set({ browser: { url } });
  });

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
    renderSidebar(s);
    renderTopbar(s);
    renderContent(s);
  });

  renderSidebar(store.state);
  renderTopbar(store.state);
  renderContent(store.state);

  // 分割条拖拽（左右宽度/侧栏宽度）
  initSplitters();
}

bootstrap();
