import { store } from '../state/store.js';
import {
  createButton,
  createPageIntro,
  createStatusPill,
  createSummaryCard
} from '../ui/components.js';

export function renderLogin(_state) {
  const root = document.createElement('div');
  root.className = 'view';
  root.appendChild(createPageIntro({
    title: '开始',
    description: '先把右侧蒲公英账号准备好，然后进入找达人和建联表流程。'
  }));

  const btnOpen = createButton('在右侧打开蒲公英入口', async () => {
    try {
      await window.desktopAPI.browser.openCollection('https://pgy.xiaohongshu.com/');
    } catch (_) {}
  }, { primary: true });

  const btnHome = createButton('打开工作台（已登录）', async () => {
    try {
      await window.desktopAPI.browser.openCollection('https://pgy.xiaohongshu.com/solar/pre-trade/home');
    } catch (_) {}
  }, { ghost: true });
  btnHome.disabled = true;

  const btnCheck = createButton('检测登录态', null, { ghost: true });

  const btnGoTasks = createButton('开始找达人', () => store.set({ view: 'tasks' }), { primary: true });

  const btnGoExports = createButton('复核建联表', () => store.set({ view: 'exports' }), { ghost: true });

  const startGrid = document.createElement('div');
  startGrid.className = 'start-action-grid';
  startGrid.appendChild(createSummaryCard({
    title: '1. 打开蒲公英',
    description: '在右侧网页区完成人工登录和搜索准备。',
    meta: '不托管账号，不绕过平台登录',
    tone: 'accent',
    actions: [btnOpen, btnHome]
  }));
  startGrid.appendChild(createSummaryCard({
    title: '2. 找达人',
    description: '导入名单，或在蒲公英搜索后把合适达人加入候选池。',
    meta: '候选确认后再开始采集',
    actions: [btnGoTasks]
  }));
  startGrid.appendChild(createSummaryCard({
    title: '3. 复核建联',
    description: '复核采集结果，补充联系方式，导出建联表和待补联系方式表。',
    meta: '小蜜蜂表作为下游结果，不打断主流程',
    actions: [btnGoExports]
  }));
  root.appendChild(startGrid);

  const result = document.createElement('div');
  result.style.marginTop = '12px';
  result.style.fontSize = '13px';
  result.style.whiteSpace = 'pre-wrap';
  result.style.color = 'var(--text)';
  result.textContent = '未检测';

  btnCheck.addEventListener('click', async () => {
    result.textContent = '检测中...';
    try {
      const r = await window.desktopAPI.pgy.checkLogin();
      if (!r?.ok) {
        result.textContent = `检测失败：${r?.error || 'unknown error'}`;
        btnHome.disabled = true;
        return;
      }
      btnHome.disabled = !r.loggedIn;
      result.textContent =
        `${r.loggedIn ? '已检测到登录状态' : '还没有检测到登录状态'}\n` +
        `当前页面：${r.url}`;
    } catch (e) {
      result.textContent = `检测异常：${e?.message || String(e)}`;
      btnHome.disabled = true;
    }
  });

  const statusPanel = document.createElement('div');
  statusPanel.className = 'start-status-panel';
  const statusHead = document.createElement('div');
  statusHead.className = 'panel-title-row';
  const statusTitle = document.createElement('div');
  statusTitle.className = 'section-label compact';
  statusTitle.textContent = '登录状态';
  statusHead.appendChild(statusTitle);
  statusHead.appendChild(createStatusPill('人工登录', 'neutral'));
  statusPanel.appendChild(statusHead);
  const statusActions = document.createElement('div');
  statusActions.className = 'tool-strip compact';
  statusActions.appendChild(btnCheck);
  statusPanel.appendChild(statusActions);
  statusPanel.appendChild(result);
  root.appendChild(statusPanel);
  return root;
}
