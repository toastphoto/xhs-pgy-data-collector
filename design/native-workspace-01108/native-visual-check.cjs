const fs=require('fs'),path=require('path'),Module=require('module');
const original='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app/tests/pgy_invite_flow.electron.test.js';
const source=fs.readFileSync(original,'utf8');let code=source.slice(0,source.indexOf("  if (process.env.PGY_VIEW_LIFECYCLE_TEST"));
code=code.replace("assert.equal(setup.version, require('../package.json').version);","assert.equal(setup.version, process.env.EXPECTED_NATIVE_VERSION || require('../package.json').version);");
code+=`
  const {store}=await page.evaluate(async()=>{ const m=await import('./state/store.js');return {store:!!m.store};});
  await page.evaluate(async runDir=>{const {store}=await import('./state/store.js');store.set({view:'exports',exports:{...(store.state.exports||{}),selectedRunDir:runDir}});},runDir);
  await page.waitForFunction(()=>document.querySelectorAll('.contact-review-card').length===3);
  const out=process.env.NATIVE_EVIDENCE_DIR;fs.mkdirSync(out,{recursive:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await electronApp.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));w.setSize(1600,1000);w.show();w.focus();});
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(out,'review-1600.png')});
  const capture=await electronApp.evaluate(async({BrowserWindow,desktopCapturer},out)=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));const id=win.getMediaSourceId();const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1600,height:1000}});const source=sources.find(s=>s.id===id);if(!source||source.thumbnail.isEmpty())return false;require('fs').writeFileSync(require('path').join(out,'composited-window.png'),source.thumbnail.toPNG());return true;},out);
  const nativeImage=await electronApp.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));const v=w.getBrowserViews().at(-1);return v?(await v.webContents.capturePage()).toPNG().toString('base64'):null;});if(nativeImage)fs.writeFileSync(path.join(out,'native-browser-content.png'),Buffer.from(nativeImage,'base64'));
  const browserPage=electronApp.windows().find(w=>w.url().includes('pgy.xiaohongshu.com/solar/'));if(browserPage){await browserPage.screenshot({path:path.join(out,'native-browser-cdp.png')});fs.writeFileSync(path.join(out,'native-browser-text.json'),JSON.stringify({url:'local PGY protocol fixture',body:await browserPage.locator('body').innerText()},null,2));}
  const hasStages=await page.locator('.delivery-stages').count();
  if(hasStages){
    assert.equal(await page.locator('.contact-settings-section').isVisible(),false);
    await page.getByRole('tab',{name:'话术与邀约',exact:true}).click();assert.equal(await page.locator('.contact-settings-section').isVisible(),true);
    await page.screenshot({path:path.join(out,'prepare-1600.png')});
    await page.getByRole('tab',{name:'飞书交接',exact:true}).click();assert.equal(await page.locator('.feishu-workbench').isVisible(),true);
    await page.screenshot({path:path.join(out,'cloud-1600.png')});
    await page.getByRole('tab',{name:'达人复核',exact:true}).click();
    const exportPath=path.join(out,'fictional-resource.xlsx');
    await electronApp.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},exportPath);
    await page.getByRole('button',{name:'导出达人资源表',exact:true}).click();
    await page.waitForFunction(()=>document.body.innerText.includes('达人资源表已导出')||document.body.innerText.includes('导出成功'),null,{timeout:30000});
    const exportedText=await page.locator('.export-run-card [role=status]').innerText();const writtenPath=exportedText.split(/\\r?\\n/).map(s=>s.trim()).find(s=>s.endsWith('.xlsx'));assert.ok(writtenPath,'Actual export result must identify workbook');assert.ok(path.resolve(writtenPath).startsWith(path.resolve(userData))||path.resolve(writtenPath)===path.resolve(exportPath),'Only fictional test output may be read');assert.ok(fs.existsSync(writtenPath));const book=require('xlsx').readFile(writtenPath);const values=book.SheetNames.map(n=>require('xlsx').utils.sheet_to_json(book.Sheets[n],{header:1})).flat();assert.ok(values.some(row=>row.includes('EXAMPLE01')));if(path.resolve(writtenPath)!==path.resolve(exportPath))fs.copyFileSync(writtenPath,exportPath);
  }
  const geometry=[];
  for(const width of [1600,1100,840,1600]){
   await electronApp.evaluate(({BrowserWindow},width)=>{BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html')).setSize(width,1000);},width);await page.waitForTimeout(300);
   const g=await page.evaluate(()=>({width:innerWidth,content:document.querySelector('#content').clientWidth,sidebar:document.querySelector('#sidebar').clientWidth,edge:document.querySelector('#splitterMain').getBoundingClientRect().right}));geometry.push(g);
   await page.screenshot({path:path.join(out,'width-'+width+'.png')});
  }
  for(const zoom of [.75,1,1.25]){await electronApp.evaluate(({BrowserWindow},z)=>{BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html')).webContents.setZoomFactor(z);},zoom);await page.waitForTimeout(300);const edge=await page.evaluate(()=>document.querySelector('#splitterMain').getBoundingClientRect().right);const native=await electronApp.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/renderer/index.html'));return w.getBrowserViews().map(v=>v.getBounds());});assert.ok(native.every(b=>Math.abs(b.x-Math.round(edge*zoom))<=1));await page.screenshot({path:path.join(out,'native-zoom-'+zoom+'.png')});}
  const blue=await page.locator('button:visible').evaluateAll(nodes=>nodes.filter(n=>{const c=getComputedStyle(n).backgroundColor.match(/[0-9.]+/g)?.map(Number);return c&&c[3]!==0&&c[2]>c[0]+20&&c[2]>c[1]+10;}).map(n=>n.textContent));
  if(hasStages)assert.deepEqual(blue,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,version:setup.version,localOnly:true,compositedCapture:capture,stages:!!hasStages,geometry,errors,blueButtons:blue},null,2));fs.writeFileSync(reportPath,JSON.stringify({ok:true,out},null,2));
})();
`;
// Add the original error/finalization contract, collecting every foreground run.
code=code.replace(/\}\)\(\);\s*$/,source.slice(source.indexOf('})().catch(async error')));
const mod=new Module(original,module);mod.filename=original;mod.paths=Module._nodeModulePaths(path.dirname(original));mod._compile(code,original);
