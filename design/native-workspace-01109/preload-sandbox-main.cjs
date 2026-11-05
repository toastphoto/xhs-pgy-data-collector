const {app,BrowserWindow,ipcMain}=require('electron');
global.actions=[];global.preloadErrors=[];
ipcMain.on('recording:action',(_,a)=>global.actions.push(a));
app.whenReady().then(async()=>{const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,preload:process.env.QA_PRELOAD}});global.testWindow=w;w.webContents.on('preload-error',(_,p,e)=>global.preloadErrors.push(e.message));await w.loadURL('data:text/html,<input id="ordinary"><input id="password" type="password"><input id="otp" autocomplete="one-time-code"><input id="mail" type="email"><input id="phone" type="tel"><input id="account" autocomplete="username"><button id="test">Test</button>');});
