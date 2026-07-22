const assert = require('assert');

const {
  contactFieldCount,
  detectXhsRisk,
  firstProfileUrl,
  isIgnorableXhsNavigationError,
  mergeContactFields,
  normalizeXhsProfileUrl,
  parsePublicContactText
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

console.log('xhs_contact_enrichment.test.js OK');
