const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

const {
  buildContactRowsFromRun,
  exportContactRowsWorkbook,
  exportContactWorkbook,
  exportXiaomifengWorkbook,
  getContactPreview,
  makeLegacyRowId,
  summarizeContactWorkbookRows,
  timestampForFilename
} = require('../lib/contact_sheet');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-contact-sheet-'));
const runDir = path.join(tmp, 'run_2026-06-30T00-00-00-000Z');
const childDir = path.join(runDir, '1_creator');
fs.mkdirSync(childDir, { recursive: true });

fs.writeFileSync(
  path.join(runDir, 'meta.json'),
  JSON.stringify(
    {
      signingTask: {
        candidates: [
          {
            pgy_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc',
            creator_name: '候选达人',
            status: 'excluded',
            priority: 'P2',
            excludeReason: '候选阶段排除',
            note: '候选备注'
          }
        ]
      }
    },
    null,
    2
  ),
  'utf-8'
);

fs.writeFileSync(
  path.join(childDir, 'raw_result.json'),
  JSON.stringify(
    {
      platform: 'pgy',
      creator_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc',
      creator_summary: {
        creator_name: '测试达人',
        xhs_id: 'xhs_001',
        xhs_profile_url: 'https://www.xiaohongshu.com/user/profile/saved_profile',
        creator_url: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/abc',
        tags: '家居, 好物',
        location: '上海'
      },
      metrics: {
        '粉丝数': '4.2w',
        '图文笔记一口价': '¥3,000',
        '视频笔记一口价': '¥8,000',
        '近90天笔记阅读中位数': '12,000'
      },
      quality_report: { score: 92 }
    },
    null,
    2
  ),
  'utf-8'
);

const rows = buildContactRowsFromRun(runDir, {
  defaultGroupTag: 'FILA',
  defaultGreeting: '您好，想沟通一下合作。'
});

assert.strictEqual(rows.files, 1);
assert.strictEqual(rows.contactRows.length, 1);
assert.strictEqual(rows.contactRows[0]['达人昵称'], '候选达人');
assert.strictEqual(rows.contactRows[0]['跟进状态'], '不建联');
assert.strictEqual(rows.contactRows[0]['微信分组标签'], 'FILA');
assert.strictEqual(rows.contactRows[0]['打招呼内容'], '您好，想沟通一下合作。');
assert.ok(rows.contactRows[0]['推荐理由'].includes('采集质量 92'));
assert.strictEqual(rows.contactRows[0]['选择建联'], '否');
assert.strictEqual(rows.contactRows[0]['排除原因'], '候选阶段排除');
assert.strictEqual(rows.xiaomifengRows.length, 0);
assert.strictEqual(rows.pendingContactRows.length, 0);
assert.strictEqual(rows.summary.total, 1);
assert.strictEqual(rows.summary.selected, 0);
assert.strictEqual(rows.summary.excluded, 1);
assert.strictEqual(rows.summary.followupStatusCounts['不建联'], 1);

const preview = getContactPreview(runDir);
assert.strictEqual(preview.summary.total, 1);
assert.strictEqual(preview.summary.selected, 0);
assert.strictEqual(preview.rawFiles, 1);
assert.ok(preview.rows[0].rowId);
assert.strictEqual(preview.rows[0].priority, 'P2');
assert.strictEqual(preview.rows[0].excludeReason, '候选阶段排除');
assert.strictEqual(preview.rows[0].note, '候选备注');
assert.strictEqual(preview.rows[0].xhsProfileUrl, 'https://www.xiaohongshu.com/user/profile/saved_profile');

const manualOptInRunDir = path.join(tmp, 'run_manual_opt_in');
const manualOptInChildDir = path.join(manualOptInRunDir, '1_creator');
fs.mkdirSync(manualOptInChildDir, { recursive: true });
fs.copyFileSync(path.join(childDir, 'raw_result.json'), path.join(manualOptInChildDir, 'raw_result.json'));
const manualOptInPreview = getContactPreview(manualOptInRunDir);
assert.strictEqual(manualOptInPreview.rows[0].selected, false);
assert.strictEqual(manualOptInPreview.summary.selected, 0);
assert.strictEqual(manualOptInPreview.rows[0].followupStatus, '');

