import { store } from './state/store.js';
import { renderLogin } from './views/login.js';
import { renderRecordings } from './views/recordings.js';
import { renderTemplates } from './views/templates.js';
import { renderTasks } from './views/tasks.js';
import { renderExports } from './views/exports.js';
import { renderReport } from './views/report_chat.js';

const views = {
  login: renderLogin,
  recordings: renderRecordings,
  templates: renderTemplates,
  tasks: renderTasks,
  exports: renderExports,
  report: renderReport
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
    report: iconSvg('M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-4-4H6a2 2 0 0 0-2 2v14 Z M8 11h8 M8 15h8')
  };

  const items = [
    ['login', '登录态/账号'],
    ['recordings', '录制&回放'],
    ['templates', '采集模板'],
    ['tasks', '批量任务'],
    ['exports', '结果&导出'],
    ['report', 'AI 报告']
  ];

  sidebar.appendChild(h('div', { class: 'brand' }, ['小红书相关信息采集工具']));
  // brand subtitle（始终显示在标题正下方）
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.textContent = '由黄熠制作，有问题七楼找黄熠。';
  sidebar.appendChild(footer);

  const navList = document.createElement('div');
  navList.className = 'nav-list';
  items.forEach(([key, label]) => {
    const icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.innerHTML = icons[key] || '';
    navList.appendChild(
      h(
        'button',
        {
          class: `nav-item ${state.view === key ? 'active' : ''}`,
          onclick: () => store.set({ view: key })
        },
        [icon, label]
      )
    );
  });
  sidebar.appendChild(navList);
}

function renderTopbar(state) {
  const topbar = document.getElementById('topbar');
  topbar.innerHTML = '';

  const titleMap = {
    login: '登录态/账号',
    recordings: '录制&回放',
    templates: '采集模板',
    tasks: '批量任务',
    exports: '结果&导出',
    report: 'AI 报告'
  };

  const running = state.backend.running;
  const cls = running === true ? 'ok' : running === false ? 'bad' : 'unknown';
  const statusText =
    running === true ? '运行中' : running === false ? '未运行' : '未知';
  const backendText = `后端：${statusText} http://${state.backend.host}:${state.backend.port}`;

  const left = h('div', { class: 'topbar-left' }, [
    h('div', { class: 'title' }, [titleMap[state.view] || ''])
  ]);

  const center = h('div', { class: 'topbar-center' }, []);
  const navBack = h('button', { class: 'tb-btn ghost', title: '后退', onclick: () => window.desktopAPI.browser.nav('back') }, ['←']);
  const navForward = h('button', { class: 'tb-btn ghost', title: '前进', onclick: () => window.desktopAPI.browser.nav('forward') }, ['→']);
  const navReload = h('button', { class: 'tb-btn ghost', title: '刷新', onclick: () => window.desktopAPI.browser.nav('reload') }, ['⟳']);
  const urlInput = h('input', { class: 'url-input', placeholder: '右侧浏览器地址（可输入并回车打开）' }, []);
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

  // 初始化时把当前 console 宽度同步给主进程，避免 BrowserView 覆盖分割条
  try {
    const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--w-console') || '0', 10);
    if (w && window.desktopAPI?.browser?.setLayout) window.desktopAPI.browser.setLayout({ consoleWidth: w });
  } catch (_) {}

  drag(splitMain, (e) => {
    const rect = body.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // console 宽度：控制“左边控制台”与“右侧浏览器”比例
    const min = 420;
    const max = Math.max(min, rect.width - 320); // 右侧至少 320
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
    const max = Math.min(380, Math.max(min, rect.width - 240)); // 内容至少 240
    const w = clamp(x, min, max);
    rootStyle.setProperty('--w-sidebar', `${Math.round(w)}px`);
  });
}

async function bootstrap() {
  // 先用 backend.info 展示 host/port（是否真正运行由 backend:status 推送更新）
  try {
    const info = await window.desktopAPI.backend.info();
    if (info?.ok) {
      store.set({
        backend: {
          ...store.state.backend,
          running: typeof info.running === 'boolean' ? info.running : store.state.backend.running,
          host: info.host || store.state.backend.host,
          port: info.port || store.state.backend.port
        }
      });
    }
  } catch (_) {}

  window.desktopAPI.backend.onStatus((st) => {
    if (st?.running) {
      store.set({
        backend: {
          running: true,
          host: st.host || store.state.backend.host,
          port: st.port || store.state.backend.port
        }
      });
    } else {
      store.set({
        backend: { ...store.state.backend, running: false }
      });
    }
  });

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
