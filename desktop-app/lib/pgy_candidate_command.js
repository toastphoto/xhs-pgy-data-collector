const MAX_CANDIDATE_COUNT = 50;

const CHINESE_DIGITS = Object.freeze({
  '零': 0,
  '〇': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9
});

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseChineseNumber(value) {
  const text = cleanText(value);
  if (!text) return 0;
  if (!text.includes('十')) {
    return Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, text)
      ? CHINESE_DIGITS[text]
      : 0;
  }
  const [left, right] = text.split('十');
  const tens = left ? CHINESE_DIGITS[left] : 1;
  const ones = right ? CHINESE_DIGITS[right] : 0;
  if (!Number.isFinite(tens) || !Number.isFinite(ones)) return 0;
  return tens * 10 + ones;
}

function extractRequestedCount(text) {
  const arabic = text.match(/(?:前\s*)?(\d{1,3})\s*(?:名|位|个|人)?/);
  if (arabic) return Number(arabic[1]);
  const chinese = text.match(/(?:前\s*)?([零〇一二两三四五六七八九十]{1,3})\s*(?:名|位|个|人)?/);
  return chinese ? parseChineseNumber(chinese[1]) : 0;
}

function parseCandidateInstruction(value, options = {}) {
  const instruction = cleanText(value);
  const maxCount = Math.max(1, Number(options.maxCount || MAX_CANDIDATE_COUNT));
  if (!instruction) {
    return { ok: false, code: 'CANDIDATE_COMMAND_EMPTY', error: '请输入需求，例如“将当前页面前30位达人加入候选”。' };
  }
  if (!/(候选|达人|博主)/.test(instruction) || !/(加入|添加|导入|放入|列入|查找|取)/.test(instruction)) {
    return { ok: false, code: 'CANDIDATE_COMMAND_UNSUPPORTED', error: '当前只支持从右侧蒲公英结果中取前 N 位达人加入候选。' };
  }
  const count = extractRequestedCount(instruction);
  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, code: 'CANDIDATE_COMMAND_COUNT_MISSING', error: '请在指令中写明人数，例如“前20位”。' };
  }
  if (count > maxCount) {
    return {
      ok: false,
      code: 'CANDIDATE_COMMAND_LIMIT_EXCEEDED',
      error: `为降低平台风控风险，单次最多加入 ${maxCount} 位达人。`,
      requestedCount: count,
      maxCount
    };
  }
  return {
    ok: true,
    instruction,
    requestedCount: count,
    maxCount,
    scope: 'current_pgy_search'
  };
}

