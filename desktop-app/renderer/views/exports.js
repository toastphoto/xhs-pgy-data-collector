import { store } from '../state/store.js';
import {
  buildReviewViewportKey,
  createReviewViewportStateRegistry,
  restoreReviewViewport
} from '../state/review_view_state.mjs';
import { createAdvancedSection } from '../ui/components.js';

let _runs = [];
let _selectedRunDir = '';
let _msg = '';
let _columns = [];
let _groups = [];
let _checked = new Set();
let _query = '';
let _colsLoadedOnce = false;
let _activeGroup = '';
let _contactGroupTag = '';
let _contactGreeting = '您好，我们想和您沟通一下品牌合作，方便的话可以通过一下好友吗？';
let _xiaomifengSmartRemark = '{MMDD}-{昵称}';
let _xiaomifengTaskWechat = '';
let _xiaomifengApproval = null;
let _xiaomifengApprovalCheck = null;
let _contactChannelStrategy = '自动分流';
let _contactEmailSubject = '';
let _contactEmailBody = '';
let _contactPgyCooperationType = '图文';
let _contactPgyBrandName = '';
let _contactPgyProductName = '';
let _contactPgyContactWay = '';
let _contactPgyIntro = '';
let _contactPgyPublishStart = '';
let _contactPgyPublishEnd = '';
let _contactPreviewRows = [];
let _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: false, error: '' };
let _contactReviewMap = new Map();
let _contactPreviewRunDir = '';
let _contactLoadedRunDir = '';
let _contactSaveTimer = null;
let _contactPendingSave = null;
let _contactSaveInFlight = null;
let _contactRunSwitchTarget = '';
let _contactSearch = '';
let _contactStatusFilter = 'all';
let _contactContactFilter = 'all';
let _contactPriorityFilter = 'all';
let _contactFollowupFilter = 'all';
let _contactChannelFilter = 'all';
let _contactBatchFollowupStatus = '待建联';
let _contactBatchChannel = '蒲公英邀约';
const _contactReviewViewportStates = createReviewViewportStateRegistry();
let _contactBulkActionsOpen = false;
let _autoPreviewRequestedRunDir = '';
let _contactSaveStatus = '';
let _lastContactExportPath = '';
let _contactExportState = { status: 'idle', message: '', outPath: '' };
let _xhsContactListenerBound = false;
const _autoEnrichmentStartedRuns = new Set();
let _xhsContactState = {
  running: false,
  paused: false,
  pausePending: false,
  cancelPending: false,
  phase: 'idle',
  total: 0,
  completed: 0,
  found: 0,
  failed: 0,
  session: 'unknown',
  currentCreatorName: '',
  lastCode: '',
  message: ''
};
let _emailHandoffState = {
  status: 'idle',
  emails: [],
  missingNames: [],
  message: ''
};

const FOLLOWUP_STATUS_OPTIONS = ['待建联', '已建联', '已通过', '已拒绝', '需二次跟进', '不建联'];
const CONTACT_CHANNEL_OPTIONS = ['自动分流', '蒲公英邀约', '微信建联', '邮件建联', '待补联系方式'];
const CONTACT_SELECTION_POLICY = 'manual_opt_in_v1';

function setMsg(s) {
  _msg = s || '';
  store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
}

function setContactSaveStatus(s) {
  _contactSaveStatus = s || '';
  store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
}

async function refreshRuns() {
  setMsg('刷新 runs 列表中...');
  try {
    const r = await window.desktopAPI.exports.listRuns();
    if (!r?.ok) {
      setMsg(`刷新失败：${r?.error || 'unknown error'}`);
      return;
    }
    _runs = Array.isArray(r.runs) ? r.runs : [];
    if (!_selectedRunDir) _selectedRunDir = _runs?.[0]?.path || '';
    if (_selectedRunDir && _autoPreviewRequestedRunDir !== _selectedRunDir && !_contactPreviewRows.length) {
      _autoPreviewRequestedRunDir = _selectedRunDir;
      setTimeout(() => refreshContactPreview().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
    }
    setMsg('');
  } catch (e) {
    setMsg(`刷新异常：${e?.message || String(e)}`);
  }
}

async function ensureColumnsLoaded() {
  if (_colsLoadedOnce) return;
  _colsLoadedOnce = true;
  try {
    const r = await window.desktopAPI.exports.getResourceColumns();
    if (r?.ok) {
      _columns = Array.isArray(r.columns) ? r.columns : [];
      _groups = Array.isArray(r.groups) ? r.groups : [];
    }
    const p = await window.desktopAPI.exports.loadColumnPreset();
    const preset = p?.ok && Array.isArray(p.selectedColumns) ? p.selectedColumns.map(String) : [];
    const known = p?.ok && Array.isArray(p.knownColumns) ? p.knownColumns.map(String) : [];
    const presetSet = new Set(preset);
    const knownSet = new Set(known);

    // 规则：
    // - 如果没有 preset：全选
    // - 如果有 preset：按 preset 勾选；若发现“新增列”（当前列不在 knownColumns 里）则默认勾选
    if (!preset.length) {
      _checked = new Set(_columns);
    } else {
      _checked = new Set(preset);
      _columns.forEach((c) => {
        if (!knownSet.has(c)) _checked.add(c); // 新增列默认勾选
      });
    }
  } catch (_) {
    // ignore
  }
}

function _filteredColumns(cols) {
  const q = String(_query || '').trim();
  if (!q) return cols;
  return cols.filter((c) => String(c).includes(q));
}

function getReviewRows() {
  return Array.from(_contactReviewMap.values()).map((row) => ({ ...row }));
}

function getContactReviewViewportKey() {
  return buildReviewViewportKey({
    runDir: _selectedRunDir,
    filters: {
      search: _contactSearch,
      status: _contactStatusFilter,
      contact: _contactContactFilter,
      priority: _contactPriorityFilter,
      followup: _contactFollowupFilter,
      channel: _contactChannelFilter
    }
  });
}

function applyXhsContactUpdate(update = {}) {
  const rowId = String(update.rowId || '');
  if (!rowId) return false;
  const review = _contactReviewMap.get(rowId);
  if (!review) return false;
  if (!String(review.email || '').trim() && update.email) review.email = update.email;
  if (!String(review.wechatId || '').trim() && update.wechatId) review.wechatId = update.wechatId;
  if (!String(review.phone || '').trim() && update.phone) review.phone = update.phone;
  if (update.xhsProfileUrl) review.xhsProfileUrl = update.xhsProfileUrl;
  if (update.xhsProfileSourceCreatorUrl) review.xhsProfileSourceCreatorUrl = update.xhsProfileSourceCreatorUrl;
  if (update.contactSource) review.contactSource = update.contactSource;
  if (update.contactCollectedAt) review.contactCollectedAt = update.contactCollectedAt;
  if (update.contactCollectionStatus) review.contactCollectionStatus = update.contactCollectionStatus;
  if (update.contactCollectionCode !== undefined) review.contactCollectionCode = update.contactCollectionCode || '';
  if (update.contactCollectionError !== undefined || update.error !== undefined) {
    review.contactCollectionError = update.contactCollectionError || update.error || '';
  }
  _xiaomifengApprovalCheck = null;
  scheduleContactReviewSave();
  return true;
}

function ensureXhsContactProgressListener() {
  if (_xhsContactListenerBound || !window.desktopAPI?.contacts?.onXhsProgress) return;
  _xhsContactListenerBound = true;
  window.desktopAPI.contacts.onXhsProgress((payload = {}) => {
    if (payload.type === 'item_start' && payload.rowId) {
      _contactReviewViewportStates.setActiveRow(
        getContactReviewViewportKey(),
        payload.rowId,
        document.querySelector('.contact-review-list')
      );
    }
    if (payload.type === 'item_result' && payload.update) applyXhsContactUpdate(payload.update);
    _xhsContactState = {
      ..._xhsContactState,
      running: typeof payload.running === 'boolean' ? payload.running : _xhsContactState.running,
      paused: typeof payload.paused === 'boolean' ? payload.paused : _xhsContactState.paused,
      pausePending: typeof payload.pausePending === 'boolean' ? payload.pausePending : _xhsContactState.pausePending,
      cancelPending: typeof payload.cancelPending === 'boolean' ? payload.cancelPending : _xhsContactState.cancelPending,
      phase: payload.phase || _xhsContactState.phase,
      total: Number.isFinite(Number(payload.total)) ? Number(payload.total) : _xhsContactState.total,
      completed: Number.isFinite(Number(payload.completed)) ? Number(payload.completed) : _xhsContactState.completed,
      found: Number.isFinite(Number(payload.found)) ? Number(payload.found) : _xhsContactState.found,
      failed: Number.isFinite(Number(payload.failed)) ? Number(payload.failed) : _xhsContactState.failed,
      currentCreatorName: payload.currentCreatorName || payload.creatorName || _xhsContactState.currentCreatorName,
      lastCode: payload.code || payload.update?.contactCollectionCode || _xhsContactState.lastCode,
      message: payload.message || payload.pauseReason || payload.error || _xhsContactState.message
    };
    if (payload.type === 'started' || payload.type === 'resumed') {
      _xhsContactState.running = true;
      _xhsContactState.paused = false;
      _xhsContactState.pausePending = false;
      _xhsContactState.cancelPending = false;
    }
    if (payload.type === 'pause_requested') _xhsContactState.pausePending = true;
    if (payload.type === 'paused') {
      _xhsContactState.paused = true;
      _xhsContactState.pausePending = false;
    }
    if (payload.type === 'cancel_requested') {
      _xhsContactState.cancelPending = true;
      _xhsContactState.phase = 'stopping';
    }
    if (payload.type === 'item_result' && payload.update?.error) {
      _xhsContactState.message = payload.update.contactCollectionError || payload.update.error;
    }
    if (payload.code === 'XHS_RISK_DETECTED') _xhsContactState.session = 'risk';
    if (payload.type === 'finished' || payload.type === 'failed' || payload.type === 'stopped') {
      _xhsContactState.running = false;
      _xhsContactState.paused = false;
      _xhsContactState.pausePending = false;
      _xhsContactState.cancelPending = false;
      _xhsContactState.currentCreatorName = '';
      if (payload.type === 'failed') _xhsContactState.phase = 'failed';
      if (payload.type === 'stopped') _xhsContactState.phase = 'stopped';
      if (payload.type === 'finished') _xhsContactState.phase = 'finished';
    }
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });
}

async function startXhsContactRows(targets, scopeLabel = '当前筛选', options = {}) {
  if (!targets.length) {
    setMsg(`${scopeLabel}中没有已选达人。`);
    return { ok: false, code: 'NO_SELECTED_CREATORS' };
  }
  if (options.confirm !== false) {
    const confirmed = window.confirm(
      `确认开始补采${scopeLabel}的 ${targets.length} 位达人？\n\n系统会在右侧可见浏览器中低频串行打开个人主页，只读取公开简介中的联系方式，不会发送消息。`
    );
    if (!confirmed) return { ok: false, canceled: true };
  }
  _xhsContactState = {
    running: true,
    paused: false,
    pausePending: false,
    cancelPending: false,
    phase: 'starting',
    total: targets.length,
    completed: 0,
    found: 0,
    failed: 0,
    session: _xhsContactState.session,
    currentCreatorName: '',
    lastCode: '',
    message: '补采任务正在启动'
  };
  const result = await window.desktopAPI.contacts.enrichXhsBatch({
    runDir: _selectedRunDir,
    rows: buildExportRowsFromContactRows(targets)
  });
  if (!result?.ok) {
    _xhsContactState.running = false;
    _xhsContactState.phase = 'failed';
    if (result.code === 'XHS_RISK_DETECTED') {
      _xhsContactState.session = 'risk';
      _xhsContactState.message = result.riskText || result.error || '安全验证';
    }
    setMsg(`小红书补采失败：${result?.error || 'unknown error'}`);
    return result;
  }
  (Array.isArray(result.updates) ? result.updates : []).forEach(applyXhsContactUpdate);
  await saveContactReviewNow();
  _xhsContactState = {
    ..._xhsContactState,
    running: false,
    paused: false,
    pausePending: false,
    cancelPending: false,
    phase: result.canceled ? 'stopped' : 'finished',
    completed: result.updates?.length || _xhsContactState.completed,
    found: result.found || 0,
    failed: result.failed || 0
  };
  setMsg(result.canceled
    ? `小红书补采已停止：停止前处理 ${result.updates?.length || 0} 人，找到联系方式 ${result.found || 0} 人，失败 ${result.failed || 0} 人。`
    : `小红书补采完成：处理 ${result.updates?.length || 0} 人，找到联系方式 ${result.found || 0} 人，失败 ${result.failed || 0} 人。`);
  return result;
}

function resetEmailHandoff() {
  _emailHandoffState = { status: 'idle', emails: [], missingNames: [], message: '' };
}

function isValidEmail(value) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(value || '').trim());
}

function getEmailHandoff(rows) {
  const emails = [];
  const missingNames = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const review = ensureReviewRow(row);
    const email = String(review?.email || row?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      missingNames.push(row.creatorName || row.xhsId || '未命名达人');
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    emails.push(email);
  });
  return { emails, missingNames };
}

function normalizeContactUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function formatFollowupStatusCounts(counts) {
  const entries = Object.entries(counts || {}).filter(([, count]) => Number(count || 0) > 0);
  if (!entries.length) return '';
  return entries
    .sort(([a], [b]) => a.localeCompare(b, 'zh-Hans-CN'))
    .map(([status, count]) => `${status}${count}`)
    .join('，');
}

async function copyTextWithFallback(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    window.prompt('复制失败，请手工复制：', text);
    return false;
  }
}

function buildContactReviewSummaryText(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const review = ensureReviewRow(row);
    const parts = [
      `${index + 1}. ${row.creatorName || '(无昵称)'}`,
      row.xhsId ? `小红书号：${row.xhsId}` : '',
      `状态：${defaultFollowupStatus(review)}`,
      `方式：${getContactExecutionChannel(review)}`,
      review?.priority ? `优先级：${review.priority}` : '',
      review?.email ? `邮箱：${review.email}` : '',
      review?.wechatId ? `微信：${review.wechatId}` : '',
      review?.phone ? `手机：${review.phone}` : '',
      review?.note ? `备注：${review.note}` : '',
      row.creatorUrl || ''
    ].filter(Boolean);
    return parts.join(' | ');
  }).join('\n');
}

function buildExportRowsFromContactRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const review = ensureReviewRow(row) || {};
    return {
      ...row,
      selected: review.selected === true,
      followupStatus: defaultFollowupStatus(review),
      priority: review.priority || '',
      excludeReason: review.excludeReason || '',
      note: review.note || '',
      email: review.email || row.email || '',
      wechatId: review.wechatId || '',
      phone: review.phone || '',
      xhsProfileUrl: review.xhsProfileUrl || row.xhsProfileUrl || '',
      xhsProfileSourceCreatorUrl: review.xhsProfileSourceCreatorUrl || row.xhsProfileSourceCreatorUrl || '',
      contactSource: review.contactSource || '',
      contactCollectedAt: review.contactCollectedAt || '',
      contactCollectionStatus: review.contactCollectionStatus || '',
      contactCollectionCode: review.contactCollectionCode || '',
      contactCollectionError: review.contactCollectionError || '',
      contactChannel: normalizeContactChannel(review.contactChannel || row.contactChannel || _contactChannelStrategy),
      groupTag: _contactGroupTag,
      greeting: _contactGreeting,
      xiaomifengSmartRemark: _xiaomifengSmartRemark,
      xiaomifengTaskWechat: _xiaomifengTaskWechat,
      pgyInvite: row.pgyInvite || getPgyInviteSettings(),
      emailTemplate: row.emailTemplate || getEmailTemplateSettings()
    };
  });
}

function safeSuffixPart(value) {
  return String(value || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
}

function buildContactSelectionExportSuffix() {
  const parts = ['当前筛选'];
  const statusLabels = { selected: '已选建联', excluded: '已排除' };
  const contactLabels = { missing: '缺联系方式', filled: '已有联系方式' };
  const priorityLabels = { priority: '有优先级', none: '无优先级' };
  if (_contactStatusFilter !== 'all') parts.push(statusLabels[_contactStatusFilter] || _contactStatusFilter);
  if (_contactContactFilter !== 'all') parts.push(contactLabels[_contactContactFilter] || _contactContactFilter);
  if (_contactPriorityFilter !== 'all') parts.push(priorityLabels[_contactPriorityFilter] || _contactPriorityFilter);
  if (_contactFollowupFilter !== 'all') parts.push(_contactFollowupFilter);
  const search = safeSuffixPart(_contactSearch);
  if (search) parts.push(`搜索_${search}`);
  return parts.map(safeSuffixPart).filter(Boolean).slice(0, 6).join('_') || '当前筛选';
}

function summarizeContactReviewRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => {
      const review = ensureReviewRow(row);
      const selected = review?.selected === true;
      const hasWechat = Boolean(String(review?.wechatId || '').trim() || String(review?.phone || '').trim());
      const hasEmail = Boolean(String(review?.email || row?.email || '').trim());
      const channel = getContactExecutionChannel(review);
      acc.total += 1;
      if (selected) acc.selected += 1;
      if (selected && channel === '蒲公英邀约') acc.pgyInvite += 1;
      if (selected && hasEmail) acc.email += 1;
      if (selected && channel === '微信建联' && hasWechat) acc.wechat += 1;
      if (selected && (
        channel === '待补联系方式' ||
        (channel === '邮件建联' && !hasEmail) ||
        (channel === '微信建联' && !hasWechat)
      )) acc.pending += 1;
      return acc;
    },
    { total: 0, selected: 0, pgyInvite: 0, email: 0, wechat: 0, pending: 0 }
  );
}

function setStyles(el, styles) {
  Object.assign(el.style, styles);
  return el;
}

function makeSoftButton(label, onClick, { primary = false, disabled = false } = {}) {
  const b = document.createElement('button');
  b.className = primary ? 'btn primary' : 'btn ghost';
  b.textContent = label;
  b.disabled = disabled;
  setStyles(b, { height: '36px' });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function makeMetricCard(label, value, tone = '') {
  const card = document.createElement('div');
  card.className = `export-metric ${tone}`.trim();
  const k = document.createElement('div');
  k.className = 'export-metric-label';
  k.textContent = label;
  const v = document.createElement('div');
  v.className = 'export-metric-value';
  v.textContent = value;
  card.appendChild(k);
  card.appendChild(v);
  return card;
}

function getContactSettings() {
  return {
    defaultGroupTag: _contactGroupTag,
    defaultGreeting: _contactGreeting,
    xiaomifengSmartRemark: _xiaomifengSmartRemark,
    xiaomifengTaskWechat: _xiaomifengTaskWechat,
    selectionPolicy: CONTACT_SELECTION_POLICY,
    contactChannel: _contactChannelStrategy,
    emailSubject: _contactEmailSubject,
    emailBody: _contactEmailBody,
    pgyCooperationType: _contactPgyCooperationType,
    pgyBrandName: _contactPgyBrandName,
    pgyProductName: _contactPgyProductName,
    pgyContactWay: _contactPgyContactWay,
    pgyIntro: _contactPgyIntro,
    pgyPublishStart: _contactPgyPublishStart,
    pgyPublishEnd: _contactPgyPublishEnd
  };
}

function getPgyInviteSettings() {
  return {
    cooperationType: _contactPgyCooperationType,
    brandName: _contactPgyBrandName,
    productName: _contactPgyProductName,
    contactWay: _contactPgyContactWay,
    intro: _contactPgyIntro,
    publishStart: _contactPgyPublishStart,
    publishEnd: _contactPgyPublishEnd
  };
}

function getEmailTemplateSettings() {
  return {
    subject: _contactEmailSubject,
    body: _contactEmailBody
  };
}

function normalizeContactChannel(value, fallback = '自动分流') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (/自动|auto/i.test(text)) return '自动分流';
  if (/蒲公英|邀约|pgy/i.test(text)) return '蒲公英邀约';
  if (/邮件|邮箱|email|mail/i.test(text)) return '邮件建联';
  if (/微信|小蜜蜂|wechat|xmf/i.test(text)) return '微信建联';
  if (/待补|pending/i.test(text)) return '待补联系方式';
  return CONTACT_CHANNEL_OPTIONS.includes(text) ? text : fallback;
}

function getContactExecutionChannel(review) {
  const channel = normalizeContactChannel(review?.contactChannel || _contactChannelStrategy);
  if (channel !== '自动分流') return channel;
  if (String(review?.wechatId || '').trim() || String(review?.phone || '').trim()) return '微信建联';
  if (String(review?.email || '').trim()) return '邮件建联';
  return '蒲公英邀约';
}

function defaultFollowupStatus(review) {
  const status = String(review?.followupStatus || '').trim();
  if (status) return status;
  return review?.selected === true ? '待建联' : '';
}

function markReviewSelected(review) {
  if (!review) return;
  review.selected = true;
  if (!String(review.followupStatus || '').trim() || review.followupStatus === '不建联') {
    review.followupStatus = '待建联';
  }
  review.excludeReason = '';
  resetEmailHandoff();
}

function clearReviewSelected(review) {
  if (!review) return;
  review.selected = false;
  if (review.followupStatus === '待建联') review.followupStatus = '';
  resetEmailHandoff();
}

function ensureReviewRow(row) {
  const id = String(row?.rowId || '');
  if (!id) return null;
  if (!_contactReviewMap.has(id)) {
    _contactReviewMap.set(id, {
      rowId: id,
      selected: row?.selected === true,
      followupStatus: row?.followupStatus || (row?.selected === true ? '待建联' : ''),
      priority: row?.priority || '',
      excludeReason: row?.excludeReason || '',
      note: row?.note || '',
      email: row?.email || '',
      wechatId: row?.wechatId || '',
      phone: row?.phone || '',
      xhsProfileUrl: row?.xhsProfileUrl || '',
      xhsProfileSourceCreatorUrl: row?.xhsProfileSourceCreatorUrl || '',
      contactSource: row?.contactSource || '',
      contactCollectedAt: row?.contactCollectedAt || '',
      contactCollectionStatus: row?.contactCollectionStatus || '',
      contactCollectionCode: row?.contactCollectionCode || '',
      contactCollectionError: row?.contactCollectionError || '',
      contactChannel: normalizeContactChannel(row?.contactChannel || _contactChannelStrategy)
    });
  }
  return _contactReviewMap.get(id);
}

