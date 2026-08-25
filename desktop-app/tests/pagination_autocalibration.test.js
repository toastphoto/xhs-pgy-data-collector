const assert = require('assert');
const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(desktopRoot, 'renderer', 'views', 'templates.js'), 'utf8');

assert.match(mainSource, /function candidatePaginationReady\(pagination = \{\}\)/);
assert.match(mainSource, /buildSearchPaginationRevealScript\(calibration\)/);
assert.match(mainSource, /for \(const waitMs of \[500, 1000, 1800\]\)/);

const validationStart = mainSource.indexOf("ipcMain.handle('pgy:validateCandidateSearchPagination'");
const validationEnd = mainSource.indexOf("ipcMain.handle('pgy:pickElement'", validationStart);
assert.ok(validationStart >= 0 && validationEnd > validationStart);
const validationSource = mainSource.slice(validationStart, validationEnd);
const directSecondPage = validationSource.indexOf("buildSearchPaginationScript('goto', 2, calibration)");
const nextPageFallback = validationSource.indexOf("buildSearchPaginationScript('next', 1, calibration)");
assert.ok(directSecondPage >= 0);
assert.ok(nextPageFallback > directSecondPage);

assert.match(templateSource, /正在自动滚动右侧结果区并定位完整分页栏/);
assert.match(templateSource, /pagination\.currentPageKnown/);
assert.match(templateSource, /pageNumbers\.length >= 2/);

console.log('pagination_autocalibration.test.js OK');
