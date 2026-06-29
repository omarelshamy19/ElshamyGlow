const TURSO_URL = process.env.TURSO_DB_URL || 'https://elshamyglow-db-omarelshamy19.aws-eu-west-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODI3MjQ3MTksImlkIjoiMDE5ZjEyYWMtNDIwMS03MzgwLWFhOWUtMjg0ZmE3YTIxZjExIiwia2lkIjoidmxqZ1ZyNUtFSHJSYkJKYm9CMGNsSnRBcXdRTFVFTUtCOXdST0NqdTJQYyIsInJpZCI6ImMyYzQwY2FjLWEyNzgtNDExMi1hNzQwLWM5ZWQ4N2Y1MDY1ZCJ9.-ZcS9jgtNycH5p6Z9rG9WG99y0nSi8InVAdvpuZcLhQDYU_Bz6m87tkkuRJvslu5mfSaIkzrq5enWImvHuPEDQ';

let ready = false;

async function query(sql, params = []) {
  const res = await fetch(TURSO_URL + '/v2/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TURSO_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: { sql, args: params.map(p => p === undefined || p === null ? { type: 'null', value: null } : { type: typeof p === 'number' ? (Number.isInteger(p) ? 'integer' : 'float') : 'text', value: String(p) }) },
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('DB error: ' + res.status + ' ' + text.slice(0, 200));
  }
  const data = await res.json();
  const r = data.results?.[0];
  if (r?.type === 'error') throw new Error('SQL error: ' + r.error?.message);
  return r?.response?.result;
}

function rowToObj(row, cols) {
  const obj = {};
  cols.forEach((c, i) => {
    const val = row[i];
    if (val === null || val?.type === 'null') { obj[c.name] = null; return; }
    switch (val?.type) {
      case 'integer': obj[c.name] = parseInt(val.value, 10); break;
      case 'float': obj[c.name] = val.value; break;
      case 'real': obj[c.name] = val.value; break;
      default: obj[c.name] = val?.value ?? null;
    }
  });
  return obj;
}

async function dbAll(sql, params = []) {
  const result = await query(sql, params);
  if (!result) return [];
  const cols = result.cols || [];
  return (result.rows || []).map(r => rowToObj(r, cols));
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  const result = await query(sql, params);
  return { lastInsertRowid: result?.last_insert_rowid };
}

async function initDb() {
  if (ready) return;
  await query('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, phone TEXT, address TEXT, role TEXT DEFAULT \'customer\', google_id TEXT, email_verified INTEGER DEFAULT 0, verification_code TEXT, verification_expires_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  await query('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, image TEXT)');
  await query('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT NOT NULL, name_en TEXT NOT NULL, description_ar TEXT, description_en TEXT, price REAL NOT NULL, images TEXT DEFAULT \'[]\', stock INTEGER DEFAULT 0, category_id INTEGER REFERENCES categories(id), featured INTEGER DEFAULT 0, sku TEXT, variants TEXT DEFAULT \'[]\', tag TEXT DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  await query('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), items TEXT NOT NULL, total REAL NOT NULL, status TEXT DEFAULT \'pending\', payment_method TEXT NOT NULL, payment_status TEXT DEFAULT \'pending\', shipping_address TEXT, phone TEXT, notes TEXT, internal_notes TEXT, status_history TEXT DEFAULT \'[]\', estimated_delivery TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  await query('CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, discount_percent REAL NOT NULL DEFAULT 0, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, min_order REAL DEFAULT 0, is_active INTEGER DEFAULT 1, expires_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  // Migrate existing tables: add missing columns
  const tables = await query("SELECT name FROM sqlite_master WHERE type='table'");
  for (const table of tables?.rows || []) {
    const name = table[0]?.value;
    if (!name) continue;
    const cols = await query(`PRAGMA table_info(${name})`);
    const colNames = (cols?.rows || []).map(r => r[1]?.value);
    if (name === 'products' && !colNames.includes('sku')) await query('ALTER TABLE products ADD COLUMN sku TEXT');
    if (name === 'products' && !colNames.includes('variants')) await query("ALTER TABLE products ADD COLUMN variants TEXT DEFAULT '[]'");
    if (name === 'products' && !colNames.includes('tag')) await query("ALTER TABLE products ADD COLUMN tag TEXT DEFAULT ''");
    if (name === 'orders' && !colNames.includes('internal_notes')) await query('ALTER TABLE orders ADD COLUMN internal_notes TEXT');
    if (name === 'orders' && !colNames.includes('status_history')) await query("ALTER TABLE orders ADD COLUMN status_history TEXT DEFAULT '[]'");
    if (name === 'orders' && !colNames.includes('estimated_delivery')) await query('ALTER TABLE orders ADD COLUMN estimated_delivery TEXT');
  }
  ready = true;
}

module.exports = { initDb, dbAll, dbGet, dbRun };
