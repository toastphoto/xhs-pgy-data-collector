const assert = require('assert');

const {
  XHS_PAGE_READ_STATUS,
  classifyXhsProfilePageRead,
  contactFieldCount,
  detectXhsLogin,
  detectXhsRisk,
  extractPgyCreatorEntityId,
  extractPublicEmails,
  extractXhsProfileEntityId,
  extractVisibleMailtoEmails,
  firstProfileUrl,
  isXhsProfileSnapshotStable,
  isIgnorableXhsNavigationError,
  mergeContactFields,
  normalizePgyCreatorUrl,
  normalizeXhsProfileUrl,
  parsePublicContactSnapshot,
  parsePublicContactText,
  xhsProfileMatchesPgyCreator,
  xhsProfileSourceMatchesPgyCreator,
  xhsProfileUrlFromPgyCreator
} = require('../lib/xhs_contact_enrichment');

assert.deepStrictEqual(
  detectXhsRisk(
    'https://www.xiaohongshu.com/website-login/captcha?verifyType=124',
    'Requests too frequent. Try again later.'
  ),
  { riskDetected: true, riskText: 'requests too frequent' }
);
assert.deepStrictEqual(
  detectXhsRisk('https://www.xiaohongshu.com/website-login/captcha?verifyType=124', ''),
  { riskDetected: true, riskText: '安全验证' }
);
assert.deepStrictEqual(
  detectXhsRisk('https://www.xiaohongshu.com/user/profile/abc123', '普通达人简介'),
  { riskDetected: false, riskText: '' }
);

assert.strictEqual(
  normalizeXhsProfileUrl('https://www.xiaohongshu.com/user/profile/abc123?xsec_token=do-not-store'),
  'https://www.xiaohongshu.com/user/profile/abc123'
);
assert.strictEqual(normalizeXhsProfileUrl('https://pgy.xiaohongshu.com/user/profile/abc123'), '');
assert.strictEqual(firstProfileUrl(['', '/relative', 'xiaohongshu.com/user/profile/user_1']), 'https://www.xiaohongshu.com/user/profile/user_1');
assert.strictEqual(
  extractPgyCreatorEntityId('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list'),
  'abc123'
);
assert.strictEqual(extractXhsProfileEntityId('https://www.xiaohongshu.com/user/profile/ABC123?xsec_token=private'), 'abc123');
assert.strictEqual(
  xhsProfileMatchesPgyCreator(
    'https://www.xiaohongshu.com/user/profile/abc123?xsec_token=private',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc123'
  ),
  true
);
assert.strictEqual(
  xhsProfileMatchesPgyCreator(
    'https://www.xiaohongshu.com/user/profile/wrong-user',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc123'
  ),
  false
);
assert.strictEqual(
  xhsProfileUrlFromPgyCreator('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list'),
  'https://www.xiaohongshu.com/user/profile/abc123'
);
assert.strictEqual(xhsProfileUrlFromPgyCreator('https://example.com/blogger-detail/abc123'), '');
assert.strictEqual(
  normalizePgyCreatorUrl('https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list'),
  'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'
);
assert.strictEqual(
  xhsProfileSourceMatchesPgyCreator(
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=old',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123?source=list'
  ),
  true
);
assert.strictEqual(
  xhsProfileSourceMatchesPgyCreator(
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/other',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/ABC123'
  ),
  false
);
assert.strictEqual(
  xhsProfileMatchesPgyCreator(
    'https://www.xiaohongshu.com/user/profile/xhs-different-id',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/pgy-id'
  ),
  false
);
assert.strictEqual(
  xhsProfileSourceMatchesPgyCreator(
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/pgy-id',
    'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/pgy-id'
  ),
  true
);

