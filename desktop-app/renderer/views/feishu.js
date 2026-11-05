let connection = { connected: false, fields: [], target: '' };
let config = { pluginId: '', projectKey: '', workItemTypeKey: '', userKey: '' };
let busy = false;
let message = '飞书未连接';
let currentRun = '';
let currentRow = '';
let currentContactRows = [];
let epoch = 0;
let accountNumber = '';
let accountConfirmed = false;
let safetyConfirmed = false;
let recordMode = 'production';
let lookup = null;
let records = [];
let draft = {};
let checkedFields = new Set();
let plan = null;
let manualCleanupApproval = null;
let action = 'create';
let recordId = '';
let ownedAbsenceNotice = null;
let operator = null;
let selectedMaintainer = null;
let operatorLease = null;
let operatorConfirmed = false;
let operatorInvalidReason = '';
let operatorExpiryTimer = null;
// A reply never grants five fresh minutes from renderer receipt.
const operatorLeaseMs = 5 * 60 * 1000;
let maintainerName = '';
let maintainerCandidates = [];
let maintainerChoice = '';
let maintainerRevision = 0;
let configDirty = false;
let savedConnection = false;
let initialRestoreStarted = false;
let rememberConnection = true;
let batch = null;
let batchOpen = false;
let singleOpen = null;
let currentWriteDetails = null;
let cloud = null;
let cloudAction = 'create';
let cloudHistory = [];
let cloudExpiryTimer = null;
let cloudInvalidReason = '';
// Session-only disclosure choices, never operator authority or form values.
const readingState = new Map();
const currentReadingDetails = new Map();
const batchLimit = 50;
const testRecord = r => r.recordMode === undefined || r.recordMode === 'test';
function invalidateCloud(reason = '建档名单或资料已更改，旧预览已失效') {
  cloudInvalidReason = reason;
  if (!cloud) return;
  cloud.revision++;
  cloud.confirmed = false;
  for (const item of cloud.items) {
    item.plan = null;
    const submitted = ['verified', 'unknown'].includes(item.status)
      || (item.submission && (item.status === 'creating' || (item.error && item.error === item.result)));
    if (!submitted) {
      item.status = 'idle'; item.error = null; item.draftStamp = ''; item.operationOwner = '';
    }
  }
  if (cloud.operation !== 'execute') { cloud.progress = 0; cloud.total = 0; }
  if (!busy) { cloud.phase = 'idle'; cloud.haltReason = ''; }
}
const usableContact = c => c?.value && ['wechat', 'email', 'phone', 'unclassified'].includes(c.kind);
const contactRowIdentity = row => row ? JSON.stringify([row.rowId, row.creatorUrl, row.creatorName, row.xhsId, row.feishuAccountNumber || '']) : '';
function batchChoice(item) {
  const candidate = item.result?.preview?.candidates.find(c => String(c.recordId) === item.recordId);
  const field = ({ wechat: 'wechatId', email: 'email', phone: 'phone', unclassified: 'contactRaw' })[item.kind];
  return usableContact(candidate) && field && (candidate.kind === item.kind || candidate.kind === 'unclassified')
    && (!item[field] || item[field] === candidate.value) && item.result?.token && !item.applied ? candidate : null;
}
function resetMaintainer(reason = '经纪人归属待确认，旧预览不可使用') {
  maintainerRevision++;
  if (operatorExpiryTimer != null) { clearTimeout(operatorExpiryTimer); operatorExpiryTimer = null; }
  operatorInvalidReason = '';
  selectedMaintainer = null;
  operator = null; operatorLease = null; operatorConfirmed = false; maintainerCandidates = []; maintainerChoice = ''; plan = null;
  invalidateCloud(reason);
}
function operatorTiming() {
  const now = Date.now(), value = operator?.checkedAt;
  const checked = typeof value === 'string' ? Date.parse(value) : NaN;
  if (value == null || value === '') return { now, deadline: NaN, code: 'CHECK_TIME_MISSING', detail: '未返回检查时间' };
  if (!Number.isFinite(checked)) return { now, deadline: NaN, code: 'CHECK_TIME_INVALID', detail: '检查时间格式不正确' };
  if (!Number.isFinite(now)) return { now, deadline: NaN, code: 'REVIEW_CLOCK_INVALID', detail: '界面计时无法核实' };
  if (operatorLease && operatorLease.operator !== operator) {
    return { now, deadline: NaN, code: 'CHECK_LEASE_INVALID', detail: '人员确认与检查结果不一致' };
  }
  if (operatorLease?.operator === operator) {
    const lease = operatorLease, mono = monotonicNow();
    if (!Number.isSafeInteger(lease.remainingMs) || lease.remainingMs <= 0 || lease.remainingMs > operatorLeaseMs
      || lease.checkedAt !== value || !Number.isFinite(lease.wallStart) || !Number.isFinite(lease.monoStart)) {
      return { now, deadline: NaN, code: 'CHECK_LEASE_INVALID', detail: '检查返回的确认期无法核实' };
    }
    if (!Number.isFinite(mono) || mono < lease.monoLast) {
      return { now, deadline: NaN, code: 'REVIEW_CLOCK_INVALID', detail: '界面连续计时无法核实' };
    }
    lease.monoLast = mono;
    // Subtract the complete request time; neither clock can extend this bound.
    const remaining = lease.remainingMs - (mono - lease.monoStart);
    const deadline = Math.min(lease.wallStart + lease.remainingMs, now + remaining);
    return { now, deadline, ...(deadline <= now ? { code: 'CHECK_TIME_EXPIRED', detail: '确认期已结束，请重新选择' } : {}) };
  }
  if (checked > now) return { now, deadline: NaN, code: 'CHECK_TIME_FUTURE', detail: `检查时间比界面超前 ${checked - now} 毫秒` };
  const deadline = checked + operatorLeaseMs;
  return { now, deadline, ...(deadline <= now ? { code: 'CHECK_TIME_EXPIRED', detail: '已超过五分钟确认期' } : {}) };
}
function monotonicNow() {
  try { return performance.now(); } catch (_) { return NaN; }
}
function operatorDeadline() { return operatorTiming().deadline; }
function operatorReady() {
  expireOperatorIfNeeded();
  return !!operator && !operatorInvalidReason;
}
function maintainerReady() {
  return !!selectedMaintainer && selectedMaintainer.target === connection.target && connection.connected && !configDirty;
}
function preparationReady() { return maintainerReady() || operatorReady(); }
function invalidateOperator(reason, preserveChoice = false) {
  maintainerRevision++;
  operatorInvalidReason = reason;
  if (!preserveChoice) { selectedMaintainer = null; operatorConfirmed = false; }
  plan = null;
  maintainerCandidates = []; maintainerChoice = '';
  if (operatorExpiryTimer != null) { clearTimeout(operatorExpiryTimer); operatorExpiryTimer = null; }
  invalidateCloud(reason);
  if (busy && cloud && ['preparing', 'creating'].includes(cloud.phase)) {
    cloud.stopRequested = true; cloud.haltReason = reason;
  }
}
function expireOperatorIfNeeded() {
  if (!operator || operatorInvalidReason) return;
  const timing = operatorTiming(), deadline = timing.deadline;
  if (!Number.isFinite(deadline) || deadline <= timing.now) {
    if (selectedMaintainer) {
      const reason = `操作检查需刷新；经纪人选择已保留，重新预览时会核验所选人员 [${timing.code}]`;
      invalidateOperator(reason, true); message = reason; return;
    }
    const summary = Number.isFinite(deadline) ? '经纪人归属确认已过期，请重新查找并选择后确认'
      : '经纪人归属确认有效期无法核实，请重新查找并选择后确认';
    const reason = `${summary}；原因：${timing.detail} [${timing.code}]`;
    invalidateOperator(reason); message = reason;
  }
}
const operatorFailures = ['FEISHU_OPERATOR_CHANGED', 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED', 'FEISHU_OPERATOR_INVALID',
  'FEISHU_OPERATOR_INACTIVE', 'FEISHU_MAINTAINER_ROLE_INVALID'];
const fieldOrder = ['账号昵称', '小红书ID', '平台', '达人资源来源', '联系方式', '图文平台价', '视频平台价', '所在城市', '后台链接', '平台链接', '其他备注'];
const contactKinds = { wechat: '微信', phone: '手机', email: '邮箱', unclassified: '未分类原值', empty: '未填写', status: '状态占位', unrecognized: '无法识别' };

const outcomes = { not_found: '未匹配到记录', no_contact: '记录暂无联系方式', incomplete: '结果不完整，禁止自动回填',
  conflict: '库内联系方式冲突，请选择核实后的来源', manual_review: '命中记录，需要确认联系方式类型',
  local_conflict: '与本地已有联系方式冲突', already_present: '联系方式已在本地', ready_for_review: '命中记录，等待确认回填' };
const errors = { FEISHU_SESSION_EXPIRED: '连接已过期，请重新连接', FEISHU_REQUIRED_MISSING: '缺少必填字段',
  FEISHU_CONFIG_INVALID: '连接配置缺失或格式不正确，请核对五项连接字段',
  FEISHU_AUTH_CONFIG_INVALID: 'Plugin ID 或 Plugin Secret 缺失或格式不正确',
  FEISHU_AUTH_API: '插件凭证认证未通过，请核对 Plugin ID、Secret 和发布安装状态',
  FEISHU_AUTH_HTTP: '插件认证请求失败，请核对网络或代理',
  FEISHU_AUTH_TIMEOUT: '插件认证请求超时，请核对网络或代理',
  FEISHU_AUTH_REQUEST_FAILED: '无法访问插件认证接口，请核对网络、代理或证书',
  FEISHU_AUTH_REDIRECT: '插件认证被重定向，已拒绝发送凭证，请检查网络',
  FEISHU_AUTH_RESPONSE_INVALID: '插件认证响应无法识别，请核对网络和插件状态',
  FEISHU_AUTH_RESPONSE_TOO_LARGE: '插件认证响应异常，已停止连接',
  FEISHU_REQUEST_TIMEOUT: '读取飞书数据超时，请核对网络或代理',
  FEISHU_SAVED_MAINTAINER_INVALID: '本机经纪人选择无法读取，请重新选择；连接仍保留',
  FEISHU_MAINTAINER_SAVE_FAILED: '经纪人选择未能安全保存，请检查本机存储后重试',
  FEISHU_STORAGE_UNAVAILABLE: '本机安全存储不可用，未保存凭证',
  FEISHU_STORAGE_SAVE_FAILED: '连接配置未能安全保存，请检查本机存储',
  FEISHU_SAVED_CONNECTION_INVALID: '本机保存的连接无法解密，请更新连接配置',
  FEISHU_HTTP_ERROR: '接口请求失败', FEISHU_API_ERROR: '接口返回业务错误',
  FEISHU_IDENTITY_INVALID: '缺少有效的主页小红书号，已跳过', FEISHU_ROW_MISSING: '达人已不在当前结果中',
  FEISHU_LOCAL_SAVE_FAILED: '本地保存失败，未计为回填成功，请重新查询',
  FEISHU_CONTACT_CHANGED: '来源联系方式已变化或无法核实，未回填；请重新查询并审核',
  FEISHU_OPERATOR_CONFIRMATION_REQUIRED: '请查询并选定现维护经纪人，再确认归属',
  FEISHU_OPERATOR_INVALID: '未匹配到有效人员，请核对经纪人完整姓名',
  FEISHU_OPERATOR_INACTIVE: '所选经纪人账号未启用，不能新建跟进',
  FEISHU_OPERATOR_CHANGED: '所选经纪人或角色配置已改变，请重新选择',
  FEISHU_MAINTAINER_NAME_REQUIRED: '请填写经纪人完整姓名',
  FEISHU_MAINTAINER_RESULTS_INVALID: '人员查询结果无法核实，未选择任何人员',
  FEISHU_MAINTAINER_AMBIGUOUS: '存在无法区分的同名人员，请先在飞书核实成员账号',
  FEISHU_MAINTAINER_ROLE_INVALID: '没有找到唯一的现维护经纪人角色，不能新建跟进',
  FEISHU_MAINTAINER_READBACK_MISMATCH: '已创建，但现维护经纪人回读不一致；禁止重复新建，请核对结果',
  FEISHU_CONTACT_REQUIRED: '缺少实际联系方式，保留本地待补；后台邀约占位映射尚未验收',
  FEISHU_CONTACT_REQUIRED_BY_PROJECT: '飞书将联系方式设为必填或条件必填，本次无法留空；软件未改飞书配置或关闭必填检查',
  FEISHU_CONTACT_TIME_SCHEMA_UNSUPPORTED: '未找到唯一的建联时间日期字段，请核对飞书字段名称和类型',
  FEISHU_CONTACT_TIME_READBACK_MISMATCH: '建联时间未回读核实；若已返回工作项编号，请到飞书检查该记录，不要重复新建',
  FEISHU_RECORD_MODE_INVALID: '建档模式无效，请重新选择正式建档或AI测试',
  FEISHU_PRODUCTION_RECORD_PROTECTED: '正式记录不属于AI测试修改／清理范围；补录请使用“补录已有记录”',
  FEISHU_ENRICH_TARGET_MISSING: '未找到同小红书号、同经纪人的记录；可切换新建',
  FEISHU_ENRICH_TARGET_AMBIGUOUS: '同号同经纪人有多条记录，无法自动选定；请核对目标记录',
  FEISHU_ENRICH_IDENTITY_CHANGED: '目标记录的小红书号、平台或经纪人已变化，请重新选择',
  FEISHU_ENRICH_FIELDS_CHANGED: '将要补录的字段已被修改；请重新预览最新差异',
  FEISHU_ENRICH_PENDING: '该记录上次写入结果待核对；请先核对，避免重复写入',
  FEISHU_ENRICH_TEST_RECORD: '目标是AI测试记录，请使用测试操作入口',
  FEISHU_QUOTE_INVALID: '平台报价不是可核实的精确人民币价格，请核对；缺失不按零填写',
  FEISHU_QUOTE_SCHEMA_UNSUPPORTED: '平台价字段映射或类型尚未核实，未写入',
  FEISHU_CLEAR_UNSUPPORTED: '当前不支持清空字段；空值不会静默覆盖',
  FEISHU_REQUIRED_UNSUPPORTED: '存在尚未映射的必填字段，不能新建', FEISHU_LOCAL_CONFLICT: '本地已有不同值，未覆盖',
  FEISHU_LOCAL_CHANGED: '本地资料已改变，请重新预览', FEISHU_REMOTE_CHANGED: '飞书记录与清单基线不一致，暂停操作，请人工核对',
  FEISHU_ALREADY_SUBMITTED: '同号同经纪人已提交或结果未知，已阻止重复建档',
  FEISHU_DUPLICATE_MAINTAINER: '飞书已有同号同经纪人记录，跳过重复建档；未发送邀约',
  FEISHU_DUPLICATE_REVIEW_REQUIRED: '查重结果或维护人归属无法完整核实，未新建，请人工核对',
  FEISHU_NOT_OWNED: '只能处理本软件清单内已核实的新建记录',
  FEISHU_CLEANUP_BLOCKED: '记录的创建来源或初始状态无法核实，已禁止自动修改和清理；请管理员核对',
  FEISHU_MANUAL_CLEANUP_UNVERIFIED: '目标归属、已写字段或初始流程无法核实，不能人工清理',
  FEISHU_HISTORY_ARCHIVE_INVALID: '历史移除范围无效，请刷新清单',
  FEISHU_HISTORY_ARCHIVE_UNVERIFIED: '只能移除已核实删除的历史，不会删除飞书原记录',
  FEISHU_WRITE_SAFETY_REQUIRED: '请先确认测试清理和通知影响', FEISHU_CONTACT_INVALID: '联系方式类型或来源不符合条件',
  FEISHU_PREVIEW_EXPIRED: '预览已过期，请重新查询', FEISHU_FIELDS_INVALID: '字段格式不正确', FEISHU_OPTION_INVALID: '字段选项已失效' };
