export function renderLogin(_state) {
  const root = document.createElement('div');
  root.className = 'view';
  root.innerHTML = `
    <h2>登录态 / 账号</h2>
    <p>v1：在右侧 BrowserView 中手工完成登录后，可在此检测登录态（基于当前页面 URL 与 DOM 经验性判断）。</p>
    <p style="color: var(--muted); font-size: 13px; line-height: 1.6;">
      建议从 <b>蒲公英官网入口</b> 进入再点“账号登录”，比直接打开站内 /login 或某个内页更稳定（可避免“页面不见了/需要返回上一页”的情况）。
    </p>
  `;

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  actions.style.flexWrap = 'wrap';

  const btnOpen = document.createElement('button');
  btnOpen.className = 'btn primary';
  btnOpen.textContent = '在右侧打开蒲公英入口';
  btnOpen.addEventListener('click', async () => {
    try {
      await window.desktopAPI.browser.open('https://pgy.xiaohongshu.com/');
    } catch (_) {}
  });

  const btnHome = document.createElement('button');
  btnHome.className = 'btn ghost';
  btnHome.textContent = '打开工作台（已登录）';
  btnHome.disabled = true;
  btnHome.addEventListener('click', async () => {
    try {
      await window.desktopAPI.browser.open('https://pgy.xiaohongshu.com/solar/pre-trade/home');
    } catch (_) {}
  });

  const btnCheck = document.createElement('button');
  btnCheck.className = 'btn ghost';
  btnCheck.textContent = '检测登录态';

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
        `loggedIn: ${r.loggedIn}\n` +
        `isLoginPage: ${r.isLoginPage}\n` +
        `url: ${r.url}`;
    } catch (e) {
      result.textContent = `检测异常：${e?.message || String(e)}`;
      btnHome.disabled = true;
    }
  });

  actions.appendChild(btnOpen);
  actions.appendChild(btnHome);
  actions.appendChild(btnCheck);
  root.appendChild(actions);
  root.appendChild(result);
  return root;
}