assert.deepStrictEqual(
  parsePublicContactText('商务合作：hello.brand@example.com，微信号: Brand_vx88'),
  { email: 'hello.brand@example.com', wechatId: 'Brand_vx88', phone: '' }
);
assert.deepStrictEqual(
  parsePublicContactText('合作电话 +86 138-0000-0000'),
  { email: '', wechatId: '', phone: '13800000000' }
);
assert.deepStrictEqual(
  parsePublicContactText('微信：13800000000'),
  { email: '', wechatId: '', phone: '13800000000' }
);
assert.deepStrictEqual(
  parsePublicContactText('小红书号：42787254202 粉丝数 31.1w 获赞与收藏 468.7w'),
  { email: '', wechatId: '', phone: '' }
);

assert.deepStrictEqual(
  mergeContactFields(
    { email: 'manual@example.com', wechatId: '', phone: '' },
    { email: 'public@example.com', wechatId: 'wx_public', phone: '13800000000' }
  ),
  { email: 'manual@example.com', wechatId: 'wx_public', phone: '13800000000' }
);
assert.strictEqual(contactFieldCount({ email: 'a@example.com', phone: '13800000000' }), 2);
assert.strictEqual(
  isIgnorableXhsNavigationError(
    new Error("(-3) loading 'https://www.xiaohongshu.com/user/profile/abc123'"),
    'https://www.xiaohongshu.com/user/profile/abc123?xsec_token=temporary',
    'https://www.xiaohongshu.com/user/profile/abc123'
  ),
  true
);
assert.strictEqual(
  isIgnorableXhsNavigationError(new Error('ERR_ABORTED'), 'https://www.xiaohongshu.com/explore', 'https://www.xiaohongshu.com/user/profile/abc123'),
  false
);

assert.deepStrictEqual(
  parsePublicContactText('小红书号：42787254202 超级宠粉感谢关注！我们一起做电子闺蜜吧 📮2118262937@qq.com'),
  { email: '2118262937@qq.com', wechatId: '', phone: '' }
);

assert.deepStrictEqual(
  extractPublicEmails('商务邮箱：Hello.Brand＠Example．COM；备用 hello @ backup . cn'),
  ['hello.brand@example.com', 'hello@backup.cn']
);
assert.deepStrictEqual(
  extractPublicEmails('合作请联系 hello（at）example［dot］com'),
  ['hello@example.com']
);
assert.deepStrictEqual(extractPublicEmails('合作邮箱 boffyayale❄️163.com'), ['boffyayale@163.com']);
assert.deepStrictEqual(extractPublicEmails('商务联系 j.n.a📮163.com'), ['j.n.a@163.com']);
assert.deepStrictEqual(extractPublicEmails('邮箱 cookiemm3@🐧.com'), ['cookiemm3@qq.com']);
assert.deepStrictEqual(extractPublicEmails('今天 A❄️163.com 降温'), []);
assert.deepStrictEqual(extractPublicEmails('无效地址 bad..dots@example.com'), []);
assert.deepStrictEqual(
  extractVisibleMailtoEmails([
    'https://example.com/not-mail',
    'mailto:Hello.Brand%40Example.com?subject=Business',
    'MAILTO:second@example.cn'
  ]),
  ['hello.brand@example.com', 'second@example.cn']
);
assert.deepStrictEqual(
  parsePublicContactSnapshot({
    profileText: '小红书号：123456 商务合作欢迎联系',
    visibleMailtoHrefs: ['mailto:creator%40example.com?subject=hello']
  }),
  { email: 'creator@example.com', wechatId: '', phone: '' }
);
assert.deepStrictEqual(
  parsePublicContactSnapshot({
    profileText: '邮箱：visible@example.com',
    visibleMailtoHrefs: ['mailto:footer@example.com']
  }),
  { email: 'visible@example.com', wechatId: '', phone: '' }
);

assert.deepStrictEqual(
  detectXhsLogin('https://www.xiaohongshu.com/login', '', {}),
  { loginRequired: true, loginText: '小红书登录页' }
);
assert.deepStrictEqual(
  detectXhsLogin(
    'https://www.xiaohongshu.com/user/profile/abc123',
    '页面文案里出现“登录后查看更多”不代表登录弹窗可见',
    {}
  ),
  { loginRequired: false, loginText: '' }
);