function getContactFilteredRows() {
  const search = String(_contactSearch || '').trim().toLowerCase();
  return (_contactPreviewRows || []).filter((row) => {
    const review = ensureReviewRow(row);
    const selected = review?.selected === true;
    const hasContact = Boolean(String(review?.wechatId || '').trim() || String(review?.phone || '').trim() || String(review?.email || row?.email || '').trim());
    const hasPriority = Boolean(String(review?.priority || '').trim());
    const followupStatus = defaultFollowupStatus(review);
    const channel = getContactExecutionChannel(review);

    if (_contactStatusFilter === 'selected' && !selected) return false;
    if (_contactStatusFilter === 'excluded' && selected) return false;
    if (_contactContactFilter === 'missing' && hasContact) return false;
    if (_contactContactFilter === 'filled' && !hasContact) return false;
    if (_contactPriorityFilter === 'priority' && !hasPriority) return false;
    if (_contactPriorityFilter === 'none' && hasPriority) return false;
    if (_contactFollowupFilter !== 'all' && followupStatus !== _contactFollowupFilter) return false;
    if (_contactChannelFilter !== 'all' && channel !== _contactChannelFilter) return false;
    if (search) {
      const hay = [
        row.creatorName,
        row.xhsId,
        row.creatorUrl,
        row.tags,
        row.region,
        row.recommendation,
        review?.priority,
        review?.followupStatus,
        review?.excludeReason,
        review?.note,
        review?.email,
        review?.wechatId,
        review?.phone,
        channel
      ].map((x) => String(x || '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function resetContactPreviewState({ keepMeta = false } = {}) {
  _contactPreviewRows = [];
  _contactPreviewRunDir = '';
  _contactLoadedRunDir = '';
  _contactReviewMap = new Map();
  _contactSaveStatus = '';
  resetEmailHandoff();
  if (!keepMeta) _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: false, error: '' };
}

async function loadContactReviewForRun(force = false, runDir = _selectedRunDir) {
  const targetRunDir = String(runDir || '');
  if (!targetRunDir) return false;
  if (!force && _contactLoadedRunDir === targetRunDir) return true;
  try {
    const r = await window.desktopAPI.exports.loadContactReview({ runDir: targetRunDir });
    if (_selectedRunDir !== targetRunDir) return false;
    if (!r?.ok) return false;
    const needsManualSelectionMigration = r.settings?.selectionPolicy !== CONTACT_SELECTION_POLICY;
    _contactReviewMap = new Map();
    (Array.isArray(r.reviewRows) ? r.reviewRows : []).forEach((row) => {
      const rowId = String(row?.rowId || '');
      if (!rowId) return;
      const next = { ...row };
      if (needsManualSelectionMigration) {
        next.selected = false;
        if (next.followupStatus === '待建联') next.followupStatus = '';
      }
      _contactReviewMap.set(rowId, next);
    });
    if (r.settings?.defaultGroupTag) _contactGroupTag = r.settings.defaultGroupTag;
    if (r.settings?.defaultGreeting) _contactGreeting = r.settings.defaultGreeting;
    if (r.settings?.xiaomifengSmartRemark) _xiaomifengSmartRemark = r.settings.xiaomifengSmartRemark;
    if (r.settings?.xiaomifengTaskWechat !== undefined) _xiaomifengTaskWechat = r.settings.xiaomifengTaskWechat;
    if (r.settings?.contactChannel) _contactChannelStrategy = normalizeContactChannel(r.settings.contactChannel);
    if (r.settings?.emailSubject !== undefined) _contactEmailSubject = r.settings.emailSubject;
    if (r.settings?.emailBody !== undefined) _contactEmailBody = r.settings.emailBody;
    if (r.settings?.pgyCooperationType) _contactPgyCooperationType = r.settings.pgyCooperationType;
    if (r.settings?.pgyBrandName !== undefined) _contactPgyBrandName = r.settings.pgyBrandName;
    if (r.settings?.pgyProductName !== undefined) _contactPgyProductName = r.settings.pgyProductName;
    if (r.settings?.pgyContactWay !== undefined) _contactPgyContactWay = r.settings.pgyContactWay;
    if (r.settings?.pgyIntro !== undefined) _contactPgyIntro = r.settings.pgyIntro;
    if (r.settings?.pgyPublishStart !== undefined) _contactPgyPublishStart = r.settings.pgyPublishStart;
    if (r.settings?.pgyPublishEnd !== undefined) _contactPgyPublishEnd = r.settings.pgyPublishEnd;
    _contactLoadedRunDir = targetRunDir;
    return true;
  } catch (_) {
    // keep unsaved in-memory edits if load fails
    return false;
  }
}

function captureContactReviewSavePayload(runDir = _selectedRunDir) {
  const targetRunDir = String(runDir || '');
  if (!targetRunDir) return null;
  const ownsLoadedState = _contactLoadedRunDir === targetRunDir || _contactPreviewRunDir === targetRunDir;
  if (!ownsLoadedState) return null;
  return {
    runDir: targetRunDir,
    reviewRows: getReviewRows(),
    settings: { ...getContactSettings() }
  };
}

function cancelPendingContactReviewSave(runDir = '') {
  if (!_contactPendingSave) {
    if (_contactSaveTimer) clearTimeout(_contactSaveTimer);
    _contactSaveTimer = null;
    return null;
  }
  const pendingRunDir = String(_contactPendingSave.payload?.runDir || '');
  if (runDir && pendingRunDir !== runDir) return null;
  if (_contactSaveTimer) clearTimeout(_contactSaveTimer);
  _contactSaveTimer = null;
  const payload = _contactPendingSave.payload;
  _contactPendingSave = null;
  return payload;
}

async function persistContactReviewPayload(payload) {
  if (!payload?.runDir) return null;
  const previous = _contactSaveInFlight?.promise;
  const promise = (previous ? previous.catch(() => null) : Promise.resolve())
    .then(() => window.desktopAPI.exports.saveContactReview(payload));
  const marker = { runDir: payload.runDir, promise };
  _contactSaveInFlight = marker;
  try {
    return await promise;
  } finally {
    if (_contactSaveInFlight === marker) _contactSaveInFlight = null;
  }
}

async function saveContactReviewNow(payload = null) {
  const savePayload = payload || captureContactReviewSavePayload();
  if (!savePayload) return null;
  if (!payload) cancelPendingContactReviewSave(savePayload.runDir);
  return persistContactReviewPayload(savePayload);
}

async function flushContactReviewSaveBeforeRunSwitch(runDir) {
  const targetRunDir = String(runDir || '');
  try {
    const pendingPayload = cancelPendingContactReviewSave(targetRunDir);
    if (pendingPayload) {
      if (_selectedRunDir === targetRunDir) setContactSaveStatus('切换前保存中...');
      const result = await saveContactReviewNow(pendingPayload);
      if (!result?.ok) throw new Error(result?.error || '保存失败');
    }
    const inFlight = _contactSaveInFlight;
    if (inFlight?.runDir === targetRunDir) {
      const result = await inFlight.promise;
      if (!result?.ok) throw new Error(result?.error || '保存失败');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function switchSelectedContactRun(nextRunDir) {
  const targetRunDir = String(nextRunDir || '');
  if (targetRunDir === _selectedRunDir) return true;
  const previousRunDir = _selectedRunDir;
  if (previousRunDir) {
    const flushed = await flushContactReviewSaveBeforeRunSwitch(previousRunDir);
    if (!flushed.ok) {
      setContactSaveStatus('旧结果保存失败，已取消切换');
      setMsg(`未切换结果：旧结果的复核改动保存失败。${flushed.error || ''}`);
      return false;
    }
  } else {
    cancelPendingContactReviewSave();
  }
  _selectedRunDir = targetRunDir;
  resetContactPreviewState();
  _autoPreviewRequestedRunDir = '';
  return true;
}

function requestSelectedContactRunSwitch(nextRunDir) {
  const targetRunDir = String(nextRunDir || '');
  if (!targetRunDir || targetRunDir === _selectedRunDir || _contactRunSwitchTarget === targetRunDir) return;
  _contactRunSwitchTarget = targetRunDir;
  setTimeout(async () => {
    const switched = await switchSelectedContactRun(targetRunDir);
    _contactRunSwitchTarget = '';
    store.set({
      exports: {
        ...(store.state.exports || {}),
        selectedRunDir: switched ? targetRunDir : _selectedRunDir,
        _t: Date.now()
      }
    });
  }, 0);
}

function getXiaomifengApprovalPayload() {
  return {
    runDir: _selectedRunDir,
    rows: buildExportRowsFromContactRows(_contactPreviewRows),
    settings: getContactSettings()
  };
}

async function refreshXiaomifengApproval() {
  if (!_selectedRunDir || !_contactPreviewRows.length) {
    _xiaomifengApproval = null;
    _xiaomifengApprovalCheck = null;
    return;
  }
  try {
    const result = await window.desktopAPI.approvals.getXiaomifeng(getXiaomifengApprovalPayload());
    if (!result?.ok) return;
    _xiaomifengApproval = result.approval || null;
    _xiaomifengApprovalCheck = result.check || null;
  } catch (_) {}
}

async function importContactReviewWorkbookNow() {
  if (!_contactPreviewRows.length) {
    setMsg('请先刷新复核预览，再导入建联复核表。');
    return;
  }
  const r = await window.desktopAPI.exports.importContactReviewWorkbook();
  if (r?.canceled) return;
  if (!r?.ok) {
    setMsg(`导入复核表失败：${r?.error || 'unknown error'}`);
    return;
  }
  const byUrl = new Map();
  _contactPreviewRows.forEach((row) => {
    const url = normalizeContactUrl(row.creatorUrl);
    if (url) byUrl.set(url, row);
  });
  let updated = 0;
  const unmatchedRows = [];
  (Array.isArray(r.rows) ? r.rows : []).forEach((row) => {
    const preview = byUrl.get(normalizeContactUrl(row.creatorUrl));
    if (!preview) {
      unmatchedRows.push(row);
      return;
    }
    const review = ensureReviewRow(preview);
    if (!review) return;
    review.selected = row.selected === true;
    review.followupStatus = row.followupStatus || defaultFollowupStatus(review);
    review.priority = row.priority || '';
    review.excludeReason = row.excludeReason || '';
    review.note = row.note || '';
    review.email = row.email || '';
    review.wechatId = row.wechatId || '';
    review.phone = row.phone || '';
    review.contactChannel = normalizeContactChannel(row.contactChannel || review.contactChannel || _contactChannelStrategy);
    updated += 1;
  });
  await saveContactReviewNow();
  setContactSaveStatus(`已导入并保存 ${new Date().toLocaleTimeString()}`);
  const unmatchedHint = unmatchedRows.length
    ? `\n\n未匹配示例：\n${unmatchedRows.slice(0, 5).map((row) => `- 第${row.rowIndex || '?'}行 ${row.creatorName || ''} ${row.creatorUrl || ''}`).join('\n')}`
    : '';
  const sheets = Array.isArray(r.sheetNames) && r.sheetNames.length ? r.sheetNames.join('、') : (r.sheetName || '未知工作表');
  setMsg(`导入复核表完成：工作表 ${sheets}，读取 ${r.stats?.matchedRows ?? 0} 行，更新 ${updated} 行，未匹配 ${unmatchedRows.length} 行。${unmatchedHint}`);
}

function scheduleContactReviewSave() {
  const payload = captureContactReviewSavePayload();
  if (!payload) return;
  cancelPendingContactReviewSave();
  _contactSaveStatus = '等待自动保存';
  _xiaomifengApprovalCheck = null;
  _contactPendingSave = { payload };
  _contactSaveTimer = setTimeout(async () => {
    const pending = _contactPendingSave;
    if (!pending) return;
    _contactSaveTimer = null;
    _contactPendingSave = null;
    const scheduledRunDir = pending.payload.runDir;
    try {
      if (_selectedRunDir === scheduledRunDir) setContactSaveStatus('保存中...');
      const result = await saveContactReviewNow(pending.payload);
      if (!result?.ok) throw new Error(result?.error || '保存失败');
      if (_selectedRunDir === scheduledRunDir) setContactSaveStatus(`已保存 ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      if (_selectedRunDir === scheduledRunDir) {
        setContactSaveStatus(`自动保存失败：${error?.message || String(error)}`);
      }
    }
  }, 500);
}

async function refreshContactPreview() {
  const runDir = _selectedRunDir;
  if (!runDir) {
    _contactPreviewRows = [];
    _contactPreviewRunDir = '';
    _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: false, error: '' };
    return;
  }
  setMsg('加载建联复核预览中...');
  try {
    const loaded = await loadContactReviewForRun(false, runDir);
    if (_selectedRunDir !== runDir) return;
    if (!loaded) {
      _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: true, error: '复核状态读取失败' };
      setMsg('加载复核预览失败：无法读取这个结果原有的复核状态，已停止刷新以避免覆盖。');
      return;
    }
    const r = await window.desktopAPI.exports.getContactPreview({
      runDir,
      defaultGroupTag: _contactGroupTag,
      defaultGreeting: _contactGreeting,
      ...getContactSettings(),
      reviewRows: getReviewRows()
    });
    if (_selectedRunDir !== runDir) return;
    if (!r?.ok) {
      _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: true, error: r?.error || 'unknown error' };
      setMsg(`加载复核预览失败：${r?.error || 'unknown error'}`);
      return;
    }
    _contactPreviewRows = Array.isArray(r.rows) ? r.rows : [];
    _contactPreviewMeta = {
      rawFiles: Number(r.rawFiles || 0),
      files: Number(r.files || _contactPreviewRows.length || 0),
      loaded: true,
      error: ''
    };
    _contactPreviewRunDir = runDir;
    const migratedReviewMap = new Map();
    _contactPreviewRows.forEach((row) => {
      const review = ensureReviewRow(row);
      if (review) migratedReviewMap.set(row.rowId, { ...review, rowId: row.rowId });
    });
    _contactReviewMap = migratedReviewMap;
    const saveResult = await saveContactReviewNow(captureContactReviewSavePayload(runDir));
    if (!saveResult?.ok) throw new Error(saveResult?.error || '保存复核状态失败');
    if (_selectedRunDir !== runDir) return;
    await refreshXiaomifengApproval();
    if (_selectedRunDir !== runDir) return;
    _contactSaveStatus = '';
    setMsg('');
  } catch (e) {
    if (_selectedRunDir !== runDir) return;
    _contactPreviewMeta = { rawFiles: 0, files: 0, loaded: true, error: e?.message || String(e) };
    setMsg(`加载复核预览异常：${e?.message || String(e)}`);
  }
}

export function renderExports(state) {
  ensureXhsContactProgressListener();
  const requestedRunDir = state.exports?.selectedRunDir || '';
  if (requestedRunDir && requestedRunDir !== _selectedRunDir) {
    requestSelectedContactRunSwitch(requestedRunDir);
  }
  const autoEnrichRunDir = String(state.exports?.autoEnrichRunDir || '');
  if (
    autoEnrichRunDir &&
    autoEnrichRunDir === _selectedRunDir &&
    !_autoEnrichmentStartedRuns.has(autoEnrichRunDir)
  ) {
    _autoEnrichmentStartedRuns.add(autoEnrichRunDir);
    _autoPreviewRequestedRunDir = autoEnrichRunDir;
    setTimeout(async () => {
      await refreshContactPreview();
      const targets = _contactPreviewRows.filter((row) => ensureReviewRow(row)?.selected === true).slice(0, 50);
      if (targets.length) {
        setMsg(`蒲公英采集已完成，正在继续补采 ${targets.length} 位达人的小红书公开联系方式。`);
        await startXhsContactRows(targets, '本次采集名单', { confirm: false });
      } else {
        setMsg('蒲公英采集已结束，但本次没有可用的达人结果可继续补采。');
      }
      store.set({
        exports: {
          ...(store.state.exports || {}),
          autoEnrichRunDir: '',
          _t: Date.now()
        }
      });
    }, 0);
  }

  const root = document.createElement('div');
  root.className = 'view';

  const title = document.createElement('h2');
  title.textContent = '建联工作台';
  root.appendChild(title);

  const desc = document.createElement('p');
  desc.textContent = '选一批采集结果，先复核哪些达人要建联，再导出给团队或小蜜蜂使用的 Excel。';
  root.appendChild(desc);

  // 首次进入：加载 runs + 列定义/上次选择
  if (!_runs.length && !(state.exports && state.exports._loadedOnce)) {
    store.set({ exports: { ...(store.state.exports || {}), _loadedOnce: true } });
    setTimeout(() => refreshRuns().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
  }
  if (!_colsLoadedOnce) {
    setTimeout(() => ensureColumnsLoaded().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
  }
  if (_selectedRunDir && _contactPreviewRunDir !== _selectedRunDir && _autoPreviewRequestedRunDir !== _selectedRunDir) {
    _autoPreviewRequestedRunDir = _selectedRunDir;
    setTimeout(() => refreshContactPreview().then(() => store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } })), 0);
  }

  const bar = document.createElement('div');
  bar.className = 'export-run-card';

  const sel = document.createElement('select');
  sel.className = 'tpl-input';
  sel.style.height = '38px';
  (_runs || []).forEach((it) => {
    const opt = document.createElement('option');
    opt.value = it.path;
    opt.textContent = it.name || it.path;
    if (it.path === _selectedRunDir) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async () => {
    const targetRunDir = sel.value;
    sel.disabled = true;
    const switched = await switchSelectedContactRun(targetRunDir);
    sel.value = _selectedRunDir;
    store.set({
      exports: {
        ...(store.state.exports || {}),
        selectedRunDir: switched ? targetRunDir : _selectedRunDir,
        _t: Date.now()
      }
    });
  });

  const btnRefresh = document.createElement('button');
  btnRefresh.className = 'btn ghost';
  btnRefresh.style.height = '38px';
  btnRefresh.textContent = '刷新结果';
  btnRefresh.addEventListener('click', async () => {
    await refreshRuns();
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  const btnExport = document.createElement('button');
  btnExport.className = 'btn ghost';
  btnExport.style.height = '38px';
  btnExport.textContent = '导出原始明细';
  btnExport.addEventListener('click', async () => {
    setMsg('导出中...');
    try {
      const r = await window.desktopAPI.exports.exportRun({ runDir: _selectedRunDir });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      setMsg(`导出成功：\n${r.outPath}\n\n统计：raw_result.json=${r.files}，达人=${r.creators}，笔记=${r.notes}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  const btnExportResource = document.createElement('button');
  btnExportResource.className = 'btn primary';
  btnExportResource.style.height = '38px';
  btnExportResource.textContent = '导出达人资源表';
  btnExportResource.addEventListener('click', async () => {
    setMsg('导出中...');
    try {
      const r = await window.desktopAPI.exports.exportResourceRun({ runDir: _selectedRunDir });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      const dropped = (r.droppedCols !== undefined) ? `，已移除全空列=${r.droppedCols}` : '';
      setMsg(`导出成功：\n${r.outPath}\n\n统计：raw_result.json=${r.files}，达人=${r.creators}，Top10笔记(非空标题)=${r.notesTop}${dropped}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  const btnOpenRun = document.createElement('button');
  btnOpenRun.className = 'btn ghost';
  btnOpenRun.style.height = '38px';
  btnOpenRun.textContent = '打开文件夹';
  btnOpenRun.disabled = !_selectedRunDir;
  btnOpenRun.addEventListener('click', async () => {
    const r = await window.desktopAPI.exports.openPath(_selectedRunDir);
    if (!r?.ok) alert(`打开失败：${r?.error || 'unknown error'}`);
  });

  const runMain = document.createElement('div');
  runMain.className = 'export-run-main';
  const runLabel = document.createElement('div');
  runLabel.className = 'export-section-kicker';
  runLabel.textContent = '当前结果';
  runMain.appendChild(runLabel);
  runMain.appendChild(sel);

  const runActions = document.createElement('div');
  runActions.className = 'export-run-actions';
  runActions.appendChild(btnRefresh);
  runActions.appendChild(btnExportResource);
  runActions.appendChild(btnExport);
  runActions.appendChild(btnOpenRun);

  bar.appendChild(runMain);
  bar.appendChild(runActions);
  root.appendChild(bar);

  const contactSec = document.createElement('div');
  contactSec.className = 'card export-workbench';
  contactSec.style.marginTop = '14px';

  const contactHead = document.createElement('div');
  contactHead.className = 'export-workbench-head';

  const contactTitle = document.createElement('div');
  contactTitle.className = 'export-workbench-title';
  contactTitle.textContent = '达人复核与建联表';
  const contactHint = document.createElement('div');
  contactHint.className = 'export-workbench-hint';
  contactHint.textContent = '勾选要建联的人，选择执行通道。系统会把名单分成蒲公英邀约、邮件建联、小蜜蜂导入和待补联系方式。';
  contactHead.appendChild(contactTitle);
  contactHead.appendChild(contactHint);
  contactSec.appendChild(contactHead);

  const contactGrid = document.createElement('div');
  contactGrid.className = 'export-settings-grid';

  const strategyWrap = document.createElement('label');
  strategyWrap.className = 'field-label';
  strategyWrap.textContent = '默认建联方式';
  const strategySelect = document.createElement('select');
  strategySelect.className = 'tpl-input';
  CONTACT_CHANNEL_OPTIONS.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    if (value === _contactChannelStrategy) opt.selected = true;
    strategySelect.appendChild(opt);
  });
  strategySelect.addEventListener('change', () => {
    _contactChannelStrategy = normalizeContactChannel(strategySelect.value);
    _contactPreviewRows.forEach((row) => {
      const review = ensureReviewRow(row);
      if (review && normalizeContactChannel(review.contactChannel) === '自动分流') {
        review.contactChannel = _contactChannelStrategy;
      }
    });
    scheduleContactReviewSave();
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });
  strategyWrap.appendChild(strategySelect);

  const groupWrap = document.createElement('label');
  groupWrap.className = 'field-label';
  groupWrap.textContent = '微信分组标签';
  const groupInput = document.createElement('input');
  groupInput.className = 'tpl-input';
  groupInput.placeholder = '例如 FILA';
  groupInput.value = _contactGroupTag;
  groupInput.addEventListener('input', () => {
    _contactGroupTag = groupInput.value;
    scheduleContactReviewSave();
  });
  groupWrap.appendChild(groupInput);

  const greetingWrap = document.createElement('label');
  greetingWrap.className = 'field-label';
  greetingWrap.textContent = '默认打招呼内容';
  const greetingInput = document.createElement('input');
  greetingInput.className = 'tpl-input';
  greetingInput.placeholder = '用于建联表和小蜜蜂导入表';
  greetingInput.value = _contactGreeting;
  greetingInput.addEventListener('input', () => {
    _contactGreeting = greetingInput.value;
    scheduleContactReviewSave();
  });
  greetingWrap.appendChild(greetingInput);

  const xmfRemarkWrap = document.createElement('label');
  xmfRemarkWrap.className = 'field-label';
  xmfRemarkWrap.textContent = '小蜜蜂智能备注';
  const xmfRemarkInput = document.createElement('input');
  xmfRemarkInput.className = 'tpl-input';
  xmfRemarkInput.placeholder = '{MMDD}-{昵称}';
  xmfRemarkInput.value = _xiaomifengSmartRemark;
  xmfRemarkInput.addEventListener('input', () => {
    _xiaomifengSmartRemark = xmfRemarkInput.value;
    scheduleContactReviewSave();
  });
  xmfRemarkWrap.appendChild(xmfRemarkInput);

  const xmfAccountWrap = document.createElement('label');
  xmfAccountWrap.className = 'field-label';
  xmfAccountWrap.textContent = '任务微信';
  const xmfAccountInput = document.createElement('input');
  xmfAccountInput.className = 'tpl-input';
  xmfAccountInput.placeholder = '留空由小蜜蜂智能分配';
  xmfAccountInput.value = _xiaomifengTaskWechat;
  xmfAccountInput.addEventListener('input', () => {
    _xiaomifengTaskWechat = xmfAccountInput.value;
    scheduleContactReviewSave();
  });
  xmfAccountWrap.appendChild(xmfAccountInput);

  const btnExportContact = document.createElement('button');
  btnExportContact.className = 'btn primary';
  btnExportContact.className = 'btn primary export-main-cta';
  btnExportContact.textContent = _contactExportState.status === 'working' ? '正在导出...' : '导出建联表';
  btnExportContact.disabled = _contactExportState.status === 'working' || !_selectedRunDir || !_contactPreviewRows.length;
  btnExportContact.addEventListener('click', async () => {
    if (_contactExportState.status === 'working') return;
    _contactExportState = { status: 'working', message: '正在生成建联表，请稍候。', outPath: '' };
    setMsg('导出建联表中...');
    try {
      const saveResult = await saveContactReviewNow();
      if (saveResult && !saveResult.ok) throw new Error(saveResult.error || '复核内容保存失败');
      const r = await window.desktopAPI.exports.exportContactRun({
        runDir: _selectedRunDir,
        ...getContactSettings(),
        reviewRows: getReviewRows()
      });
      if (!r?.ok) {
        _contactExportState = { status: 'error', message: `导出失败：${r?.error || 'unknown error'}`, outPath: '' };
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      _lastContactExportPath = r.outPath || '';
      _contactExportState = {
        status: 'success',
        message: `建联表已导出，共 ${r.creators || 0} 位达人。`,
        outPath: _lastContactExportPath
      };
      const statusCounts = formatFollowupStatusCounts(r.summary?.followupStatusCounts);
      const statusLine = statusCounts ? `\n跟进状态：${statusCounts}` : '';
      const fallbackLine = r.savedAs
        ? `\n\n原建联表正被 WPS/Excel 占用，已安全另存为新文件；未覆盖正在打开的文件。`
        : '';
      setMsg(`导出成功：\n${r.outPath}${fallbackLine}\n\n统计：raw_result.json=${r.files}，建联达人=${r.creators}，蒲公英邀约=${r.pgyInviteRows || 0}，邮件建联=${r.emailContactRows || 0}，小蜜蜂导入=${r.xiaomifengRows || 0}，待补联系方式=${r.pendingContactRows || 0}${statusLine}`);
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    } catch (e) {
      _contactExportState = { status: 'error', message: `导出异常：${e?.message || String(e)}`, outPath: '' };
      setMsg(`导出异常：${e?.message || String(e)}`);
    } finally {
      if (_contactExportState.status === 'working') {
        _contactExportState = { status: 'error', message: '导出未完成，请重试。', outPath: '' };
      }
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }
  });

  contactGrid.appendChild(strategyWrap);
  contactGrid.appendChild(groupWrap);
  contactGrid.appendChild(greetingWrap);
  contactGrid.appendChild(xmfRemarkWrap);
  contactGrid.appendChild(xmfAccountWrap);

  const emailWrap = document.createElement('label');
  emailWrap.className = 'field-label';
  emailWrap.textContent = '邮件标题';
  const emailSubjectInput = document.createElement('input');
  emailSubjectInput.className = 'tpl-input';
  emailSubjectInput.placeholder = '例如 品牌合作沟通';
  emailSubjectInput.value = _contactEmailSubject;
  emailSubjectInput.addEventListener('input', () => {
    _contactEmailSubject = emailSubjectInput.value;
    scheduleContactReviewSave();
  });
  emailWrap.appendChild(emailSubjectInput);

  const emailBodyWrap = document.createElement('label');
  emailBodyWrap.className = 'field-label wide';
  emailBodyWrap.textContent = '邮件正文';
  const emailBodyInput = document.createElement('textarea');
  emailBodyInput.className = 'tpl-input';
  emailBodyInput.placeholder = '导出到邮件建联表，暂不自动发送。';
  emailBodyInput.value = _contactEmailBody;
  emailBodyInput.addEventListener('input', () => {
    _contactEmailBody = emailBodyInput.value;
    scheduleContactReviewSave();
  });
  emailBodyWrap.appendChild(emailBodyInput);

  const pgyGrid = document.createElement('div');
  pgyGrid.className = 'contact-strategy-grid';
  const pgyFields = [
    ['合作类型', _contactPgyCooperationType, (v) => { _contactPgyCooperationType = v; }, '图文 / 视频'],
    ['品牌名', _contactPgyBrandName, (v) => { _contactPgyBrandName = v; }, '例如 多芬'],
    ['产品名称', _contactPgyProductName, (v) => { _contactPgyProductName = v; }, '例如 沐浴露'],
    ['联系方式', _contactPgyContactWay, (v) => { _contactPgyContactWay = v; }, '微信 / 邮箱'],
    ['开始时间', _contactPgyPublishStart, (v) => { _contactPgyPublishStart = v; }, 'YYYY-MM-DD'],
    ['结束时间', _contactPgyPublishEnd, (v) => { _contactPgyPublishEnd = v; }, 'YYYY-MM-DD']
  ];
  pgyFields.forEach(([label, value, setter, placeholder]) => {
    const wrap = document.createElement('label');
    wrap.className = 'field-label compact';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.className = 'tpl-input';
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('input', () => {
      setter(input.value);
      scheduleContactReviewSave();
    });
    wrap.appendChild(input);
    pgyGrid.appendChild(wrap);
  });
  const pgyIntroWrap = document.createElement('label');
  pgyIntroWrap.className = 'field-label compact wide';
  pgyIntroWrap.textContent = '蒲公英邀约内容';
  const pgyIntroInput = document.createElement('textarea');
  pgyIntroInput.className = 'tpl-input';
  pgyIntroInput.placeholder = '导出到蒲公英邀约表，人工复制或后续交给 RPA。';
  pgyIntroInput.value = _contactPgyIntro;
  pgyIntroInput.addEventListener('input', () => {
    _contactPgyIntro = pgyIntroInput.value;
    scheduleContactReviewSave();
  });
  pgyIntroWrap.appendChild(pgyIntroInput);
  pgyGrid.appendChild(pgyIntroWrap);
  pgyGrid.appendChild(emailWrap);
  pgyGrid.appendChild(emailBodyWrap);

  const filteredContactRows = getContactFilteredRows();
  const contactReviewViewportKey = getContactReviewViewportKey();
  const savedContactReviewViewport = _contactReviewViewportStates.get(contactReviewViewportKey);
  const selectedContactRows = filteredContactRows.filter((row) => ensureReviewRow(row)?.selected === true);
  const allReviewSummary = summarizeContactReviewRows(_contactPreviewRows);
  const filteredReviewSummary = summarizeContactReviewRows(filteredContactRows);

  const metrics = document.createElement('div');
  metrics.className = 'export-metrics';
  metrics.appendChild(makeMetricCard('已选建联', _contactPreviewRows.length ? `${allReviewSummary.selected}/${_contactPreviewRows.length}` : '-'));
  metrics.appendChild(makeMetricCard('蒲公英邀约', _contactPreviewRows.length ? String(allReviewSummary.pgyInvite) : '-', 'good'));
  metrics.appendChild(makeMetricCard('小蜜蜂导入', _contactPreviewRows.length ? String(allReviewSummary.wechat) : '-', 'good'));
  metrics.appendChild(makeMetricCard('待补联系方式', _contactPreviewRows.length ? String(allReviewSummary.pending) : '-', allReviewSummary.pending ? 'warn' : ''));
  contactSec.appendChild(metrics);

  const xhsContactBar = document.createElement('div');
  xhsContactBar.className = 'xhs-contact-status-panel';
  setStyles(xhsContactBar, { marginTop: '10px' });
  const xhsContactStatus = document.createElement('div');
  xhsContactStatus.className = 'xhs-contact-status-copy';
  xhsContactStatus.setAttribute('role', 'status');
  xhsContactStatus.setAttribute('aria-live', 'polite');
  const xhsPhaseLabels = {
    starting: '正在启动',
    resolving_pgy: '正在定位主页',
    loading_xhs: '正在打开主页',
    reading_xhs: '正在读取公开资料',
    cooldown: '安全冷却中',
    between_items: '准备下一位',
    stopping: '正在安全停止',
    stopped: '已停止',
    finished: '已完成',
    failed: '补采失败'
  };
  let xhsStatusLabel = xhsPhaseLabels[_xhsContactState.phase] || '补采未启动';
  let xhsStatusDetail = '';
  if (_xhsContactState.running && _xhsContactState.cancelPending) {
    xhsStatusLabel = '正在安全停止';
    xhsStatusDetail = '停止请求已收到；到达下一个安全点后结束，未处理达人不会继续。';
  } else if (_xhsContactState.running && _xhsContactState.paused) {
    xhsStatusLabel = '已暂停';
    xhsStatusDetail = _xhsContactState.message || '补采已停在安全点，不会继续读取下一位达人。';
  } else if (_xhsContactState.running && _xhsContactState.pausePending) {
    xhsStatusLabel = '等待暂停';
    xhsStatusDetail = '暂停请求已收到；将在当前页面读取的下一个安全点暂停。';
  } else if (_xhsContactState.running) {
    xhsStatusDetail = [
      _xhsContactState.currentCreatorName ? `当前：${_xhsContactState.currentCreatorName}` : '',
      _xhsContactState.message
    ].filter(Boolean).join(' · ') || '补采任务正在运行。';
  } else if (_xhsContactState.session === 'risk') {
    xhsStatusLabel = '安全验证阻断';
    xhsStatusDetail = `${_xhsContactState.message || '请查看右侧页面'}。请勿反复刷新或重试；页面恢复后先检测登录。`;
  } else if (_xhsContactState.total) {
    xhsStatusDetail = `处理 ${_xhsContactState.completed}/${_xhsContactState.total}，找到 ${_xhsContactState.found}，失败 ${_xhsContactState.failed}`;
  } else if (_xhsContactState.session === 'ready') {
    xhsStatusLabel = '可以开始补采';
    xhsStatusDetail = selectedContactRows.length
      ? `已选择 ${selectedContactRows.length} 位达人。`
      : '请先在下方勾选要建联的达人。';
  } else {
    xhsStatusLabel = '等待登录';
    xhsStatusDetail = '先在右侧完成人工登录，再读取公开联系方式。';
  }
  const xhsStatusTitle = document.createElement('b');
  xhsStatusTitle.textContent = xhsStatusLabel;
  const xhsStatusBody = document.createElement('span');
  xhsStatusBody.textContent = xhsStatusDetail;
  const xhsStatusMetrics = document.createElement('small');
  xhsStatusMetrics.textContent = `进度 ${_xhsContactState.completed}/${_xhsContactState.total || 0} · 找到 ${_xhsContactState.found} · 失败 ${_xhsContactState.failed}`;
  xhsContactStatus.appendChild(xhsStatusTitle);
  xhsContactStatus.appendChild(xhsStatusBody);
  xhsContactStatus.appendChild(xhsStatusMetrics);

  const xhsContactActions = document.createElement('div');
  xhsContactActions.className = 'xhs-contact-actions';

  const btnOpenXhsLogin = makeSoftButton('打开小红书登录', async () => {
    const result = await window.desktopAPI.contacts.openXhsLogin();
    if (!result?.ok) return setMsg(`打开小红书失败：${result?.error || 'unknown error'}`);
    _xhsContactState = { ..._xhsContactState, session: 'waiting_login', message: '请在右侧人工登录' };
    setMsg('请在右侧完成小红书登录，完成后点击“检测登录”。');
  }, { disabled: _xhsContactState.running });

  const btnCheckXhsLogin = makeSoftButton('检测登录', async () => {
    const result = await window.desktopAPI.contacts.checkXhsLogin();
    if (!result?.ok) return setMsg(`检测失败：${result?.error || 'unknown error'}`);
    if (result.riskDetected) {
      _xhsContactState = { ..._xhsContactState, session: 'risk', message: result.riskText || '需要手工验证' };
      return setMsg(`小红书需要手工验证：${result.riskText || '请查看右侧页面'}`);
    }
    _xhsContactState = { ..._xhsContactState, session: result.loggedIn ? 'ready' : 'login_required', message: '' };
    setMsg(result.loggedIn ? '小红书页面已可用。' : '尚未完成小红书登录。');
  }, { disabled: _xhsContactState.running && !_xhsContactState.paused });

  const btnStartXhsContact = makeSoftButton('补采已选达人联系方式', async () => {
    const targets = getContactFilteredRows().filter((row) => ensureReviewRow(row)?.selected === true);
    await startXhsContactRows(targets, '已选达人');
  }, { primary: true, disabled: !_contactPreviewRows.length || !selectedContactRows.length || _xhsContactState.running || _xhsContactState.session === 'risk' });
  btnStartXhsContact.title = selectedContactRows.length
    ? '只补采当前明确勾选的达人，并保留串行低频和风险暂停'
    : '请先在下方达人名称前勾选“要建联”';

  const btnPauseXhsContact = makeSoftButton(
    (_xhsContactState.paused || _xhsContactState.pausePending) ? '继续' : '暂停',
    async () => {
    const result = (_xhsContactState.paused || _xhsContactState.pausePending)
      ? await window.desktopAPI.contacts.resumeXhsEnrichment()
      : await window.desktopAPI.contacts.pauseXhsEnrichment();
    if (!result?.ok) setMsg(`补采任务操作失败：${result?.error || 'unknown error'}`);
  }, { disabled: !_xhsContactState.running || _xhsContactState.cancelPending });

  const btnCancelXhsContact = makeSoftButton(_xhsContactState.cancelPending ? '正在安全停止' : '停止', async () => {
    const result = await window.desktopAPI.contacts.cancelXhsEnrichment();
    if (!result?.ok) return setMsg(`停止失败：${result?.error || 'unknown error'}`);
    _xhsContactState = { ..._xhsContactState, cancelPending: true, phase: 'stopping', message: '停止请求已收到' };
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  }, { disabled: !_xhsContactState.running || _xhsContactState.cancelPending });

  const btnReturnCollection = makeSoftButton('返回筛选结果', async () => {
    const result = await window.desktopAPI.browser.returnToCollectionResults();
    if (!result?.ok) return setMsg(`返回筛选结果失败：${result?.error || 'unknown error'}`);
    setMsg(result.warning || '已返回最近的蒲公英筛选结果页。');
  }, { disabled: _xhsContactState.running });

  xhsContactBar.appendChild(xhsContactStatus);
  xhsContactActions.appendChild(btnReturnCollection);
  xhsContactActions.appendChild(btnOpenXhsLogin);
  xhsContactActions.appendChild(btnCheckXhsLogin);
  xhsContactActions.appendChild(btnStartXhsContact);
  xhsContactActions.appendChild(btnPauseXhsContact);
  xhsContactActions.appendChild(btnCancelXhsContact);
  xhsContactBar.appendChild(xhsContactActions);
  contactSec.appendChild(xhsContactBar);

  const contactSettings = createAdvancedSection({
    title: '填写建联话术',
    open: true,
    children: [contactGrid, pgyGrid]
  });
  contactSettings.classList.add('contact-settings-section');
  contactSec.appendChild(contactSettings);

  const approvalBar = document.createElement('div');
  approvalBar.className = 'export-review-toolbar';
  setStyles(approvalBar, { marginTop: '10px' });
  const approvalStatus = document.createElement('div');
  approvalStatus.className = 'export-review-summary';
  if (_xiaomifengApprovalCheck?.ok) {
    approvalStatus.textContent = `小蜜蜂批次已由 ${_xiaomifengApproval?.approvedBy || '人工'} 确认，可以导出执行文件。`;
  } else if (_xiaomifengApprovalCheck?.code === 'APPROVAL_STALE') {
    approvalStatus.textContent = '小蜜蜂批次内容已变化，原确认失效，请重新提交。';
  } else if (_xiaomifengApproval?.status === 'pending_approval') {
    approvalStatus.textContent = '小蜜蜂批次等待人工确认。';
  } else {
    approvalStatus.textContent = '小蜜蜂执行文件需要先提交并完成人工确认。';
  }

  const btnSubmitXmfApproval = makeSoftButton('提交小蜜蜂确认', async () => {
    try {
      await saveContactReviewNow();
      const result = await window.desktopAPI.approvals.submitXiaomifeng({
        ...getXiaomifengApprovalPayload(),
        requestedBy: '桌面端操作人'
      });
      if (!result?.ok) return setMsg(`提交确认失败：${result?.error || 'unknown error'}`);
      _xiaomifengApproval = result.approval;
      _xiaomifengApprovalCheck = result.check || { ok: false, code: 'APPROVAL_NOT_APPROVED' };
      setMsg(`已提交 ${result.recipientCount || 0} 位达人，等待人工确认。`);
    } catch (e) {
      setMsg(`提交确认异常：${e?.message || String(e)}`);
    }
  }, { disabled: !allReviewSummary.wechat });

  const btnApproveXmf = makeSoftButton('人工确认本批次', async () => {
    const approver = window.prompt('请输入确认人姓名：', _xiaomifengApproval?.approvedBy || '');
    if (!String(approver || '').trim()) return;
    const confirmed = window.confirm(`确认批准当前小蜜蜂批次？\n\n达人数量：${allReviewSummary.wechat}\n发送内容：${_contactGreeting || '(空)'}\n\n确认后才允许生成执行文件。`);
    if (!confirmed) return;
    const result = await window.desktopAPI.approvals.approveXiaomifeng({
      ...getXiaomifengApprovalPayload(),
      approver
    });
    if (!result?.ok) return setMsg(`人工确认失败：${result?.error || 'unknown error'}`);
    _xiaomifengApproval = result.approval;
    _xiaomifengApprovalCheck = { ok: true };
    setMsg(`已由 ${result.approval?.approvedBy || approver} 确认 ${result.recipientCount || 0} 位达人。`);
  }, { disabled: _xiaomifengApproval?.status !== 'pending_approval' });

  const btnExportXmf = makeSoftButton('导出小蜜蜂执行文件', async () => {
    const result = await window.desktopAPI.exports.exportXiaomifeng(getXiaomifengApprovalPayload());
    if (!result?.ok) {
      _xiaomifengApprovalCheck = result;
      return setMsg(`小蜜蜂文件未导出：${result?.error || '需要重新人工确认'}`);
    }
    _lastContactExportPath = result.outPath || '';
    setMsg(`小蜜蜂执行文件已生成：\n${result.outPath}\n\n达人=${result.rows}，审批记录=${result.approvalId}`);
  }, { primary: true, disabled: !_xiaomifengApprovalCheck?.ok });

  approvalBar.appendChild(approvalStatus);
  approvalBar.appendChild(btnSubmitXmfApproval);
  approvalBar.appendChild(btnApproveXmf);
  approvalBar.appendChild(btnExportXmf);
  contactSec.appendChild(approvalBar);

  const reviewTop = document.createElement('div');
  reviewTop.className = 'export-review-toolbar';

  const reviewStat = document.createElement('div');
  reviewStat.className = 'export-review-summary';
  reviewStat.textContent = _contactPreviewRows.length
    ? `当前筛选 ${filteredReviewSummary.total} 人，已勾选 ${filteredReviewSummary.selected} 人。只会处理你明确勾选的达人。`
    : '还没有复核名单。点击“刷新名单”后可以逐个决定是否建联。';

  const btnPreview = document.createElement('button');
  btnPreview.className = 'btn ghost';
  btnPreview.style.height = '34px';
  btnPreview.textContent = '刷新名单';
  btnPreview.addEventListener('click', async () => {
    await refreshContactPreview();
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  const btnSaveReview = document.createElement('button');
  btnSaveReview.className = 'btn ghost';
  btnSaveReview.style.height = '34px';
  btnSaveReview.textContent = '保存';
  btnSaveReview.disabled = !_contactPreviewRows.length;
  btnSaveReview.addEventListener('click', async () => {
    try {
      setContactSaveStatus('保存中...');
      const result = await saveContactReviewNow();
      if (!result?.ok) throw new Error(result?.error || '保存失败');
      setContactSaveStatus(`已保存 ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      setContactSaveStatus(`保存失败：${e?.message || String(e)}`);
    }
  });

  const btnImportReview = document.createElement('button');
  btnImportReview.className = 'btn ghost';
  btnImportReview.style.height = '34px';
  btnImportReview.textContent = '导入修改后的表';
  btnImportReview.disabled = !_contactPreviewRows.length;
  btnImportReview.addEventListener('click', async () => {
    try {
      setContactSaveStatus('导入复核表中...');
      await importContactReviewWorkbookNow();
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    } catch (e) {
      setContactSaveStatus(`导入失败：${e?.message || String(e)}`);
    }
  });

  const btnUnselectAllContact = document.createElement('button');
  btnUnselectAllContact.className = 'btn ghost';
  btnUnselectAllContact.style.height = '34px';
  btnUnselectAllContact.textContent = '清空整批勾选';
  btnUnselectAllContact.disabled = !_contactPreviewRows.length;
  btnUnselectAllContact.addEventListener('click', () => {
    _contactPreviewRows.forEach((row) => {
      const review = ensureReviewRow(row);
      clearReviewSelected(review);
    });
    scheduleContactReviewSave();
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  reviewTop.appendChild(reviewStat);
  reviewTop.appendChild(btnExportContact);
  reviewTop.appendChild(btnPreview);
  reviewTop.appendChild(btnSaveReview);
  const btnTencentEmail = document.createElement('button');
  btnTencentEmail.className = 'btn primary';
  btnTencentEmail.style.height = '34px';
  btnTencentEmail.textContent = _emailHandoffState.status === 'preparing' ? '正在整理邮箱...' : '打开企业邮箱';
  btnTencentEmail.disabled = !selectedContactRows.length || _emailHandoffState.status === 'preparing' || _xhsContactState.running;
  btnTencentEmail.title = '只整理当前已有邮箱并打开腾讯企业邮箱；不会启动补采、自动填写或发送';
  btnTencentEmail.addEventListener('click', async () => {
    const selectedRows = getContactFilteredRows().filter((row) => ensureReviewRow(row)?.selected === true);
    if (!selectedRows.length) return setMsg('请先在达人名称前勾选“要建联”。');
    _emailHandoffState = { status: 'preparing', emails: [], missingNames: [], message: '正在整理已勾选达人的公开邮箱。' };
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });

    const handoff = getEmailHandoff(selectedRows);
    if (!handoff.emails.length) {
      _emailHandoffState = {
        status: 'error',
        ...handoff,
        message: '勾选达人中没有现成的可用邮箱。请先点击“补采已选达人联系方式”并确认补采范围。'
      };
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      return;
    }

    const openResult = await window.desktopAPI.contacts.openTencentEmail();
    _emailHandoffState = {
      status: openResult?.ok ? 'ready' : 'error',
      ...handoff,
      message: openResult?.ok
        ? '邮箱已整理。请复制后，在腾讯企业邮箱点击“写信”并粘贴到收件人栏。'
        : `邮箱已整理，但腾讯企业邮箱打开失败：${openResult?.error || 'unknown error'}`
    };
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    if (openResult?.ok) {
      setMsg('已打开腾讯企业邮箱。系统不会自动点击“写信”、填写收件人或发送邮件。');
    }
  });
  reviewTop.appendChild(btnTencentEmail);
  const btnOpenLastContact = document.createElement('button');
  btnOpenLastContact.className = 'btn ghost';
  btnOpenLastContact.style.height = '34px';
  btnOpenLastContact.textContent = _lastContactExportPath ? '打开已导出文件' : '打开最近建联表';
  btnOpenLastContact.disabled = !_lastContactExportPath;
  btnOpenLastContact.addEventListener('click', async () => {
    const r = await window.desktopAPI.exports.openPath(_lastContactExportPath);
    if (!r?.ok) setMsg(`打开最近建联表失败：${r?.error || 'unknown error'}`);
  });
  reviewTop.appendChild(btnOpenLastContact);
  if (_contactSaveStatus) {
    const saveStatus = document.createElement('div');
    saveStatus.className = 'muted-line';
    saveStatus.textContent = _contactSaveStatus;
    reviewTop.appendChild(saveStatus);
  }
  contactSec.appendChild(reviewTop);

  if (_emailHandoffState.status !== 'idle') {
    const emailHandoff = document.createElement('div');
    emailHandoff.className = `email-handoff ${_emailHandoffState.status}`;
    emailHandoff.setAttribute('role', 'status');
    emailHandoff.setAttribute('aria-live', 'polite');

    const emailHandoffText = document.createElement('div');
    emailHandoffText.className = 'email-handoff-message';
    emailHandoffText.textContent = _emailHandoffState.message;
    emailHandoff.appendChild(emailHandoffText);

    if (_emailHandoffState.emails.length) {
      const emailList = document.createElement('textarea');
      emailList.className = 'email-handoff-list';
      emailList.readOnly = true;
      emailList.value = _emailHandoffState.emails.join('; ');
      emailList.setAttribute('aria-label', '已选达人邮箱');
      emailHandoff.appendChild(emailList);

      const copyEmails = makeSoftButton('复制邮箱', async () => {
        const ok = await copyTextWithFallback(_emailHandoffState.emails.join('; '));
        if (ok) setMsg('邮箱已复制。请在腾讯企业邮箱中点击“写信”，再粘贴到收件人栏。');
      }, { primary: true });
      emailHandoff.appendChild(copyEmails);
    }

    if (_emailHandoffState.missingNames.length) {
      const missing = document.createElement('div');
      missing.className = 'email-handoff-missing';
      missing.textContent = `未找到公开邮箱：${_emailHandoffState.missingNames.join('、')}`;
      emailHandoff.appendChild(missing);
    }
    contactSec.appendChild(emailHandoff);
  }

  if (_contactExportState.status !== 'idle') {
    const exportFeedback = document.createElement('div');
    exportFeedback.className = `export-action-feedback ${_contactExportState.status}`;
    exportFeedback.setAttribute('role', 'status');
    exportFeedback.setAttribute('aria-live', 'polite');
    const exportFeedbackMessage = document.createElement('div');
    exportFeedbackMessage.className = 'export-action-feedback-message';
    exportFeedbackMessage.textContent = _contactExportState.message;
    exportFeedback.appendChild(exportFeedbackMessage);
    if (_contactExportState.outPath) {
      const exportFeedbackPath = document.createElement('div');
      exportFeedbackPath.className = 'export-action-feedback-path';
      exportFeedbackPath.textContent = _contactExportState.outPath;
      exportFeedback.appendChild(exportFeedbackPath);
    }
    contactSec.appendChild(exportFeedback);
  }

  if (_contactPreviewRows.length) {
    const reviewBatchActions = document.createElement('div');
    reviewBatchActions.className = 'export-filter-actions';
    reviewBatchActions.appendChild(btnImportReview);
    reviewBatchActions.appendChild(btnUnselectAllContact);
    const reviewBatchDetails = createAdvancedSection({
      title: '整张名单批量处理',
      children: [reviewBatchActions]
    });
    reviewBatchDetails.classList.add('bulk-actions-section');
    contactSec.appendChild(reviewBatchDetails);
  }

  if (_contactPreviewRows.length) {
    const filterBar = document.createElement('div');
    filterBar.className = 'export-filter-bar';

    const searchInput = document.createElement('input');
    searchInput.className = 'tpl-input';
    searchInput.style.height = '36px';
    searchInput.placeholder = '搜索昵称 / 小红书号 / 标签 / 备注';
    searchInput.value = _contactSearch;
    searchInput.addEventListener('input', () => {
      _contactSearch = searchInput.value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    });

    const mkSelect = (value, options, onChange) => {
      const selFilter = document.createElement('select');
      selFilter.className = 'tpl-input';
      selFilter.style.height = '36px';
      options.forEach(([v, label]) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = label;
        if (v === value) opt.selected = true;
        selFilter.appendChild(opt);
      });
      selFilter.addEventListener('change', () => onChange(selFilter.value));
      return selFilter;
    };

    filterBar.appendChild(searchInput);
    filterBar.appendChild(mkSelect(_contactStatusFilter, [
      ['all', '全部状态'],
      ['selected', '已选建联'],
      ['excluded', '已排除']
    ], (value) => {
      _contactStatusFilter = value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    filterBar.appendChild(mkSelect(_contactContactFilter, [
      ['all', '全部联系方式'],
      ['missing', '缺联系方式'],
      ['filled', '已有联系方式']
    ], (value) => {
      _contactContactFilter = value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    filterBar.appendChild(mkSelect(_contactPriorityFilter, [
      ['all', '全部优先级'],
      ['priority', '有优先级'],
      ['none', '无优先级']
    ], (value) => {
      _contactPriorityFilter = value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    filterBar.appendChild(mkSelect(_contactFollowupFilter, [
      ['all', '全部跟进状态'],
      ...FOLLOWUP_STATUS_OPTIONS.map((value) => [value, value])
    ], (value) => {
      _contactFollowupFilter = value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    filterBar.appendChild(mkSelect(_contactChannelFilter, [
      ['all', '全部建联方式'],
      ...CONTACT_CHANNEL_OPTIONS.filter((value) => value !== '自动分流').map((value) => [value, value])
    ], (value) => {
      _contactChannelFilter = value;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    contactSec.appendChild(filterBar);

    const filterActions = document.createElement('div');
    filterActions.className = 'export-filter-actions';

    const mkFilterBtn = (label, onClick) => {
      const b = document.createElement('button');
      b.className = 'btn ghost';
      b.style.height = '32px';
      b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };

    const selectionActions = document.createElement('div');
    selectionActions.className = 'export-filter-actions';
    setStyles(selectionActions, { padding: '8px 18px 0', alignItems: 'center' });

    const selectAllButton = mkFilterBtn('全选整批', () => {
      _contactPreviewRows.forEach((row) => {
        const review = ensureReviewRow(row);
        markReviewSelected(review);
      });
      _xiaomifengApprovalCheck = null;
      scheduleContactReviewSave();
      setMsg(`已选中本批次全部 ${_contactPreviewRows.length} 位达人。`);
    });
    selectAllButton.title = '选中本批次全部已采集达人，不受当前筛选条件影响';
    selectionActions.appendChild(selectAllButton);

    const resetSelectionButton = mkFilterBtn('清空整批勾选', () => {
      _contactPreviewRows.forEach((row) => {
        const review = ensureReviewRow(row);
        clearReviewSelected(review);
      });
      _xiaomifengApprovalCheck = null;
      scheduleContactReviewSave();
      setMsg('已清空本批次全部达人勾选；采集数据和已填写内容保持不变。');
    });
    resetSelectionButton.title = '清空本批次全部达人勾选，不删除采集数据或已填写内容';
    selectionActions.appendChild(resetSelectionButton);

    const selectionScope = document.createElement('span');
    selectionScope.className = 'muted-line';
    selectionScope.textContent = `作用于本批次全部 ${_contactPreviewRows.length} 位达人`;
    selectionActions.appendChild(selectionScope);
    contactSec.appendChild(selectionActions);

    filterActions.appendChild(mkFilterBtn('全选当前筛选', () => {
      filteredContactRows.forEach((row) => {
        const review = ensureReviewRow(row);
        markReviewSelected(review);
      });
      _xiaomifengApprovalCheck = null;
      scheduleContactReviewSave();
      setMsg(`已选中当前筛选中的 ${filteredContactRows.length} 位达人。`);
    }));
    filterActions.appendChild(mkFilterBtn('取消当前筛选勾选', () => {
      filteredContactRows.forEach((row) => {
        const review = ensureReviewRow(row);
        clearReviewSelected(review);
      });
      _xiaomifengApprovalCheck = null;
      scheduleContactReviewSave();
      setMsg(`已取消当前筛选中 ${filteredContactRows.length} 位达人的勾选；其他达人不受影响。`);
    }));
    filterActions.appendChild(mkFilterBtn('复制当前链接', async () => {
      const text = filteredContactRows.map((row) => row.creatorUrl).filter(Boolean).join('\n');
      if (!text) {
        setMsg('当前筛选结果没有可复制的蒲公英链接。');
        return;
      }
      const ok = await copyTextWithFallback(text);
      if (ok) setMsg(`已复制当前筛选结果链接：${filteredContactRows.length} 条`);
    }));
    filterActions.appendChild(mkFilterBtn('复制当前摘要', async () => {
      const text = buildContactReviewSummaryText(filteredContactRows);
      if (!text) {
        setMsg('当前筛选结果没有可复制的摘要。');
        return;
      }
      const ok = await copyTextWithFallback(text);
      if (ok) setMsg(`已复制当前筛选结果摘要：${filteredContactRows.length} 条`);
    }));
    filterActions.appendChild(mkFilterBtn('导出当前Excel', async () => {
      if (!filteredContactRows.length) {
        setMsg('当前筛选结果为空，无法导出。');
        return;
      }
      try {
        await saveContactReviewNow();
        const r = await window.desktopAPI.exports.exportContactSelection({
          runDir: _selectedRunDir,
          suffix: buildContactSelectionExportSuffix(),
          rows: buildExportRowsFromContactRows(filteredContactRows),
          ...getContactSettings()
        });
        if (!r?.ok) {
          setMsg(`导出当前筛选失败：${r?.error || 'unknown error'}`);
          return;
        }
        _lastContactExportPath = r.outPath || '';
        setMsg(`导出当前筛选成功：\n${r.outPath}\n\n统计：达人=${r.creators}，蒲公英邀约=${r.pgyInviteRows || 0}，邮件建联=${r.emailContactRows || 0}，小蜜蜂导入=${r.xiaomifengRows || 0}，待补联系方式=${r.pendingContactRows || 0}`);
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      } catch (e) {
        setMsg(`导出当前筛选异常：${e?.message || String(e)}`);
      }
    }));
    filterActions.appendChild(mkFilterBtn('清空筛选', () => {
      _contactSearch = '';
      _contactStatusFilter = 'all';
      _contactContactFilter = 'all';
      _contactPriorityFilter = 'all';
      _contactFollowupFilter = 'all';
      _contactChannelFilter = 'all';
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    const batchFollowup = document.createElement('select');
    batchFollowup.className = 'tpl-input';
    batchFollowup.style.height = '32px';
    batchFollowup.style.width = '132px';
    FOLLOWUP_STATUS_OPTIONS.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      if (value === _contactBatchFollowupStatus) opt.selected = true;
      batchFollowup.appendChild(opt);
    });
    batchFollowup.addEventListener('change', () => {
      _contactBatchFollowupStatus = batchFollowup.value;
    });
    filterActions.appendChild(batchFollowup);
    filterActions.appendChild(mkFilterBtn('当前结果改状态', () => {
      filteredContactRows.forEach((row) => {
        const review = ensureReviewRow(row);
        if (!review) return;
        review.followupStatus = _contactBatchFollowupStatus;
        if (_contactBatchFollowupStatus === '不建联') review.selected = false;
        else if (review.selected !== true) review.selected = true;
      });
      scheduleContactReviewSave();
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    const batchChannel = document.createElement('select');
    batchChannel.className = 'tpl-input';
    batchChannel.style.height = '32px';
    batchChannel.style.width = '148px';
    CONTACT_CHANNEL_OPTIONS.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      if (value === _contactBatchChannel) opt.selected = true;
      batchChannel.appendChild(opt);
    });
    batchChannel.addEventListener('change', () => {
      _contactBatchChannel = normalizeContactChannel(batchChannel.value);
    });
    filterActions.appendChild(batchChannel);
    filterActions.appendChild(mkFilterBtn('当前结果改建联方式', () => {
      filteredContactRows.forEach((row) => {
        const review = ensureReviewRow(row);
        if (review) review.contactChannel = _contactBatchChannel;
      });
      _xiaomifengApprovalCheck = null;
      scheduleContactReviewSave();
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    }));
    const bulkDetails = createAdvancedSection({
      title: `批量处理当前筛选结果（${filteredContactRows.length} 人）`,
      open: _contactBulkActionsOpen,
      onToggle: (open) => {
        _contactBulkActionsOpen = open;
      },
      children: [filterActions]
    });
    bulkDetails.classList.add('bulk-actions-section');
    contactSec.appendChild(bulkDetails);
  }

  if (_contactPreviewRunDir !== _selectedRunDir || !_contactPreviewRows.length) {
    const emptyState = document.createElement('div');
    emptyState.style.color = 'var(--muted)';
    emptyState.style.fontSize = '12px';
    emptyState.style.marginTop = '8px';
    emptyState.style.padding = '10px 12px';
    emptyState.style.border = '1px solid var(--line)';
    emptyState.style.borderRadius = '10px';
    emptyState.style.background = 'rgba(17,24,39,0.02)';

    if (!_selectedRunDir) {
      emptyState.textContent = '请选择一个 run 目录。';
    } else if (_contactPreviewMeta.error) {
      emptyState.textContent = `复核预览加载失败：${_contactPreviewMeta.error}`;
    } else if (_contactPreviewRunDir !== _selectedRunDir && !_contactPreviewMeta.loaded) {
      emptyState.textContent = '正在准备建联复核预览；如果没有自动出现，请点击“刷新复核预览”。';
    } else if (_contactPreviewMeta.loaded && !_contactPreviewMeta.rawFiles) {
      emptyState.textContent = '这个 run 目录下还没有 raw_result.json。请先完成采集，或确认选择的是包含子任务结果的 run 目录。';
    } else if (_contactPreviewMeta.loaded && _contactPreviewMeta.rawFiles && !_contactPreviewRows.length) {
      emptyState.textContent = `已找到 ${_contactPreviewMeta.rawFiles} 个 raw_result.json，但没有生成可复核达人。请检查采集结果里的 creator_summary 字段。`;
    } else {
      emptyState.textContent = '当前筛选条件下没有达人。';
    }
    contactSec.appendChild(emptyState);
  }

  let contactReviewList = null;
  if (_contactPreviewRows.length) {
    const reviewList = document.createElement('div');
    contactReviewList = reviewList;
    reviewList.className = 'contact-review-list';

    if (!filteredContactRows.length) {
      const empty = document.createElement('div');
      empty.className = 'contact-review-empty';
      empty.textContent = '当前筛选条件下没有达人。';
      reviewList.appendChild(empty);
    }

    filteredContactRows.forEach((row) => {
      const review = ensureReviewRow(row);
      const card = document.createElement('div');
      const rowId = String(row.rowId || '');
      const isActive = rowId && savedContactReviewViewport?.activeRowId === rowId;
      card.className = [
        'contact-review-card',
        defaultFollowupStatus(review) === '不建联' ? 'is-excluded' : '',
        isActive ? 'is-active' : ''
      ].filter(Boolean).join(' ');
      card.dataset.reviewRowId = rowId;
      if (isActive) card.setAttribute('aria-current', 'true');
      card.addEventListener('focusin', () => {
        _contactReviewViewportStates.setActiveRow(contactReviewViewportKey, rowId, reviewList);
      });

      const main = document.createElement('div');
      main.className = 'contact-review-main';

      const selectedWrap = document.createElement('label');
      selectedWrap.className = 'contact-review-check';
      const selectedInput = document.createElement('input');
      selectedInput.type = 'checkbox';
      selectedInput.checked = review?.selected === true;
      selectedInput.addEventListener('change', () => {
        if (!review) return;
        _contactReviewViewportStates.setActiveRow(contactReviewViewportKey, rowId, reviewList);
        if (selectedInput.checked) markReviewSelected(review);
        else clearReviewSelected(review);
        _xiaomifengApprovalCheck = null;
        resetEmailHandoff();
        scheduleContactReviewSave();
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      });
      const selectedText = document.createElement('span');
      selectedText.textContent = '要建联';
      selectedWrap.appendChild(selectedInput);
      selectedWrap.appendChild(selectedText);

      const creatorBlock = document.createElement('div');
      creatorBlock.className = 'contact-review-creator';
      const creatorName = document.createElement('div');
      creatorName.className = 'contact-review-name';
      creatorName.textContent = row.creatorName || '(无昵称)';
      const sub = document.createElement('div');
      sub.className = 'muted-line';
      sub.textContent = [row.xhsId, row.followers].filter(Boolean).join(' / ');
      creatorBlock.appendChild(creatorName);
      creatorBlock.appendChild(sub);
      if (row.creatorUrl) {
        const pgyLink = document.createElement('a');
        pgyLink.className = 'contact-pgy-link';
        pgyLink.href = normalizeContactUrl(row.creatorUrl);
        pgyLink.textContent = '打开蒲公英主页';
        pgyLink.title = row.creatorUrl;
        pgyLink.addEventListener('click', async (event) => {
          event.preventDefault();
          _contactReviewViewportStates.setActiveRow(contactReviewViewportKey, rowId, reviewList);
          const result = await window.desktopAPI.contacts.openPgyCreator(row.creatorUrl);
          if (!result?.ok) setMsg(`打开蒲公英主页失败：${result?.error || 'unknown error'}`);
        });
        creatorBlock.appendChild(pgyLink);
      }

      const reason = document.createElement('div');
      reason.className = 'contact-review-reason';
      reason.textContent = row.recommendation || '暂无推荐理由';

      main.appendChild(selectedWrap);
      main.appendChild(creatorBlock);
      main.appendChild(reason);

      const quickMeta = document.createElement('div');
      quickMeta.className = 'contact-review-quick-meta';
      const appendChip = (label, value, tone = '') => {
        const chip = document.createElement('span');
        chip.className = `contact-chip ${tone}`.trim();
        chip.textContent = `${label}${value ? `：${value}` : ''}`;
        quickMeta.appendChild(chip);
      };
      appendChip('跟进', defaultFollowupStatus(review));
      if (review?.priority) appendChip('优先级', review.priority, 'strong');
      appendChip('邮箱', review?.email ? '已填' : '待补', review?.email ? 'good' : 'warn');
      appendChip('微信', review?.wechatId ? '已填' : '待补', review?.wechatId ? 'good' : 'warn');
      if (review?.phone) appendChip('手机', '已填', 'good');
      if (review?.contactCollectionStatus === 'found') appendChip('小红书公开资料', '已补采', 'good');
      if (review?.contactCollectionStatus === 'not_public') appendChip('小红书主页', '未公开联系方式');
      if (review?.contactCollectionStatus === 'profile_not_found' || review?.contactCollectionStatus === 'profile_unavailable') {
        appendChip('小红书主页', '补采失败', 'warn');
      }

      let contactFailure = null;
      if (review?.contactCollectionError) {
        const failureLabels = {
          PGY_PROFILE_LOAD_FAILED: '蒲公英达人页打开失败',
          PGY_PROFILE_LOAD_WRONG_PAGE: '蒲公英达人页尚未切换完成',
          PGY_PROFILE_NOT_READY: '蒲公英达人页未加载稳定',
          XHS_PROFILE_NOT_FOUND: '未找到小红书主页入口',
          XHS_PROFILE_NOT_READY: '小红书主页未加载完整',
          XHS_PROFILE_CONTENT_NOT_READY: '公开资料区域未出现',
          XHS_PROFILE_STABILIZING: '公开资料仍在变化',
          XHS_PROFILE_URL_MISMATCH: '打开了其他小红书主页'
        };
        contactFailure = document.createElement('div');
        contactFailure.className = 'contact-collection-error';
        const label = failureLabels[review.contactCollectionCode] || '补采失败';
        contactFailure.textContent = `${label}：${review.contactCollectionError}`;
        contactFailure.title = review.contactCollectionCode || '';
      }

      const fields = document.createElement('div');
      fields.className = 'contact-review-fields';

      const followupField = document.createElement('label');
      followupField.className = 'field-label compact';
      followupField.textContent = '跟进';
      const followup = document.createElement('select');
      followup.className = 'tpl-input';
      followup.style.height = '34px';
      const currentFollowup = defaultFollowupStatus(review);
      if (!FOLLOWUP_STATUS_OPTIONS.includes(currentFollowup)) {
        const opt = document.createElement('option');
        opt.value = currentFollowup;
        opt.textContent = currentFollowup;
        followup.appendChild(opt);
      }
      FOLLOWUP_STATUS_OPTIONS.forEach((value) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        if (value === currentFollowup) opt.selected = true;
        followup.appendChild(opt);
      });
      followup.addEventListener('change', () => {
        if (!review) return;
        review.followupStatus = followup.value;
        if (followup.value === '不建联') review.selected = false;
        else if (review.selected !== true) review.selected = true;
        scheduleContactReviewSave();
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      });
      followupField.appendChild(followup);

      const channelField = document.createElement('label');
      channelField.className = 'field-label compact';
      channelField.textContent = '方式';
      const channel = document.createElement('select');
      channel.className = 'tpl-input';
      channel.style.height = '34px';
      CONTACT_CHANNEL_OPTIONS.forEach((value) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        if (value === normalizeContactChannel(review?.contactChannel || _contactChannelStrategy)) opt.selected = true;
        channel.appendChild(opt);
      });
      channel.addEventListener('change', () => {
        if (!review) return;
        review.contactChannel = normalizeContactChannel(channel.value);
        scheduleContactReviewSave();
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      });
      channelField.appendChild(channel);

      const priorityField = document.createElement('label');
      priorityField.className = 'field-label compact';
      priorityField.textContent = '优先级';
      const priority = document.createElement('input');
      priority.className = 'tpl-input';
      priority.style.height = '34px';
      priority.placeholder = 'P1';
      priority.value = review?.priority || '';
      priority.addEventListener('input', () => {
        if (review) review.priority = priority.value;
        scheduleContactReviewSave();
      });
      priorityField.appendChild(priority);

      const emailField = document.createElement('label');
      emailField.className = 'field-label compact';
      emailField.textContent = '邮箱';
      const email = document.createElement('input');
      email.className = 'tpl-input';
      email.style.height = '34px';
      email.placeholder = '邮箱';
      email.value = review?.email || '';
      email.addEventListener('input', () => {
        if (review) review.email = email.value;
        scheduleContactReviewSave();
      });
      emailField.appendChild(email);

      const wechatField = document.createElement('label');
      wechatField.className = 'field-label compact';
      wechatField.textContent = '微信';
      const wechat = document.createElement('input');
      wechat.className = 'tpl-input';
      wechat.style.height = '34px';
      wechat.placeholder = '微信号';
      wechat.value = review?.wechatId || '';
      wechat.addEventListener('input', () => {
        if (review) review.wechatId = wechat.value;
        scheduleContactReviewSave();
      });
      wechatField.appendChild(wechat);

      const phoneField = document.createElement('label');
      phoneField.className = 'field-label compact';
      phoneField.textContent = '手机';
      const phone = document.createElement('input');
      phone.className = 'tpl-input';
      phone.style.height = '34px';
      phone.placeholder = '手机号';
      phone.value = review?.phone || '';
      phone.addEventListener('input', () => {
        if (review) review.phone = phone.value;
        scheduleContactReviewSave();
      });
      phoneField.appendChild(phone);

      const excludeField = document.createElement('label');
      excludeField.className = 'field-label compact wide';
      excludeField.textContent = '不建联原因';
      const exclude = document.createElement('input');
      exclude.className = 'tpl-input';
      exclude.style.height = '34px';
      exclude.placeholder = '不选时填写';
      exclude.value = review?.excludeReason || '';
      exclude.addEventListener('input', () => {
        if (review) review.excludeReason = exclude.value;
        scheduleContactReviewSave();
      });
      excludeField.appendChild(exclude);

      const noteField = document.createElement('label');
      noteField.className = 'field-label compact wide';
      noteField.textContent = '备注';
      const note = document.createElement('input');
      note.className = 'tpl-input';
      note.style.height = '34px';
      note.placeholder = '跟进备注';
      note.value = review?.note || '';
      note.addEventListener('input', () => {
        if (review) review.note = note.value;
        scheduleContactReviewSave();
      });
      noteField.appendChild(note);

      fields.appendChild(followupField);
      fields.appendChild(channelField);
      fields.appendChild(priorityField);
      fields.appendChild(emailField);
      fields.appendChild(wechatField);
      fields.appendChild(phoneField);
      fields.appendChild(excludeField);
      fields.appendChild(noteField);

      const detail = document.createElement('details');
      detail.className = 'contact-review-detail';
      const detailSummary = document.createElement('summary');
      detailSummary.textContent = '编辑跟进信息';
      detail.appendChild(detailSummary);
      detail.appendChild(fields);

      card.appendChild(main);
      card.appendChild(quickMeta);
      if (contactFailure) card.appendChild(contactFailure);
      card.appendChild(detail);
      reviewList.appendChild(card);
    });
    contactSec.appendChild(reviewList);
    reviewList.addEventListener('scroll', () => {
      _contactReviewViewportStates.capture(contactReviewViewportKey, reviewList);
    });
  }
  root.appendChild(contactSec);
  if (contactReviewList) {
    requestAnimationFrame(() => {
      if (!contactReviewList.isConnected || !savedContactReviewViewport) return;
      restoreReviewViewport(contactReviewList, savedContactReviewViewport);
      requestAnimationFrame(() => {
        if (contactReviewList.isConnected) restoreReviewViewport(contactReviewList, savedContactReviewViewport);
      });
    });
  }

  // 二次导出：按列勾选（两栏 + sticky 操作条）
  const sec = document.createElement('div');
  sec.className = 'card';
  sec.style.marginTop = '14px';
  sec.style.padding = '14px';

  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'baseline';
  head.style.justifyContent = 'space-between';
  head.style.gap = '12px';
  head.style.marginBottom = '10px';

  const h3 = document.createElement('div');
  h3.style.fontWeight = '900';
  h3.style.letterSpacing = '0.2px';
  h3.textContent = '二次导出（按列勾选）';

  const hint = document.createElement('div');
  hint.style.color = 'var(--muted)';
  hint.style.fontSize = '12px';
  hint.textContent = '导出精简版：按勾选列导出，并自动剔除全空列；会记住你的上次选择。';

  head.appendChild(h3);
  head.appendChild(hint);
  sec.appendChild(head);

  const groups = (_groups && _groups.length) ? _groups : [{ name: '全部列', columns: _columns }];
  if (!_activeGroup && groups.length) _activeGroup = groups[0].name;
  if (!groups.some((g) => g.name === _activeGroup) && groups.length) _activeGroup = groups[0].name;
  const active = groups.find((g) => g.name === _activeGroup) || groups[0] || { name: '全部列', columns: _columns };

  const tools = document.createElement('div');
  tools.style.display = 'flex';
  tools.style.flexWrap = 'wrap';
  tools.style.gap = '8px';
  tools.style.alignItems = 'center';
  tools.style.marginBottom = '12px';

  const search = document.createElement('input');
  search.className = 'tpl-input';
  search.placeholder = '搜索列名（例如：粉丝 / 报价 / 笔记）';
  search.style.height = '34px';
  search.style.maxWidth = '360px';
  search.value = _query;
  search.addEventListener('input', () => {
    _query = search.value;
    store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
  });

  const mkMiniBtn = (label, onClick) => {
    const b = document.createElement('button');
    b.className = 'btn ghost';
    b.style.height = '34px';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  tools.appendChild(search);
  tools.appendChild(
    mkMiniBtn('全选全部列', () => {
      _columns.forEach((c) => _checked.add(c));
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  tools.appendChild(
    mkMiniBtn('取消全部列', () => {
      _checked = new Set();
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  tools.appendChild(
    mkMiniBtn('反选全部列', () => {
      const next = new Set();
      _columns.forEach((c) => { if (!_checked.has(c)) next.add(c); });
      _checked = next;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    })
  );
  sec.appendChild(tools);

  const pane = document.createElement('div');
  pane.style.display = 'grid';
  pane.style.gridTemplateColumns = '190px 1fr';
  pane.style.gap = '12px';
  pane.style.minHeight = '360px';

  // 左：分组
  const left = document.createElement('div');
  left.style.background = 'var(--panel2)';
  left.style.border = '1px solid var(--line)';
  left.style.borderRadius = '14px';
  left.style.padding = '10px';

  groups.forEach((g) => {
    const cols = Array.isArray(g.columns) ? g.columns : [];
    const total = cols.length;
    const checkedN = cols.filter((c) => _checked.has(c)).length;
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.style.width = '100%';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.padding = '10px 10px';
    btn.style.marginBottom = '8px';
    btn.style.borderRadius = '12px';
    btn.style.background = (g.name === _activeGroup) ? 'var(--primary-weak)' : 'rgba(255,255,255,0.55)';
    btn.style.borderColor = (g.name === _activeGroup) ? 'rgba(232, 90, 154, 0.22)' : 'rgba(17,24,39,0.08)';
    btn.addEventListener('click', () => {
      _activeGroup = g.name;
      store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
    });

    const name = document.createElement('div');
    name.style.fontWeight = '700';
    name.textContent = g.name;

    const badge = document.createElement('div');
    badge.style.fontSize = '12px';
    badge.style.color = 'var(--muted)';
    badge.textContent = `${checkedN}/${total}`;

    btn.appendChild(name);
    btn.appendChild(badge);
    left.appendChild(btn);
  });

  // 右：列列表
  const right = document.createElement('div');
  right.style.border = '1px solid var(--line)';
  right.style.borderRadius = '14px';
  right.style.background = 'var(--panel)';
  right.style.overflow = 'auto';
  right.style.position = 'relative';

  const rightTop = document.createElement('div');
  rightTop.style.padding = '12px 12px 10px 12px';
  rightTop.style.borderBottom = '1px solid var(--line)';
  rightTop.style.position = 'sticky';
  rightTop.style.top = '0';
  rightTop.style.zIndex = '2';
  rightTop.style.background = 'rgba(255,255,255,0.92)';
  rightTop.style.backdropFilter = 'blur(10px)';

  const rtTitle = document.createElement('div');
  rtTitle.style.fontWeight = '800';
  rtTitle.textContent = `${active.name} · 列选择`;
  const rtSub = document.createElement('div');
  rtSub.style.color = 'var(--muted)';
  rtSub.style.fontSize = '12px';
  rtSub.style.marginTop = '4px';
  rtSub.textContent = `已选 ${_checked.size} / ${_columns.length}`;

  rightTop.appendChild(rtTitle);
  rightTop.appendChild(rtSub);
  right.appendChild(rightTop);

  const list = document.createElement('div');
  list.style.padding = '10px 12px 68px 12px'; // 预留 sticky 底部

  const cols = _filteredColumns(Array.isArray(active.columns) ? active.columns : []);
  if (!cols.length && String(_query || '').trim()) {
    const empty = document.createElement('div');
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '13px';
    empty.textContent = '当前分组下无匹配列。';
    list.appendChild(empty);
  } else {
    cols.forEach((c) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '10px';
      row.style.alignItems = 'center';
      row.style.padding = '10px 10px';
      row.style.borderRadius = '12px';
      row.style.cursor = 'pointer';
      row.style.border = '1px solid rgba(17,24,39,0.06)';
      row.style.background = 'rgba(17,24,39,0.02)';
      row.style.marginBottom = '8px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = _checked.has(c);
      cb.addEventListener('change', () => {
        if (cb.checked) _checked.add(c);
        else _checked.delete(c);
        store.set({ exports: { ...(store.state.exports || {}), _t: Date.now() } });
      });

      const txt = document.createElement('div');
      txt.style.fontSize = '13px';
      txt.style.color = 'var(--text)';
      txt.style.flex = '1';
      txt.textContent = c;

      row.appendChild(cb);
      row.appendChild(txt);
      list.appendChild(row);
    });
  }
  right.appendChild(list);

  // sticky 导出条
  const sticky = document.createElement('div');
  sticky.style.position = 'sticky';
  sticky.style.bottom = '0';
  sticky.style.left = '0';
  sticky.style.right = '0';
  sticky.style.zIndex = '3';
  sticky.style.padding = '10px 12px';
  sticky.style.borderTop = '1px solid var(--line)';
  sticky.style.background = 'rgba(255,255,255,0.92)';
  sticky.style.backdropFilter = 'blur(10px)';
  sticky.style.display = 'flex';
  sticky.style.alignItems = 'center';
  sticky.style.justifyContent = 'space-between';
  sticky.style.gap = '10px';

  const leftStat = document.createElement('div');
  leftStat.style.color = 'var(--muted)';
  leftStat.style.fontSize = '12px';
  leftStat.textContent = `已选 ${_checked.size} / ${_columns.length} · 会自动剔除全空列`;

  const btnExportSlim = document.createElement('button');
  btnExportSlim.className = 'btn primary';
  btnExportSlim.style.height = '36px';
  btnExportSlim.textContent = '导出精简版';
  btnExportSlim.disabled = !_columns.length;
  btnExportSlim.addEventListener('click', async () => {
    const selectedColumns = _columns.filter((c) => _checked.has(c));
    if (!selectedColumns.length) {
      alert('请至少勾选 1 列');
      return;
    }
    setMsg('导出精简版中...');
    try {
      await window.desktopAPI.exports.saveColumnPreset(selectedColumns);
      const r = await window.desktopAPI.exports.exportResourceRun({
        runDir: _selectedRunDir,
        selectedColumns,
        mode: 'slim'
      });
      if (!r?.ok) {
        setMsg(`导出失败：${r?.error || 'unknown error'}`);
        return;
      }
      const dropped = (r.droppedCols !== undefined) ? `，已移除全空列=${r.droppedCols}` : '';
      setMsg(`导出成功：\n${r.outPath}\n\n统计：达人=${r.creators}，selectedCols=${r.selectedCols ?? selectedColumns.length}${dropped}`);
    } catch (e) {
      setMsg(`导出异常：${e?.message || String(e)}`);
    }
  });

  sticky.appendChild(leftStat);
  sticky.appendChild(btnExportSlim);
  right.appendChild(sticky);

  pane.appendChild(left);
  pane.appendChild(right);
  sec.appendChild(pane);
  root.appendChild(sec);

  const msg = document.createElement('div');
  msg.style.marginTop = '10px';
  msg.style.fontSize = '13px';
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = 'var(--text)';
  msg.textContent = _msg || '';
  root.appendChild(msg);

  return root;
}
