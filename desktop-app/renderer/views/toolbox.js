import { store } from '../state/store.js';
import {
  createButton,
  createNotice,
  createPageIntro,
  createSummaryCard,
  createStatusPill
} from '../ui/components.js';

function openRunsDirButton() {
  return createButton('打开结果目录', async () => {
    try {
      const r = await window.desktopAPI.tasks.openRunsDir();
      if (!r?.ok) window.alert(`打开失败：${r?.error || 'unknown error'}`);
    } catch (e) {
      window.alert(`打开异常：${e?.message || String(e)}`);
    }
  }, { ghost: true });
}

export function renderToolbox(_state) {
  const root = document.createElement('div');
  root.className = 'view toolbox-view';

  root.appendChild(createPageIntro({
    title: '工具箱',
    description: '低频维护、排查和分析入口。日常找达人和导出建联表，一般不用进这里。'
  }));
  root.appendChild(createNotice({
    text: '这里保留原来的维护能力，但默认不打扰主流程。页面字段抓不到时先用“采集校准”；需要复现问题时再用“录制回放”。'
  }));

  const grid = document.createElement('div');
  grid.className = 'toolbox-grid';

  grid.appendChild(createSummaryCard({
    title: '采集校准',
    description: '打开一个典型达人页，手动点选昵称、粉丝、笔记卡片等位置，让系统记住。',
    meta: '页面结构变化或字段抓不到时使用',
    tone: 'accent',
    actions: [
      createButton('去校准', () => store.set({ view: 'templates' }), { primary: true })
    ]
  }));

  grid.appendChild(createSummaryCard({
    title: 'AI 分析',
    description: '同步历史采集结果后，用问答方式做总结、筛选和报告草稿。',
    meta: '适合采集完成后复盘',
    actions: [
      createButton('打开分析', () => store.set({ view: 'report' }), { ghost: true })
    ]
  }));

  grid.appendChild(createSummaryCard({
    title: '录制回放',
    description: '记录右侧网页操作路径，用于复现问题和排查页面变化。',
    meta: '排查工具，不是日常必走流程',
    actions: [
      createButton('打开录制', () => store.set({ view: 'recordings' }), { ghost: true })
    ]
  }));

  grid.appendChild(createSummaryCard({
    title: '本地结果',
    description: '打开本机采集结果目录，检查 raw_result、截图证据和导出的 Excel。',
    meta: '只打开目录，不会删除数据',
    actions: [openRunsDirButton()]
  }));

  root.appendChild(grid);

  const boundary = document.createElement('div');
  boundary.className = 'toolbox-boundary';
  boundary.appendChild(createStatusPill('不绕过登录', 'neutral'));
  boundary.appendChild(createStatusPill('不删本地数据', 'neutral'));
  boundary.appendChild(createStatusPill('低频工具收纳', 'neutral'));
  root.appendChild(boundary);

  return root;
}
