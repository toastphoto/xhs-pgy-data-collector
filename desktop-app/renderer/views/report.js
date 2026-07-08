export function renderReport(_state) {
  const root = document.createElement('div');
  root.className = 'view';
  root.innerHTML = `
    <h2>AI 报告</h2>
    <p>这里后续用于生成达人对比报告。当前阶段先以复核名单和建联表为主。</p>
  `;
  return root;
}
