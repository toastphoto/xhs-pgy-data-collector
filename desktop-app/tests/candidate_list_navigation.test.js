const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tasksSource = fs.readFileSync(
  path.join(__dirname, '..', 'renderer', 'views', 'tasks.js'),
  'utf8'
);
const cssSource = fs.readFileSync(
  path.join(__dirname, '..', 'renderer', 'app.css'),
  'utf8'
);

assert.match(tasksSource, /let _candidateListScrollTop = 0;/);
assert.match(tasksSource, /_candidateListScrollTop = 0;\s+_candidateListViewportKey = '';\s+_importPreview = null;/);
assert.match(tasksSource, /candidateList\.scrollTo\(\{ top: 0, behavior: 'auto' \}\)/);
assert.match(tasksSource, /candidateList\.scrollTo\(\{ top: candidateList\.scrollHeight, behavior: 'auto' \}\)/);
assert.match(tasksSource, /candidateList\.scrollTop = Math\.min\(_candidateListScrollTop, maxScrollTop\)/);
assert.match(tasksSource, /候选达人列表，共 \$\{filteredDraftUrls\.length\} 人/);

assert.match(cssSource, /\.candidate-list \{[\s\S]*?max-height: min\(64vh, 720px\);/);
assert.match(cssSource, /\.candidate-list \{[\s\S]*?overflow-y: auto;/);
assert.match(cssSource, /\.candidate-list \{[\s\S]*?scrollbar-gutter: stable;/);
assert.match(cssSource, /\.candidate-list::\-webkit-scrollbar \{[\s\S]*?width: 16px;/);

console.log('candidate_list_navigation.test.js passed');