const reviewed = buildContactRowsFromRun(runDir, {
  defaultGroupTag: 'FILA',
  defaultGreeting: '您好，想沟通一下合作。',
  reviewRows: [
    {
      rowId: preview.rows[0].rowId,
      selected: false,
      followupStatus: '已拒绝',
      priority: 'P1',
      excludeReason: '报价偏高',
      note: '先不联系',
      wechatId: 'wx_test'
    }
  ]
});
assert.strictEqual(reviewed.contactRows[0]['选择建联'], '否');
assert.strictEqual(reviewed.contactRows[0]['跟进状态'], '已拒绝');
assert.strictEqual(reviewed.contactRows[0]['优先级'], 'P1');
assert.strictEqual(reviewed.contactRows[0]['排除原因'], '报价偏高');
assert.strictEqual(reviewed.contactRows[0]['备注'], '先不联系');
assert.strictEqual(reviewed.contactRows[0]['微信号'], 'wx_test');
assert.strictEqual(reviewed.xiaomifengRows.length, 0);
assert.strictEqual(reviewed.pendingContactRows.length, 0);
assert.strictEqual(reviewed.summary.followupStatusCounts['已拒绝'], 1);

const directSummary = summarizeContactWorkbookRows(reviewed.previewRows);
assert.strictEqual(directSummary.total, 1);
assert.strictEqual(directSummary.followupStatusCounts['已拒绝'], 1);

const pendingExported = exportContactWorkbook(runDir, {
  defaultGroupTag: 'FILA',
  defaultGreeting: '您好，想沟通一下合作。',
  reviewRows: [{ rowId: preview.rows[0].rowId, selected: true }]
});
assert.ok(fs.existsSync(pendingExported.outPath));
assert.strictEqual(pendingExported.savedAs, false);
assert.strictEqual(pendingExported.requestedOutPath, pendingExported.outPath);
assert.strictEqual(pendingExported.saveFallbackCode, '');
assert.strictEqual(pendingExported.creators, 1);
assert.strictEqual(pendingExported.xiaomifengRows, 0);
assert.strictEqual(pendingExported.pendingContactRows, 1);

const pendingWb = XLSX.readFile(pendingExported.outPath);
assert.ok(pendingWb.SheetNames.includes('建联表'));
assert.ok(pendingWb.SheetNames.includes('蒲公英邀约表'));
assert.ok(pendingWb.SheetNames.includes('邮件建联表'));
assert.ok(pendingWb.SheetNames.includes('小蜜蜂导入表'));
assert.ok(pendingWb.SheetNames.includes('待补联系方式'));
assert.strictEqual(pendingWb.SheetNames[0], '建联概览');

const pendingSummary = XLSX.utils.sheet_to_json(pendingWb.Sheets['建联概览']);
assert.strictEqual(pendingSummary.find((row) => row['指标'] === '总达人')['数量'], 1);
assert.strictEqual(pendingSummary.find((row) => row['指标'] === '待补联系方式')['数量'], 1);
assert.strictEqual(pendingSummary.find((row) => row['指标'] === '小蜜蜂导入行')['数量'], 0);
assert.strictEqual(pendingSummary.find((row) => row['指标'] === '跟进状态：待建联')['数量'], 1);
const pendingContact = XLSX.utils.sheet_to_json(pendingWb.Sheets['建联表']);
assert.strictEqual(pendingContact[0]['达人昵称'], '候选达人');
assert.strictEqual(pendingContact[0]['选择建联'], '是');
const pendingXmf = XLSX.utils.sheet_to_json(pendingWb.Sheets['小蜜蜂导入表']);
assert.strictEqual(pendingXmf.length, 0);
const pendingPgyInvite = XLSX.utils.sheet_to_json(pendingWb.Sheets['蒲公英邀约表']);
assert.strictEqual(pendingPgyInvite.length, 0);
const pendingEmail = XLSX.utils.sheet_to_json(pendingWb.Sheets['邮件建联表']);
assert.strictEqual(pendingEmail.length, 0);
const pendingRows = XLSX.utils.sheet_to_json(pendingWb.Sheets['待补联系方式'], { defval: '' });
assert.strictEqual(pendingRows[0]['达人昵称'], '候选达人');
assert.ok(Object.prototype.hasOwnProperty.call(pendingRows[0], '微信号'));
assert.ok(Object.prototype.hasOwnProperty.call(pendingRows[0], '手机号'));
assert.strictEqual(pendingRows[0]['跟进状态'], '待建联');

