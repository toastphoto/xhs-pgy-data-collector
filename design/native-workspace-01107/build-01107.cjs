const fs=require('fs'),path=require('path');const app='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const pkg=path.join(app,'package.json');const p=JSON.parse(fs.readFileSync(pkg));p.version='0.1.107';fs.writeFileSync(pkg,JSON.stringify(p,null,2)+'\n');
const lock=path.join(app,'package-lock.json');const l=JSON.parse(fs.readFileSync(lock));l.version='0.1.107';if(l.packages?.[''])l.packages[''].version='0.1.107';fs.writeFileSync(lock,JSON.stringify(l,null,2)+'\n');
const {build,Platform}=require(path.join(app,'node_modules/electron-builder'));
const baseline=path.join(app,'dist-invite-selection-01105-final/win-unpacked/resources');
build({projectDir:app,targets:Platform.WINDOWS.createTarget('nsis'),config:{directories:{output:'dist-native-workspace-01107'},files:['main.js','preload.js','lib/**/*','renderer/**/*','package.json','node_modules/**/*'],extraResources:[{from:path.join(baseline,'content-analyzer'),to:'content-analyzer'},{from:path.join(baseline,'content-analyzer-backend'),to:'content-analyzer-backend'}]}}).then(files=>console.log(JSON.stringify(files))).catch(e=>{console.error(e);process.exitCode=1;});