const cleanupReasons = { CREATE_ORIGIN_UNVERIFIED: '首次回读创建来源无法核实',
  INITIAL_WORKFLOW_UNVERIFIED: '首次回读初始流程状态无法核实', FIELD_SCHEMA_UNVERIFIED: '首次回读字段结构无法核实',
  ROLE_DEFAULT_UNVERIFIED: '首次回读角色默认值无法核实', FIELD_DEFAULT_UNVERIFIED: '首次回读字段默认值无法核实' };
const cleanupOriginReasons = { CREATOR_MISSING: '首次回读缺少创建人字段', CREATOR_INVALID: '首次回读创建人格式无效',
  CREATOR_MISMATCH: '首次回读创建人与本次创建身份不一致', UPDATER_MISSING: '首次回读缺少更新人字段',
  UPDATER_INVALID: '首次回读更新人格式无效', UPDATER_MISMATCH: '首次回读更新人与本次创建身份不一致',
  CREATED_AT_INVALID: '首次回读创建时间无效', UPDATED_AT_INVALID: '首次回读更新时间无效',
  TIMESTAMPS_REVERSED: '首次回读更新时间早于创建时间', TIMESTAMPS_UNEQUAL: '旧版本首次回读创建与更新时间不一致' };
const workflowInspectionReasons = { STATUS_MISSING: '缺少流程状态', STATUS_SHAPE: '流程状态格式无效',
  STATUS_EXTRA_FIELDS: '流程状态含未识别字段', STATE_KEY_INVALID: '流程状态标识无效',
  NOT_INITIAL: '流程不是初始状态', INITIAL_FLAG_MISSING: '缺少初始状态标记',
  ARCHIVED_OR_INVALID: '归档标记无效或已归档', ARCHIVE_FLAG_MISSING: '缺少归档标记',
  STATUS_TIME_INVALID: '流程更新时间缺失或无效', STATUS_ACTOR_MISMATCH: '流程更新人不一致',
  STATUS_ACTOR_MISSING: '缺少流程更新人', HISTORY_MISSING: '缺少流程历史',
  HISTORY_SHAPE: '流程历史格式无效', HISTORY_NONEMPTY: '流程历史非空' };
function safeCleanupDiagnostic(record) {
  if (record?.cleanupBlocked !== true || typeof record.cleanupDiagnostic !== 'string'
    || !Object.hasOwn(cleanupReasons, record.cleanupDiagnostic)) return {};
  return { cleanupDiagnostic: record.cleanupDiagnostic,
    ...(record.cleanupDiagnostic === 'CREATE_ORIGIN_UNVERIFIED' && typeof record.cleanupOriginDiagnostic === 'string'
      && Object.hasOwn(cleanupOriginReasons, record.cleanupOriginDiagnostic)
      ? { cleanupOriginDiagnostic: record.cleanupOriginDiagnostic } : {}) };
}
function copyCleanupDiagnostics(destination, source) {
  const diagnostic = safeCleanupDiagnostic(source);
  delete destination.cleanupDiagnostic; delete destination.cleanupOriginDiagnostic;
  Object.assign(destination, diagnostic);
}
function cleanupDiagnosticText(record, current = false) {
  const diagnostic = safeCleanupDiagnostic(record);
  const context = text => current ? text.replace(/^首次回读/, '当前检查') : text;
  return diagnostic.cleanupDiagnostic ? `；${current ? '当前检查原因' : '清理保护原因'}：${context(cleanupReasons[diagnostic.cleanupDiagnostic])}`
    + (diagnostic.cleanupOriginDiagnostic ? `；来源核对：${context(cleanupOriginReasons[diagnostic.cleanupOriginDiagnostic])}` : '') : '';
}
const dedupReasons = { RESPONSE_SHAPE: '查询响应结构不完整', PAGE_NUMBER: '页码不一致', PAGE_SIZE: '分页大小不一致',
  TOTAL_INVALID: '总数不可核实', TOTAL_CHANGED: '查询总数发生变化', PAGE_LENGTH: '分页记录不完整',
  RECORD_ID_INVALID: '记录标识无效', RECORD_ID_REPEATED: '分页重复返回记录', SCOPE_MISMATCH: '记录目标范围不一致',
  DELETED: '查询包含已删除记录', FIELDS_SHAPE: '字段列表不完整', FIELD_KEY_INVALID: '字段标识无效',
  FIELD_KEY_DUPLICATE: '重复字段', ACCOUNT_MISMATCH: '主页小红书号不一致', PLATFORM_MISMATCH: '平台不一致',
  ROLE_FIELD_MISSING: '缺少角色归属字段', ROLE_TYPE_MISSING: '缺少角色字段类型', ROLE_TYPE_UNEXPECTED: '角色字段类型不一致',
  ROLE_VALUE_NOT_ARRAY: '角色归属列表格式不正确', ROLE_ID_INVALID: '角色标识无效', ROLE_ID_DUPLICATE: '角色重复',
  TARGET_OWNERS_MISSING: '缺少维护人列表', TARGET_OWNERS_NULL: '维护人列表为空值',
  TARGET_OWNERS_NOT_ARRAY: '维护人列表格式不正确', TARGET_OWNERS_INVALID_ELEMENT: '维护人标识无效',
  OTHER_OWNERS_MISSING: '其他角色缺少人员列表', OTHER_OWNERS_NULL: '其他角色人员列表为空值',
  OTHER_OWNERS_NOT_ARRAY: '其他角色人员列表格式不正确', OTHER_OWNERS_INVALID_ELEMENT: '其他角色人员标识无效',
  TARGET_ROLE_MISSING: '缺少现维护经纪人角色', TARGET_OWNERS_EMPTY: '现维护经纪人未分配',
  TARGET_OWNERS_DUPLICATE: '维护人列表重复' };
function dedupDiagnostic(r) {
  const d = r?.dedupReview;
  if (r?.code !== 'FEISHU_DUPLICATE_REVIEW_REQUIRED' || !d || !Object.hasOwn(dedupReasons, d.reason)
    || !Number.isInteger(d.pageOrdinal) || d.pageOrdinal < 1 || d.pageOrdinal > 20
    || (d.recordOrdinal != null && (!Number.isInteger(d.recordOrdinal) || d.recordOrdinal < 1 || d.recordOrdinal > 50))) return '';
  return `；查询第${d.pageOrdinal}页${d.recordOrdinal != null ? `第${d.recordOrdinal}条` : ''}：${dedupReasons[d.reason]} [${d.reason}]`;
}
const failure = (r, reset = true) => {
  if (reset && r?.code === 'FEISHU_SESSION_EXPIRED') {
    connection = { connected: false, fields: [], target: '' }; lookup = null; plan = null; records = [];
    resetMaintainer(); batch = null;
  }
  if (reset && operatorFailures.includes(r?.code)) {
    invalidateOperator(errors[r.code]);
  }
  const stage = ({ maintainer_search: '经纪人姓名查询', maintainer_roles: '经纪人角色查询',
    connection_config: '校验连接配置', connection_auth: '认证插件凭证',
    connection_metadata: '读取项目字段', connection_storage: '保存本机连接' })[r?.stage];
  const labels = { pluginId: 'Plugin ID', pluginSecret: 'Plugin Secret', projectKey: '项目 Key',
    workItemTypeKey: '工作项 Key', userKey: '操作人 User Key' };
  const fields = r?.code === 'FEISHU_CONFIG_INVALID' && r?.stage === 'connection_config'
    && Array.isArray(r.configFields) && r.configFields.length > 0 && r.configFields.length <= 5
    && r.configFields.every(field => typeof field === 'string' && Object.hasOwn(labels, field))
    && new Set(r.configFields).size === r.configFields.length ? `；请检查：${r.configFields.map(field => labels[field]).join('、')}` : '';
  const http = Number.isInteger(r?.status) && r.status >= 100 && r.status <= 599 ? ` / HTTP ${r.status}` : '';
  const api = Number.isSafeInteger(r?.apiCode) ? ` / API ${r.apiCode}` : '';
  return `${stage ? `${stage}：` : ''}${errors[r?.code] || '操作未完成'} (${r?.code || 'FEISHU_OPERATION_FAILED'}${http}${api})${fields}${dedupDiagnostic(r)}${r?.code === 'FEISHU_CLEANUP_BLOCKED' ? cleanupDiagnosticText(r) : ''}${r?.status === 'unknown' ? '；结果未知，禁止自动重试' : ''}`;
};

function el(tag, className, value) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (value !== undefined) e.textContent = value;
  return e;
}
function readingDetails(kind, className, summaryText, defaultOpen) {
  const target = connection.target;
  if (!readingState.has(target)) readingState.set(target, {});
  const state = readingState.get(target);
  const section = el('details', className);
  section.open = state[kind] ?? defaultOpen;
  state[kind] = section.open;
  currentReadingDetails.set(kind, section);
  const current = () => currentReadingDetails.get(kind) === section && connection.target === target;
  section.addEventListener('toggle', () => { if (current()) state[kind] = section.open; });
  const summary = el('summary', kind === 'history' ? 'feishu-section-title' : '', summaryText);
  summary.addEventListener('click', event => {
    event.preventDefault();
    if (!current()) return;
    section.open = !section.open; state[kind] = section.open;
  });
  section.append(summary);
  return section;
}
function field(label, input) {
  if (!input.hasAttribute('aria-label')) input.setAttribute('aria-label', label);
  const l = el('label', 'feishu-field'); l.append(el('span', '', label), input); return l;
}
function input(value, onInput, type = 'text') {
  const i = el('input', 'tpl-input'); i.type = type; i.value = String(value ?? '');
  i.disabled = busy; i.autocomplete = 'off'; i.addEventListener('input', () => onInput(i.value)); return i;
}
function check(label, value, onChange) {
  const c = input('', () => {}, 'checkbox'); c.checked = value;
  c.className = '';
  c.addEventListener('change', () => onChange(c.checked)); const l = el('label', 'feishu-check'); l.append(c, document.createTextNode(label)); return l;
}
function button(label, handler, disabled = false, primary = false) {
  const b = el('button', primary ? 'btn primary' : 'btn ghost', label); b.type = 'button'; b.disabled = disabled || busy;
  b.addEventListener('click', handler); return b;
}
function contactDraft(row) {
  return [row?.wechatId ? `微信：${row.wechatId}` : '', row?.email ? `邮箱：${row.email}` : '',
    row?.phone ? `手机：${row.phone}` : '', typeof row?.contactRaw === 'string' ? row.contactRaw : '']
    .filter(Boolean).join('\n');
}
function fillDraft(row) {
  draft = {};
  for (const f of connection.fields) {
    draft[f.key] = ({ '账号昵称': row?.creatorName, '小红书ID': accountNumber,
      '联系方式': contactDraft(row),
      '后台链接': row?.creatorUrl, '平台链接': row?.xhsProfileSourceCreatorUrl ? row?.xhsProfileUrl : '',
      '图文平台价': row?.imagePrice, '视频平台价': row?.videoPrice,
      '所在城市': row?.region, '其他备注': row?.note })[f.name] ?? '';
    if (f.name === '平台') draft[f.key] = f.options.find(o => o.label === '小红书')?.value || '';
  }
  checkedFields = new Set();
  plan = null;
}

