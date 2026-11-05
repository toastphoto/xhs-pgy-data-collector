const fs=require('fs'),path=require('path'),Module=require('module');
const original=path.resolve('native-visual-check.cjs');let s=fs.readFileSync(original,'utf8');
s=s.replace('  const geometry=[];',`  const handle=await electronApp.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html')).getNativeWindowHandle().readUInt32LE());
  require('child_process').execFileSync('C:/Users/feibo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',[path.resolve('capture-qa-window.py'),String(handle),path.join(out,'specific-qa-window.png')],{windowsHide:true});
  const geometry=[];`);
const mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));mod._compile(s,original);
