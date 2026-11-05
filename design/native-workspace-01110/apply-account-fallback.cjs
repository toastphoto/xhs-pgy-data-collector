const fs=require('fs'),path=require('path');
const root='C:/Users/feibo/Documents/Codex/2026-06-25/s/projects/xhs-pgy-data-collector/desktop-app';
const file=path.join(root,'main.js');let s=fs.readFileSync(file,'utf8');fs.mkdirSync('pre-01110',{recursive:true});fs.writeFileSync('pre-01110/main.js',s);
function replace(a,b){if(!s.includes(a))throw Error('Baseline mismatch: '+a.slice(0,70));s=s.replace(a,b);}
replace("pgyInviteOperation?.navigationPermit?.settling\n      || !isAllowedPgyInviteNavigationUrl(url)","(pgyInviteOperation?.navigationPermit?.settling && !permitsPgyInviteAccountFallback(webContents, url))\n      || !isAllowedPgyInviteNavigationUrl(url)");
replace('function permitsPgyInviteNavigation(webContents, url) {',`function permitsPgyInviteAccountFallback(webContents, url) {
  const operation = pgyInviteOperation;
  if (!operation || operation.invalidated || operation.webContents !== webContents
    || !['open-account', 'check-login'].includes(operation.kind)
    || operation.navigationPermit?.kind !== 'account') return false;
  try {
    const target = new URL(url);
    // The verified PGY public homepage hosts the login UI. Do not guess other login routes.
    return target.origin === 'https://pgy.xiaohongshu.com'
      && !target.username && !target.password && target.pathname === '/'
      && !target.search && !target.hash;
  } catch (_) { return false; }
}

function permitsPgyInviteNavigation(webContents, url) {`);
replace("if (permit.settling && pgyInviteNavigationKey(url) !== permit.settlingKey) return false;\n  if (permit.kind === 'account' || permit.kind === 'submitted') return isAllowedPgyInviteNavigationUrl(url);", "const accountFallback = permitsPgyInviteAccountFallback(webContents, url);\n  if (permit.settling && pgyInviteNavigationKey(url) !== permit.settlingKey && !accountFallback) return false;\n  if (permit.kind === 'account') return pgyInviteNavigationKey(url) === pgyInviteNavigationKey(permit.url) || accountFallback;\n  if (permit.kind === 'submitted') return isAllowedPgyInviteNavigationUrl(url);");
replace("const permit = operation.navigationPermit;\n  // loadURL leaves", "const permit = operation.navigationPermit;\n  const accountFallback = permitsPgyInviteAccountFallback(webContents, url);\n  // loadURL leaves");
replace("|| (operation.navigationPermit?.settling && !inPage)) {", "|| (operation.navigationPermit?.settling && !inPage && !accountFallback)) {");
replace("if (event === 'commit') permit.committed = true;", "if (accountFallback && permit.settling) permit.settlingKey = pgyInviteNavigationKey(url);\n  if (event === 'commit') permit.committed = true;");
fs.writeFileSync(file,s);
for(const name of ['package.json','package-lock.json']){const p=path.join(root,name),j=JSON.parse(fs.readFileSync(p));fs.copyFileSync(p,path.join('pre-01110',name));j.version='0.1.110';if(j.packages?.[''])j.packages[''].version='0.1.110';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');}
