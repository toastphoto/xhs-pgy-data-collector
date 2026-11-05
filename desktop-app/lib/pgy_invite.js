function normalizePgyInviteCreatorUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.hostname.toLowerCase() !== 'pgy.xiaohongshu.com') return '';
    const match = url.pathname.match(/^\/solar\/pre-trade\/blogger-detail\/([^/?#]+)\/?$/i);
    if (!match) return '';
    const creatorId = encodeURIComponent(decodeURIComponent(match[1]));
    return `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${creatorId}`;
  } catch (_) {
    return '';
  }
}

function normalizePgyInviteFormUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'pgy.xiaohongshu.com') return '';
    if (!/^\/solar\/pre-trade\/invite-form\/?$/i.test(url.pathname)) return '';
    const inviteId = String(url.searchParams.get('id') || '').trim();
    if (!/^[a-z0-9_-]{8,128}$/i.test(inviteId)) return '';
    return `https://pgy.xiaohongshu.com/solar/pre-trade/invite-form?id=${encodeURIComponent(inviteId)}`;
  } catch (_) {
    return '';
  }
}

function isAllowedPgyInviteNavigationUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'pgy.xiaohongshu.com';
  } catch (_) {
    return false;
  }
}

function normalizePgyInviteComparableText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePgyInviteDateValue(value) {
  const text = normalizePgyInviteComparableText(value);
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    || text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function pgyInviteFieldValuesEqual(label, expected, actual) {
  if (label === '开始日期' || label === '结束日期') {
    const expectedDate = normalizePgyInviteDateValue(expected);
    const actualDate = normalizePgyInviteDateValue(actual);
    return Boolean(expectedDate && actualDate && expectedDate === actualDate);
  }
  return String(actual || '').trim() === String(expected || '').trim();
}

function resolveInviteTargetFromRows(rows, rowId) {
  const safeRowId = String(rowId || '').trim();
  if (!safeRowId || !Array.isArray(rows)) return null;
  const row = rows.find((item) => String(item?.rowId || '').trim() === safeRowId);
  if (!row) return null;
  const creatorUrl = normalizePgyInviteCreatorUrl(row.creatorUrl);
  if (!creatorUrl) return null;
  return {
    rowId: safeRowId,
    creatorName: String(row.creatorName || '').trim(),
    creatorUrl
  };
}

function normalizePgyInviteTemplate(value = {}) {
  const rawGoal = String(value.cooperationGoal || value.cooperationType || '').trim();
  const rawMode = String(value.cooperationMode || '').trim();
  const rawContactChannel = String(value.contactChannel || value.disclosureMethod || '').trim();
  return {
    cooperationGoal: /直播/.test(rawGoal) ? '直播合作' : '笔记合作',
    cooperationMode: /种收/.test(rawMode) ? '种收联动' : '定制合作',
    contactMethod: '线上邀约',
    contactChannel: /手机/.test(rawContactChannel) ? '手机号' : '微信',
    brandName: String(value.brandName || '').trim().slice(0, 200),
    productName: String(value.productName || '').trim().slice(0, 200),
    contactWay: String(value.contactWay || '').trim().slice(0, 200),
    intro: String(value.intro || '').trim().slice(0, 5000),
    publishStart: String(value.publishStart || '').trim().slice(0, 40),
    publishEnd: String(value.publishEnd || '').trim().slice(0, 40)
  };
}

function validatePgyInviteTemplate(value = {}) {
  const template = normalizePgyInviteTemplate(value);
  const missing = [
    ['报备品牌', template.brandName],
    ['联系方式', template.contactWay],
    ['产品名称', template.productName],
    ['合作内容介绍', template.intro],
    ['开始日期', template.publishStart],
    ['结束日期', template.publishEnd]
  ].filter((entry) => !entry[1]).map((entry) => entry[0]);
  const errors = [];
  if (missing.length) errors.push(`请先填写：${missing.join('、')}`);
  if (template.productName.length > 20) errors.push('产品名称最多 20 个字符');
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (template.publishStart && !datePattern.test(template.publishStart)) errors.push('开始日期必须为 YYYY-MM-DD');
  if (template.publishEnd && !datePattern.test(template.publishEnd)) errors.push('结束日期必须为 YYYY-MM-DD');
  if (datePattern.test(template.publishStart) && datePattern.test(template.publishEnd) && template.publishStart > template.publishEnd) {
    errors.push('结束日期不能早于开始日期');
  }
  return { ok: errors.length === 0, template, errors };
}

function pageInviteHelpers() {
  const textOf = (node) => String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  // Reading fields must survive scrolling, while clicks still require viewport visibility.
  const isRendered = (node) => {
    if (!node?.isConnected || node.matches?.('input[type="hidden"]')) return false;
    for (let current = node; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (current.hidden || current.getAttribute('aria-hidden') === 'true'
        || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const isVisible = (node) => {
    if (!isRendered(node)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0
      && rect.right > 0 && rect.bottom > 0
      && rect.left < window.innerWidth && rect.top < window.innerHeight;
  };
  const centerPoint = (node) => {
    if (!isVisible(node)) return null;
    const rect = node.getBoundingClientRect();
    const visibleLeft = Math.max(0, rect.left);
    const visibleRight = Math.min(window.innerWidth, rect.right);
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return null;
    return {
      x: Math.round(visibleLeft + ((visibleRight - visibleLeft) / 2)),
      y: Math.round(visibleTop + ((visibleBottom - visibleTop) / 2))
    };
  };
  const visibleAncestor = (node) => {
    let current = node || null;
    for (let depth = 0; current && depth < 7; depth += 1) {
      if (isVisible(current)) return current;
      current = current.parentElement;
    }
    return null;
  };
  const exactTextNodes = (root, label) => Array.from(root.querySelectorAll('span, div, p, label'))
    .filter(isVisible)
    .filter((node) => textOf(node) === label)
    .sort((a, b) => a.childElementCount - b.childElementCount);
  const labelTextNodes = (root, label) => Array.from(root.querySelectorAll('span, div, p, label'))
    .filter(isRendered)
    .filter((node) => textOf(node).replace(/\s*\*\s*$/, '').trim() === label)
    .sort((a, b) => a.childElementCount - b.childElementCount);
  const exactTextNodesAnywhere = (root, label) => Array.from(root.querySelectorAll('span, div, p, label, button, a, li, [role="group"], [role="combobox"]'))
    .filter((node) => textOf(node) === label)
    .sort((a, b) => a.childElementCount - b.childElementCount);
  const pointRightOfLabel = (node, offset = 150) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) return null;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    if (visibleBottom <= visibleTop) return null;
    return {
      x: Math.round(Math.min(window.innerWidth - 8, Math.max(8, rect.right + offset))),
      y: Math.round(visibleTop + ((visibleBottom - visibleTop) / 2))
    };
  };
  const fieldRightOfLabel = (root, labelNode) => {
    if (!root || !labelNode) return null;
    const labelRect = labelNode.getBoundingClientRect();
    return Array.from(root.querySelectorAll('input, textarea, [contenteditable="true"], [role="combobox"]'))
      .filter(isVisible)
      .map((field) => {
        const rect = field.getBoundingClientRect();
        const verticalDistance = Math.abs((rect.top + (rect.height / 2)) - (labelRect.top + (labelRect.height / 2)));
        const horizontalDistance = Math.max(0, rect.left - labelRect.right);
        return { field, verticalDistance, horizontalDistance };
      })
      .filter((item) => item.verticalDistance < 36)
      .sort((a, b) => (a.verticalDistance * 8 + a.horizontalDistance) - (b.verticalDistance * 8 + b.horizontalDistance))[0]?.field || null;
  };
  const exactClickable = (root, label) => {
    for (const node of exactTextNodes(root, label)) {
      const candidate = node.closest('button, a, label, [role="radio"], [role="button"], [class*="radio"]') || node;
      if (isVisible(candidate)) return candidate;
    }
    return Array.from(root.querySelectorAll('button, a, label, [role="button"], [role="radio"]'))
      .filter(isVisible)
      .find((node) => textOf(node) === label) || null;
  };
  const modalRoot = () => {
    const selectors = ['[role="dialog"]', '.ant-modal', '.ant-drawer-content', '[class*="dialog"]', '[class*="modal"]', '[class*="drawer"]'];
    const candidates = Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(isVisible)
      .filter((node) => {
        const text = textOf(node);
        return (text.includes('笔记合作') && text.includes('直播合作') && text.includes('发起邀约'))
          || (text.includes('合作诉求') && text.includes('合作模式') && text.includes('建联方式'));
      });
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });
    return candidates[0] || null;
  };
  const radioInputForLabel = (root, label) => {
    const textNode = labelTextNodes(root, label)[0] || null;
    if (!textNode) return null;
    let current = textNode;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const inputs = Array.from(current.querySelectorAll?.('input[type="radio"]') || []);
      if (inputs.length === 1) return inputs[0];
      if (inputs.length > 1) break;
      current = current.parentElement;
    }
    const textRect = textNode.getBoundingClientRect();
    const nearby = Array.from(root.querySelectorAll('input[type="radio"]')).map((input) => {
      const rect = input.getBoundingClientRect();
      const dx = Math.abs((rect.left + (rect.width / 2)) - textRect.left);
      const dy = Math.abs((rect.top + (rect.height / 2)) - (textRect.top + (textRect.height / 2)));
      return { input, distance: dx + (dy * 4), dy };
    }).filter((item) => item.dy < 28).sort((a, b) => a.distance - b.distance);
    return nearby[0]?.input || null;
  };
  const optionState = (root, label) => {
    const node = exactClickable(root, label);
    const input = radioInputForLabel(root, label);
    if (!node && !input) return { label, found: false, selected: false, disabled: false };
    const wrapper = input?.closest('label, [role="radio"], [class*="radio"]')
      || node?.closest('label, [role="radio"], [class*="radio"]')
      || node;
    return {
      label,
      found: true,
      selected: Boolean(input?.checked || wrapper?.getAttribute?.('aria-checked') === 'true' || /checked|selected|active/.test(String(wrapper?.className || '').toLowerCase())),
      disabled: Boolean(input?.disabled || node?.disabled || wrapper?.getAttribute?.('aria-disabled') === 'true' || /disabled/.test(String(wrapper?.className || '').toLowerCase()))
    };
  };
  const optionPoint = (root, label) => {
    const input = radioInputForLabel(root, label);
    if (input && isVisible(input)) return centerPoint(input);
    const node = exactClickable(root, label);
    const point = centerPoint(node?.closest('label, [role="radio"], [class*="radio"]') || node);
    if (point) return point;
    const textPoint = centerPoint(exactTextNodes(root, label)[0]);
    return textPoint ? { x: Math.max(1, textPoint.x - 18), y: textPoint.y } : null;
  };
  const platformMessages = () => {
    const bodyText = textOf(document.body);
    return ['permission denied', '博主尚未开通笔记合作', '博主尚未开通直播合作', '请先选择店铺']
      .filter((message) => bodyText.includes(message));
  };
  const fieldContainer = (root, label) => {
    const labelNode = labelTextNodes(root, label)[0] || null;
    if (!labelNode) return null;
    let current = labelNode.parentElement;
    for (let depth = 0; current && current !== root && depth < 7; depth += 1) {
      const controls = current.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="combobox"]');
      if (controls.length > 0 && controls.length <= 5) return current;
      if (controls.length > 5) break;
      current = current.parentElement;
    }
    return null;
  };
  const setFieldValue = (field, value, { blur = true } = {}) => {
    if (!field) return false;
    if (field.isContentEditable) field.textContent = value;
    else {
      const proto = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(field, value);
      else field.value = value;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    if (blur) field.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  };
  const readFieldValue = (field) => field?.isContentEditable ? textOf(field) : String(field?.value || '').trim();
  const readBrandState = (container) => {
    if (!container) return { found: false, actual: '' };
    if (container.contains(document.activeElement) && document.activeElement?.matches('input')
      && isRendered(document.activeElement) && !document.activeElement.readOnly) {
      return { found: false, actual: '' };
    }
    const excluded = '[role="option"], [role="listbox"], [class*="dropdown"], [class*="option"]';
    const labels = labelTextNodes(container, '品牌名');
    const nodes = Array.from(container.querySelectorAll('span, div, p'))
      .filter(isRendered)
      .filter(node => !labels.some(label => label === node || label.contains(node)))
      .filter(node => !node.closest(excluded))
      .filter(node => !Array.from(node.children).some(child => isRendered(child) && textOf(child)))
      .map(textOf)
      .filter(text => text && !/^(品牌名\s*\*?|请选择报备品牌|请输入品牌名称\/ID搜索)$/.test(text));
    const selectedInputs = Array.from(container.querySelectorAll('input, select'))
      .filter(isRendered)
      .filter(node => !node.closest(excluded))
      .filter(node => node.tagName === 'SELECT' || node.readOnly || node.disabled)
      .map(node => node.tagName === 'SELECT' ? textOf(node.selectedOptions?.[0]) : readFieldValue(node))
      .filter(Boolean);
    const candidates = Array.from(new Set([...nodes, ...selectedInputs]));
    return { found: candidates.length === 1, actual: candidates.join(' | ') };
  };
  const brandOptions = (container, searchInput) => {
    if (!searchInput) return [];
    const controls = [searchInput, searchInput.closest('[role="combobox"]'), container].filter(Boolean);
    const linkedIds = controls.flatMap(node => `${node.getAttribute('aria-controls') || ''} ${node.getAttribute('aria-owns') || ''}`.split(/\s+/).filter(Boolean));
    let roots = linkedIds.map(id => document.getElementById(id)).filter(isVisible);
    if (!linkedIds.length) {
      roots = Array.from(container?.querySelectorAll('[role="listbox"]') || []).filter(isVisible);
      if (!roots.length) {
        const anchor = searchInput.getBoundingClientRect();
        roots = Array.from(document.querySelectorAll('[role="listbox"], [class*="dropdown"], [class*="select-menu"], [class*="select-popup"], [class*="popper"], [class*="popover"]'))
          .filter(isVisible).filter(node => {
            const rect = node.getBoundingClientRect();
            return rect.right > anchor.left && rect.left < anchor.right
              && rect.top < anchor.bottom + 120 && rect.bottom > anchor.top - 120;
          });
        roots = roots.filter(root => !roots.some(other => other !== root && root.contains(other)));
        if (roots.length !== 1) return [];
      }
    }
    const choices = [];
    const nodes = roots.flatMap(root => Array.from(root.querySelectorAll('[role="option"], li, [class*="option"], [class*="select-item"], [class*="dropdown-item"]')));
    // Class substrings also match plural list wrappers; never click their center.
    const namedNodes = nodes.filter(node => {
      const text = textOf(node);
      return isVisible(node) && text && !/^(ID\s*[:：]|暂无|无搜索|没有|加载|搜索中|请选择|请输入)/i.test(text);
    });
    const rows = namedNodes.filter(node => !namedNodes.some(other => other !== node && node.contains(other)));
    for (const node of rows) {
      if (!isVisible(node) || node.closest('header') || node.getAttribute('aria-disabled') === 'true'
        || /disabled/i.test(String(node.className || ''))) continue;
      if (node.getAttribute('role') !== 'option'
        && !node.closest('[role="listbox"], [class*="dropdown"], [class*="select-menu"], [class*="select-popup"], [class*="popper"], [class*="popover"]')) continue;
      // Search highlighting splits names across children; an ID row is metadata.
      const optionName = String(node.innerText || node.textContent || '').split(/\r?\n/)
        .map(text => text.trim()).find(text => text && !/^ID\s*[:：]/i.test(text)) || '';
      const label = String(node.getAttribute('data-label') || optionName)
        .replace(/\s*ID\s*[:：].*$/i, '').trim();
      if (!label || label.length > 200 || /^(暂无|无搜索|没有|加载|搜索中|请选择|请输入)/.test(label)
        || choices.some(choice => choice.label === label)) continue;
      choices.push({ label, node });
      if (choices.length >= 20) break;
    }
    return choices;
  };
  const brandDiagnostics = () => ({
    inputs: Array.from(document.querySelectorAll('input')).filter(isVisible).slice(0, 4).map(node => ({
      tag: node.tagName, classes: String(node.className || ''), readOnly: node.readOnly,
      focused: document.activeElement === node, placeholder: node.getAttribute('placeholder')
    })),
    popups: Array.from(document.querySelectorAll('[role="listbox"], [class*="dropdown"], [class*="popper"], [class*="popover"], [class*="select"]'))
      .filter(isVisible).slice(0, 20).map(node => ({
        tag: node.tagName, classes: String(node.className || ''), role: node.getAttribute('role'),
        children: Array.from(node.children).slice(0, 4).map(child => ({tag: child.tagName, classes: String(child.className || '')}))
      }))
  });
  const inputByPlaceholder = (root, placeholder) => {
    const scope = root || document;
    const fields = Array.from(scope.querySelectorAll('input, textarea, [contenteditable="true"]')).filter(isRendered);
    const direct = fields.filter((field) => [
      field.getAttribute('placeholder'),
      field.getAttribute('aria-placeholder'),
      field.getAttribute('data-placeholder'),
      field.getAttribute('aria-label'),
      field.value
    ].some((value) => String(value || '').trim() === placeholder));
    if (direct.length) return direct.length === 1 ? direct[0] : null;
    const hintNode = labelTextNodes(scope, placeholder)[0] || null;
    let current = hintNode?.parentElement || null;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const nested = Array.from(current.querySelectorAll('input, textarea, [contenteditable="true"]')).filter(isRendered);
      if (nested.length === 1) return nested[0];
      if (nested.length > 1) break;
      current = current.parentElement;
    }
    return null;
  };
  const detailFields = (root) => {
    const datesContainer = fieldContainer(root, '期望发布时间');
    const dateInputs = Array.from(datesContainer?.querySelectorAll('input') || []).filter(isRendered);
    const introContainer = fieldContainer(root, '合作内容介绍');
    const contactContainer = fieldContainer(root, '联系方式');
    return {
      brand: readBrandState(fieldContainer(root, '品牌名')),
      contact: contactContainer ? inputByPlaceholder(contactContainer, '请输入') : null,
      product: inputByPlaceholder(root, '请输入产品名称'),
      intro: Array.from(introContainer?.querySelectorAll('textarea, [contenteditable="true"], input') || []).filter(isRendered)[0] || null,
      start: inputByPlaceholder(root, '开始日期') || (dateInputs.length === 2 ? dateInputs[0] : null),
      end: inputByPlaceholder(root, '结束日期') || (dateInputs.length === 2 ? dateInputs[1] : null)
    };
  };
  const detailFieldResults = (root, template) => {
    const fields = detailFields(root);
    const channel = optionState(root, template.contactChannel);
    return [
      { label: '报备品牌', found: fields.brand.found, expected: template.brandName, actual: fields.brand.actual },
      { label: '联系方式类型', found: channel.found, expected: template.contactChannel, actual: channel.selected ? template.contactChannel : '' },
      ...[
        ['联系方式', fields.contact, template.contactWay], ['产品名称', fields.product, template.productName],
        ['合作内容介绍', fields.intro, template.intro], ['开始日期', fields.start, template.publishStart],
        ['结束日期', fields.end, template.publishEnd]
      ].map(([label, field, expected]) => ({ label, found: Boolean(field), expected, actual: readFieldValue(field) }))
    ].map(item => ({ ...item, verified: item.found && pgyInviteFieldValuesEqual(item.label, item.expected, item.actual) }));
  };
  const inviteFormRoot = () => {
    if (!/^\/solar\/pre-trade\/invite-form\/?$/i.test(location.pathname)) return null;
    const bodyText = textOf(document.body);
    return bodyText.includes('品牌名') && bodyText.includes('产品名称') && bodyText.includes('合作内容介绍') ? document.body : null;
  };
  return {
    textOf,
    isRendered,
    isVisible,
    centerPoint,
    visibleAncestor,
    exactTextNodes,
    labelTextNodes,
    exactTextNodesAnywhere,
    pointRightOfLabel,
    fieldRightOfLabel,
    exactClickable,
    modalRoot,
    optionState,
    optionPoint,
    platformMessages,
    fieldContainer,
    setFieldValue,
    readFieldValue,
    readBrandState,
    brandChoices: (container, searchInput) => brandOptions(container, searchInput).map(({ label }) => ({ label })),
    brandDiagnostics,
    brandOptionPoint: (container, searchInput, label) => {
      const node = brandOptions(container, searchInput).find(option => option.label === label)?.node;
      const point = centerPoint(node);
      return point && node.contains(document.elementFromPoint(point.x, point.y)) ? point : null;
    },
    detailFields,
    detailFieldResults,
    inputByPlaceholder,
    inviteFormRoot
  };
}