function buildSearchCandidateExtractionScript(requestedCount = MAX_CANDIDATE_COUNT) {
  const limit = Math.max(1, Math.min(MAX_CANDIDATE_COUNT, Number(requestedCount) || MAX_CANDIDATE_COUNT));
  return `
    (function(){
      const requestedCount = ${JSON.stringify(limit)};
      const clean = (value, max = 180) => String(value == null ? '' : value)
        .replace(/\\u00a0/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, max);
      const unwrap = (value) => {
        try { return value && value.__v_isRef ? value.value : value; } catch (_) { return value; }
      };
      const first = (obj, keys) => {
        for (const key of keys) {
          try {
            const value = clean(unwrap(obj && obj[key]), 180);
            if (value) return value;
          } catch (_) {}
        }
        return '';
      };
      const absUrl = (href) => {
        try { return new URL(href, location.href).toString(); } catch (_) { return ''; }
      };
      const isVisible = (el) => {
        if (!el || el.nodeType !== 1) return false;
        const rect = el.getBoundingClientRect && el.getBoundingClientRect();
        if (!rect || rect.width < 20 || rect.height < 16) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) >= 0.05;
      };
      const normalizeRecord = (raw) => {
        const obj = unwrap(raw);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
        const id = first(obj, ['userId', 'kolId', 'bloggerId', 'creatorId', 'user_id', 'kol_id', 'id']);
        const name = first(obj, ['name', 'kolName', 'creatorName', 'nickName', 'nickname', 'userName']);
        const fans = first(obj, ['fansNum', 'fansCnt', 'fansCount', 'followers', 'followerCount']);
        const read = first(obj, ['clickMidNum', 'readCnt', 'readMedian', 'readCount']);
        const interact = first(obj, ['mEngagementNum', 'interCnt', 'interactMedian', 'engagementCount']);
        const existingUrl = first(obj, ['pgyUrl', 'detailUrl', 'profileUrl', 'url']);
        const idLooksValid = /^[A-Za-z0-9_-]{6,128}$/.test(id);
        const businessSignals = [fans, read, interact, first(obj, ['picturePrice', 'videoPrice', 'contentTags', 'personalTags'])].filter(Boolean).length;
        if (!idLooksValid || !name || businessSignals < 1) return null;
        let pgyUrl = '';
        if (existingUrl && /pgy\\.xiaohongshu\\.com/i.test(absUrl(existingUrl))) pgyUrl = absUrl(existingUrl);
        if (!/\\/blogger-detail\\//i.test(pgyUrl)) {
          pgyUrl = 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/' + encodeURIComponent(id);
        }
        const note = [
          fans ? '粉丝 ' + fans : '',
          read ? '阅读中位数 ' + read : '',
          interact ? '互动中位数 ' + interact : ''
        ].filter(Boolean).join(' / ');
        return { pgy_url: pgyUrl, creator_name: name, note, status: 'candidate', priority: '', excludeReason: '' };
      };
      const sources = [];
      const seenArrays = new Set();
      const seenObjects = new Set();
      const directRows = [];
      const directUrls = new Set();
      const rememberDirectRow = (value) => {
        const row = normalizeRecord(value);
        if (!row || directUrls.has(row.pgy_url)) return;
        directUrls.add(row.pgy_url);
        directRows.push(row);
      };
      const inspectArray = (value, path) => {
        const list = unwrap(value);
        if (!Array.isArray(list) || !list.length || list.length > 2000 || seenArrays.has(list)) return;
        seenArrays.add(list);
        const rows = [];
        const seen = new Set();
        for (const entry of list) {
          const row = normalizeRecord(entry);
          if (!row || seen.has(row.pgy_url)) continue;
          seen.add(row.pgy_url);
          rows.push(row);
        }
        if (!rows.length) return;
        const pathBonus = /list|data|source|kol|blogger|creator|result/i.test(path) ? 30 : 0;
        sources.push({ path, rows, score: rows.length * 24 + pathBonus });
      };
      const inspectContainer = (value, path, depth = 0) => {
        const obj = unwrap(value);
        if (!obj || typeof obj !== 'object' || depth > 4) return;
        if (Array.isArray(obj)) {
          inspectArray(obj, path);
          if (depth < 4) {
            for (let index = 0; index < Math.min(obj.length, 80); index += 1) {
              inspectContainer(obj[index], path + '[' + index + ']', depth + 1);
            }
          }
          return;
        }
        if (seenObjects.has(obj)) return;
        seenObjects.add(obj);
        rememberDirectRow(obj);
        const preferred = ['rowData', 'record', 'item', 'list', 'dataSource', 'data', 'items', 'records', 'kols', 'kolList', 'bloggerList', 'result', 'tableData'];
        let ownKeys = [];
        try { ownKeys = Object.keys(obj); } catch (_) {}
        const keys = [
          ...preferred.filter((key) => ownKeys.includes(key) || key in obj),
          ...ownKeys.filter((key) => !preferred.includes(key))
        ];
        for (const key of keys.slice(0, 140)) {
          if (/^(parent|root|appContext|provides|components|directives|bum|bum|um|m|a|da|ec|sp)$/.test(key)) continue;
          try {
            const next = unwrap(obj[key]);
            if (Array.isArray(next)) inspectArray(next, path + '.' + key);
            if (next && typeof next === 'object') inspectContainer(next, path + '.' + key, depth + 1);
          } catch (_) {}
        }
      };

      const components = new Set();
      const nodes = [document.documentElement, ...Array.from(document.querySelectorAll('*')).slice(0, 6000)];
      for (const node of nodes) {
        let names = [];
        try { names = Object.getOwnPropertyNames(node); } catch (_) {}
        for (const prop of names) {
          if (!/^__vueParentComponent|^__vue_app__/.test(prop)) continue;
          let component = null;
          try { component = node[prop]?._instance || node[prop]; } catch (_) {}
          for (let depth = 0; component && depth < 14; depth += 1) {
            if (components.has(component)) break;
            components.add(component);
            const name = clean(component.type && (component.type.__name || component.type.name), 80) || 'component';
            inspectContainer(component.props, name + '.props');
            inspectContainer(component.setupState, name + '.setupState');
            inspectContainer(component.data, name + '.data');
            inspectContainer(component.ctx, name + '.ctx');
            inspectContainer(component.subTree && component.subTree.props, name + '.subTree.props');
            component = component.parent;
          }
        }
      }
      if (directRows.length) {
        sources.push({ path: 'vue-component-records', rows: directRows, score: directRows.length * 22 + 20 });
      }

      const anchorRows = [];
      const anchorSeen = new Set();
      for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
        if (!isVisible(anchor)) continue;
        const url = absUrl(anchor.getAttribute('href') || '');
        if (!/^https:\\/\\/pgy\\.xiaohongshu\\.com\\//i.test(url) || !/blogger-detail|creator|kol|profile|author/i.test(url) || anchorSeen.has(url)) continue;
        anchorSeen.add(url);
        const root = anchor.closest('[role="row"],tr,[class*="row" i],[class*="item" i]') || anchor.parentElement;
        const lines = String(root && root.innerText || anchor.innerText || '').split(/\\n+/).map((x) => clean(x, 80)).filter(Boolean);
        const name = clean(anchor.innerText || anchor.textContent, 40) || lines.find((line) => line.length >= 2 && line.length <= 30) || '';
        anchorRows.push({ pgy_url: url, creator_name: name, note: clean(root && root.innerText, 180), status: 'candidate', priority: '', excludeReason: '' });
      }
      if (anchorRows.length) sources.push({ path: 'visible-links', rows: anchorRows, score: anchorRows.length * 20 });

      sources.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
      const best = sources[0] || { path: '', rows: [] };
      const items = best.rows.slice(0, requestedCount);
      return {
        ok: true,
        url: location.href,
        items,
        stats: {
          requested: requestedCount,
          available: best.rows.length,
          extracted: items.length,
          source: best.path || 'none',
          runtimeSources: sources.length
        },
        message: items.length >= requestedCount
          ? '已按当前排序读取前 ' + requestedCount + ' 位达人。'
          : (items.length
            ? '当前结果可读取 ' + items.length + ' 位达人，少于指令中的 ' + requestedCount + ' 位。'
            : '未从当前蒲公英结果中识别到达人数据。')
      };
    })()
  `;
}

