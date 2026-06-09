const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let SQL = null;

async function _getSQL() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file) => {
      // sql.js 会请求 sql-wasm.wasm
      // 打包后 wasm 会被 asarUnpack 到：<resources>/app.asar.unpacked/**/node_modules/sql.js/dist/sql-wasm.wasm
      const unpacked = process.resourcesPath
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file)
        : '';
      try {
        if (unpacked && fs.existsSync(unpacked)) return unpacked;
      } catch (_) {}
      return path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file);
    }
  });
  return SQL;
}

async function openDb(dbPath) {
  const SQL = await _getSQL();
  const p = String(dbPath || '').trim();
  if (!p || p === ':memory:') return new SQL.Database();
  if (fs.existsSync(p)) {
    const buf = fs.readFileSync(p);
    return new SQL.Database(new Uint8Array(buf));
  }
  return new SQL.Database();
}

function initDb(db) {
  if (!db) throw new Error('db is required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      run_dir TEXT,
      created_at TEXT,
      platform TEXT,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      creator_url TEXT,
      creator_name TEXT,
      xhs_id TEXT,
      tags TEXT,
      region TEXT,
      updated_at_text TEXT,

      followers INTEGER,
      likes_fav INTEGER,
      price_image INTEGER,
      price_video INTEGER,

      exposure_median INTEGER,
      read_median INTEGER,
      interact_median INTEGER,
      interact_rate REAL,
      fans_change_rate REAL,

      metrics_json TEXT,

      UNIQUE(run_id, creator_url)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      creator_url TEXT,
      creator_name TEXT,
      idx INTEGER,
      title TEXT,
      read_cnt INTEGER,
      like_cnt INTEGER,
      collect_cnt INTEGER,
      publish_date TEXT,
      is_promo INTEGER,

      UNIQUE(run_id, creator_url, idx)
    );
  `);
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(db, sql, params = []) {
  const rows = dbAll(db, sql, params);
  return rows[0] || null;
}

function dbRun(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function withTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function saveDbToFile(db, dbPath) {
  const p = String(dbPath || '').trim();
  if (!p || p === ':memory:') return;
  const data = db.export();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(data));
}

module.exports = { openDb, initDb, dbAll, dbGet, dbRun, withTransaction, saveDbToFile };
