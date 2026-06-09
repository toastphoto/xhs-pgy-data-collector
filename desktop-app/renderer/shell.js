function $(id) {
  return document.getElementById(id);
}

async function ensureBackendIframe() {
  try {
    const info = await window.desktopAPI.backend.info();
    if (!info?.ok) return;
    const host = info.host || '127.0.0.1';
    const port = info.port || '8010';
    const iframe = $('appFrame');
    if (!iframe) return;
    const target = `http://${host}:${port}/`;
    if (iframe.src !== target) iframe.src = target;
  } catch (_) {}
}

async function refreshRecordingFiles() {
  const res = await window.desktopAPI.recording.list();
  const sel = $('recFiles');
  sel.innerHTML = '';
  if (!res.ok) {
    const opt = document.createElement('option');
    opt.textContent = '无法读取录制列表';
    opt.value = '';
    sel.appendChild(opt);
    return;
  }
  if (res.files.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '暂无录制文件';
    opt.value = '';
    sel.appendChild(opt);
    return;
  }
  for (const f of res.files) {
    const opt = document.createElement('option');
    opt.textContent = f.name;
    opt.value = f.path;
    sel.appendChild(opt);
  }
}

function bind() {
  const urlInput = $('urlInput');
  const go = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    const res = await window.desktopAPI.browser.open(url);
    if (!res.ok) alert(`打开失败：${res.error}`);
  };

  $('btnGo').addEventListener('click', go);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });

  $('btnBack').addEventListener('click', () => window.desktopAPI.browser.nav('back'));
  $('btnForward').addEventListener('click', () => window.desktopAPI.browser.nav('forward'));
  $('btnReload').addEventListener('click', () => window.desktopAPI.browser.nav('reload'));

  $('btnRecStart').addEventListener('click', async () => {
    await window.desktopAPI.recording.start();
    $('btnRecStart').disabled = true;
    $('btnRecStop').disabled = false;
    $('recCount').textContent = '0';
  });

  $('btnRecStop').addEventListener('click', async () => {
    const res = await window.desktopAPI.recording.stop();
    $('btnRecStart').disabled = false;
    $('btnRecStop').disabled = true;
    if (res.ok) {
      await refreshRecordingFiles();
      alert(`已保存录制：\n${res.filePath}`);
    } else {
      alert(`保存失败：${res.error || '未知错误'}`);
    }
  });

  $('btnReplay').addEventListener('click', async () => {
    const filePath = $('recFiles').value;
    if (!filePath) return alert('请选择一个录制文件');
    const res = await window.desktopAPI.recording.replay(filePath);
    if (!res.ok) alert(`回放失败：${res.error}`);
  });

  window.desktopAPI.recording.onCount((n) => {
    $('recCount').textContent = String(n);
  });

  window.desktopAPI.backend.onStatus((st) => {
    const el = $('backendStatus');
    if (!el) return;
    if (st?.running) {
      el.textContent = '后端：运行中';
      el.style.color = '#7ee787';
      // 后端刚起来时刷新 iframe
      try {
        ensureBackendIframe();
        const iframe = $('appFrame');
        iframe?.contentWindow?.location?.reload?.();
      } catch (_) {}
    } else {
      el.textContent = '后端：未运行';
      el.style.color = '#ff7b72';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await ensureBackendIframe();
  await refreshRecordingFiles();
});
