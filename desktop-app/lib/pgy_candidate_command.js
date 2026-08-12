const MAX_CANDIDATE_COUNT = 50;
const MAX_CANDIDATE_RANK = 100;

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
  if (Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, text)) {
    return CHINESE_DIGITS[text];
  }
  let total = 0;
  let digit = 0;
  for (const char of text) {
    if (Object.prototype.hasOwnProperty.call(CHINESE_DIGITS, char)) {
      digit = CHINESE_DIGITS[char];
      continue;
    }
    if (char === '十') {
      total += (digit || 1) * 10;
      digit = 0;
      continue;
    }
    if (char === '百') {
      total += (digit || 1) * 100;
      digit = 0;
      continue;
    }
    return 0;
  }
  return total + digit;
}

function parsePositionNumber(value) {
  const text = cleanText(value);
  if (/^\d{1,3}$/.test(text)) return Number(text);
  return parseChineseNumber(text);
}

function extractRequestedRange(text) {
  const number = '(\\d{1,3}|[零〇一二两三四五六七八九十百]{1,5})';
  const rangePattern = new RegExp(
    `(?:从\\s*)?第?\\s*${number}\\s*(?:名|位|个|人)?\\s*(?:达人|博主)?\\s*(?:到|至|[-—~～])\\s*第?\\s*${number}\\s*(?:名|位|个|人)?`,
    'i'
  );
  const range = text.match(rangePattern);
  if (range) {
    return {
      mode: 'range',
      startRank: parsePositionNumber(range[1]),
      endRank: parsePositionNumber(range[2])
    };
  }

  const prefixPattern = new RegExp(
    `前\\s*${number}\\s*(?:名|位|个|人)?`,
    'i'
  );
  const prefix = text.match(prefixPattern);
  if (prefix) {
    const endRank = parsePositionNumber(prefix[1]);
    return { mode: 'prefix', startRank: 1, endRank };
  }

  const countPattern = new RegExp(
    `(?:取|查找|选择|选取)\\s*${number}\\s*(?:名|位|个|人)`,
    'i'
  );
  const count = text.match(countPattern);
  if (count) {
    const endRank = parsePositionNumber(count[1]);
    return { mode: 'prefix', startRank: 1, endRank };
  }
  return null;
}

