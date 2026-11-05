(function () {
  function renderErr(err, startup) {
    try {
      var box = document.getElementById('runtimeErrorNotice');
      if (!box) {
        box = document.createElement('section');
        box.id = 'runtimeErrorNotice';
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;left:12px;top:88px;z-index:10000;box-sizing:border-box;max-height:45vh;overflow:auto;padding:12px;border:1px solid #c23b44;border-radius:6px;background:#fff5f5;color:#8c2028;font:13px sans-serif;overflow-wrap:anywhere';
        var close = document.createElement('button');
        close.type = 'button';
        close.textContent = '关闭';
        close.setAttribute('aria-label', '关闭错误提示');
        close.style.cssText = 'float:right;margin-left:12px';
        close.onclick = function () { box.remove(); };
        var text = document.createElement('div');
        text.dataset.errorText = 'true';
        text.style.whiteSpace = 'pre-wrap';
        box.append(close, text);
        document.body.appendChild(box);
      }
      var host = document.getElementById('console');
      box.style.width = Math.max(160, Math.min(560, (host ? host.clientWidth : window.innerWidth) - 24)) + 'px';
      var message = String(err && err.message ? err.message : err || '未知错误').slice(0, 1500);
      box.querySelector('[data-error-text]').textContent =
        (startup === true ? '工作台未能启动。' : '本次操作未完成，工作台仍可继续使用。') + '\n\n' + message
        + '\n\n请关闭提示后重新打开对应网页；若仍失败，请保留报错和版本号反馈。发送结果不明时，请先在网页核对，勿重复发送。';
    } catch (_) {}
  }
  window.addEventListener('error', function (event) { renderErr(event.error || event.message); }, true);
  window.addEventListener('unhandledrejection', function (event) { renderErr(event.reason); }, true);
  window.__renderAppError = renderErr;
})();