function buildSearchPaginationScript(action = 'inspect', targetPage = 1) {
  const safeAction = ['inspect', 'next', 'goto'].includes(action) ? action : 'inspect';
  const safeTargetPage = Math.max(1, Number(targetPage || 1));
  return `
    (function(){
      const action = ${JSON.stringify(safeAction)};
      const targetPage = ${JSON.stringify(safeTargetPage)};
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element || element.nodeType !== 1) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width < 8 || rect.height < 8) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) >= 0.05;
      };
      const jumpInput = Array.from(document.querySelectorAll('input')).find((input) => {
        if (!visible(input)) return false;
        let parent = input.parentElement;
        for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
          const text = clean(parent.innerText || parent.textContent);
          if (text.includes('跳至') && text.includes('页')) return true;
        }
        return false;
      });
      let root = jumpInput?.parentElement || null;
      for (let depth = 0; root && depth < 7; depth += 1) {
        const rect = root.getBoundingClientRect?.();
        const text = clean(root.innerText || root.textContent);
        if (rect && rect.width >= 180 && rect.height <= 140 && text.includes('跳至') && text.includes('页')) break;
        root = root.parentElement;
      }
      if (!root) {
        const explicit = document.querySelector('[class*="pagination" i],[class*="pager" i]');
        if (visible(explicit)) root = explicit;
      }
      if (!root) return { ok: false, clicked: false, error: '未识别到分页控件' };
      const isDisabled = (element) => Boolean(
        element.disabled
        || element.getAttribute?.('aria-disabled') === 'true'
        || /disabled/.test(String(element.className || '').toLowerCase())
      );
      const rawControls = Array.from(root.querySelectorAll('button,a,[role="button"],[tabindex],[class*="page" i],[class*="next" i],[class*="prev" i]'));
      const controls = rawControls.filter((element, index) => (
        element !== root
        && visible(element)
        && !isDisabled(element)
        && rawControls.indexOf(element) === index
      ));
      const current = controls.find((element) => (
        element.getAttribute?.('aria-current') === 'page'
        || /active|current|selected/.test(String(element.className || '').toLowerCase())
      ));
      const currentPage = Number(clean(current?.innerText || current?.textContent)) || 1;
      if (action === 'inspect') return { ok: true, clicked: false, currentPage, controlCount: controls.length };
      if (action === 'goto') {
        const pageControl = controls.find((element) => clean(element.innerText || element.textContent) === String(targetPage));
        if (!pageControl) return { ok: false, clicked: false, currentPage, error: '未找到目标页码' };
        pageControl.click();
        return { ok: true, clicked: true, currentPage, targetPage };
      }
      let nextControl = controls.find((element) => {
        const label = clean([
          element.getAttribute?.('aria-label'),
          element.getAttribute?.('title'),
          element.className
        ].join(' ')).toLowerCase();
        return /下一页|next/.test(label) && !/上一页|prev/.test(label);
      });
      if (!nextControl && jumpInput) {
        const jumpLeft = jumpInput.getBoundingClientRect().left;
        nextControl = controls
          .filter((element) => {
            const text = clean(element.innerText || element.textContent);
            const rect = element.getBoundingClientRect();
            return rect.right <= jumpLeft + 4 && rect.width <= 80 && rect.height <= 64 && !/^\\d+$/.test(text);
          })
          .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      }
      if (!nextControl) return { ok: false, clicked: false, currentPage, error: '未找到下一页按钮' };
      nextControl.click();
      return { ok: true, clicked: true, currentPage, targetPage: currentPage + 1 };
    })()
  `;
}

module.exports = {
  MAX_CANDIDATE_COUNT,
  buildSearchCandidateExtractionScript,
  buildSearchPaginationScript,
  parseCandidateInstruction,
  parseChineseNumber
};
