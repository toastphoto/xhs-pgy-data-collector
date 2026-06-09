const assert = require('assert');
const { openDb, initDb, dbGet } = require('../lib/db/sqlite');

(async () => {
  const db = await openDb(':memory:');
  initDb(db);

  const t1 = dbGet(db, "select name from sqlite_master where type='table' and name='runs'");
  const t2 = dbGet(db, "select name from sqlite_master where type='table' and name='creators'");
  const t3 = dbGet(db, "select name from sqlite_master where type='table' and name='notes'");

  assert.ok(t1 && t2 && t3, 'tables should exist');
  console.log('sqlite.test.js OK');
})();