export function renderFeishuWorkbench(ctx) {
  currentContactRows = ctx.rows;
  currentReadingDetails.clear();
  if (cloudExpiryTimer != null) { clearTimeout(cloudExpiryTimer); cloudExpiryTimer = null; }
  if (operatorExpiryTimer != null) { clearTimeout(operatorExpiryTimer); operatorExpiryTimer = null; }
  if (currentRun !== ctx.runDir) {
    const changedRun = !!currentRun;
    currentRun = ctx.runDir; currentRow = ''; epoch++; lookup = null; plan = null; records = [];
    accountNumber = ''; accountConfirmed = false; safetyConfirmed = false;
    recordId = ''; ownedAbsenceNotice = null; draft = {}; checkedFields = new Set(); action = 'create';
    singleOpen = null; currentWriteDetails = null;
    if (selectedMaintainer) {
      maintainerRevision++; operator = null; operatorLease = null; operatorInvalidReason = '';
      plan = null; invalidateCloud('当前任务已切换，旧预览不可使用');
    } else resetMaintainer(changedRun ? '当前任务已切换，旧预览不可使用' : '经纪人归属待确认');
    batch = null; cloud = null;
  }
  expireOperatorIfNeeded();
  const root = el('section', 'feishu-workbench');
  root.dataset.testid = 'feishu-workbench';
  const head = el('div', 'feishu-heading');
  head.append(el('h3', '', '飞书项目'), el('span', `feishu-badge${connection.connected ? ' connected' : ''}`, connection.connected ? '已连接' : '未连接'));
  root.append(head);
  const status = el('div', `feishu-status${/FEISHU_|失败|未知/.test(message) ? ' is-error' : ''}`, `最近操作：${message}`); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  root.append(status);
  const api = window.desktopAPI.feishu;
  if (!api) { status.textContent = '当前版本未接入飞书，请使用更新后的主软件'; return root; }
  const selected = ctx.rows.find(r => r.rowId === currentRow);
  const valid = (run, row, e) => currentRun === run && currentRow === row && epoch === e;
  let updateCloudInvalidation = () => {};
  async function run(fn, { requireSave = false, pendingMessage = '处理中…' } = {}) {
    if (busy) return;
    const runDir = currentRun, rowId = currentRow, e = epoch;
    busy = true; message = pendingMessage; ctx.rerender();
    try {
      if (requireSave) {
        const saved = await ctx.save();
        if (!saved?.ok) throw new Error('SAVE_FAILED');
      }
      if (!valid(runDir, rowId, e)) return;
      await fn({ runDir, rowId, e });
    } catch (_) { if (valid(runDir, rowId, e)) message = '操作失败，请核对连接或本地保存状态'; }
    finally { busy = false; ctx.rerender(); }
  }
  function bindInspection(r, wallStart, monoStart) {
    operator = r?.ok ? Object.freeze({ ...r }) : null;
    operatorLease = operator ? { operator, checkedAt: r.checkedAt, remainingMs: r.remainingLeaseMs,
      wallStart, monoStart, monoLast: monoStart } : null;
    operatorInvalidReason = '';
    expireOperatorIfNeeded();
  }
  async function ensureOperatorFresh(scope) {
    if (!maintainerReady()) return operatorReady() && operatorConfirmed;
    if (!operatorConfirmed) return false;
    const choice = selectedMaintainer, revision = maintainerRevision, target = connection.target;
    const wallStart = Date.now(), monoStart = monotonicNow();
    const r = await api.refreshOperator({ choiceToken: choice.token });
    if (!valid(scope.runDir, scope.rowId, scope.e) || configDirty || selectedMaintainer !== choice
      || maintainerRevision !== revision || connection.target !== target || !operatorConfirmed) return false;
    if (!r?.ok || r.choice?.token !== choice.token || r.choice?.target !== target || r.name !== choice.name) {
      invalidateOperator(r?.ok ? errors.FEISHU_OPERATOR_CHANGED : failure(r));
      message = operatorInvalidReason; return false;
    }
    bindInspection(r, wallStart, monoStart);
    // Main rotates authority and revokes all plans, not just this surface's plan.
    plan = null;
    if (cloud) {
      for (const item of cloud.items) {
        item.plan = null;
        if (['verified', 'unknown', 'creating'].includes(item.status)) continue;
        item.status = 'idle'; item.error = null; item.draftStamp = ''; item.operationOwner = '';
      }
      cloud.progress = 0; cloud.total = 0;
    }
    return operatorReady();
  }

  function acceptConnection(r) {
    savedConnection = r?.saved === true;
    connection = r?.ok && r.connected ? { connected: true, fields: r.fields || [], target: r.target }
      : { connected: false, fields: [], target: '' };
    if (r?.config) config = { ...config, ...r.config, userKey: '' };
    resetMaintainer('连接已刷新，旧预览不可使用'); configDirty = false; lookup = null; plan = null; ownedAbsenceNotice = null; records = []; batch = null; cloud = null;
    if (connection.connected && r.maintainer && r.maintainer.target === connection.target
      && typeof r.maintainer.token === 'string' && typeof r.maintainer.name === 'string') {
      selectedMaintainer = Object.freeze({ ...r.maintainer }); maintainerName = r.maintainer.name;
    }
    if (connection.connected) fillDraft(ctx.rows.find(row => row.rowId === currentRow));
    message = r?.ok ? (r.connected ? `连接成功，已读取 ${r.fieldCount} 个字段；${savedConnection ? '已在本机安全保存' : '本次会话连接'}；未执行写入`
      : savedConnection ? '已保存连接，自动连接已暂停' : '尚未保存连接') : failure(r);
    if (r?.maintainerNotice) message += `；${errors[r.maintainerNotice] || '经纪人选择需重新核对'}`;
  }
  function suspendConnectionView() {
    epoch++;
    acceptConnection({ ok: true, connected: false, saved: savedConnection });
    safetyConfirmed = false; config.userKey = '';
  }
  async function refreshRecords(isCurrent = () => true) {
    if (!api.listRecords || !connection.connected) return;
    const activeConnection = connection;
    const response = await api.listRecords();
    if (connection !== activeConnection || !isCurrent()) return;
    if (response?.ok) {
      records = response.records.map(record => ({ ...record, target: record.target || connection.target }));
      for (const record of records.filter(r => r.status === 'deleted')) acceptReconciliation(record.entryId, record);
      if (recordId && !records.some(r => r.recordId === recordId && r.target === connection.target && r.status === 'verified')) {
        recordId = ''; plan = null; checkedFields = new Set();
      }
    }
    else message = failure(response, false);
    return response;
  }
  const sameSubmission = (submission, record) => {
    const target = record.target || connection.target;
    if (submission.target !== target) return false;
    const entry = submission.result?.entryId || submission.entryId;
    const id = submission.result?.recordId || submission.recordId;
    if ((entry && record.entryId && entry !== record.entryId)
      || (id && record.recordId && id !== record.recordId)) return false;
    if ((entry && record.entryId) || (id && record.recordId)) return true;
    // Label recovery cannot replace a known identity or resolve ambiguous submissions.
    if (entry || id || !['unknown', 'creating'].includes(submission.status) || !record.name || !record.batch) return false;
    const sameLabel = value => (value.target || connection.target) === target
      && value.name === record.name && value.batch === record.batch;
    if (!sameLabel(submission) || (submission.account && record.accountNumber && submission.account !== record.accountNumber)) return false;
    return records.filter(sameLabel).length === 1 && cloudHistory.filter(value => sameLabel(value)
      && !value.result?.entryId && !value.entryId && !value.result?.recordId && !value.recordId).length === 1;
  };
  function acceptReconciliation(entryId, reviewed, submission) {
    const record = records.find(r => r.entryId === entryId);
    const target = record?.target || submission?.target || connection.target;
    if ((reviewed.entryId && reviewed.entryId !== entryId)
      || (record?.recordId && reviewed.recordId && record.recordId !== reviewed.recordId)
      || (submission?.result?.recordId && reviewed.recordId && submission.result.recordId !== reviewed.recordId)
      || (record?.target && submission?.target && record.target !== submission.target)
      || (reviewed.target && reviewed.target !== target)) return false;
    const identity = { target,
      name: record?.name || submission?.name, batch: record?.batch || submission?.batch, entryId,
      recordId: reviewed.recordId || record?.recordId, accountNumber: record?.accountNumber || submission?.account };
    const matching = cloudHistory.filter(h => sameSubmission(h, identity));
    if (!record && !matching.length && (!submission || !sameSubmission(submission, identity))) return false;
    if (record) {
      record.status = reviewed.status;
      if (reviewed.recordId) record.recordId = reviewed.recordId;
      if (reviewed.externalAbsenceVerified === true) record.externalAbsenceVerified = true;
      if (typeof reviewed.cleanupBlocked === 'boolean') copyCleanupDiagnostics(record, reviewed);
    }
    for (const prior of matching) {
      prior.status = reviewed.status; prior.result = { ...prior.result, ...reviewed, entryId };
      copyCleanupDiagnostics(prior.result, prior.result);
      if (typeof reviewed.cleanupBlocked === 'boolean') copyCleanupDiagnostics(prior, reviewed);
      if (reviewed.externalAbsenceVerified === true) prior.externalAbsenceVerified = true;
      if (prior.item?.submission === prior) {
        prior.item.status = reviewed.status; prior.item.result = prior.result; prior.item.error = null;
      }
    }
    return true;
  }
  if (!initialRestoreStarted && api.restoreConnection) {
    initialRestoreStarted = true;
    // Restore only authentication and metadata, never a business operation.
    void run(async () => { acceptConnection(await api.restoreConnection()); await refreshRecords(); });
  }

  const settings = readingDetails('settings', 'feishu-settings', connection.connected ? '连接设置' : '连接飞书项目', !connection.connected && !savedConnection);
  const configGrid = el('div', 'feishu-grid');
  for (const [k, label] of [['pluginId', 'Plugin ID'], ['projectKey', '项目 Key'], ['workItemTypeKey', '工作项 Key'], ['userKey', '操作人 User Key']]) {
    configGrid.append(field(label, input(config[k], v => {
      config[k] = v; configDirty = true; resetMaintainer('连接设置已更改，旧预览已失效');
      updateCloudInvalidation();
      batch = null;
      const preview = root.querySelector('.feishu-write-preview'); if (preview) preview.remove();
      const operatorSection = root.querySelector('[data-operator]');
      if (operatorSection) operatorSection.textContent = '连接设置已更改，尚未应用；请重新连接后选择经纪人';
      const prepare = root.querySelector('[data-prepare]'); if (prepare && action === 'create') prepare.disabled = true;
      const absence = root.querySelector('[data-owned-absence]'); if (absence) absence.disabled = true;
    })));
  }
  const secret = input('', () => {}, 'password'); secret.setAttribute('aria-label', 'Plugin Secret');
  configGrid.append(field('Plugin Secret（更新连接时填写）', secret)); settings.append(configGrid);
  settings.append(check('在本机记住连接', rememberConnection, value => { rememberConnection = value; }));
  settings.append(button('连接并读取字段', () => {
    const payload = { ...config, pluginSecret: secret.value, rememberConnection }; secret.value = '';
    void run(async ({ runDir, rowId, e }) => {
      const r = await api.connect(payload); payload.pluginSecret = '';
      if (!valid(runDir, rowId, e)) return;
      acceptConnection(r?.ok ? { ...r, connected: true } : r);
      await refreshRecords();
    }, { pendingMessage: '正在连接飞书，校验配置并读取项目字段…' });
  }, false, true));
  settings.append(button('断开连接', () => { void run(async () => {
    suspendConnectionView();
    let r;
    try { r = api.disconnect ? await api.disconnect() : await api.clear(); }
    catch (_) { message = '断开结果未核实，操作已暂停；请检查连接后再使用'; return; }
    if (r?.ok !== true) {
      message = r?.sessionRevoked === true
        ? `已断开；本机自动连接设置保存未完成，重启后可能恢复连接；${failure(r, false)}`
        : '断开结果未核实，操作已暂停；请检查连接后再使用';
      return;
    }
    message = savedConnection ? '已断开；本机连接保留，自动连接已暂停' : '已断开，凭证已从本次会话清除';
  }); }, !connection.connected)); root.append(settings);
  if (savedConnection) {
    const savedActions = el('div', 'feishu-actions');
    savedActions.append(el('span', 'feishu-badge', '已保存本机连接'));
    if (!connection.connected) savedActions.append(button('使用已保存连接', () => void run(async () => {
      acceptConnection(await api.restoreConnection({ manual: true })); await refreshRecords();
    }), false, true));
    savedActions.append(button('忘记本机连接', () => {
      if (!confirm('删除这台电脑保存的飞书连接？下次连接需要重新填写。采集资料、浏览器登录和模板不会删除。')) return;
      void run(async () => {
        suspendConnectionView();
        let r;
        try { r = await api.forgetConnection(); }
        catch (_) { message = '忘记连接结果未核实，操作已暂停；请核对本机保存状态'; return; }
        if (r?.ok !== true) {
          message = r?.sessionRevoked === true
            ? `已断开；忘记本机连接未完成，请核对保存状态；${failure(r, false)}`
            : '忘记连接结果未核实，操作已暂停；请核对本机保存状态';
          return;
        }
        acceptConnection({ ok: true, connected: false, saved: false });
        config = { pluginId: '', projectKey: '', workItemTypeKey: '', userKey: '' };
        message = '已忘记本机连接；采集资料、浏览器登录和模板未改变';
      });
    }));
    root.append(savedActions);
  }
  if (!connection.connected) return root;

  const connectionActions = el('div', 'feishu-actions');
  connectionActions.append(button('检查连接', () => void run(async () => {
    const r = await api.status();
    if (!r?.ok) { message = failure(r); return; }
    if (!r.connected) { message = failure({ code: 'FEISHU_SESSION_EXPIRED' }); return; }
    message = '连接有效；未执行写入';
  })));
  root.append(connectionActions);
  const creationMode = el('select', 'tpl-input'); creationMode.disabled = busy;
  creationMode.setAttribute('aria-label', '建档模式');
  creationMode.append(new Option('正式建档', 'production'), new Option('AI测试', 'test'));
  creationMode.value = recordMode;
  creationMode.addEventListener('change', () => {
    if (busy || !['test', 'production'].includes(creationMode.value)) return;
    recordMode = creationMode.value;
    if (cloudAction !== 'create') cloud = null;
    cloudAction = 'create'; epoch++; plan = null; manualCleanupApproval = null; safetyConfirmed = false;
    invalidateCloud('建档模式已更改，请重新预览并确认'); ctx.rerender();
  });
  root.append(field('建档模式', creationMode));
  renderMaintainer();
  const approvalMode = recordMode, approvalEpoch = epoch;
  root.append(check(recordMode === 'test' ? '已确认测试记录可清理，允许飞书新建通知；不发送邀约、不推进流程'
    : '已核对正式新建／补录及通知影响；不发送邀约、不推进流程', safetyConfirmed,
    v => {
      if (approvalEpoch !== epoch || approvalMode !== recordMode) return;
      maintainerRevision++; safetyConfirmed = v; plan = null;
      if (!v) invalidateCloud('写入确认已撤销，旧预览已失效'); ctx.rerender();
    }));
  renderCloudBatch();
  renderCloudHistory();
  root.append(el('h4', 'feishu-section-title', '团队库回补'));

  function renderCloudBatch() {
    const operation = cloudAction, enriching = operation === 'enrich';
    const operationLabel = enriching ? '补录' : '建档';
    // Review-only flags do not alter the payload or revoke a cloud preview.
    const rowStamp = row => JSON.stringify([row.rowId, row.creatorName, row.creatorUrl,
      row.xhsId, row.feishuAccountNumber, contactDraft(row), row.imagePrice, row.videoPrice,
      row.region, row.xhsProfileUrl, row.xhsProfileSourceCreatorUrl]);
    const sourceIdentity = row => JSON.stringify([row.creatorName, row.creatorUrl, row.xhsId, row.feishuAccountNumber]);
    const itemFor = row => ({ rowId: row.rowId, creatorName: row.creatorName, selected: row.selected === true,
      account: typeof (row.feishuAccountNumber || row.xhsId) === 'string' ? row.feishuAccountNumber || row.xhsId : '', contact: contactDraft(row),
      image: String(row.imagePrice ?? ''), video: String(row.videoPrice ?? ''), rowStamp: rowStamp(row), sourceIdentity: sourceIdentity(row),
      status: 'idle', plan: null, result: null, entryId: '', operationOwner: '' });
    if (!cloud) cloud = { items: ctx.rows.map(itemFor), confirmed: false, revision: 0,
      phase: 'idle', operation: '', progress: 0, total: 0, source: '', note: '', search: '', scrollTop: 0, scrollLeft: 0 };
    const c = cloud;
    const old = new Map(c.items.map(i => [i.rowId, i]));
    if (ctx.rows.length !== c.items.length || ctx.rows.some(r => !old.has(r.rowId))) invalidateCloud();
    c.items = ctx.rows.map(row => {
      const item = old.get(row.rowId);
      if (!item) return itemFor(row);
      if (item.rowStamp !== rowStamp(row)) {
        invalidateCloud();
        const identityChanged = item.sourceIdentity !== sourceIdentity(row);
        if (identityChanged) return { ...itemFor(row), selected: item.selected };
        // Unknown submissions retain their exact attempted payload for reconciliation.
        if (item.status !== 'unknown' && item.status !== 'creating') {
          const fresh = itemFor(row);
          for (const key of ['account', 'contact', 'image', 'video']) {
            if (!item.editedFields?.[key]) item[key] = fresh[key];
          }
        }
        item.rowStamp = rowStamp(row);
      }
      return item;
    });
    if (c.items.some(i => i.plan && i.plan.expiresAt <= Date.now())) {
      invalidateCloud('预览已过期，请重新查重并预览；未继续写入');
    }
    const sourceField = connection.fields.find(f => f.name === '达人资源来源');
    if (!c.source) c.source = sourceField?.options.find(o => ['主动搜索达人资源', '主动搜索'].includes(o.label))?.value || '';
    const section = el('section', 'feishu-cloud'); section.dataset.testid = 'feishu-cloud';
    section.append(el('h4', 'feishu-section-title', enriching ? '批量补录到飞书' : '批量建档到飞书'));
    const operationSelect = el('select', 'tpl-input'); operationSelect.disabled = busy;
    operationSelect.setAttribute('aria-label', '飞书批量操作');
    operationSelect.append(new Option('新建记录', 'create'));
    if (recordMode === 'production') operationSelect.append(new Option('补录已有记录', 'enrich'));
    operationSelect.value = operation;
    operationSelect.addEventListener('change', () => {
      if (busy || !['create', 'enrich'].includes(operationSelect.value)
        || (operationSelect.value === 'enrich' && recordMode !== 'production')) return;
      cloudAction = operationSelect.value; invalidateCloud(); cloud = null; epoch++;
      message = '操作已切换，请预览选中行'; ctx.rerender();
    });
    section.append(field('本批操作', operationSelect));
    const controls = el('div', 'feishu-grid');
    if (sourceField && !enriching) {
      const source = el('select', 'tpl-input'); source.disabled = busy;
      source.append(new Option('请选择', ''));
      for (const option of sourceField.options) source.append(new Option(option.label, option.value));
      source.value = c.source;
      source.addEventListener('change', () => { c.source = source.value; invalidateCloud(); ctx.rerender(); });
      controls.append(field('本批达人资源来源', source));
    }
    if (!enriching) controls.append(field('本批备注', input(c.note, v => {
      c.note = v; invalidateCloud(); identity.children[0].checked = false;
      updateCloudInvalidation();
      const submit = section.querySelector('[data-cloud-submit]'); if (submit) submit.disabled = true;
      const prepare = section.querySelector('[data-cloud-prepare]'); if (prepare) prepare.disabled = true;
    })));
    section.append(controls);
    const quoteSchema = el('div', 'feishu-cloud-progress');
    for (const name of ['图文平台价', '视频平台价']) {
      const fields = connection.fields.filter(f => f.name === name);
      quoteSchema.append(el('div', '', `${name}：${fields.length === 1 && ['number', 'text'].includes(fields[0].type)
        ? fields[0].type === 'number' ? '数值字段 · 人民币元' : '文本字段 · 人民币元' : '映射待核对'}`));
    }
    section.append(quoteSchema);
    const timeFields = connection.fields.filter(f => f.generated === 'contact_time');
    if (timeFields.length === 1 && !enriching) section.append(el('div', 'feishu-cloud-progress', `${timeFields[0].name}：提交时自动填写当前时间`));
    const toolbar = el('div', 'feishu-actions');
    const changeSelection = fn => {
      if (busy) return;
      for (const item of c.items) item.selected = fn(item);
      invalidateCloud(); message = '批量建档：名单已更改，请重新核对并预览'; ctx.rerender();
    };
    toolbar.append(button('使用建联名单', () => changeSelection(i => ctx.rows.find(r => r.rowId === i.rowId)?.selected === true)),
      button('全选建档名单', () => changeSelection(() => true)), button('清空建档勾选', () => changeSelection(() => false)));
    section.append(toolbar);
    const search = input(c.search, v => {
      const caret = search.selectionStart; c.search = v; ctx.rerender();
      requestAnimationFrame(() => {
        const current = document.querySelector('[data-cloud-search]');
        current?.focus({ preventScroll: true }); current?.setSelectionRange(caret, caret);
      });
    });
    search.dataset.cloudSearch = 'true'; section.append(field('搜索建档名单', search));
    const selected = c.items.filter(i => i.selected);
    const labels = { idle: '未预览', preparing: '正在查重', ready: '可新建', duplicate: '重复跳过',
      creating: '正在写入', verified: '成功 · 已回读', unchanged: '已是最新 · 无需写入', unknown: '结果待核对 · 禁止重发', failed: '未完成' };
    const list = el('div', 'feishu-cloud-list'); list.setAttribute('aria-label', '飞书建档名单');
    list.addEventListener('scroll', () => { c.scrollTop = list.scrollTop; c.scrollLeft = list.scrollLeft; });
    const table = el('table', 'feishu-cloud-table'), header = el('tr', '');
    for (const name of ['勾选 / 达人', '小红书号', '联系方式', '图文平台价（元）', '视频平台价（元）', '处理结果']) header.append(el('th', '', name));
    const thead = el('thead', ''); thead.append(header); table.append(thead);
    const body = el('tbody', '');
    const resultCells = [];
    for (const item of c.items.filter(i => !c.search || `${i.creatorName} ${i.account}`.includes(c.search.trim()))) {
      const tr = el('tr', ''), name = el('td', '');
      name.append(check(`建档 · ${item.creatorName || item.rowId}`, item.selected, v => {
        if (busy) return;
        item.selected = v; invalidateCloud(); ctx.rerender();
      })); tr.append(name);
      for (const [key, label] of [['account', '建档小红书号'], ['contact', '建档联系方式'], ['image', '图文平台价'], ['video', '视频平台价']]) {
        const cell = el('td', '');
        const control = input(item[key], v => {
          item[key] = v; item.editedFields = { ...item.editedFields, [key]: true }; invalidateCloud();
          updateCloudInvalidation();
          identity.children[0].checked = false;
          result.textContent = '资料已改，需重新预览';
          const submit = section.querySelector('[data-cloud-submit]'); if (submit) submit.disabled = true;
          const prepare = section.querySelector('[data-cloud-prepare]'); if (prepare) prepare.disabled = true;
        });
        control.setAttribute('aria-label', `${label} · ${item.creatorName || item.rowId}`);
        control.disabled = busy || item.status === 'unknown'; cell.append(control); tr.append(cell);
      }
      const result = el('td', `feishu-cloud-result ${item.status}`);
      resultCells.push({ item, cell: result });
      result.append(el('strong', '', labels[item.status] || item.status));
      if (item.operationOwner) result.append(el('div', '', `记录归属：${item.operationOwner}`));
      if (item.result?.recordId) result.append(el('div', '', `工作项 ${item.result.recordId}`));
      if (item.error) result.append(el('div', '', failure(item.error, false)));
      if (item.plan) {
        if (enriching) {
          result.append(el('div', '', `目标工作项 ${item.plan.recordId}`));
          for (const p of item.plan.fields || []) result.append(el('div', '',
            `${connection.fields.find(f => f.key === p.field_key)?.name || p.field_key}：${p.before || '空'} → ${p.field_value}`));
        }
        for (const quote of ['图文平台价', '视频平台价']) {
          const descriptor = connection.fields.find(f => f.name === quote);
          const value = item.plan.fields?.find(f => f.field_key === descriptor?.key)?.field_value;
          if (value != null) result.append(el('div', '', `${quote}：${value} 元`));
        }
      }
      if (item.status === 'unknown') result.append(button('核对该行结果', () => void run(async ({ runDir, rowId, e }) => {
        const activeConnection = connection;
        const source = item.submission || item.attempt || {};
        const submission = { ...source, target: source.target || activeConnection.target, status: 'unknown',
          account: source.account || item.account, result: { ...item.result } };
        const current = () => valid(runDir, rowId, e) && connection === activeConnection && cloud === c && !configDirty;
        if (!current() || submission.target !== activeConnection.target) return;
        let entryId = item.result?.entryId;
        if (!entryId) {
          const response = await api.listRecords();
          if (!current()) return;
          const available = response?.ok && Array.isArray(response.records) ? response.records : [];
          const matches = available.filter(r => (r.target || activeConnection.target) === submission.target
            && r.name === submission.name && r.batch === submission.batch
            && (!r.accountNumber || !submission.account || r.accountNumber === submission.account)
            && (!r.recordId || !submission.result?.recordId || r.recordId === submission.result.recordId));
          if (matches.length !== 1) { item.error = response?.ok ? { code: 'FEISHU_RECONCILE_UNCERTAIN' } : response; return; }
          records = available.map(r => ({ ...r, target: r.target || activeConnection.target }));
          entryId = matches[0].entryId;
        }
        const reviewed = await api.reconcile({ entryId });
        if (!current()) return;
        const accepted = reviewed?.ok && acceptReconciliation(entryId, reviewed, submission);
        item.error = accepted ? null : reviewed?.ok ? { code: 'FEISHU_RECONCILE_UNCERTAIN' } : reviewed;
        if (accepted && reviewed.status === 'verified') {
          item.status = 'verified'; item.result = { ...item.result, ...reviewed, entryId };
        }
        message = accepted && reviewed.status === 'verified' ? `建档结果已核对 · 工作项 ${reviewed.recordId}`
          : failure(item.error || { code: 'FEISHU_RECONCILE_UNCERTAIN' }, false);
      })));
      tr.append(result); body.append(tr);
    }
    table.append(body); list.append(table); section.append(list);
    if (enriching && selected.some(i => i.plan)) {
      const deltas = el('div', 'feishu-enrichment-deltas');
      deltas.append(el('h4', 'feishu-section-title', '本次补录差异'));
      for (const item of selected.filter(i => i.plan)) {
        const row = el('div', 'feishu-contact-preview');
        row.append(el('strong', '', `${item.creatorName} · 工作项 ${item.plan.recordId}`));
        for (const p of item.plan.fields || []) {
          const delta = el('div', '', `${connection.fields.find(f => f.key === p.field_key)?.name || p.field_key}：${p.before || '空'} → ${p.field_value}`);
          delta.style.whiteSpace = 'pre-wrap'; delta.style.overflowWrap = 'anywhere'; row.append(delta);
        }
        deltas.append(row);
      }
      section.append(deltas);
    }
    requestAnimationFrame(() => { list.scrollTop = c.scrollTop; list.scrollLeft = c.scrollLeft; });
    const valuesFor = item => Object.fromEntries(connection.fields.filter(f => !f.generated).map(f => [f.key,
      ({ '账号昵称': item.creatorName, '小红书ID': item.account.trim(), '联系方式': item.contact,
        '图文平台价': item.image, '视频平台价': item.video,
        '平台': f.options?.find(o => o.label === '小红书')?.value || '', '达人资源来源': c.source,
        '所在城市': ctx.rows.find(r => r.rowId === item.rowId)?.region || '',
        '后台链接': ctx.rows.find(r => r.rowId === item.rowId)?.creatorUrl || '',
        '平台链接': ctx.rows.find(r => r.rowId === item.rowId)?.xhsProfileSourceCreatorUrl
          ? ctx.rows.find(r => r.rowId === item.rowId)?.xhsProfileUrl || '' : '', '其他备注': c.note })[f.name] ?? '' ]));
    const identity = check('已核对建档名单的小红书号与达人对应关系', c.confirmed, v => { c.confirmed = v; ctx.rerender(); });
    section.append(identity);
    const ready = selected.filter(i => i.status === 'ready' && i.plan && i.draftStamp === JSON.stringify(valuesFor(i)));
    const renderedRevision = c.revision;
    const renderedOperator = operator;
    const allowed = (execute = false) => cloud === c && c.revision === renderedRevision && !configDirty && (!execute || safetyConfirmed)
      && (execute ? operator === renderedOperator && operatorReady() : preparationReady()) && operatorConfirmed && c.confirmed
      && selected.length > 0 && selected.length <= batchLimit && selected.every(i => i.selected && c.items.includes(i))
      && selected.length === c.items.filter(i => i.selected).length;
    const halt = r => r?.status === 'unknown' || [401, 403, 429].includes(r?.status)
      || ['FEISHU_SESSION_EXPIRED', 'FEISHU_API_ERROR', 'FEISHU_HTTP_ERROR', 'FEISHU_REQUEST_TIMEOUT', 'FEISHU_OPERATION_FAILED',
        'FEISHU_OPERATOR_CHANGED', 'FEISHU_OPERATOR_CONFIRMATION_REQUIRED'].includes(r?.code);
    async function perform(items, execute) {
      if (busy) return;
      expireOperatorIfNeeded();
      if (!allowed(execute)) { ctx.rerender(); return; }
      let selectedOperator = operator?.token;
      const revision = c.revision;
      const captured = items.map(item => ({ item, values: valuesFor(item), plan: item.plan }));
      await run(async ({ runDir, rowId, e }) => {
        if (!execute) {
          if (!allowed(false) || !await ensureOperatorFresh({ runDir, rowId, e }) || !allowed(false)) return;
          selectedOperator = operator.token;
        }
        const owned = () => cloud === c && c.revision === revision && valid(runDir, rowId, e)
          && !configDirty && operatorReady() && operator?.token === selectedOperator && operatorConfirmed && (!execute || safetyConfirmed) && c.confirmed;
        expireOperatorIfNeeded();
        if (!owned()) return;
        cloudInvalidReason = '';
        c.operation = execute ? 'execute' : 'prepare';
        c.phase = execute ? 'creating' : 'preparing'; c.progress = 0; c.total = captured.length; c.stopRequested = false; c.haltReason = '';
        try {
          for (const snapshot of captured) {
            expireOperatorIfNeeded();
            if (!owned() || c.stopRequested) break;
            const { item, values, plan: approved } = snapshot;
            item.error = null;
            if (item.status === 'unknown') { c.progress++; continue; }
            if (JSON.stringify(valuesFor(item)) !== JSON.stringify(values)) { item.plan = null; item.status = 'failed'; item.error = { code: 'FEISHU_LOCAL_CHANGED' }; c.progress++; continue; }
            item.status = execute ? 'creating' : 'preparing'; ctx.rerender();
            expireOperatorIfNeeded();
            if (!owned() || c.stopRequested) break;
            let response;
            if (execute) {
              if (!approved || item.plan !== approved || item.draftStamp !== JSON.stringify(values)) response = { ok: false, code: 'FEISHU_CONFIRMATION_REQUIRED' };
              else {
                item.attempt = approved; item.plan = null;
                const submission = { target: connection.target, creatorName: item.creatorName, account: item.account,
                  maintainerName: approved.maintainer?.name || operator.name, name: approved.name, batch: approved.batch,
                  ...(enriching ? { entryId: approved.entryId, recordId: approved.recordId } : {}),
                  status: 'creating', result: null, item };
                cloudHistory.push(submission); item.submission = submission; item.operationOwner = submission.maintainerName;
                try { response = await api.execute({ token: approved.token, confirmed: true, safetyConfirmed: true }); }
                catch (_) { response = { ok: false, code: 'FEISHU_OPERATION_FAILED', status: 'unknown' }; }
                if (enriching) {
                  if ((response?.entryId && response.entryId !== approved.entryId)
                    || (response?.recordId && response.recordId !== approved.recordId)) {
                    response = { ok: false, code: 'FEISHU_READBACK_INVALID', status: 'unknown' };
                  }
                  response = { ...response, entryId: approved.entryId, recordId: approved.recordId };
                }
                submission.result = response; submission.status = response?.ok && response.status === 'verified' ? 'verified'
                  : response?.status === 'unknown' ? 'unknown' : 'failed';
              }
              item.result = response;
              item.status = response?.ok && response.status === 'verified' ? 'verified' : response?.status === 'unknown' ? 'unknown'
                : ['FEISHU_ALREADY_SUBMITTED', 'FEISHU_DUPLICATE_MAINTAINER'].includes(response?.code) ? 'duplicate' : 'failed';
            } else {
              const quoteUnsupported = [['图文平台价', item.image], ['视频平台价', item.video]].some(([name, value]) => {
                const fields = connection.fields.filter(f => f.name === name);
                return value !== '' && (fields.length !== 1 || !['number', 'text'].includes(fields[0].type));
              });
              if (quoteUnsupported) response = { ok: false, code: 'FEISHU_QUOTE_SCHEMA_UNSUPPORTED' };
              else try { response = await api.prepare({ action: operation, recordMode, runDir, rowId: item.rowId, values,
                deferWriteConfirmation: true, operatorToken: selectedOperator, operatorConfirmed: true }); }
              catch (_) { response = { ok: false, code: 'FEISHU_OPERATION_FAILED' }; }
              if (!owned()) return;
              item.plan = response?.ok && !response.noChanges ? response : null; item.draftStamp = JSON.stringify(values);
              item.result = response?.status === 'unknown' ? response : item.result;
              item.operationOwner = response?.status === 'unknown' ? response.maintainerName || '原归属待核对' : operator.name;
              item.status = response?.ok ? response.noChanges ? 'unchanged' : 'ready' : response?.status === 'unknown' ? 'unknown'
                : ['FEISHU_ALREADY_SUBMITTED', 'FEISHU_DUPLICATE_MAINTAINER'].includes(response?.code) ? 'duplicate' : 'failed';
            }
            item.error = response?.ok ? null : response; c.progress++;
            if (operatorFailures.includes(response?.code)) invalidateOperator(errors[response.code]);
            expireOperatorIfNeeded();
            if (halt(response)) { c.haltReason = failure(response, false); c.stopRequested = true; }
            if (!owned()) return;
            ctx.rerender();
            if (c.progress < c.total && !c.stopRequested) await new Promise(resolve => setTimeout(resolve, 500));
          }
        } finally {
          if (cloud === c) {
            c.phase = c.stopRequested || !owned() ? 'stopped' : execute ? 'done' : 'preview';
            if (owned()) message = `批量${operationLabel}${c.phase === 'stopped' ? '已停止' : execute ? '处理完成' : '预览完成'} · ${c.progress}/${c.total}`;
          }
        }
      }, { requireSave: true });
    }
    const actions = el('div', 'feishu-cloud-actions');
    const prepare = button('查重并预览选中行', () => void perform([...selected], false), !allowed(), true);
    prepare.dataset.cloudPrepare = 'true'; actions.append(prepare);
    const submit = button(`确认${enriching ? '补录' : '新建'}到飞书（${ready.length}）`, () => {
      expireOperatorIfNeeded();
      if (operatorInvalidReason) { message = operatorInvalidReason; ctx.rerender(); return; }
      if (busy || !allowed(true) || !ready.length) return;
      if (ready.some(i => i.plan.expiresAt <= Date.now())) {
        message = '预览已过期，请重新查重并预览；未继续写入'; invalidateCloud(message); ctx.rerender(); return;
      }
      const names = ready.map(i => `${i.creatorName} · 小红书号 ${i.account} · 联系方式 ${i.contact}\n`
        + (i.plan.fields || []).filter(p => connection.fields.some(f => f.key === p.field_key && ['图文平台价', '视频平台价'].includes(f.name)))
          .map(p => `${connection.fields.find(f => f.key === p.field_key).name}：${p.field_value} 元`).join('；')).join('\n');
      const prompt = enriching
        ? `在 ${connection.target} 补录以下 ${ready.length} 条记录？\n现维护经纪人：${operator.name}\n`
          + ready.map(i => `${i.creatorName} · 工作项 ${i.plan.recordId}\n` + i.plan.fields.map(p =>
            `${connection.fields.find(f => f.key === p.field_key)?.name || p.field_key}：${p.before || '空'} → ${p.field_value}`).join('\n')).join('\n')
          + '\n只更新上述字段；保留原建联时间、昵称和归属。不发送邀约、不推进流程。'
        : `在 ${connection.target} 新建以下 ${ready.length} 条${recordMode === 'test' ? ' [AI测试]' : '正式'}记录？\n现维护经纪人：${operator.name}\n${names}\n允许飞书新建通知；不发送邀约、不推进流程、不更新已有团队记录。`;
      if (!confirm(prompt)) return;
      void perform([...ready], true);
    }, !allowed(true) || !ready.length || ready.some(i => i.plan.expiresAt <= Date.now()), true); submit.dataset.cloudSubmit = 'true'; actions.append(submit);
    if (ready.length && !busy && c.phase === 'preview') {
      const expires = Math.min(...ready.map(i => i.plan.expiresAt));
      if (Number.isFinite(expires) && expires > Date.now()) cloudExpiryTimer = setTimeout(() => {
        cloudExpiryTimer = null;
        if (cloud === c && c.revision === renderedRevision && !busy && Date.now() >= expires) ctx.rerender();
      }, expires - Date.now() + 1);
    }
    if (busy && ['preparing', 'creating'].includes(c.phase)) {
      const stop = el('button', 'btn ghost', c.stopRequested ? '正在停止' : `停止批量${operationLabel}`); stop.type = 'button'; stop.disabled = c.stopRequested;
      stop.addEventListener('click', () => { c.stopRequested = true; ctx.rerender(); }); actions.append(stop);
    }
    const phases = { idle: '尚未执行', preparing: '正在查重并预览', preview: '预览完成 · 尚未写入', creating: `正在${enriching ? '补录' : '新建'}并回读`, done: '处理完成', stopped: '已停止' };
    const progressText = () => `${c.stopRequested && busy ? '正在停止 · 等待当前行结束' : c.phase === 'idle' && cloudInvalidReason ? '待重新预览' : phases[c.phase]} · 已选 ${selected.length}/${c.items.length} · ${cloudInvalidReason && c.operation === 'execute' ? '上次提交处理' : '处理'} ${c.progress}/${c.total}\n`
      + `可${enriching ? '补录' : '新建'} ${selected.filter(i => i.status === 'ready' && i.plan).length} · 重复跳过 ${selected.filter(i => i.status === 'duplicate').length} · 已核实 ${selected.filter(i => i.status === 'verified').length} · 待核对 ${selected.filter(i => i.status === 'unknown').length} · 未完成 ${selected.filter(i => i.status === 'failed').length}`
      + (enriching ? ` · 无需更新 ${selected.filter(i => i.status === 'unchanged').length}` : '');
    const progress = el('div', 'feishu-cloud-progress', progressText());
    progress.setAttribute('role', 'status'); progress.setAttribute('aria-live', 'polite'); actions.append(progress);
    const notice = el('div', 'feishu-warning'); notice.dataset.cloudInvalidation = 'true';
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
    const reason = el('div', ''), recovery = el('div', ''); notice.append(reason, recovery); actions.append(notice);
    updateCloudInvalidation = () => {
      if (cloud !== c) return;
      notice.hidden = !cloudInvalidReason;
      reason.textContent = cloudInvalidReason;
      recovery.textContent = !cloudInvalidReason ? '' : `${configDirty ? '请重新连接，再重新查找并选择经纪人、确认归属；' : !preparationReady() ? '请重新查找并选择经纪人、确认归属；' : !operatorConfirmed ? '请确认经纪人归属；' : ''}重新核对建档名单并查重预览；实际新建仍需单独确认。`;
      progress.textContent = progressText();
      if (cloudInvalidReason) {
        identity.children[0].checked = c.confirmed;
        const eligible = selected.filter(i => i.status === 'ready' && i.plan && i.draftStamp === JSON.stringify(valuesFor(i)));
        prepare.disabled = busy || !allowed();
        submit.disabled = busy || !allowed(true) || !eligible.length || eligible.some(i => i.plan.expiresAt <= Date.now());
        submit.textContent = `确认新建到飞书（${eligible.length}）`;
        for (const { item, cell } of resultCells) if (item.status === 'idle') {
          cell.className = 'feishu-cloud-result idle'; cell.replaceChildren(el('strong', '', labels.idle));
        }
      }
    };
    updateCloudInvalidation();
    if (selected.length > batchLimit) actions.append(el('div', 'feishu-warning', `单批最多 ${batchLimit} 位，请减少勾选`));
    if (c.haltReason) actions.append(el('div', 'feishu-warning', c.haltReason));
    if (ready.some(i => i.plan.expiresAt <= Date.now())) actions.append(el('div', 'feishu-warning', '预览已过期，请重新查重并预览；未继续写入'));
    section.append(actions); root.append(section);
  }

  function renderCloudHistory() {
    for (const record of records.filter(r => r.target === connection.target && (['unknown', 'verified'].includes(r.status)
      || (r.status === 'deleted' && r.externalAbsenceVerified === true)))) {
      const prior = cloudHistory.filter(h => sameSubmission(h, record));
      if (prior.length) {
        if (record.status === 'deleted') { acceptReconciliation(record.entryId, record); continue; }
        for (const submission of prior) {
          if (record.name) submission.name = record.name;
          if (record.batch) submission.batch = record.batch;
          if (record.accountNumber) submission.account = record.accountNumber;
          if (record.maintainerName) submission.maintainerName = record.maintainerName;
          if (typeof record.cleanupBlocked === 'boolean') submission.cleanupBlocked = record.cleanupBlocked;
          copyCleanupDiagnostics(submission, record);
          submission.result = { ...submission.result, entryId: record.entryId,
            recordId: record.recordId || submission.result?.recordId };
          copyCleanupDiagnostics(submission.result, record);
        }
        if (record.status === 'verified') acceptReconciliation(record.entryId, record);
        continue;
      }
      const restored = { ...record, creatorName: record.name, account: record.accountNumber || '', target: record.target,
        status: record.status, result: { status: record.status, entryId: record.entryId, recordId: record.recordId } };
      copyCleanupDiagnostics(restored, record); copyCleanupDiagnostics(restored.result, record);
      cloudHistory.push(restored);
    }
    const history = cloudHistory.filter(h => h.target === connection.target);
    const section = readingDetails('history', 'feishu-cloud-history', `提交记录与待核对 · ${history.filter(h => h.status === 'unknown').length} 条待核对`, history.some(h => h.status === 'unknown'));
    section.append(button('刷新提交结果', () => void run(async ({ runDir, rowId, e }) => {
      await refreshRecords(() => valid(runDir, rowId, e));
    })));
    for (const submission of history.filter(h => h.status === 'unknown').concat(history.filter(h => h.status !== 'unknown').slice(-50))) {
      const line = el('div', 'feishu-history-row');
      line.append(el('strong', '', submission.name || submission.result?.name || submission.creatorName), el('div', '', `记录归属：${submission.maintainerName || '待核对'} · 小红书号 ${submission.account || '待核对'}`),
        el('div', '', submission.status === 'deleted' ? submission.externalAbsenceVerified === true || submission.result?.externalAbsenceVerified === true
          ? '外部不存在（只读确认）' : '本软件已清理'
          : submission.status === 'verified' ? '历史提交成功 · 已回读' : submission.status === 'unknown' ? '提交结果未知 · 禁止重发' : submission.status === 'creating' ? '提交处理中' : '提交未完成'));
        if (submission.batch) line.append(el('div', '', `批次 ${submission.batch}`));
        if (submission.result?.recordId) line.append(el('div', '', `工作项 ${submission.result.recordId}`));
        if (submission.status !== 'deleted' && (submission.cleanupBlocked === true || submission.result?.cleanupBlocked === true)) {
          line.append(el('div', 'feishu-warning', errors.FEISHU_CLEANUP_BLOCKED
            + cleanupDiagnosticText({ ...submission, ...submission.result, cleanupBlocked: true })));
        }
      if (submission.status === 'unknown') line.append(button('核对提交结果', () => void run(async ({ runDir, rowId, e }) => {
        const activeConnection = connection;
        const current = () => valid(runDir, rowId, e) && connection === activeConnection && !configDirty;
        if (!current() || submission.target !== activeConnection.target) return;
        let entryId = submission.result?.entryId;
        if (!entryId) {
          const loaded = await refreshRecords(current);
          if (!current()) return;
          if (!loaded?.ok) { message = failure(loaded, false); return; }
            const matches = records.filter(r => sameSubmission(submission, r));
          if (matches.length !== 1) { message = failure({ code: 'FEISHU_RECONCILE_UNCERTAIN' }, false); return; }
          entryId = matches[0].entryId;
        }
        const reviewed = await api.reconcile({ entryId });
        if (!current()) return;
        const accepted = reviewed?.ok && acceptReconciliation(entryId, reviewed, submission);
        message = accepted ? `原提交结果已核对 · 工作项 ${reviewed.recordId} · 归属 ${submission.maintainerName || '待核对'}`
          : failure(reviewed?.ok ? { code: 'FEISHU_RECONCILE_UNCERTAIN' } : reviewed, false);
      })));
      section.append(line);
    }
    root.append(section);
  }

  if (!batch) batch = { items: ctx.rows.map(row => ({ rowId: row.rowId, creatorName: row.creatorName,
    selected: row.selected === true, account: row.feishuAccountNumber || row.xhsId || '',
    wechatId: row.wechatId, email: row.email, phone: row.phone, result: null, recordId: '', kind: '', approved: false })),
    confirmed: false, phase: 'idle', progress: 0, total: 0, stopRequested: false, scrollTop: 0 };
  const b = batch;
  const revokeBatchReview = () => { b.reviewRevision = (b.reviewRevision || 0) + 1; };
  const previousItems = new Map(b.items.map(i => [i.rowId, i]));
  if (ctx.rows.length !== b.items.length || ctx.rows.some(row => !previousItems.has(row.rowId))) b.confirmed = false;
  b.items = ctx.rows.map(row => {
    let item = previousItems.get(row.rowId);
    if (!item || item.creatorName !== row.creatorName) {
      revokeBatchReview();
      b.confirmed = false;
      item = { rowId: row.rowId, creatorName: row.creatorName, selected: row.selected === true,
        account: row.feishuAccountNumber || row.xhsId || '', result: null, recordId: '', kind: '', approved: false };
    }
    Object.assign(item, { wechatId: row.wechatId, email: row.email, phone: row.phone, contactRaw: row.contactRaw });
    if (item.result && item.queriedIdentity !== contactRowIdentity(row) && item.pendingIdentity !== contactRowIdentity(row)) {
      revokeBatchReview();
      item.result = null; item.recordId = ''; item.kind = ''; item.approved = false;
      item.error = null; item.applied = false; b.confirmed = false;
    }
    return item;
  });
  const panel = el('details', 'feishu-batch'); panel.open = batchOpen;
  panel.addEventListener('toggle', () => { batchOpen = panel.open; });
  panel.append(el('summary', '', `批量回补 · 已选 ${b.items.filter(i => i.selected).length} / ${ctx.rows.length} 位`));
  const selectedItems = b.items.filter(i => i.selected && ctx.rows.some(row => row.rowId === i.rowId));
  const batchActions = el('div', 'feishu-actions');
  function changeSelection(fn) {
    revokeBatchReview();
    for (const item of b.items) item.selected = fn(item);
    b.confirmed = false; ctx.rerender();
  }
  batchActions.append(button('使用要建联名单', () => changeSelection(i => ctx.rows.find(r => r.rowId === i.rowId)?.selected === true)),
    button('全选回补名单', () => changeSelection(() => true)), button('清空回补勾选', () => changeSelection(() => false)));
  panel.append(batchActions);
  const list = el('div', 'feishu-batch-list'); list.setAttribute('aria-label', '批量回补名单');
  const listRun = currentRun, listEpoch = epoch;
  const currentBatchList = () => batch === b && currentRun === listRun && epoch === listEpoch && list.isConnected;
  list.addEventListener('scroll', () => { if (currentBatchList()) b.scrollTop = list.scrollTop; });
  for (const item of b.items.filter(i => ctx.rows.some(row => row.rowId === i.rowId))) {
    const line = el('div', 'feishu-batch-row');
    line.append(check(item.creatorName || '未命名达人', item.selected, value => {
      revokeBatchReview();
      item.selected = value; b.confirmed = false; ctx.rerender();
    }));
    line.append(field(`小红书号 · ${item.creatorName || item.rowId}`, input(item.account, value => {
      revokeBatchReview();
      item.account = value.trim(); item.result = null; item.approved = false; b.confirmed = false;
      const checked = panel.querySelector('[data-batch-confirm] input'); if (checked) checked.checked = false;
      const query = panel.querySelector('[data-batch-query]'); if (query) query.disabled = true;
      const apply = panel.querySelector('[data-batch-apply]'); if (apply) apply.disabled = true;
    })));
    if (item.result) {
      const r = item.result;
      line.append(el('div', 'feishu-batch-outcome', item.applied ? '已回填并保存' : item.error ? failure(item.error, false)
        : r.ok ? outcomes[r.preview.status] || r.preview.status : failure(r, false)));
      if (r.ok && !item.applied) {
        const source = el('select', 'tpl-input'); source.disabled = busy;
        source.append(new Option('选择已核实的来源', ''));
        for (const c of r.preview.candidates.filter(usableContact)) source.append(new Option(`记录 ${c.recordId} · ${c.value}`, String(c.recordId)));
        source.value = item.recordId;
        source.addEventListener('change', () => {
          revokeBatchReview();
          item.recordId = source.value; item.approved = false;
          item.kind = ''; ctx.rerender();
        });
        if (r.preview.candidates.some(usableContact)) {
          line.append(field(`回补来源 · ${item.creatorName}`, source));
          const candidate = r.preview.candidates.find(c => String(c.recordId) === item.recordId);
          if (usableContact(candidate)) {
            const value = el('p', 'feishu-contact-value', candidate.value);
            value.dataset.batchContactValue = 'true';
            value.style.whiteSpace = 'pre-wrap'; value.style.overflowWrap = 'anywhere';
            line.append(value);
          }
          const kind = el('select', 'tpl-input'); kind.disabled = busy;
          kind.append(new Option('确认联系方式类型', ''));
          for (const v of ['wechat', 'phone', 'email']) kind.append(new Option(contactKinds[v], v));
          if (candidate?.kind === 'unclassified') kind.append(new Option(contactKinds.unclassified, 'unclassified'));
          kind.value = item.kind;
          kind.addEventListener('change', () => { revokeBatchReview(); item.kind = kind.value; item.approved = false; ctx.rerender(); });
          line.append(field(`回补类型 · ${item.creatorName}`, kind));
          const include = check(`回填 · ${item.creatorName}`, item.approved, value => { revokeBatchReview(); item.approved = value; ctx.rerender(); });
          include.children[0].disabled = busy || !batchChoice(item); line.append(include);
          if (item.recordId && item.kind && !batchChoice(item)) line.append(el('div', 'feishu-warning', '本地值不同或类型不符，未纳入回填'));
        }
      }
    }
    list.append(line);
  }
  panel.append(list);
  requestAnimationFrame(() => { if (currentBatchList()) list.scrollTop = b.scrollTop || 0; });
  const identityCheck = check('已核对本批小红书号与达人对应关系', b.confirmed, value => { revokeBatchReview(); b.confirmed = value; ctx.rerender(); });
  identityCheck.dataset.batchConfirm = 'true'; panel.append(identityCheck);
  if (selectedItems.length > batchLimit) panel.append(el('div', 'feishu-warning', `单批最多 ${batchLimit} 位，请减少勾选`));
  if (selectedItems.some(i => !i.account)) panel.append(el('div', 'feishu-warning', '部分达人缺少主页小红书号，查询时将跳过'));
  const batchValid = (runDir, rowId, e) => valid(runDir, rowId, e) && batch === b && !configDirty;
  async function performBatch(items, apply) {
    const reviewRevision = b.reviewRevision || 0;
    const reviewed = new Map(apply ? items.map(item => [item, {
      account: item.account, recordId: item.recordId, kind: item.kind, token: item.result?.token,
      identity: contactRowIdentity(currentContactRows.find(row => row.rowId === item.rowId)),
      candidate: batchChoice(item) && { ...batchChoice(item) }
    }]) : []);
    await run(async ({ runDir, rowId, e }) => {
      b.phase = apply ? 'applying' : 'querying'; b.progress = 0; b.total = items.length; b.stopRequested = false; b.haltReason = '';
      try {
        for (const item of items) {
          if (!batchValid(runDir, rowId, e) || b.stopRequested) break;
          message = `${apply ? '批量回填' : '批量查询'} ${b.progress + 1}/${b.total} · ${item.creatorName}`; ctx.rerender();
          if (apply) {
            const captured = reviewed.get(item);
            const choiceCurrent = () => b.confirmed && (b.reviewRevision || 0) === reviewRevision
              && b.items.includes(item) && item.selected && item.approved
              && item.account === captured?.account && item.recordId === captured?.recordId
              && item.kind === captured?.kind && item.result?.token === captured?.token
              && captured?.identity && captured.identity === contactRowIdentity(currentContactRows.find(row => row.rowId === item.rowId))
              && item.queriedIdentity === captured.identity
              && batchChoice(item)?.value === captured?.candidate?.value;
            const c = choiceCurrent() && captured.candidate;
            if (!c) { item.error = { code: 'FEISHU_CONTACT_INVALID' }; }
            else {
              const chosenRecord = item.recordId, chosenKind = item.kind;
              const chosenIdentity = contactRowIdentity(currentContactRows.find(row => row.rowId === item.rowId));
              // Renew only a read preview; never renew cloud or maintainer authority.
              const fresh = await api.lookup({ runDir, rowId: item.rowId, accountNumber: captured.account });
              if (!batchValid(runDir, rowId, e)) return;
              if (b.stopRequested) break;
              const matches = Array.isArray(fresh?.preview?.candidates)
                ? fresh.preview.candidates.filter(candidate => String(candidate.recordId) === chosenRecord) : [];
              const unchanged = fresh?.ok === true && fresh.token && fresh.preview?.status !== 'incomplete'
                && matches.length === 1 && matches[0].value === c.value && matches[0].kind === c.kind
                && matches[0].identityVariant === c.identityVariant;
              const r = !choiceCurrent() ? { ok: false, code: 'FEISHU_LOCAL_CHANGED' }
                : !fresh?.ok ? fresh || { ok: false, code: 'FEISHU_OPERATION_FAILED' }
                : !unchanged ? { ok: false, code: 'FEISHU_CONTACT_CHANGED' }
                : await api.applyContact({ runDir, rowId: item.rowId, token: fresh.token, recordId: chosenRecord, kind: chosenKind });
              if (!batchValid(runDir, rowId, e)) return;
              const localRow = currentContactRows.find(row => row.rowId === item.rowId);
              const rawConflict = chosenKind === 'unclassified' && localRow?.contactRaw != null
                && localRow.contactRaw !== '' && localRow.contactRaw !== c.value;
              const stillSelected = choiceCurrent() && chosenIdentity && contactRowIdentity(localRow) === chosenIdentity && !rawConflict
                && batchChoice(item)?.value === c.value;
              let saved = r;
              if (r?.ok) {
                saved = { ok: false, code: 'FEISHU_LOCAL_CHANGED' };
                if (stillSelected) {
                  item.pendingIdentity = contactRowIdentity({ ...localRow, ...r.patch });
                  try { saved = await ctx.apply(runDir, item.rowId, r.patch); }
                  catch (_) { saved = { ok: false, code: 'FEISHU_LOCAL_SAVE_FAILED' }; }
                  finally { item.pendingIdentity = ''; }
                }
              }
              if (!batchValid(runDir, rowId, e)) return;
              item.applied = saved?.ok === true; item.error = item.applied ? null : saved || { code: 'FEISHU_OPERATION_FAILED' };
              item.approved = false;
              if (item.applied) {
                Object.assign(item, r.patch);
                item.queriedIdentity = contactRowIdentity({ ...localRow, ...r.patch });
                lookup = null; plan = null;
                if (item.rowId === currentRow) {
                  const contactField = connection.fields.find(f => f.name === '联系方式');
                  if (contactField && (!draft[contactField.key] || draft[contactField.key] === contactDraft(selected))) {
                    draft[contactField.key] = contactDraft({ ...selected, ...r.patch });
                  }
                }
              }
              if (!saved?.ok && (saved?.code === 'FEISHU_SESSION_EXPIRED' || [401, 403, 429].includes(saved?.status))) {
                b.haltReason = failure(saved, false); b.stopRequested = true;
              }
            }
          } else {
            item.result = null; item.error = null; item.applied = false; item.approved = false; item.recordId = ''; item.kind = '';
            const queriedAccount = item.account;
            const queriedIdentity = contactRowIdentity(currentContactRows.find(row => row.rowId === item.rowId));
            if (!item.account) item.result = { ok: false, code: 'FEISHU_IDENTITY_INVALID' };
            else {
              const r = await api.lookup({ runDir, rowId: item.rowId, accountNumber: item.account });
              if (!batchValid(runDir, rowId, e)) return;
              if (item.account !== queriedAccount || queriedIdentity !== contactRowIdentity(currentContactRows.find(row => row.rowId === item.rowId))) {
                item.error = { code: 'FEISHU_LOCAL_CHANGED' }; b.confirmed = false;
                b.haltReason = failure(item.error, false); b.stopRequested = true; break;
              }
              item.result = r;
              if (!r?.ok && (r?.code === 'FEISHU_SESSION_EXPIRED' || [401, 403, 429].includes(r?.status))) {
                b.haltReason = failure(r, false); b.stopRequested = true;
              }
            }
            item.queriedIdentity = queriedIdentity;
          }
          b.progress++; ctx.rerender();
          if (b.progress < b.total && !b.stopRequested) await new Promise(resolve => setTimeout(resolve, 500));
        }
      } finally {
        if (batchValid(runDir, rowId, e)) {
          b.phase = b.stopRequested ? 'stopped' : 'done';
          message = `${b.stopRequested ? '批量已停止' : apply ? '批量回填完成' : '批量查询完成'} · 处理 ${b.progress}/${b.total} · 已保存 ${b.items.filter(i => i.applied).length} · 未修改飞书原记录`;
          if (!apply) message += `；命中 ${items.filter(i => i.result?.ok && i.result.preview.candidates.length).length} · 未匹配 ${items.filter(i => i.result?.preview?.status === 'not_found').length} · 异常 ${items.filter(i => i.result?.ok === false).length}`;
          if (b.haltReason) message += `；${b.haltReason}`;
        }
      }
    }, { requireSave: true });
  }
  const batchQuery = button('查询选中达人', () => {
    if (!b.confirmed || configDirty || !selectedItems.length || selectedItems.length > batchLimit) return;
    batchOpen = true; void performBatch([...selectedItems], false);
  }, !b.confirmed || configDirty || !selectedItems.length || selectedItems.length > batchLimit, true);
  batchQuery.dataset.batchQuery = 'true'; panel.append(batchQuery);
  const readyItems = selectedItems.filter(i => i.approved && batchChoice(i));
  const batchApply = button(`确认回填本地（${readyItems.length}）`, () => {
    if (!b.confirmed || configDirty || !readyItems.length || selectedItems.length > batchLimit) return;
    if (!confirm(`回填以下 ${readyItems.length} 位达人的本地资料？\n${readyItems.map(i => `${i.creatorName} / ${i.account} / 记录 ${i.recordId} / ${contactKinds[i.kind]}：${batchChoice(i).value}`).join('\n')}\n保存前将逐条重新核实来源；变化项不回填。已有不同值不会覆盖；飞书原记录不修改。`)) return;
    void performBatch([...readyItems], true);
  }, !b.confirmed || configDirty || !readyItems.length || selectedItems.length > batchLimit, true);
  batchApply.dataset.batchApply = 'true'; panel.append(batchApply);
  if (['querying', 'applying'].includes(b.phase)) {
    const stop = el('button', 'btn ghost', b.stopRequested ? '正在停止…' : '停止批量'); stop.type = 'button'; stop.disabled = b.stopRequested;
    stop.addEventListener('click', () => { b.stopRequested = true; message = '正在停止，等待当前达人处理结束'; ctx.rerender(); }); panel.append(stop);
  }
  panel.append(el('div', 'feishu-batch-progress', `${({ idle: '尚未查询', querying: '查询中', applying: '回填中', stopped: '已停止', done: '本批处理完成' })[b.phase]} · ${b.progress}/${b.total}`));
  root.append(panel);

  const rowSelect = el('select', 'tpl-input'); rowSelect.disabled = busy;
  rowSelect.append(new Option('选择本次达人', ''));
  for (const row of ctx.rows) rowSelect.append(new Option(`${row.selected ? '已勾选 · ' : ''}${row.creatorName || '未命名达人'}`, row.rowId));
  rowSelect.value = currentRow;
  rowSelect.addEventListener('change', () => {
    currentRow = rowSelect.value; epoch++; lookup = null; plan = null; accountConfirmed = false;
    const row = ctx.rows.find(r => r.rowId === currentRow);
    accountNumber = row?.feishuAccountNumber || ''; fillDraft(row); ctx.rerender();
  }); root.append(field('本次达人', rowSelect));
  const account = input(accountNumber, v => {
    accountNumber = v; epoch++; accountConfirmed = false; lookup = null; plan = null;
    for (const preview of root.querySelectorAll?.('.feishu-contact-preview:not([data-operator])') || []) preview.remove();
    const checked = root.querySelector('[data-account-confirm] input'); if (checked) checked.checked = false;
    const query = root.querySelector('[data-query]'); if (query) query.disabled = true;
  });
  root.append(field('主页显示的小红书号', account));
  const accountCheck = check('已核对该小红书号属于当前达人', accountConfirmed, v => {
    epoch++; lookup = null; plan = null; accountConfirmed = v; ctx.rerender();
  });
  accountCheck.dataset.accountConfirm = 'true'; root.append(accountCheck);
  const queryButton = button('查询团队库', () => {
    if (busy) return;
    epoch++; lookup = null; plan = null;
    void run(async ({ runDir, rowId, e }) => {
    if (!accountConfirmed || !selected) { message = '请先核对当前达人的主页小红书号'; return; }
    lookup = null; plan = null;
    const r = await api.lookup({ runDir, rowId, accountNumber });
    if (!valid(runDir, rowId, e)) return;
    if (r?.ok) lookup = r;
    message = r?.ok ? `${outcomes[r.preview.status] || r.preview.status} · ${r.preview.candidates.length} 条 · ${r.checkedAt}` : failure(r);
    }, { requireSave: true });
  }, !selected || !accountConfirmed || !accountNumber, true);
  queryButton.dataset.query = 'true'; root.append(queryButton);

  if (lookup) {
    const runDir = currentRun, rowId = currentRow, e = epoch, lookupToken = lookup.token;
    const selectedIdentity = contactRowIdentity(selected);
    const selectedIdentityRow = { ...selected };
    for (const candidate of lookup.preview.candidates) {
      const line = el('div', 'feishu-contact-preview');
      line.append(el('div', '', `来源记录 ${candidate.recordId} · ${contactKinds[candidate.kind] || '类型待确认'}`), el('div', '', candidate.value || '未填写联系方式'));
      const kind = el('select', 'tpl-input');
      kind.append(new Option('确认联系方式类型', ''));
      for (const [v, label] of [['wechat', '微信'], ['phone', '手机'], ['email', '邮箱']]) kind.append(new Option(label, v));
      if (candidate.kind === 'unclassified') kind.append(new Option(contactKinds.unclassified, 'unclassified'));
      if (['wechat', 'phone', 'email'].includes(candidate.kind)) kind.value = candidate.kind;
      line.append(field('联系方式类型', kind));
      line.append(button('确认回填本地', () => {
        if (busy || !valid(runDir, rowId, e) || !accountConfirmed || lookup?.token !== lookupToken) {
          message = '回补预览已失效，请核对当前账号并重新查询'; ctx.rerender(); return;
        }
        const chosenKind = kind.value, activeConnection = connection;
        if (!Object.hasOwn(contactKinds, chosenKind) || !confirm(`将来源记录 ${candidate.recordId} 的 ${contactKinds[chosenKind]} 回填给 ${selected.creatorName}？\n已有不同值不会覆盖。`)) return;
        void run(async () => {
          const current = (expectedIdentities = [selectedIdentity]) => valid(runDir, rowId, e) && connection === activeConnection && !configDirty
            && accountConfirmed && lookup?.token === lookupToken && selectedIdentity
            && expectedIdentities.includes(contactRowIdentity(currentContactRows.find(row => row.rowId === rowId)));
          if (!current()) return;
          const r = await api.applyContact({ runDir, rowId, token: lookupToken, recordId: candidate.recordId, kind: chosenKind });
          if (!current()) return;
          const currentRow = currentContactRows.find(row => row.rowId === rowId);
          const rawConflict = chosenKind === 'unclassified' && currentRow?.contactRaw != null
            && currentRow.contactRaw !== '' && currentRow.contactRaw !== candidate.value;
          const saved = r?.ok ? rawConflict ? { ok: false, code: 'FEISHU_LOCAL_CONFLICT' }
            : await ctx.apply(runDir, rowId, r.patch) : r;
          // The adapter updates its map, while the last rendered rows may still be copies.
          if (!current(r?.ok ? [selectedIdentity, contactRowIdentity({ ...selectedIdentityRow, ...r.patch })] : [selectedIdentity])) return;
          if (saved?.ok) {
            const contactField = connection.fields.find(f => f.name === '联系方式');
            if (contactField && (!draft[contactField.key] || draft[contactField.key] === contactDraft(selected))) {
              draft[contactField.key] = contactDraft({ ...selected, ...r.patch });
            }
          }
          message = saved?.ok ? '回填成功，已保存本地复核资料；飞书旧记录未修改' : failure(saved);
          lookup = null; plan = null;
        }, { requireSave: true });
      }, ['status', 'unrecognized', 'none'].includes(candidate.kind) || !candidate.value)); root.append(line);
    }
  }

  const write = el('details', 'feishu-write'); write.open = singleOpen ?? !!selected;
  currentWriteDetails = write;
  write.addEventListener('toggle', () => {
    if (currentWriteDetails === write) singleOpen = write.open;
  });
  const writeSummary = el('summary', 'feishu-section-title', '单条操作与测试清理');
  writeSummary.addEventListener('click', event => {
    event.preventDefault();
    if (currentWriteDetails !== write) return;
    write.open = !write.open; singleOpen = write.open;
  });
  write.append(writeSummary);
  const modes = el('div', 'feishu-modes'); modes.setAttribute('role', 'tablist'); modes.setAttribute('aria-label', '飞书跟进操作');
  const modeKeys = ['create', 'update', 'delete'];
  const activateMode = (value, focus = false) => {
    action = value; singleOpen = true; plan = null; checkedFields = new Set(); ctx.rerender();
    if (focus) requestAnimationFrame(() => document.getElementById(`feishu-mode-${value}`)?.focus({ preventScroll: true }));
  };
  for (const [v, label] of [['create', '新建跟进'], ['update', '修改记录'], ['delete', '测试清理']]) {
    const b = button(label, () => activateMode(v, true));
    b.id = `feishu-mode-${v}`; b.tabIndex = action === v ? 0 : -1;
    b.className = `feishu-mode${action === v ? ' active' : ''}${v === 'delete' ? ' danger' : ''}`;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(action === v));
    b.setAttribute('aria-controls', 'feishu-write-panel'); modes.append(b);
    b.addEventListener('keydown', event => {
      if (busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2
        : (modeKeys.indexOf(v) + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
      activateMode(modeKeys[index], true);
    });
  }
  write.append(modes);
  const writePanel = el('div', 'feishu-write-panel'); writePanel.id = 'feishu-write-panel';
  writePanel.setAttribute('role', 'tabpanel'); writePanel.setAttribute('aria-label', ({ create: '新建跟进', update: '修改记录', delete: '测试清理' })[action]);
  writePanel.setAttribute('aria-labelledby', `feishu-mode-${action}`);
  write.append(writePanel);
  const writeBody = writePanel;
  writeBody.append(el('div', 'feishu-test-scope', action === 'create' && recordMode === 'production'
    ? '正式建档' : 'AI测试 · 仅处理本软件新建测试记录'));
  function renderMaintainer() {
    const person = el('div', 'feishu-contact-preview'); person.dataset.operator = 'true';
    const personStatus = el('strong', '', selectedMaintainer ? `现维护经纪人：${selectedMaintainer.name} · 已选定`
      : operator ? `现维护经纪人：${operator.name}${operatorInvalidReason ? ' · 归属确认无效' : ''}` : '现维护经纪人：尚未选择');
    person.append(personStatus);
    const authorityStatus = el('div', '');
    authorityStatus.dataset.authorityStatus = 'true'; person.append(authorityStatus);
    if (operatorInvalidReason) authorityStatus.append(el('div', 'feishu-warning', operatorInvalidReason));
    else if (operatorReady()) {
      const inspected = operator, deadline = operatorDeadline();
      authorityStatus.append(el('div', '', selectedMaintainer ? '人员已核验；预览和写入仍需单独确认'
        : `归属确认预计有效至 ${new Date(deadline).toLocaleTimeString()}（后端校验为准）`));
      operatorExpiryTimer = setTimeout(() => {
        operatorExpiryTimer = null;
        if (operator !== inspected) return;
        expireOperatorIfNeeded();
        if (operatorInvalidReason) ctx.rerender();
      }, deadline - Date.now() + 1);
    }
    const nameInput = input(maintainerName, v => {
      maintainerName = v; resetMaintainer();
      message = '经纪人姓名已更改，请查找并选择；旧确认已撤销，尚未写入';
      status.textContent = `最近操作：${message}`; authorityStatus.replaceChildren();
      updateCloudInvalidation();
      personStatus.textContent = '现维护经纪人：尚未选择';
      root.querySelector('[data-people]')?.remove();
      root.querySelector('.feishu-write-preview')?.remove();
      const prepare = root.querySelector('[data-prepare]'); if (prepare) prepare.disabled = true;
      const cloudPrepare = root.querySelector('[data-cloud-prepare]'); if (cloudPrepare) cloudPrepare.disabled = true;
      const cloudSubmit = root.querySelector('[data-cloud-submit]'); if (cloudSubmit) cloudSubmit.disabled = true;
      searchButton.disabled = busy || configDirty || !v.trim();
    });
    person.append(field('经纪人姓名', nameInput));
    const searchButton = button('查找经纪人', () => void run(async ({ runDir, rowId, e }) => {
      resetMaintainer();
      if (configDirty) { message = '连接设置已更改，请先重新连接'; return; }
      const r = await api.searchMaintainers({ name: maintainerName.trim() });
      if (!valid(runDir, rowId, e)) return;
      maintainerCandidates = r?.ok ? r.candidates : [];
      message = r?.ok ? `匹配 ${r.candidates.length} 位经纪人，尚未选择` : failure(r);
    }), configDirty || !maintainerName.trim());
    person.append(searchButton);
    const people = el('div', ''); people.dataset.people = 'true';
    if (maintainerCandidates.length) {
      const pick = el('select', 'tpl-input'); pick.disabled = busy || configDirty;
      pick.append(new Option('选择经纪人', ''));
      for (const candidate of maintainerCandidates) pick.append(new Option(candidate.label, candidate.token));
      pick.value = maintainerChoice;
      pick.addEventListener('change', () => {
        maintainerRevision++;
        maintainerChoice = pick.value; selectedMaintainer = null; operator = null; operatorLease = null; operatorInvalidReason = ''; operatorConfirmed = false; plan = null; invalidateCloud('经纪人选择已更改，旧预览不可使用');
        if (!maintainerChoice) { ctx.rerender(); return; }
        void run(async ({ runDir, rowId, e }) => {
          const choice = maintainerChoice, name = maintainerName, revision = maintainerRevision, target = connection.target;
          const wallStart = Date.now(), monoStart = monotonicNow();
          const r = await api.inspectOperator({ candidateToken: choice });
          if (!valid(runDir, rowId, e) || configDirty || maintainerRevision !== revision
            || connection.target !== target || maintainerChoice !== choice || maintainerName !== name) return;
          if (r?.ok && r.choice && r.choice.target === target && typeof r.choice.token === 'string' && r.choice.name === r.name) {
            selectedMaintainer = Object.freeze({ ...r.choice });
          }
          bindInspection(r, wallStart, monoStart);
          message = r?.ok ? operatorInvalidReason || `已选择 ${r.name}，等待确认归属；尚未写入` : failure(r);
        });
      });
      people.append(field('匹配人员', pick));
    }
    if (operator || selectedMaintainer) {
      const name = selectedMaintainer?.name || operator.name;
      const confirmation = check(`将新增跟进的现维护经纪人设为 ${name}`, operatorConfirmed, v => {
        maintainerRevision++;
        expireOperatorIfNeeded(); operatorConfirmed = v && preparationReady(); plan = null;
        message = operatorConfirmed ? `已确认 ${name} 的归属；尚未写入` : operatorInvalidReason || '经纪人归属确认已撤销；尚未写入';
        invalidateCloud(operatorConfirmed ? '经纪人归属已确认，请重新核对名单并预览' : operatorInvalidReason || '经纪人归属确认已撤销'); ctx.rerender();
      });
      confirmation.children[0].disabled = busy || !preparationReady(); people.append(confirmation);
    }
    person.append(people);
    if (configDirty) person.append(el('div', '', '连接设置已更改，尚未应用'));
    root.append(person);
  }
  writeBody.append(button('刷新本软件创建清单', () => void run(async () => {
    const r = await refreshRecords(); message = r?.ok ? `创建清单 ${records.length} 条` : failure(r);
  })));
  const retired = records.filter(r => testRecord(r) && r.target === connection.target && r.status === 'deleted' && r.hiddenFromPicker !== true);
  if (retired.length && typeof api.archiveDeletedRecords === 'function') {
    const archiveConnection = connection, archiveTarget = connection.target;
    const entryIds = retired.map(r => r.entryId);
    const archiveCurrent = () => connection === archiveConnection && connection.target === archiveTarget && !configDirty
      && entryIds.every(id => records.filter(r => r.entryId === id && r.target === archiveTarget && r.status === 'deleted').length === 1);
    writeBody.append(button(`移除已删除历史（${retired.length}）`, () => {
      if (busy || !archiveCurrent()) return;
      if (!confirm(`仅从目标记录下拉框移除以下 ${retired.length} 条已删除历史：\n${retired.map(r => `${r.name} · ${r.recordId}`).join('\n')}\n不会向飞书发送删除；本机审计清单保留。确认移除？`)) return;
      if (!archiveCurrent()) return;
      plan = null; manualCleanupApproval = null;
      void run(async ({ runDir, rowId, e }) => {
        if (!valid(runDir, rowId, e) || !archiveCurrent()) return;
        const r = await api.archiveDeletedRecords({ target: archiveTarget, entryIds, confirmed: true });
        if (!valid(runDir, rowId, e) || !archiveCurrent()) return;
        message = r?.ok && r.target === archiveTarget && Number.isInteger(r.count) && r.count >= 0 && r.count <= entryIds.length
          ? `已移除 ${r.count} 条下拉历史；审计清单保留，未删除飞书数据` : failure(r?.ok ? { code: 'FEISHU_READBACK_INVALID' } : r);
        if (r?.ok) await refreshRecords(() => valid(runDir, rowId, e) && connection === archiveConnection);
      });
    }, configDirty));
  }
  if (action !== 'create') {
    const pick = el('select', 'tpl-input'); pick.disabled = busy; pick.append(new Option('选择清单内记录', ''));
    for (const r of records.filter(r => testRecord(r) && (r.status !== 'deleted' || r.hiddenFromPicker !== true))) {
      const status = r.status === 'deleted' ? r.externalAbsenceVerified === true ? '外部不存在（只读确认）' : '本软件已清理'
        : r.cleanupBlocked ? '需人工核对，禁止自动修改和清理' : ({ verified: '已核实', unknown: '待核对', failed: '失败' })[r.status] || '待核对';
      const option = new Option(`${status} · ${r.name} · ${r.recordId || '未取得ID'}`, r.recordId || '');
      option.disabled = r.status !== 'verified'; pick.append(option);
    }
    pick.value = recordId; pick.addEventListener('change', () => { recordId = pick.value; plan = null; manualCleanupApproval = null; ownedAbsenceNotice = null; checkedFields = new Set(); ctx.rerender(); });
    writeBody.append(field('目标记录', pick));
    const matches = records.filter(r => r.recordId === recordId && r.target === connection.target);
    const selectedRecord = matches.length === 1 && matches[0].status === 'verified' && typeof matches[0].entryId === 'string' && matches[0].entryId ? matches[0] : null;
    if (selectedRecord && typeof api.verifyOwnedAbsence === 'function') {
      const selectedConnection = connection, selectedAction = action;
      const identity = Object.freeze({ entryId: selectedRecord.entryId, recordId: selectedRecord.recordId, target: selectedRecord.target });
      const sameSelection = () => connection === selectedConnection && connection.target === identity.target
        && action === selectedAction && recordId === identity.recordId && !configDirty
        && records.filter(r => r.target === identity.target && r.recordId === identity.recordId).length === 1
        && records.some(r => r.target === identity.target && r.entryId === identity.entryId && r.recordId === identity.recordId && r.status === 'verified');
      const verify = button('核对云端是否已删除', () => {
        if (busy || !sameSelection()) return;
        plan = null; ownedAbsenceNotice = null; root.querySelector('.feishu-write-preview')?.remove();
        void run(async ({ runDir, rowId, e }) => {
          const currentScope = () => valid(runDir, rowId, e) && connection === selectedConnection && connection.target === identity.target
            && action === selectedAction && !configDirty;
          try {
            if (!currentScope() || !sameSelection()) return;
            let reviewed;
            try { reviewed = await api.verifyOwnedAbsence({ ...identity, ...(selectedRecord.cleanupBlocked ? { inspectCurrent: true } : {}) }); }
            catch (_) { reviewed = { ok: false, code: 'FEISHU_OPERATION_FAILED' }; }
            if (!currentScope() || !sameSelection()) return;
            const exact = reviewed?.entryId === identity.entryId && reviewed.recordId === identity.recordId && reviewed.target === identity.target;
            const absent = exact && reviewed.exists === false && reviewed.externalAbsenceVerified === true && reviewed.status === 'deleted';
            const exists = exact && reviewed.exists === true && reviewed.externalAbsenceVerified === false && reviewed.status === 'verified';
            if (!reviewed?.ok || (!absent && !exists)) {
              message = failure(reviewed?.ok ? { code: 'FEISHU_READBACK_INVALID' } : reviewed, false);
            } else {
              message = absent ? '只读确认外部不存在，未再次发送删除' : selectedRecord.cleanupBlocked
                ? '云端记录仍存在，未发送删除；仍禁止自动修改和清理'
                : '云端记录仍存在，未发送删除；清理保护保持不变，请重新预览核对';
              if (exists && selectedRecord.cleanupBlocked && reviewed.currentInspection?.matches === true) {
                message += '；当前字段检查通过，但不补建旧记录的首次基线';
              } else if (exists && selectedRecord.cleanupBlocked && reviewed.currentInspection?.matches === false) {
                message += cleanupDiagnosticText({ ...reviewed.currentInspection, cleanupBlocked: true }, true);
              }
              if (exists && selectedRecord.cleanupBlocked && Array.isArray(reviewed.currentInspection?.workflowIssues)) {
                const reasons = [...new Set(reviewed.currentInspection.workflowIssues.filter(k => typeof k === 'string'
                  && Object.hasOwn(workflowInspectionReasons, k)))];
                if (reasons.length) message += `；当前流程检查：${reasons.map(k => `${workflowInspectionReasons[k]} [${k}]`).join('、')}`;
              }
              if (exists && selectedRecord.cleanupBlocked && reviewed.currentInspection?.defaults?.matches === true) {
                message += '；当前默认字段检查通过';
              } else if (exists && selectedRecord.cleanupBlocked && reviewed.currentInspection?.defaults?.matches === false) {
                message += cleanupDiagnosticText({ ...reviewed.currentInspection.defaults, cleanupBlocked: true }, true);
                const schema = reviewed.currentInspection.defaults.schema;
                const slots = ['NAME', 'CREATOR', 'UPDATER', 'CREATED_AT', 'UPDATED_AT', 'WORKFLOW', 'ITEM_ID', 'OTHER'];
                const types = ['text', 'number', 'select', 'link', 'role_owners', 'work_item_status', 'user', 'multi_user', 'date', 'bool', 'OTHER'];
                if (schema && Number.isInteger(schema.ordinal) && schema.ordinal > 0 && schema.ordinal <= 10000
                  && slots.includes(schema.slot) && types.includes(schema.actualType) && types.includes(schema.expectedType)
                  && typeof schema.metadataFound === 'boolean' && typeof schema.valuePresent === 'boolean') {
                  message += `；当前字段结构：第${schema.ordinal}项 [${schema.slot}]、元数据${schema.metadataFound ? '存在' : '缺失'}、值${schema.valuePresent ? '存在' : '省略'}、类型 ${schema.actualType}/${schema.expectedType}`;
                }
              }
              if (absent) acceptReconciliation(identity.entryId, reviewed);
            }
            ownedAbsenceNotice = { ...identity, runDir, text: message };
            if (reviewed?.ok && (absent || exists)) {
              await refreshRecords(() => currentScope() && (!recordId || recordId === identity.recordId));
              if (currentScope() && recordId === identity.recordId && records.some(r => r.entryId === identity.entryId && r.status === 'deleted')) recordId = '';
            }
          } finally {
            if (currentScope() && (!recordId || recordId === identity.recordId)) plan = null;
          }
        });
      }, configDirty);
      verify.dataset.ownedAbsence = 'true'; writeBody.append(verify);
      if (action === 'delete' && selectedRecord.cleanupBlocked && typeof api.prepareManualCleanup === 'function') {
        const manual = button('预览人工清理', () => {
          if (busy || !safetyConfirmed || !sameSelection()) return;
          plan = null; manualCleanupApproval = null;
          void run(async ({ runDir, rowId, e }) => {
            if (!valid(runDir, rowId, e) || !safetyConfirmed || !sameSelection()) return;
            const r = await api.prepareManualCleanup({ ...identity, safetyConfirmed: true });
            if (!valid(runDir, rowId, e) || !safetyConfirmed || !sameSelection()) return;
            const exact = r?.ok && r.manualCleanup === true && r.action === 'delete' && r.entryId === identity.entryId
              && r.recordId === identity.recordId && r.target === identity.target && typeof r.token === 'string'
              && Array.isArray(r.reviewFields) && r.reviewFields.length <= 300
              && r.reviewFields.every(f => typeof f.label === 'string' && typeof f.displayValue === 'string');
            plan = exact ? r : null;
            message = exact ? '已回读当前测试对象，请核对返回字段后确认人工清理；旧基线不会重建' : failure(r?.ok ? { code: 'FEISHU_READBACK_INVALID' } : r);
          });
        }, configDirty || !safetyConfirmed);
        manual.dataset.manualCleanup = 'true'; writeBody.append(manual);
      }
    }
    if (ownedAbsenceNotice?.runDir === currentRun && ownedAbsenceNotice.target === connection.target
      && (!recordId || ownedAbsenceNotice.recordId === recordId)) {
      const notice = el('div', 'feishu-warning', `工作项 ${ownedAbsenceNotice.recordId}：${ownedAbsenceNotice.text}`);
      notice.dataset.ownedAbsenceStatus = 'true'; notice.setAttribute('role', 'status'); writeBody.append(notice);
    }
    if (!records.length) writeBody.append(el('div', 'feishu-empty', '暂无本软件创建的记录'));
    else if (!records.some(r => r.status === 'verified' && r.recordId && !r.cleanupBlocked)) {
      writeBody.append(el('div', 'feishu-empty', '暂无可直接操作记录'));
    }
    if (records.some(r => r.status !== 'deleted' && r.cleanupBlocked)) writeBody.append(el('div', 'feishu-warning', errors.FEISHU_CLEANUP_BLOCKED));
  }
  if (action === 'create' && !selected) writeBody.append(el('div', 'feishu-empty', '尚未选择本次达人'));
  if (action !== 'delete' && (action === 'create' ? selected : recordId)) {
    const grid = el('div', 'feishu-grid');
    for (const f of [...connection.fields].sort((a, b) => fieldOrder.indexOf(a.name) - fieldOrder.indexOf(b.name))) {
      if (f.generated) {
        if (action === 'create') grid.append(field(f.name, el('div', '', '提交时自动填写当前时间')));
        continue;
      }
      if (action === 'update' && ['账号昵称', '小红书ID', '平台'].includes(f.name)) continue;
      let control;
      if (f.type === 'select') {
        control = el('select', 'tpl-input'); control.disabled = busy; control.append(new Option('请选择', ''));
        for (const o of f.options) control.append(new Option(o.label, o.value));
        control.value = draft[f.key] || '';
        control.addEventListener('change', () => { draft[f.key] = control.value; plan = null; });
      } else if (f.name === '其他备注') {
        control = el('textarea', 'tpl-input'); control.value = draft[f.key] || ''; control.rows = 3; control.disabled = busy;
        control.addEventListener('input', () => { draft[f.key] = control.value; plan = null; });
      } else control = input(draft[f.key], v => { draft[f.key] = v; plan = null; });
      if (f.name === '小红书ID') { control.value = accountNumber; draft[f.key] = accountNumber; control.readOnly = true; }
      const wrap = field(f.name + (f.required ? ' *' : ''), control);
      if (f.name === '其他备注') wrap.classList.add('full-width');
      if (action === 'update') wrap.prepend(check(`修改${f.name}`, checkedFields.has(f.key), v => {
        if (v) checkedFields.add(f.key); else checkedFields.delete(f.key); plan = null;
      })); grid.append(wrap);
    }
    writeBody.append(grid);
  }
  const mutationConnection = connection, mutationAction = action, mutationRecordId = recordId, mutationTarget = connection.target;
  const mutationMode = recordMode;
  const previewContextAllowed = () => action === mutationAction && connection === mutationConnection
    && connection.target === mutationTarget && recordId === mutationRecordId && recordMode === mutationMode && !configDirty;
  const mutationMatches = records.filter(r => testRecord(r) && r.recordId === mutationRecordId && r.target === mutationTarget);
  const mutationEntryId = mutationMatches.length === 1 ? mutationMatches[0].entryId : '';
  const mutationAllowed = () => previewContextAllowed() && action !== 'create'
    && typeof mutationEntryId === 'string' && !!mutationEntryId
    && records.filter(r => r.recordId === mutationRecordId && r.target === mutationTarget).length === 1
    && records.some(r => r.recordId === mutationRecordId && r.target === mutationTarget
      && r.entryId === mutationEntryId && r.status === 'verified' && !r.cleanupBlocked);
  const manualCleanupAllowed = () => previewContextAllowed() && action === 'delete'
    && typeof mutationEntryId === 'string' && !!mutationEntryId
    && records.filter(r => r.recordId === mutationRecordId && r.target === mutationTarget).length === 1
    && records.some(r => r.recordId === mutationRecordId && r.target === mutationTarget
      && r.entryId === mutationEntryId && r.status === 'verified' && r.cleanupBlocked === true);
  const prepareButton = button(action === 'delete' ? '预览精确清理对象' : '预览写入字段', () => void run(async ({ runDir, rowId, e }) => {
    if (!previewContextAllowed()) { plan = null; return; }
    if (mutationAction !== 'create' && (!safetyConfirmed || !mutationAllowed())) { plan = null; return; }
    if (action === 'create') {
      if (!await ensureOperatorFresh({ runDir, rowId, e }) || !previewContextAllowed()) { message = operatorInvalidReason || errors.FEISHU_OPERATOR_CONFIRMATION_REQUIRED; return; }
    }
    plan = null;
    const values = action === 'update' ? Object.fromEntries(Object.entries(draft).filter(([k]) => checkedFields.has(k))) : { ...draft };
    const inspectedOperator = operator, approvalRevision = maintainerRevision;
    const r = await api.prepare({ action: mutationAction, recordMode: mutationMode, runDir, rowId, values, recordId: mutationRecordId, safetyConfirmed,
      operatorToken: operator?.token, operatorConfirmed });
    if (!valid(runDir, rowId, e)) return;
    if (!previewContextAllowed()) { plan = null; return; }
    if (mutationAction === 'create' && (maintainerRevision !== approvalRevision || operator !== inspectedOperator
      || !operatorReady() || !operatorConfirmed || !safetyConfirmed || !accountConfirmed
      || JSON.stringify(draft) !== JSON.stringify(values))) { plan = null; return; }
    if (mutationAction !== 'create' && (!safetyConfirmed || !mutationAllowed())) { plan = null; return; }
    plan = r?.ok ? r : null; message = r?.ok ? '预览已核实，尚未写入' : failure(r);
  }, { requireSave: action === 'create' }), action === 'create'
    ? !selected || !accountConfirmed || !safetyConfirmed || !preparationReady() || !operatorConfirmed || configDirty
    : !safetyConfirmed || !mutationAllowed());
  prepareButton.dataset.prepare = 'true'; writeBody.append(prepareButton);
  if (plan) {
    const captured = plan;
    const preview = el('div', 'feishu-write-preview');
    preview.append(el('div', '', `目标 ${plan.target}`), el('strong', '', plan.name));
    if (plan.recordId) preview.append(el('div', '', `工作项 ${plan.recordId}`));
    if (plan.maintainer) preview.append(el('strong', '', `${plan.maintainer.roleName}：${plan.maintainer.name}`));
    if (captured.manualCleanup === true) {
      preview.append(el('div', 'feishu-warning', '人工清理整个云端测试对象；旧记录保护不解除，不授予修改权限。'));
      if (captured.updaterChanged) preview.append(el('div', 'feishu-warning', '当前更新人与创建身份不同，请核对返回字段。'));
      for (const f of captured.reviewFields || []) preview.append(el('div', '', `${f.label}：${f.displayValue}`));
      preview.append(check('已核对返回字段及目标，只删除这条 AI 测试记录（不承诺可恢复）', manualCleanupApproval === captured, v => {
        manualCleanupApproval = v && plan === captured && manualCleanupAllowed() ? captured : null; ctx.rerender();
      }));
    }
    for (const f of plan.fields || []) {
      const descriptor = connection.fields.find(x => x.key === f.field_key);
      if (descriptor?.generated === 'contact_time') {
        preview.append(el('div', '', `${descriptor.name}：提交时自动填写当前时间`)); continue;
      }
      const display = v => typeof v === 'object' && v ? descriptor?.options.find(o => o.value === v.value)?.label || v.value : String(v ?? '');
      preview.append(el('div', '', `${descriptor?.name || f.field_key}：${f.before !== undefined ? `${display(f.before)} → ` : ''}${display(f.field_value)}`));
    }
    const cleanupAllowed = () => captured.manualCleanup === true ? manualCleanupAllowed() && manualCleanupApproval === captured : mutationAllowed();
    preview.append(button(captured.manualCleanup === true ? '删除云端测试记录' : plan.action === 'delete' ? '确认删除该测试记录' : '确认写入飞书', () => {
      if (captured.manualCleanup === true && manualCleanupApproval !== captured) return;
      if (captured.action !== 'create' && (!cleanupAllowed() || captured.action !== mutationAction
        || captured.recordId !== mutationRecordId || captured.target !== mutationTarget)) { plan = null; ctx.rerender(); return; }
      if (captured.action === 'create') {
        expireOperatorIfNeeded();
        if (!operatorReady() || !operatorConfirmed || configDirty) { message = operatorInvalidReason || errors.FEISHU_OPERATOR_CONFIRMATION_REQUIRED; ctx.rerender(); return; }
      }
      if (plan !== captured || !safetyConfirmed || configDirty) { message = '字段或确认已改变，请重新预览后再确认'; ctx.rerender(); return; }
      if (!confirm(`${captured.action === 'delete' ? '删除（未承诺可恢复）' : captured.action === 'create' ? '新建' : '修改'}：${captured.name}\n目标：${captured.target}\n${captured.recordId || (captured.recordMode === 'production' ? '' : captured.batch)}\n${captured.maintainer ? `${captured.maintainer.roleName}：${captured.maintainer.name}\n` : ''}${captured.action === 'create' ? '允许飞书新建通知；不发送邀约、不推进流程。\n' : ''}确认本次操作？`)) return;
      void run(async ({ runDir, rowId, e }) => {
        if (captured.action !== 'create' && (!cleanupAllowed() || captured.action !== mutationAction
          || captured.recordId !== mutationRecordId || captured.target !== mutationTarget)) { plan = null; return; }
        if (plan !== captured || !safetyConfirmed || configDirty) { message = '字段或确认已改变，请重新预览后再确认'; return; }
        if (captured.action === 'create') {
          expireOperatorIfNeeded();
          if (!operatorReady() || !operatorConfirmed || configDirty) { message = operatorInvalidReason || errors.FEISHU_OPERATOR_CONFIRMATION_REQUIRED; return; }
        }
        plan = null;
        const r = await api.execute({ token: captured.token, confirmed: true,
          ...(captured.manualCleanup === true ? { manualCleanupConfirmed: true, reviewedRecordId: captured.recordId } : {}) });
        const currentScope = () => valid(runDir, rowId, e) && connection === mutationConnection
          && connection.target === mutationTarget && action === mutationAction && recordId === mutationRecordId && !configDirty;
        if (!currentScope()) return;
        message = r?.ok ? `${r.action === 'delete' ? '清理' : r.action === 'create' ? '新建' : '修改'}成功，已回读核实 · 工作项 ${r.recordId}` : failure(r);
        const list = await api.listRecords(); if (!currentScope()) return;
        if (list?.ok) records = list.records;
        if (r?.ok && r.action === 'delete') { recordId = ''; manualCleanupApproval = null; }
      }, { requireSave: captured.action === 'create' });
    }, captured.action !== 'create' && !cleanupAllowed(), true)); writeBody.append(preview);
  }
  for (const r of records.filter(r => r.status === 'unknown')) {
    const warning = el('div', 'feishu-warning', `结果待核对：${r.name} · ${r.recordId || '未取得ID'} · 禁止重复提交`);
    warning.append(button('只读核对结果', () => void run(async ({ runDir, rowId, e }) => {
      const activeConnection = connection;
      const current = () => valid(runDir, rowId, e) && connection === activeConnection && !configDirty;
      if (!current() || (r.target || activeConnection.target) !== activeConnection.target) return;
      const result = await api.reconcile({ entryId: r.entryId });
      if (!current()) return;
      const accepted = result?.ok && acceptReconciliation(r.entryId, result, { ...r, target: r.target || activeConnection.target,
        result: { entryId: r.entryId, recordId: r.recordId }, account: r.accountNumber || '' });
      if (!accepted) { message = failure(result?.ok ? { code: 'FEISHU_RECONCILE_UNCERTAIN' } : result, false); return; }
      message = `核对完成 · ${result.recordId} · ${result.status}`;
      await refreshRecords(current);
    }))); writeBody.append(warning);
  }
  root.append(write);
  return root;
}