const exported = exportContactWorkbook(runDir, {
  defaultGroupTag: 'FILA',
  defaultGreeting: '您好，想沟通一下合作。',
  reviewRows: [{ rowId: preview.rows[0].rowId, selected: true, wechatId: 'wx_test' }]
});
assert.ok(fs.existsSync(exported.outPath));
assert.strictEqual(exported.outPath, pendingExported.outPath);
assert.strictEqual(exported.savedAs, false);
assert.strictEqual(exported.creators, 1);
assert.strictEqual(exported.xiaomifengRows, 1);
assert.strictEqual(exported.pendingContactRows, 0);
assert.strictEqual(exported.summary.selectedWithContact, 1);
assert.strictEqual(exported.summary.selectedMissingContact, 0);

const wb = XLSX.readFile(exported.outPath);
assert.ok(wb.SheetNames.includes('建联概览'));
assert.ok(wb.SheetNames.includes('建联表'));
assert.ok(wb.SheetNames.includes('蒲公英邀约表'));
assert.ok(wb.SheetNames.includes('邮件建联表'));
assert.ok(wb.SheetNames.includes('小蜜蜂导入表'));
assert.ok(wb.SheetNames.includes('待补联系方式'));

const contact = XLSX.utils.sheet_to_json(wb.Sheets['建联表']);
assert.strictEqual(contact[0]['达人昵称'], '候选达人');
assert.strictEqual(contact[0]['选择建联'], '是');
assert.strictEqual(contact[0]['跟进状态'], '待建联');
const xmf = XLSX.utils.sheet_to_json(wb.Sheets['小蜜蜂导入表']);
assert.strictEqual(xmf[0]['微信号码'], 'wx_test');
assert.strictEqual(xmf[0]['智能备注'], '{MMDD}-{昵称}');

const xmfDedicated = exportXiaomifengWorkbook(runDir, [{
  ...preview.rows[0],
  selected: true,
  contactChannel: '微信建联',
  wechatId: 'wx_test',
  groupTag: 'FILA',
  greeting: '您好，想沟通一下合作。'
}], {
  xiaomifengSmartRemark: '{YYMMDD}-{昵称}',
  xiaomifengTaskWechat: '运营微信A',
  timestamp: '20260715-120000'
});
assert.ok(fs.existsSync(xmfDedicated.outPath));
assert.strictEqual(xmfDedicated.rows, 1);
const xmfDedicatedWb = XLSX.readFile(xmfDedicated.outPath);
assert.deepStrictEqual(xmfDedicatedWb.SheetNames, ['Sheet1', 'Sheet2', 'Sheet3']);
const xmfDedicatedRows = XLSX.utils.sheet_to_json(xmfDedicatedWb.Sheets.Sheet1);
assert.deepStrictEqual(Object.keys(xmfDedicatedRows[0]).slice(0, 5), [
  '微信号码',
  '智能备注',
  '标签',
  '发送添加朋友申请',
  '任务微信(为空则智能分配)'
]);
assert.ok(Object.keys(xmfDedicatedRows[0])[5].startsWith('智能备注通配符说明'));
assert.strictEqual(xmfDedicatedRows[0]['微信号码'], 'wx_test');
assert.strictEqual(xmfDedicatedRows[0]['智能备注'], '{YYMMDD}-{昵称}');
assert.strictEqual(xmfDedicatedRows[0]['标签'], 'FILA');
assert.strictEqual(xmfDedicatedRows[0]['发送添加朋友申请'], '您好，想沟通一下合作。');
assert.strictEqual(xmfDedicatedRows[0]['任务微信(为空则智能分配)'], '运营微信A');