function parseCandidateInstruction(value, options = {}) {
  const instruction = cleanText(value);
  const maxCount = Math.max(1, Number(options.maxCount || MAX_CANDIDATE_COUNT));
  const maxRank = Math.max(maxCount, Number(options.maxRank || MAX_CANDIDATE_RANK));
  if (!instruction) {
    return { ok: false, code: 'CANDIDATE_COMMAND_EMPTY', error: '请输入需求，例如“将当前页面前30位达人加入候选”或“将第42位到第50位达人加入候选”。' };
  }
  if (!/(候选|达人|博主)/.test(instruction) || !/(加入|添加|导入|放入|列入|查找|取|选择|选取)/.test(instruction)) {
    return { ok: false, code: 'CANDIDATE_COMMAND_UNSUPPORTED', error: '当前支持从右侧蒲公英结果中取前 N 位，或取第 A 位到第 B 位达人加入候选。' };
  }
  const range = extractRequestedRange(instruction);
  if (!range) {
    return { ok: false, code: 'CANDIDATE_COMMAND_COUNT_MISSING', error: '请写明范围，例如“前20位”或“第42位到第50位”。' };
  }
  const { mode, startRank, endRank } = range;
  if (!Number.isInteger(startRank) || !Number.isInteger(endRank) || startRank < 1 || endRank < startRank) {
    return { ok: false, code: 'CANDIDATE_COMMAND_RANGE_INVALID', error: '范围顺序不正确，请按“第 A 位到第 B 位”填写，并确保 A 不大于 B。' };
  }
  if (endRank > maxRank) {
    return {
      ok: false,
      code: 'CANDIDATE_COMMAND_RANK_EXCEEDED',
      error: `当前支持定位到第 ${maxRank} 位达人。更靠后的达人请调整筛选条件后再分批加入。`,
      startRank,
      endRank,
      maxRank
    };
  }
  const count = endRank - startRank + 1;
  if (count > maxCount) {
    return {
      ok: false,
      code: 'CANDIDATE_COMMAND_LIMIT_EXCEEDED',
      error: `为降低平台风控风险，单次最多加入 ${maxCount} 位达人。`,
      requestedCount: count,
      startRank,
      endRank,
      maxCount,
      maxRank
    };
  }
  return {
    ok: true,
    instruction,
    mode,
    startRank,
    endRank,
    requestedCount: count,
    maxCount,
    maxRank,
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
        const id = first(obj, ['userId', 'kolId', 'bloggerId', 'creatorId', 'authorId', 'accountId', 'user_id', 'kol_id', 'author_id', 'account_id', 'id']);
        const name = first(obj, ['name', 'kolName', 'bloggerName', 'creatorName', 'nickName', 'nickname', 'nick_name', 'userName']);
        const fans = first(obj, ['fansNum', 'fansCnt', 'fansCount', 'fans_count', 'followers', 'followerCount']);
        const read = first(obj, ['clickMidNum', 'readCnt', 'readMedian', 'readCount', 'read_count']);
        const interact = first(obj, ['mEngagementNum', 'interCnt', 'interactMedian', 'engagementCount', 'engagement_count']);
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
          if (/^__vueParentComponent|^__vue_app__/.test(prop)) {
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
            continue;
          }
          if (/^__reactProps\$/.test(prop)) {
            try { inspectContainer(node[prop], 'react.props'); } catch (_) {}
            continue;
          }
          if (/^__reactFiber\$/.test(prop)) {
            let fiber = null;
            try { fiber = node[prop]; } catch (_) {}
            for (let depth = 0; fiber && depth < 16; depth += 1) {
              if (components.has(fiber)) break;
              components.add(fiber);
              const name = clean(fiber.elementType && (fiber.elementType.displayName || fiber.elementType.name), 80) || 'react-fiber';
              inspectContainer(fiber.memoizedProps, name + '.memoizedProps');
              inspectContainer(fiber.pendingProps, name + '.pendingProps');
              inspectContainer(fiber.memoizedState, name + '.memoizedState');
              fiber = fiber.return;
            }
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

function buildSearchPaginationScript(action = 'inspect', targetPage = 1, options = {}) {
  const safeAction = ['inspect', 'next', 'goto'].includes(action) ? action : 'inspect';
  const safeTargetPage = Math.max(1, Number(targetPage || 1));
  const paginationSelector = String(options?.paginationSelector || '').trim().slice(0, 500);
  return `
    (function(){
      const action = ${JSON.stringify(safeAction)};
      const targetPage = ${JSON.stringify(safeTargetPage)};
      const paginationSelector = ${JSON.stringify(paginationSelector)};
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element || element.nodeType !== 1) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width < 8 || rect.height < 8) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) >= 0.05;
      };
      const numericPage = (element) => {
        const parts = clean(element?.innerText || element?.textContent).split(/\\s+/).filter(Boolean);
        if (!parts.length || parts.some((part) => !/^\\d+$/.test(part))) return null;
        if (new Set(parts).size !== 1) return null;
        const value = Number(parts[0]);
        return Number.isInteger(value) && value >= 1 ? value : null;
      };
      const paginationControlsWithin = (element) => Array.from(element?.querySelectorAll?.(
        'button,a,[role="button"],[tabindex],[class*="page" i],[class*="next" i],[class*="prev" i]'
      ) || []).filter((candidate) => candidate !== element && visible(candidate));
      const paginationSequenceSize = (element) => new Set(
        paginationControlsWithin(element).map(numericPage).filter((value) => value != null)
      ).size;
      let calibratedRoot = null;
      if (paginationSelector) {
        try {
          const selected = document.querySelector(paginationSelector);
          if (visible(selected)) calibratedRoot = selected;
        } catch (_) {}
      }
      const inputScope = calibratedRoot || document;
      const inputCandidates = Array.from(inputScope.querySelectorAll('input')).filter(visible);
      const findPaginationAncestor = (input) => {
        for (let ancestor = input?.parentElement, depth = 0; ancestor && depth < 10; ancestor = ancestor.parentElement, depth += 1) {
          const className = String(ancestor.className || '');
          if (/pagination|pager/i.test(className) && visible(ancestor) && paginationSequenceSize(ancestor) >= 2) {
            return ancestor;
          }
        }
        return null;
      };
      const semanticJumpInput = inputCandidates.find((input) => {
        const ancestor = findPaginationAncestor(input);
        if (!visible(ancestor)) return false;
        const text = clean(ancestor.innerText || ancestor.textContent);
        return text.includes('跳至') && text.includes('页') && paginationSequenceSize(ancestor) >= 2;
      });
      const jumpInput = semanticJumpInput || inputCandidates.find((input) => {
        if (!visible(input)) return false;
        let parent = input.parentElement;
        for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
          const text = clean(parent.innerText || parent.textContent);
          const rect = parent.getBoundingClientRect?.();
          if (
            rect && rect.height <= 180
            && text.includes('跳至') && text.includes('页')
            && paginationSequenceSize(parent) >= 2
          ) return true;
        }
        return false;
      });
      const paginationAncestor = findPaginationAncestor(jumpInput);
      let root = calibratedRoot || (visible(paginationAncestor) ? paginationAncestor : null);
      if (!root && jumpInput) {
        for (let ancestor = jumpInput.parentElement, depth = 0; ancestor && depth < 8; ancestor = ancestor.parentElement, depth += 1) {
          if (visible(ancestor) && paginationSequenceSize(ancestor) >= 2) {
            root = ancestor;
            break;
          }
        }
      }
      if (!root) root = jumpInput?.parentElement || null;
      for (let depth = 0; root && depth < 7; depth += 1) {
        if (calibratedRoot) break;
        const rect = root.getBoundingClientRect?.();
        const text = clean(root.innerText || root.textContent);
        if (
          rect && rect.width >= 180 && rect.height <= 180
          && text.includes('跳至') && text.includes('页')
          && paginationSequenceSize(root) >= 2
        ) break;
        root = root.parentElement;
      }
      if (!root) {
        const explicit = Array.from(document.querySelectorAll('[class*="pagination" i],[class*="pager" i]'))
          .filter(visible)
          .sort((left, right) => paginationSequenceSize(right) - paginationSequenceSize(left))[0]
          || document.querySelector('[class*="pagination" i],[class*="pager" i]');
        if (explicit) root = explicit;
      }
      if (!root) {
        return {
          ok: false,
          clicked: false,
          currentPage: null,
          currentPageKnown: false,
          firstPageKnown: false,
          atFirstPage: false,
          error: '未识别到分页控件'
        };
      }
      const selectorFor = (element) => {
        if (!element || element.nodeType !== 1) return '';
        const escape = (value) => {
          try { return CSS.escape(value); } catch (_) { return String(value).replace(/[^A-Za-z0-9_-]/g, '\\$&'); }
        };
        if (element.id) {
          const byId = '#' + escape(element.id);
          try { if (document.querySelectorAll(byId).length === 1) return byId; } catch (_) {}
        }
        const classes = String(element.className || '').split(/\\s+/)
          .filter((value) => /^[A-Za-z_][A-Za-z0-9_-]{1,80}$/.test(value))
          .filter((value) => /pagination|pager/i.test(value))
          .slice(0, 3);
        if (classes.length) {
          const byClass = classes.map((value) => '.' + escape(value)).join('');
          try { if (document.querySelectorAll(byClass).length === 1) return byClass; } catch (_) {}
          return byClass;
        }
        return '';
      };
      const rootSelector = paginationSelector || selectorFor(root);
      const isDisabled = (element) => Boolean(
        element.disabled
        || element.getAttribute?.('aria-disabled') === 'true'
        || /disabled/.test(String(element.className || '').toLowerCase())
      );
      const rawControls = Array.from(root.querySelectorAll('button,a,[role="button"],[tabindex],[class*="page" i],[class*="next" i],[class*="prev" i]'));
      const allControls = rawControls.filter((element, index) => (
        element !== root
        && visible(element)
        && rawControls.indexOf(element) === index
      ));
      const controls = allControls.filter((element) => !isDisabled(element));
      const pageControls = allControls.filter((element) => numericPage(element) != null);
      const pageNumbers = Array.from(new Set(pageControls.map(numericPage)));
      const current = pageControls.find((element) => (
        element.getAttribute?.('aria-current') === 'page'
        || /active|current|selected|--color-bg-primary-light|\\bbold\\b/.test(String(element.className || '').toLowerCase())
        || /active|current|selected|--color-bg-primary-light|\\bbold\\b/.test(String(element.parentElement?.className || '').toLowerCase())
      ));
      const currentPage = current ? numericPage(current) : null;
      const currentPageKnown = Number.isInteger(currentPage) && currentPage >= 1;
      const previousControl = allControls.find((element) => {
        const label = clean([
          element.getAttribute?.('aria-label'),
          element.getAttribute?.('title'),
          element.className,
          element.innerText,
          element.textContent
        ].join(' ')).toLowerCase();
        return /上一页|previous|prev/.test(label) && !/下一页|next/.test(label);
      }) || allControls.find((element) => {
        const text = clean(element.innerText || element.textContent);
        const rect = element.getBoundingClientRect?.();
        const firstPageRect = pageControls
          .find((control) => numericPage(control) === 1)
          ?.getBoundingClientRect?.();
        return rect && firstPageRect && rect.right <= firstPageRect.left + 4 && /^(<|‹|«|←)?$/.test(text);
      });
      const previousDisabled = Boolean(previousControl && isDisabled(previousControl));
      const atFirstPage = currentPageKnown ? currentPage === 1 : previousDisabled;
      const firstPageKnown = currentPageKnown || previousDisabled;
      const pageEvidence = currentPageKnown
        ? 'active-page'
        : previousDisabled
          ? 'previous-disabled'
          : 'unknown';
      if (action === 'inspect') {
        return {
          ok: true,
          clicked: false,
          currentPage,
          currentPageKnown,
          firstPageKnown,
          atFirstPage,
          pageEvidence,
          previousDisabled,
          controlCount: allControls.length,
          pageNumbers,
          selector: rootSelector,
          calibrated: Boolean(calibratedRoot)
        };
      }
      if (action === 'goto') {
        if (targetPage === 1 && firstPageKnown && atFirstPage) {
          return {
            ok: true,
            clicked: false,
            alreadyAtTarget: true,
            currentPage: 1,
            currentPageKnown: true,
            firstPageKnown,
            atFirstPage,
            pageEvidence,
            targetPage,
            method: 'visible-page-evidence'
          };
        }
        const pageControl = controls.find((element) => numericPage(element) === targetPage);
        if (pageControl) {
          pageControl.click();
          return { ok: true, clicked: true, currentPage, currentPageKnown, targetPage, method: 'page-control' };
        }
        if (jumpInput) {
          const prototype = Object.getPrototypeOf(jumpInput);
          const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');
          if (descriptor?.set) descriptor.set.call(jumpInput, String(targetPage));
          else jumpInput.value = String(targetPage);
          jumpInput.dispatchEvent(new Event('input', { bubbles: true }));
          jumpInput.dispatchEvent(new Event('change', { bubbles: true }));
          jumpInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          jumpInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          return { ok: true, clicked: true, currentPage, currentPageKnown, targetPage, method: 'jump-input' };
        }
        return { ok: false, clicked: false, currentPage, currentPageKnown, error: '未找到目标页码或跳转输入框' };
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
      if (!nextControl) {
        return { ok: false, clicked: false, currentPage, currentPageKnown, error: '未找到下一页按钮' };
      }
      nextControl.click();
      return {
        ok: true,
        clicked: true,
        currentPage,
        currentPageKnown,
        targetPage: currentPageKnown ? currentPage + 1 : null
      };
    })()
  `;
}

function buildCandidatePageIdentityScript(items = [], options = {}) {
  const names = [];
  for (const item of Array.isArray(items) ? items : []) {
    const name = String(item?.creator_name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 2) continue;
    names.push(name);
    if (names.length >= 80) break;
  }
  const rowSelector = String(options?.rowSelector || '').trim().slice(0, 500);
  const nameSelector = String(options?.nameSelector || '').trim().slice(0, 500);
  return `
    (function(){
      const names = ${JSON.stringify(names)};
      const rowSelector = ${JSON.stringify(rowSelector)};
      const nameSelector = ${JSON.stringify(nameSelector)};
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const calibrated = Boolean(rowSelector || nameSelector);
      const required = calibrated ? names.length : Math.min(3, names.length);
      const visible = (element) => {
        if (!element || element.nodeType !== 1) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width < 2 || rect.height < 2) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) >= 0.05;
      };
      let visibleNames = [];
      let calibratedRows = [];
      if (rowSelector) {
        try { calibratedRows = Array.from(document.querySelectorAll(rowSelector)).filter(visible); } catch (_) {}
      }
      if (calibratedRows.length >= 2 && nameSelector) {
        visibleNames = calibratedRows.map((row) => {
          let target = null;
          try {
            if (row.matches?.(nameSelector)) target = row;
            else target = Array.from(row.querySelectorAll(nameSelector)).find(visible) || null;
          } catch (_) {}
          return clean(target?.innerText || target?.textContent || target?.getAttribute?.('aria-label') || '');
        }).filter(Boolean).slice(0, 80);
      } else if (nameSelector) {
        try {
          visibleNames = Array.from(document.querySelectorAll(nameSelector))
            .filter(visible)
            .map((element) => clean(element.innerText || element.textContent || element.getAttribute?.('aria-label') || ''))
            .filter(Boolean)
            .slice(0, 80);
        } catch (_) {}
      }
      if (calibratedRows.length >= 2 && visibleNames.length !== calibratedRows.length) {
        return {
          ok: false,
          orderedMatch: false,
          required,
          matchedCount: 0,
          candidateNameCount: names.length,
          visibleNameCount: visibleNames.length,
          calibratedRowCount: calibratedRows.length,
          evidence: 'calibrated-row-name-count-mismatch'
        };
      }
      if (calibrated && visibleNames.length < required) {
        return {
          ok: false,
          orderedMatch: false,
          required,
          matchedCount: 0,
          candidateNameCount: names.length,
          visibleNameCount: visibleNames.length,
          calibratedRowCount: calibratedRows.length,
          evidence: 'calibrated-name-count-insufficient'
        };
      }
      if (calibrated && required >= 2 && visibleNames.length >= 2) {
        const normalizedNames = names.map(clean);
        const exactMatch = visibleNames.length === normalizedNames.length
          && normalizedNames.every((name, index) => visibleNames[index] === name);
        return {
          ok: exactMatch,
          orderedMatch: exactMatch,
          required,
          matchedCount: exactMatch
            ? required
            : normalizedNames.filter((name, index) => visibleNames[index] === name).length,
          candidateNameCount: names.length,
          visibleNameCount: visibleNames.length,
          calibratedRowCount: calibratedRows.length,
          evidence: calibratedRows.length >= 2
            ? 'calibrated-row-name-exact-order'
            : 'calibrated-name-selector-exact-order'
        };
      }
      if (!calibrated && required >= 2 && visibleNames.length >= required) {
        let visibleCursor = 0;
        let visibleMatched = 0;
        for (const rawName of names) {
          const name = clean(rawName);
          let found = -1;
          for (let index = visibleCursor; index < visibleNames.length; index += 1) {
            if (visibleNames[index] === name) {
              found = index;
              break;
            }
          }
          if (found < 0) break;
          visibleMatched += 1;
          visibleCursor = found + 1;
          if (visibleMatched >= required) break;
        }
        return {
          ok: true,
          orderedMatch: visibleMatched >= required,
          required,
          matchedCount: visibleMatched,
          candidateNameCount: names.length,
          visibleNameCount: visibleNames.length,
          calibratedRowCount: calibratedRows.length,
          evidence: calibratedRows.length >= 2
            ? 'calibrated-row-name-order'
            : 'calibrated-name-selector'
        };
      }
      const pageText = clean(document.body?.innerText || '');
      if (!pageText || required < 2) {
        return {
          ok: false,
          orderedMatch: false,
          required,
          matchedCount: 0,
          candidateNameCount: names.length,
          visibleNameCount: visibleNames.length,
          calibratedRowCount: calibratedRows.length,
          evidence: 'body-text'
        };
      }
      let cursor = 0;
      let matchedCount = 0;
      for (const name of names) {
        const index = pageText.indexOf(clean(name), cursor);
        if (index < 0) break;
        matchedCount += 1;
        cursor = index + clean(name).length;
        if (matchedCount >= required) break;
      }
      return {
        ok: true,
        orderedMatch: matchedCount >= required,
        required,
        matchedCount,
        candidateNameCount: names.length,
        visibleNameCount: visibleNames.length,
        calibratedRowCount: calibratedRows.length,
        evidence: 'body-text'
      };
    })()
  `;
}

function buildCandidateSearchLayoutScript(options = {}) {
  const rowSelector = String(options?.rowSelector || '').trim().slice(0, 500);
  const nameSelector = String(options?.nameSelector || '').trim().slice(0, 500);
  return `
    (function(){
      const rowSelector = ${JSON.stringify(rowSelector)};
      const nameSelector = ${JSON.stringify(nameSelector)};
      const clean = (value, max = 120) => String(value || '')
        .replace(/\\u00a0/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim()
        .slice(0, max);
      const visible = (element) => {
        if (!element || element.nodeType !== 1) return false;
        const rect = element.getBoundingClientRect?.();
        if (!rect || rect.width < 2 || rect.height < 2) return false;
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) >= 0.05;
      };
      const queryVisible = (selector) => {
        if (!selector) return [];
        try { return Array.from(document.querySelectorAll(selector)).filter(visible); } catch (_) { return []; }
      };
      const rows = queryVisible(rowSelector);
      const globalNameElements = queryVisible(nameSelector);
      const candidateHref = (element) => {
        if (!element) return '';
        let href = '';
        try { href = new URL(element.href || element.getAttribute?.('href'), location.href).href; } catch (_) {}
        return /\\/blogger-detail\\//i.test(href) ? href : '';
      };
      const resolveRowLink = (row) => {
        let scope = row;
        for (let depth = 0; scope && depth < 6; depth += 1, scope = scope.parentElement) {
          const nameElements = [];
          try {
            if (nameSelector && scope.matches?.(nameSelector) && visible(scope)) nameElements.push(scope);
            if (nameSelector) {
              Array.from(scope.querySelectorAll(nameSelector)).filter(visible).forEach((element) => {
                if (!nameElements.includes(element)) nameElements.push(element);
              });
            }
          } catch (_) {}
          if (depth > 0 && nameElements.length > 1) break;
          const links = [];
          try {
            if (scope.matches?.('a[href]')) links.push(scope);
            Array.from(scope.querySelectorAll('a[href]')).forEach((element) => links.push(element));
          } catch (_) {}
          const hrefs = Array.from(new Set(links.map(candidateHref).filter(Boolean)));
          if (hrefs.length === 1) return hrefs[0];
          if (hrefs.length > 1) return '';
        }
        return '';
      };
      const rowCandidates = rows.map((row) => {
        let nameElement = null;
        try {
          if (nameSelector && row.matches?.(nameSelector)) nameElement = row;
          else if (nameSelector) nameElement = Array.from(row.querySelectorAll(nameSelector)).find(visible) || null;
        } catch (_) {}
        return {
          name: clean(nameElement?.innerText || nameElement?.textContent || nameElement?.getAttribute?.('aria-label') || '', 80),
          href: clean(resolveRowLink(row), 500)
        };
      });
      const rowNames = rowCandidates.map((candidate) => candidate.name).filter(Boolean);
      const names = (rows.length >= 2 ? rowNames : globalNameElements
        .map((element) => clean(element.innerText || element.textContent || element.getAttribute?.('aria-label') || '', 80))
        .filter(Boolean))
        .slice(0, 80);
      return {
        ok: true,
        url: location.href,
        rowCount: rows.length,
        nameCount: names.length,
        rowsWithName: rowCandidates.filter((candidate) => candidate.name).length,
        rowsWithLink: rowCandidates.filter((candidate) => candidate.href).length,
        names,
        candidates: rowCandidates.filter((candidate) => candidate.name).slice(0, 80),
        rowSamples: rows.slice(0, 5).map((element) => clean(element.innerText || element.textContent || '', 180)),
        selectors: { rowSelector, nameSelector },
        calibrated: Boolean(rowSelector || nameSelector)
      };
    })()
  `;
}

function hasCompleteCandidateSearchCalibration(options = {}) {
  const rowSelector = String(options?.rowSelector || '').trim();
  const nameSelector = String(options?.nameSelector || '').trim();
  const paginationSelector = String(options?.paginationSelector || '').trim();
  return Boolean(
    rowSelector
    && nameSelector
    && paginationSelector
    && rowSelector !== nameSelector
  );
}

module.exports = {
  MAX_CANDIDATE_COUNT,
  MAX_CANDIDATE_RANK,
  buildCandidatePageIdentityScript,
  buildCandidateSearchLayoutScript,
  buildSearchCandidateExtractionScript,
  buildSearchPaginationScript,
  hasCompleteCandidateSearchCalibration,
  parseCandidateInstruction,
  parseChineseNumber
};
