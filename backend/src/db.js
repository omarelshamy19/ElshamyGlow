const initSqlJs = require('sql.js');

let db = null;
let ready = false;

async function initDb() {
  if (ready) return;
  const SQL = await initSqlJs({
    locateFile: file => require('path').join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
  });
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, phone TEXT, address TEXT, role TEXT DEFAULT 'customer', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, image TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, description_ar TEXT, description_en TEXT, price REAL NOT NULL, images TEXT DEFAULT '[]', stock INTEGER DEFAULT 0, category_id INTEGER REFERENCES categories(id), featured INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), items TEXT NOT NULL, total REAL NOT NULL, status TEXT DEFAULT 'pending', payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending', shipping_address TEXT, phone TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, discount_percent REAL NOT NULL DEFAULT 0, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, min_order REAL DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  try { db.run('ALTER TABLE users ADD COLUMN google_id TEXT'); } catch(e) {}
  ready = true;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params.map(p => p === undefined ? null : p));
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function dbGet(sql, params = []) { return dbAll(sql, params)[0] || null; }
function dbRun(sql, params = []) { db.run(sql, params.map(p => p === undefined ? null : p)); return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] }; }

module.exports = { initDb, dbAll, dbGet, dbRun };