const stableProfileSnapshot = {
  url: 'https://www.xiaohongshu.com/user/profile/abc123?xsec_token=temporary',
  documentReadyState: 'complete',
  bodyText: '创作者主页 小红书号：abc123',
  profileText: '小红书号：abc123 商务邮箱 creator＠example．com',
  visibleMailtoHrefs: ['mailto:creator@example.com'],
  profileRootVisible: true,
  profileIdVisible: true
};

const firstRead = classifyXhsProfilePageRead(stableProfileSnapshot, null, {
  targetUrl: 'https://www.xiaohongshu.com/user/profile/abc123'
});
assert.strictEqual(firstRead.status, XHS_PAGE_READ_STATUS.NOT_READY);
assert.strictEqual(firstRead.code, 'XHS_PROFILE_STABILIZING');
assert.strictEqual(firstRead.retryable, true);

const stableRead = classifyXhsProfilePageRead(stableProfileSnapshot, stableProfileSnapshot, {
  targetUrl: 'https://www.xiaohongshu.com/user/profile/abc123'
});
assert.strictEqual(stableRead.status, XHS_PAGE_READ_STATUS.READY);
assert.strictEqual(stableRead.profileReady, true);
assert.deepStrictEqual(stableRead.contact, {
  email: 'creator@example.com',
  wechatId: '',
  phone: ''
});
assert.strictEqual(isXhsProfileSnapshotStable(stableProfileSnapshot, stableProfileSnapshot), true);

const changedRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, profileText: `${stableProfileSnapshot.profileText} 刚刚更新` },
  stableProfileSnapshot
);
assert.strictEqual(changedRead.code, 'XHS_PROFILE_STABILIZING');
assert.strictEqual(changedRead.profileReady, false);

const loadingRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, documentReadyState: 'loading' },
  stableProfileSnapshot
);
assert.strictEqual(loadingRead.code, 'XHS_PROFILE_DOCUMENT_LOADING');
assert.strictEqual(loadingRead.retryable, true);

const nestedLoaderFirstRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, loadingIndicatorVisible: true },
  null
);
assert.strictEqual(nestedLoaderFirstRead.code, 'XHS_PROFILE_STABILIZING');
const nestedLoaderStableRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, loadingIndicatorVisible: true },
  { ...stableProfileSnapshot, loadingIndicatorVisible: true }
);
assert.strictEqual(nestedLoaderStableRead.code, 'XHS_PROFILE_READY');

const identityMissingLoaderRead = classifyXhsProfilePageRead(
  {
    ...stableProfileSnapshot,
    profileText: '',
    visibleContactText: '',
    profileRootVisible: false,
    profileIdVisible: false,
    loadingIndicatorVisible: true
  },
  null
);
assert.strictEqual(identityMissingLoaderRead.code, 'XHS_PROFILE_DOCUMENT_LOADING');

const loginRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, loginModalVisible: true },
  stableProfileSnapshot
);
assert.strictEqual(loginRead.status, XHS_PAGE_READ_STATUS.LOGIN_REQUIRED);
assert.strictEqual(loginRead.manualIntervention, true);
assert.strictEqual(loginRead.retryable, false);

const riskRead = classifyXhsProfilePageRead(
  { ...stableProfileSnapshot, bodyText: '访问过于频繁，请稍后再试', loginModalVisible: true },
  stableProfileSnapshot
);
assert.strictEqual(riskRead.status, XHS_PAGE_READ_STATUS.RISK_DETECTED);
assert.strictEqual(riskRead.code, 'XHS_RISK_DETECTED');
assert.strictEqual(riskRead.manualIntervention, true);
assert.strictEqual(riskRead.loginRequired, false);

const wrongProfileRead = classifyXhsProfilePageRead(stableProfileSnapshot, stableProfileSnapshot, {
  targetUrl: 'https://www.xiaohongshu.com/user/profile/different-user'
});
assert.strictEqual(wrongProfileRead.code, 'XHS_PROFILE_URL_MISMATCH');
assert.strictEqual(wrongProfileRead.retryable, true);

console.log('xhs_contact_enrichment.test.js OK');