function inspectPgyInviteEntryInPage(template) {
  const helpers = pageInviteHelpers();
  if (/^\/solar\/pre-trade\/invite-form\/?$/i.test(location.pathname)) {
    return { ok: true, stage: 'detail-form', action: null, url: location.href };
  }
  const messages = helpers.platformMessages();
  if (messages.includes('permission denied')) {
    return { ok: false, code: 'PGY_INVITE_PERMISSION_DENIED', error: '邀约账号没有执行当前合作类型的权限（平台返回 permission denied）', platformMessages: messages };
  }
  const modal = helpers.modalRoot();
  if (!modal) {
    const inviteButton = helpers.exactClickable(document, '邀约');
    const point = helpers.centerPoint(inviteButton);
    if (!point) return { ok: false, code: 'PGY_INVITE_BUTTON_NOT_FOUND', error: '当前达人页没有找到“邀约”按钮' };
    return { ok: true, stage: 'creator', action: { type: 'open-entry-dialog', label: '邀约', point } };
  }
  const wantedOptions = [template.cooperationGoal, template.cooperationMode, template.contactMethod];
  const verifiedOptions = wantedOptions.map((label) => helpers.optionState(modal, label));
  const missing = verifiedOptions.find((item) => !item.found || !item.selected);
  if (missing) {
    if (missing.disabled) return { ok: false, code: 'PGY_INVITE_OPTION_DISABLED', error: `平台已禁用当前模板选项：${missing.label}`, verifiedOptions };
    const point = helpers.optionPoint(modal, missing.label);
    if (!point) return { ok: false, code: 'PGY_INVITE_OPTION_NOT_FOUND', error: `没有找到邀约选项：${missing.label}`, verifiedOptions };
    return { ok: true, stage: 'entry-dialog', verifiedOptions, action: { type: 'select-option', label: missing.label, point } };
  }
  const entryButton = helpers.exactClickable(modal, '发起邀约') || helpers.exactClickable(document, '发起邀约');
  const point = helpers.centerPoint(entryButton);
  const enabled = Boolean(entryButton && !entryButton.disabled && entryButton.getAttribute('aria-disabled') !== 'true');
  if (!point) return { ok: false, code: 'PGY_INVITE_ENTRY_ACTION_NOT_FOUND', error: '没有找到进入详细邀约表单的按钮', verifiedOptions };
  if (!enabled) return { ok: false, code: 'PGY_INVITE_ENTRY_ACTION_DISABLED', error: '第一层选项已填写，但平台仍不允许进入详细邀约表单', verifiedOptions, platformMessages: messages };
  return { ok: true, stage: 'entry-dialog', verifiedOptions, action: { type: 'open-detail-form', label: '发起邀约', point } };
}

