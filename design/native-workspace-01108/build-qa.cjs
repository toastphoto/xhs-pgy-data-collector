const path=require('path'),fs=require('fs');const app='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const {build,Platform}=require(path.join(app,'node_modules/electron-builder'));
const baseline=path.join(app,'dist-invite-selection-01105-final/win-unpacked/resources');
const config={...JSON.parse(fs.readFileSync(path.join(app,'package.json'))).build,
  appId:'com.solo.contentanalyzer.qa', productName:'PGY Workbench QA', executableName:'pgy-workbench-qa',
  extraMetadata:{name:'pgy-workbench-qa',productName:'PGY Workbench QA',buildFlavor:'coexist-qa'},
  directories:{output:'dist-coexist-qa-01108-release'},
  nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,guid:'86505d45-1343-47e6-9b32-92faec441da9',shortcutName:'PGY Workbench QA',uninstallDisplayName:'PGY Workbench QA',createDesktopShortcut:false,createStartMenuShortcut:true,runAfterFinish:false},
  win:{artifactName:'PGY-Workbench-QA-${version}-setup.${ext}'},
  files:['main.js','preload.js','browser_preload.js','templates/**/*','lib/**/*','renderer/**/*','package.json','node_modules/**/*'],
  extraResources:[{from:path.join(baseline,'content-analyzer'),to:'content-analyzer'},{from:path.join(baseline,'content-analyzer-backend'),to:'content-analyzer-backend'}]
};fs.writeFileSync('qa-builder.json',JSON.stringify(config,null,2));
build({projectDir:app,targets:Platform.WINDOWS.createTarget('nsis'),config:path.resolve('qa-builder.json')}).then(f=>console.log(JSON.stringify(f))).catch(e=>{console.error(e);process.exitCode=1;});
