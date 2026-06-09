const fs = require('fs');
const path = require('path');

function safeName(s) {
  const raw = String(s || '').trim();
  if (!raw) return 'page';
  return raw.replace(/[\\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

async function saveScreenshot(webContents, filePath) {
  try {
    const img = await webContents.capturePage();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, img.toPNG());
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

async function saveHTML(webContents, filePath) {
  try {
    const html = await webContents.executeJavaScript('document.documentElement.outerHTML', true);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, String(html || ''), 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

function saveJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data ?? null, null, 2), 'utf-8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * 保存一个“证据包”（截图 + HTML + 可选 JSON）。
 * @returns {Promise<{screenshot: string, html: string, json?: string}>}
 */
async function saveEvidence(webContents, evidenceDir, name, extraJson) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const base = safeName(name);
  const pngPath = path.join(evidenceDir, `${base}.png`);
  const htmlPath = path.join(evidenceDir, `${base}.html`);

  await saveScreenshot(webContents, pngPath);
  await saveHTML(webContents, htmlPath);

  const out = { screenshot: pngPath, html: htmlPath };
  if (extraJson && typeof extraJson === 'object') {
    const jsonPath = path.join(evidenceDir, `${base}.json`);
    saveJson(jsonPath, extraJson);
    out.json = jsonPath;
  }
  return out;
}

module.exports = {
  safeName,
  saveScreenshot,
  saveHTML,
  saveJson,
  saveEvidence
};

