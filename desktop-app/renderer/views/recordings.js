import { store } from '../state/store.js';

let _loadedOnce = false;
let _opsDocBound = false;
let _openOpsPop = null; // HTMLElement | null

const closeOpsPop = () => {
  if (_openOpsPop) _openOpsPop.remove();
  _openOpsPop = null;
};

const ensureOpsDocListener = () => {
  if (_opsDocBound) return;
  _opsDocBound = true;
  document.addEventListener(
    'click',
    (e) => {
      if (!_openOpsPop) return;
      // if click happens inside popover or inside the “…” button, ignore
      if (_openOpsPop.contains(e.target)) return;
      if (e.target?.closest?.('.ops-menu-btn')) return;
      closeOpsPop();
    },
    true
  );
};

function fmtTime(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch (_) {
    return String(ts);
  }
}

export function renderRecordings(state) {
  ensureOpsDocListener();
  // 切换/重渲染页面时，顺便清理遗留 popover
  closeOpsPop();

  const root = document.createElement('div');
  root.className = 'view';

  const title = document.createElement('h2');
  title.textContent = '录制 & 回放';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = '在右侧 BrowserView 中操作；左侧负责开始/停止录制、管理与回放录制文件。';
  root.appendChild(desc);

  const msg = document.createElement('div');
  msg.style.margin = '10px 0 12px 0';
  msg.style.fontSize = '13px';
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = 'rgba(230, 237, 243, 0.85)';
  msg.textContent = '';

  const toolbar = document.createElement('div');
  toolbar.style.display = 'flex';
  toolbar.style.gap = '10px';
  toolbar.style.flexWrap = 'wrap';
  toolbar.style.alignItems = 'center';

  const counter = document.createElement('div');
  counter.style.fontSize = '13px';
  counter.style.color = 'rgba(230, 237, 243, 0.85)';
  counter.innerHTML = `当前录制动作数：<b>${state.recording.count}</b>`;

  const setMsg = (s) => {
    msg.textContent = s || '';
  };

  const refreshList = async () => {
    setMsg('刷新中...');
    try {
      const r = await window.desktopAPI.recording.list();
      if (!r?.ok) {
        setMsg(`刷新失败：${r?.error || 'unknown error'}`);
        return;
      }
      store.set({
        recording: { ...store.state.recording, files: r.files || [] }
      });
      setMsg('');
    } catch (e) {
      setMsg(`刷新异常：${e?.message || String(e)}`);
    }
  };

  const btnStart = document.createElement('button');
  btnStart.className = 'btn';
  btnStart.textContent = '开始录制';
  btnStart.disabled = !!state.recording.isRecording;
  btnStart.addEventListener('click', async () => {
    setMsg('开始录制...');
    try {
      const r = await window.desktopAPI.recording.start();
      if (!r?.ok) {
        setMsg(`开始失败：${r?.error || 'unknown error'}`);
        return;
      }
      store.set({
        recording: { ...store.state.recording, isRecording: true, count: 0 }
      });
      setMsg('已开始录制。请在右侧进行操作。');
    } catch (e) {
      setMsg(`开始异常：${e?.message || String(e)}`);
    }
  });

  const btnStop = document.createElement('button');
  btnStop.className = 'btn';
  btnStop.textContent = '停止并保存';
  btnStop.disabled = !state.recording.isRecording;
  btnStop.addEventListener('click', async () => {
    setMsg('停止并保存中...');
    try {
      const r = await window.desktopAPI.recording.stop();
      if (!r?.ok) {
        setMsg(`停止失败：${r?.error || 'unknown error'}`);
        return;
      }
      store.set({
        recording: { ...store.state.recording, isRecording: false }
      });
      setMsg(`已保存：${r.filePath || ''}`);
      await refreshList();
    } catch (e) {
      setMsg(`停止异常：${e?.message || String(e)}`);
    }
  });

  const btnRefresh = document.createElement('button');
  btnRefresh.className = 'btn';
  btnRefresh.textContent = '刷新列表';
  btnRefresh.addEventListener('click', refreshList);

  const btnOpenFolder = document.createElement('button');
  btnOpenFolder.className = 'btn';
  btnOpenFolder.textContent = '打开 recordings 文件夹';
  btnOpenFolder.addEventListener('click', async () => {
    setMsg('打开文件夹...');
    try {
      const r = await window.desktopAPI.recording.openFolder();
      if (!r?.ok) {
        setMsg(`打开失败：${r?.error || 'unknown error'}`);
        return;
      }
      setMsg('');
    } catch (e) {
      setMsg(`打开异常：${e?.message || String(e)}`);
    }
  });

  toolbar.appendChild(btnStart);
  toolbar.appendChild(btnStop);
  toolbar.appendChild(btnRefresh);
  toolbar.appendChild(btnOpenFolder);
  toolbar.appendChild(counter);
  root.appendChild(toolbar);
  root.appendChild(msg);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '13px';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08);">文件名</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 180px;">创建时间</th>
      <th style="text-align:right; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 90px;">动作数</th>
      <th style="text-align:left; padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.08); width: 240px;">操作</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const files = state.recording.files || [];
  if (!files.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="4" style="padding:10px 6px; color: rgba(230,237,243,0.7);">
        暂无录制文件。点击“开始录制”，操作后再“停止并保存”。
      </td>
    `;
    tbody.appendChild(tr);
  } else {
    const doRename = async (f) => {
      const next = window.prompt('输入新文件名（可不含 .json）', (f.name || '').replace(/\.json$/i, ''));
      if (!next) return;
      setMsg('重命名中...');
      try {
        const r = await window.desktopAPI.recording.rename(f.path, next);
        if (!r?.ok) {
          setMsg(`重命名失败：${r?.error || 'unknown error'}`);
          return;
        }
        setMsg('重命名完成。');
        await refreshList();
      } catch (e) {
        setMsg(`重命名异常：${e?.message || String(e)}`);
      }
    };

    const doDelete = async (f) => {
      const ok = window.confirm(`确认删除该录制文件？\n${f.name || ''}\n\n删除后不可恢复。`);
      if (!ok) return;
      setMsg('删除中...');
      try {
        const r = await window.desktopAPI.recording.delete(f.path);
        if (!r?.ok) {
          setMsg(`删除失败：${r?.error || 'unknown error'}`);
          return;
        }
        setMsg('删除完成。');
        await refreshList();
      } catch (e) {
        setMsg(`删除异常：${e?.message || String(e)}`);
      }
    };

    files.forEach((f) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">${f.name || ''}</td>
        <td style="padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.06);">${fmtTime(f.createdAt)}</td>
        <td style="padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.06); text-align:right;">${f.actionCount ?? '-'}</td>
        <td style="padding:8px 6px; border-bottom:1px solid rgba(255,255,255,0.06);"></td>
      `;

      const ops = tr.children[3];

      const btnReplay = document.createElement('button');
      btnReplay.className = 'btn';
      btnReplay.style.height = '30px';
      btnReplay.textContent = '回放';
      btnReplay.addEventListener('click', async () => {
        setMsg('回放中...');
        try {
          const r = await window.desktopAPI.recording.replay(f.path);
          if (!r?.ok) {
            setMsg(`回放失败：${r?.error || r?.code || 'unknown error'}\n${JSON.stringify(r, null, 2)}`);
            return;
          }
          setMsg('回放完成。');
        } catch (e) {
          setMsg(`回放异常：${e?.message || String(e)}`);
        }
      });

      const wrap = document.createElement('div');
      wrap.className = 'ops-menu';

      wrap.appendChild(btnReplay);

      const btnMore = document.createElement('button');
      btnMore.className = 'ops-menu-btn';
      btnMore.textContent = '…';
      btnMore.title = '更多操作';
      btnMore.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // toggle: if current open pop belongs to this row, just close it
        if (_openOpsPop && wrap.contains(_openOpsPop)) {
          closeOpsPop();
          return;
        }
        if (_openOpsPop) closeOpsPop();

        const pop = document.createElement('div');
        pop.className = 'ops-menu-pop';

        const miRename = document.createElement('button');
        miRename.className = 'ops-menu-item';
        miRename.textContent = '重命名';
        miRename.onclick = async () => {
          closeOpsPop();
          await doRename(f);
        };

        const miDelete = document.createElement('button');
        miDelete.className = 'ops-menu-item danger';
        miDelete.textContent = '删除';
        miDelete.onclick = async () => {
          closeOpsPop();
          await doDelete(f);
        };

        pop.appendChild(miRename);
        pop.appendChild(miDelete);
        wrap.appendChild(pop);
        _openOpsPop = pop;
      });

      wrap.appendChild(btnMore);
      ops.appendChild(wrap);
      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  root.appendChild(table);

  // 首次进入页面时自动刷新一次
  if (!_loadedOnce) {
    _loadedOnce = true;
    setTimeout(() => refreshList(), 0);
  }

  return root;
}
