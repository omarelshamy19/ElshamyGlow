const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'store.db');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, phone TEXT, address TEXT, role TEXT DEFAULT 'customer', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, image TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, description_ar TEXT, description_en TEXT, price REAL NOT NULL, images TEXT DEFAULT '[]', stock INTEGER DEFAULT 0, category_id INTEGER REFERENCES categories(id), featured INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), items TEXT NOT NULL, total REAL NOT NULL, status TEXT DEFAULT 'pending', payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending', shipping_address TEXT, phone TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function dbAll(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params.map(p => p === undefined ? null : p));
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  return dbAll(sql, params)[0] || null;
}

function dbRun(sql, params = []) {
  const d = getDb();
  d.run(sql, params.map(p => p === undefined ? null : p));
  const lastId = d.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0];
  saveDb();
  return { lastInsertRowid: lastId };
}

module.exports = { initDb, saveDb, getDb, dbAll, dbGet, dbRun };
