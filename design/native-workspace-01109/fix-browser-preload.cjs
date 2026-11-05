const fs=require('fs'),path=require('path');
const app='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const file=path.join(app,'browser_preload.js');let text=fs.readFileSync(file,'utf8');
const old="const { isSensitiveInputElement } = require('./lib/recording_privacy');";
if(!text.includes(old))throw Error('Unexpected preload baseline');
const helper=fs.readFileSync(path.join(app,'lib/recording_privacy.js'),'utf8').replace(/module\.exports = \{[\s\S]*?\};\s*$/,'');
text=text.replace(old,'// Sandboxed Electron preloads cannot require local modules.\n// Keep the privacy predicate self-contained; validate behavior in a real sandbox.\n'+helper);
fs.writeFileSync(file,text);
for(const name of ['package.json','package-lock.json']){const p=path.join(app,name),j=JSON.parse(fs.readFileSync(p));j.version='0.1.109';if(j.packages?.[''])j.packages[''].version='0.1.109';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');}