const routedExported = exportContactRowsWorkbook(runDir, [
  {
    ...preview.rows[0],
    selected: true,
    contactChannel: '自动分流',
    email: 'creator@example.com',
    wechatId: '',
    phone: ''
  },
  {
    ...preview.rows[0],
    rowId: `${preview.rows[0].rowId}_pgy`,
    creatorName: '无联系方式达人',
    selected: true,
    contactChannel: '自动分流',
    email: '',
    wechatId: '',
    phone: ''
  },
  {
    ...preview.rows[0],
    rowId: `${preview.rows[0].rowId}_pgy_email`,
    creatorName: '蒲公英兼邮件达人',
    selected: true,
    contactChannel: '蒲公英邀约',
    email: 'pgy-and-email@example.com',
    wechatId: '',
    phone: ''
  }
], {
  suffix: '自动分流',
  timestamp: '20260630-130000',
  emailSubject: '合作沟通',
  emailBody: '您好，想沟通一下合作。',
  pgyBrandName: '品牌A',
  pgyProductName: '产品A'
});
assert.strictEqual(routedExported.emailContactRows, 2);
assert.strictEqual(routedExported.pgyInviteRows, 2);
assert.strictEqual(routedExported.xiaomifengRows, 0);
assert.strictEqual(routedExported.pendingContactRows, 0);
const routedWb = XLSX.readFile(routedExported.outPath);
const routedEmailRows = XLSX.utils.sheet_to_json(routedWb.Sheets['邮件建联表']);
assert.strictEqual(routedEmailRows[0]['邮箱'], 'creator@example.com');
assert.strictEqual(routedEmailRows[0]['邮件标题'], '合作沟通');
assert.strictEqual(routedEmailRows[1]['达人昵称'], '蒲公英兼邮件达人');
assert.strictEqual(routedEmailRows[1]['邮箱'], 'pgy-and-email@example.com');
const routedInviteRows = XLSX.utils.sheet_to_json(routedWb.Sheets['蒲公英邀约表']);
assert.strictEqual(routedInviteRows[0]['达人昵称'], '无联系方式达人');
assert.strictEqual(routedInviteRows[0]['品牌名'], '品牌A');
assert.strictEqual(routedInviteRows[1]['达人昵称'], '蒲公英兼邮件达人');

const filteredExported = exportContactRowsWorkbook(runDir, [
  {
    ...preview.rows[0],
    selected: true,
    followupStatus: '需二次跟进',
    priority: 'P1',
    wechatId: '',
    phone: '',
    note: '单独导出给同事补联系方式'
  }
], { suffix: '当前筛选', timestamp: '20260630-120000' });
assert.ok(fs.existsSync(filteredExported.outPath));
assert.ok(path.basename(filteredExported.outPath).includes('当前筛选'));
assert.ok(path.basename(filteredExported.outPath).includes('20260630-120000'));
assert.strictEqual(filteredExported.creators, 1);
assert.strictEqual(filteredExported.xiaomifengRows, 0);
assert.strictEqual(filteredExported.pendingContactRows, 1);
assert.strictEqual(filteredExported.summary.followupStatusCounts['需二次跟进'], 1);

const filteredWb = XLSX.readFile(filteredExported.outPath);
assert.strictEqual(filteredWb.SheetNames[0], '建联概览');
const filteredContact = XLSX.utils.sheet_to_json(filteredWb.Sheets['建联表']);
assert.strictEqual(filteredContact[0]['跟进状态'], '需二次跟进');
assert.strictEqual(filteredContact[0]['优先级'], 'P1');
const filteredPending = XLSX.utils.sheet_to_json(filteredWb.Sheets['待补联系方式'], { defval: '' });
assert.strictEqual(filteredPending[0]['备注'], '单独导出给同事补联系方式');

const fixedContactPath = path.join(runDir, `建联表_${path.basename(runDir)}.xlsx`);
const fallbackTimestamp = '20260812-101112';
const occupiedFallbackPath = path.join(
  runDir,
  `建联表_${path.basename(runDir)}_${fallbackTimestamp}.xlsx`
);
fs.writeFileSync(occupiedFallbackPath, 'existing fallback must not be overwritten', 'utf-8');

const originalWriteFile = XLSX.writeFile;
const writeAttempts = [];
XLSX.writeFile = (workbook, outPath, ...args) => {
  writeAttempts.push(outPath);
  if (outPath === fixedContactPath) {
    const error = new Error('EBUSY: resource busy or locked, open workbook');
    error.code = 'EBUSY';
    throw error;
  }
  return originalWriteFile.call(XLSX, workbook, outPath, ...args);
};

let lockedExported;
try {
  lockedExported = exportContactWorkbook(runDir, {
    reviewRows: [{ rowId: preview.rows[0].rowId, selected: true }],
    fallbackTimestamp
  });
} finally {
  XLSX.writeFile = originalWriteFile;
}

const expectedFallbackPath = path.join(
  runDir,
  `建联表_${path.basename(runDir)}_${fallbackTimestamp}_2.xlsx`
);
assert.deepStrictEqual(writeAttempts, [fixedContactPath]);
assert.strictEqual(lockedExported.requestedOutPath, fixedContactPath);
assert.strictEqual(lockedExported.outPath, expectedFallbackPath);
assert.strictEqual(lockedExported.savedAs, true);
assert.strictEqual(lockedExported.saveFallbackCode, 'EBUSY');
assert.ok(fs.existsSync(expectedFallbackPath));
assert.strictEqual(fs.readFileSync(occupiedFallbackPath, 'utf-8'), 'existing fallback must not be overwritten');
assert.ok(XLSX.readFile(expectedFallbackPath).SheetNames.includes('建联表'));