async function preparePgyInviteDetailFormInPage(template, brandSelectionConfirmed = true, brandSelectionSettled = true) {
  const helpers = pageInviteHelpers();
  const root = helpers.inviteFormRoot();
  if (!root) return { ok: false, code: 'PGY_INVITE_DETAIL_FORM_NOT_FOUND', error: '没有识别到蒲公英详细邀约表单' };

  const agencyContainer = helpers.fieldContainer(root, '代理商');
  const agency = helpers.textOf(agencyContainer).replace(/^代理商\s*\*?\s*/, '').trim();
  const brandContainer = helpers.fieldContainer(root, '品牌名');
  const brandHintNode = helpers.exactTextNodes(brandContainer || root, '请选择报备品牌')[0]
    || helpers.exactTextNodes(root, '请选择报备品牌')[0]
    || helpers.exactTextNodesAnywhere(brandContainer || root, '请选择报备品牌')[0]
    || helpers.exactTextNodesAnywhere(root, '请选择报备品牌')[0]
    || null;
  const brandLabelNode = helpers.labelTextNodes(root, '品牌名')[0]
    || helpers.exactTextNodesAnywhere(root, '品牌名')[0]
    || null;
  const brandInput = helpers.inputByPlaceholder(brandContainer || root, '请选择报备品牌')
    || helpers.fieldRightOfLabel(root, brandLabelNode);
  if (brandSelectionConfirmed && !brandSelectionSettled) {
    const point = helpers.centerPoint(brandLabelNode);
    if (!point) return {ok: false, code: 'PGY_INVITE_BRAND_FIELD_NOT_FOUND', error: '品牌选择后未能定位字段标签以核对实际选中值'};
    return {ok: true, action: {type: 'settle-brand', point}};
  }
  const brandTrigger = helpers.visibleAncestor(brandInput?.parentElement)
    || helpers.visibleAncestor(brandInput)
    || helpers.visibleAncestor(brandHintNode?.closest('[role="combobox"], [role="button"], [class*="select"], [class*="trigger"], [class*="input"]'))
    || helpers.visibleAncestor(brandHintNode);
  const brandState = helpers.readBrandState(brandContainer);
  const brandSelected = brandSelectionConfirmed && brandState.found
    && pgyInviteFieldValuesEqual('报备品牌', template.brandName, brandState.actual);
  if (!brandSelected) {
    const brandSearchHint = helpers.textOf(document.body).includes('请输入品牌名称/ID搜索');
    const searchInput = helpers.inputByPlaceholder(document, '请输入品牌名称/ID搜索')
      || (brandInput && !brandInput.readOnly && document.activeElement === brandInput ? brandInput : null)
      || (brandSearchHint ? brandInput : null);
    const optionPoint = helpers.brandOptionPoint(brandContainer, searchInput, template.brandName);
    if (optionPoint) {
      return { ok: true, stage: 'detail-form', action: { type: 'select-brand', label: template.brandName, point: optionPoint }, agency };
    }
    if (!searchInput) {
      const point = helpers.centerPoint(brandInput)
        || helpers.centerPoint(brandHintNode)
        || helpers.pointRightOfLabel(brandLabelNode, 130)
        || helpers.centerPoint(brandTrigger || brandContainer);
      if (!point) {
        return { ok: false, code: 'PGY_INVITE_BRAND_FIELD_NOT_FOUND', error: '没有找到报备品牌选择框' };
      }
      return { ok: true, stage: 'detail-form', action: { type: 'open-brand-picker', label: template.brandName, value: template.brandName, point }, agency };
    }
    if (helpers.readFieldValue(searchInput) !== template.brandName) {
      helpers.setFieldValue(searchInput, template.brandName, { blur: false });
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    const point = helpers.brandOptionPoint(brandContainer, searchInput, template.brandName);
    if (!point) return {
      ok: true, stage: 'detail-form', waitingForBrand: true,
      brandCandidates: helpers.brandChoices(brandContainer, searchInput), brandDiagnostics: helpers.brandDiagnostics(), agency
    };
    return { ok: true, stage: 'detail-form', action: { type: 'select-brand', label: template.brandName, point }, agency };
  }

  const contactState = helpers.optionState(root, template.contactChannel);
  if (!contactState.found || !contactState.selected) {
    const point = helpers.optionPoint(root, template.contactChannel);
    if (!point) return { ok: false, code: 'PGY_INVITE_CONTACT_CHANNEL_NOT_FOUND', error: `没有找到联系方式选项：${template.contactChannel}`, agency };
    return { ok: true, stage: 'detail-form', action: { type: 'select-contact-channel', label: template.contactChannel, point }, agency };
  }

  const fields = helpers.detailFields(root);
  const desired = [
    ['联系方式', fields.contact, template.contactWay],
    ['产品名称', fields.product, template.productName],
    ['合作内容介绍', fields.intro, template.intro],
    ['开始日期', fields.start, template.publishStart],
    ['结束日期', fields.end, template.publishEnd]
  ];
  desired.forEach(([label, field, expected]) => {
    const actual = helpers.readFieldValue(field);
    if (field && !pgyInviteFieldValuesEqual(label, expected, actual)) helpers.setFieldValue(field, expected);
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  let fieldResults = helpers.detailFieldResults(root, template);
  let missingFields = fieldResults.filter((item) => !item.verified).map((item) => item.label);
  const finalButton = helpers.exactClickable(root, '发起邀约')
    || Array.from(root.querySelectorAll('button')).find((node) => helpers.textOf(node) === '发起邀约')
    || null;
  if (missingFields.length === 0 && finalButton && !helpers.isVisible(finalButton)) {
    finalButton.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  fieldResults = helpers.detailFieldResults(root, template);
  missingFields = fieldResults.filter((item) => !item.verified).map((item) => item.label);
  const finalEnabled = Boolean(finalButton && !finalButton.disabled && finalButton.getAttribute('aria-disabled') !== 'true');
  const readyToSend = missingFields.length === 0 && Boolean(finalButton) && finalEnabled;
  return {
    ok: true,
    stage: 'detail-form',
    agency,
    formUrl: location.href,
    fieldResults,
    missingFields,
    finalAction: { found: Boolean(finalButton), enabled: finalEnabled, label: finalButton ? '发起邀约' : '', point: helpers.centerPoint(finalButton) },
    readyToSend,
    error: readyToSend ? '' : (missingFields.length ? `详细邀约表单校验未通过：${missingFields.join('、')}` : '详细邀约表单已填写，但平台的“发起邀约”按钮仍不可用')
  };
}

async function verifyPreparedPgyInviteInPage(template) {
  const helpers = pageInviteHelpers();
  const root = helpers.inviteFormRoot();
  if (!root) return { ok: false, code: 'PGY_INVITE_DETAIL_FORM_NOT_FOUND', error: '详细邀约表单已经关闭，请重新准备邀约' };
  const findFinalButton = () => {
    const candidates = Array.from(root.querySelectorAll('button, [role="button"]'))
      .filter(helpers.isRendered)
      .filter(node => helpers.textOf(node) === '发起邀约');
    return candidates.length === 1 ? candidates[0] : null;
  };
  let finalButton = findFinalButton();
  if (finalButton && !helpers.isVisible(finalButton)) {
    finalButton.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  const fieldResults = helpers.detailFieldResults(root, template);
  const invalidFields = fieldResults.filter((item) => !item.verified).map((item) => item.label);
  if (invalidFields.length) {
    const unreadable = fieldResults.filter(item => !item.found).map(item => item.label);
    const changed = fieldResults.filter(item => item.found && !item.verified).map(item => item.label);
    return {
      ok: false, code: unreadable.length ? 'PGY_INVITE_FIELD_UNREADABLE' : 'PGY_INVITE_FORM_CHANGED',
      error: `发送前校验失败：${[unreadable.length ? `未能读取 ${unreadable.join('、')}` : '', changed.length ? `${changed.join('、')} 与本次模板不一致` : ''].filter(Boolean).join('；')}。尚未点击发送，请重新准备。`,
      fieldResults
    };
  }
  finalButton = findFinalButton();
  const point = helpers.centerPoint(finalButton);
  const topNode = point ? document.elementFromPoint(point.x, point.y) : null;
  if (!finalButton || !point || !finalButton.contains(topNode) || finalButton.disabled || finalButton.getAttribute('aria-disabled') === 'true') {
    return { ok: false, code: 'PGY_INVITE_FINAL_ACTION_UNAVAILABLE', error: '平台的最终“发起邀约”按钮不存在或不可用', fieldResults };
  }
  return { ok: true, ready: true, fieldResults, finalAction: { label: '发起邀约', point } };
}

function inspectPgyInviteOutcomeInPage() {
  const helpers = pageInviteHelpers();
  const successText = Array.from(document.querySelectorAll('[role="alert"], [role="status"], [class*="message"], [class*="toast"], [class*="notification"]'))
    .filter(helpers.isVisible)
    .map(helpers.textOf)
    .find(text => /^(邀约成功|已发起邀约|发送成功)[！!。.]?$/.test(text)) || '';
  return {
    ok: true,
    successText,
    outcome: successText ? 'success-confirmed' : (/^\/solar\/pre-trade\/invite-form\/?$/i.test(location.pathname) ? 'submitted-unconfirmed' : 'page-changed'),
    url: location.href
  };
}

function buildPgyInviteEntryInspectScript(value) {
  const template = normalizePgyInviteTemplate(value);
  return `(() => {
    const pageInviteHelpers = ${pageInviteHelpers.toString()};
    return (${inspectPgyInviteEntryInPage.toString()})(${JSON.stringify(template)});
  })()`;
}

function buildPgyInvitePrepareScript(value, { brandSelectionConfirmed = true, brandSelectionSettled = true } = {}) {
  const template = normalizePgyInviteTemplate(value);
  return `(() => {
    const normalizePgyInviteComparableText = ${normalizePgyInviteComparableText.toString()};
    const normalizePgyInviteDateValue = ${normalizePgyInviteDateValue.toString()};
    const pgyInviteFieldValuesEqual = ${pgyInviteFieldValuesEqual.toString()};
    const pageInviteHelpers = ${pageInviteHelpers.toString()};
    return (${preparePgyInviteDetailFormInPage.toString()})(${JSON.stringify(template)}, ${brandSelectionConfirmed === true}, ${brandSelectionSettled === true});
  })()`;
}

function buildPgyInviteSendScript(value) {
  const template = normalizePgyInviteTemplate(value);
  return `(() => {
    const normalizePgyInviteComparableText = ${normalizePgyInviteComparableText.toString()};
    const normalizePgyInviteDateValue = ${normalizePgyInviteDateValue.toString()};
    const pgyInviteFieldValuesEqual = ${pgyInviteFieldValuesEqual.toString()};
    const pageInviteHelpers = ${pageInviteHelpers.toString()};
    return (${verifyPreparedPgyInviteInPage.toString()})(${JSON.stringify(template)});
  })()`;
}

function buildPgyInviteOutcomeScript() {
  return `(() => {
    const pageInviteHelpers = ${pageInviteHelpers.toString()};
    return (${inspectPgyInviteOutcomeInPage.toString()})();
  })()`;
}

module.exports = {
  buildPgyInviteEntryInspectScript,
  buildPgyInviteOutcomeScript,
  buildPgyInvitePrepareScript,
  buildPgyInviteSendScript,
  isAllowedPgyInviteNavigationUrl,
  normalizePgyInviteComparableText,
  normalizePgyInviteDateValue,
  normalizePgyInviteFormUrl,
  normalizePgyInviteTemplate,
  normalizePgyInviteCreatorUrl,
  pgyInviteFieldValuesEqual,
  resolveInviteTargetFromRows,
  validatePgyInviteTemplate
};
