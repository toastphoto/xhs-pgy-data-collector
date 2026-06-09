export function renderReport(_state) {
  const root = document.createElement('div');
  root.className = 'view';
  root.innerHTML = `
    <h2>AI 报告</h2>
    <p>v1：占位页。后续 Task 8 将实现一键生成对比报告并展示 markdown。</p>
  `;
  return root;
}