for (const lockCode of ['EPERM', 'EACCES']) {
  XLSX.writeFile = () => {
    const error = new Error(`${lockCode}: workbook is unavailable`);
    error.code = lockCode;
    throw error;
  };
  try {
    const lockResult = exportContactWorkbook(runDir, {
      reviewRows: [{ rowId: preview.rows[0].rowId, selected: true }],
      fallbackTimestamp: `${fallbackTimestamp}-${lockCode}`
    });
    assert.strictEqual(lockResult.savedAs, true);
    assert.strictEqual(lockResult.saveFallbackCode, lockCode);
    assert.ok(fs.existsSync(lockResult.outPath));
  } finally {
    XLSX.writeFile = originalWriteFile;
  }
}

XLSX.writeFile = () => {
  throw new Error('resource busy or locked, open workbook');
};
try {
  const messageLockedResult = exportContactWorkbook(runDir, {
    reviewRows: [{ rowId: preview.rows[0].rowId, selected: true }],
    fallbackTimestamp: `${fallbackTimestamp}-message`
  });
  assert.strictEqual(messageLockedResult.savedAs, true);
  assert.strictEqual(messageLockedResult.saveFallbackCode, 'RESOURCE_LOCKED');
  assert.ok(fs.existsSync(messageLockedResult.outPath));
} finally {
  XLSX.writeFile = originalWriteFile;
}

const nonLockError = new Error('ENOSPC: no space left on device');
nonLockError.code = 'ENOSPC';
XLSX.writeFile = () => {
  throw nonLockError;
};
try {
  assert.throws(
    () => exportContactWorkbook(runDir, {
      reviewRows: [{ rowId: preview.rows[0].rowId, selected: true }],
      fallbackTimestamp: `${fallbackTimestamp}-disk`
    }),
    (error) => error === nonLockError
  );
} finally {
  XLSX.writeFile = originalWriteFile;
}

const collisionRunDir = path.join(tmp, 'run_collision');
const collisionCreators = [
  { id: 'creator_one', name: '达人一', xhsId: 'xhs_one' },
  { id: 'creator_two', name: '达人二', xhsId: 'xhs_two' }
];
collisionCreators.forEach((creator, index) => {
  const dir = path.join(collisionRunDir, `${index + 1}_creator`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'raw_result.json'), JSON.stringify({
    creator_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${creator.id}`,
    creator_summary: {
      creator_name: creator.name,
      xhs_id: creator.xhsId,
      creator_url: `https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/${creator.id}`
    }
  }), 'utf-8');
});
const collisionPreview = getContactPreview(collisionRunDir);
assert.strictEqual(collisionPreview.rows.length, 2);
assert.notStrictEqual(collisionPreview.rows[0].rowId, collisionPreview.rows[1].rowId);

const legacyTarget = collisionPreview.rows.find((row) => row.creatorName === '达人一');
const legacyId = makeLegacyRowId({
  creatorUrl: legacyTarget.creatorUrl,
  xhsId: legacyTarget.xhsId,
  creatorName: legacyTarget.creatorName,
  index: collisionPreview.rows.indexOf(legacyTarget)
});
const migratedPreview = getContactPreview(collisionRunDir, {
  reviewRows: [{
    rowId: legacyId,
    email: 'only-one@example.com',
    xhsProfileUrl: 'https://www.xiaohongshu.com/user/profile/creator_one',
    contactCollectionStatus: 'profile_unavailable',
    contactCollectionCode: 'XHS_PROFILE_CONTENT_NOT_READY',
    contactCollectionError: '公开资料区域尚未出现'
  }]
});
assert.strictEqual(migratedPreview.rows.find((row) => row.creatorName === '达人一').email, 'only-one@example.com');
assert.strictEqual(migratedPreview.rows.find((row) => row.creatorName === '达人一').contactCollectionCode, 'XHS_PROFILE_CONTENT_NOT_READY');
assert.strictEqual(migratedPreview.rows.find((row) => row.creatorName === '达人一').contactCollectionError, '公开资料区域尚未出现');
assert.strictEqual(migratedPreview.rows.find((row) => row.creatorName === '达人二').email, '');

assert.strictEqual(timestampForFilename(new Date(2026, 5, 30, 9, 8, 7)), '20260630-090807');

console.log('contact_sheet.test.js OK');
