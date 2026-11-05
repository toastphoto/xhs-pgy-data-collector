const fs=require('fs'),path=require('path');const app='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const {build,Platform}=require(path.join(app,'node_modules/electron-builder'));
const c=JSON.parse(fs.readFileSync('qa-builder.json'));c.directories.output='dist-coexist-qa-01108-safe';c.nsis.include=path.resolve('qa-installer.nsh');fs.writeFileSync('qa-safe-builder.json',JSON.stringify(c,null,2));
build({projectDir:app,prepackaged:path.join(app,'dist-coexist-qa-01108-release/win-unpacked'),targets:Platform.WINDOWS.createTarget('nsis'),config:path.resolve('qa-safe-builder.json')}).then(f=>console.log(JSON.stringify(f))).catch(e=>{console.error(e);process.exitCode=1});
