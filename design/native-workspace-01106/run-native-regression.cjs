const fs=require('fs'),path=require('path'),Module=require('module');const original='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app/tests/pgy_invite_flow.electron.test.js';let code=fs.readFileSync(original,'utf8');
// Use the new public complete-workflow tab for the legacy end-to-end sequence.
const marker="  const batch = page.locator('.pgy-invite-batch-panel');";
code=code.replace(marker,"  if (await page.locator('.delivery-stages').count()) await page.getByRole('tab',{name:'完整流程',exact:true}).click();\n"+marker);
// Bring only this isolated test window forward before trusted native keyboard input.
code=code.replace("  const template = {", "  await electronApp.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));w.show();w.focus();});\n  const template = {");
const mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));mod._compile(code,original);
