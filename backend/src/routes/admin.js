const { Router } = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbAll, dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-change-me';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set, using fallback (insecure)');
if (!process.env.ADMIN_KEY) console.warn('WARNING: ADMIN_KEY not set, using fallback (insecure)');

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key === ADMIN_KEY) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Not admin' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// --- Orders ---
router.get('/orders', adminAuth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id';
  const params = [];
  if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const orders = await dbAll(sql, params);
  const count = await dbGet('SELECT COUNT(*) as total FROM orders' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
  res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items) })), total: count.total, page: parseInt(page), limit: parseInt(limit) });
});

function csvField(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/orders/export', adminAuth, async (req, res) => {
  const orders = await dbAll("SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC");
  const rows = orders.map(o => {
    const items = JSON.parse(o.items || '[]');
    const itemNames = items.map(i => (i.name_ar || i.name) + ' x' + i.quantity).join('; ');
    return [o.id, o.user_name || 'Guest', o.user_email || '', o.phone || o.user_phone || '', o.shipping_address || '', o.total, o.status, o.payment_method, o.payment_status, itemNames, o.created_at].map(csvField).join(',');
  });
  const header = ['ID','Customer','Email','Phone','Address','Total','Status','Payment Method','Payment Status','Items','Date'].join(',');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=orders-export.csv');
  res.send('\uFEFF' + header + '\n' + rows.join('\n'));
});

router.get('/orders/:id', adminAuth, async (req, res) => {
  const order = await dbGet('SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = JSON.parse(order.items);
  res.json(order);
});

router.put('/orders/:id/status', adminAuth, async (req, res) => {
  const { status, payment_status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await dbRun('UPDATE orders SET status = ?, payment_status = COALESCE(?, payment_status) WHERE id = ?', [status, payment_status || null, req.params.id]);
  res.json({ message: 'Order updated' });
});

// --- Products ---
router.get('/products', adminAuth, async (req, res) => {
  const products = await dbAll('SELECT p.*, c.name_ar as category_ar, c.name_en as category_en FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC');
  res.json({ products });
});

router.post('/products', adminAuth, async (req, res) => {
  const { name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images } = req.body;
  if (!name_ar || !name_en || !price) return res.status(400).json({ error: 'Name (AR/EN) and price are required' });
  const result = await dbRun('INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images) VALUES (?,?,?,?,?,?,?,?,?)',
    [name_ar, name_en, description_ar || '', description_en || '', price, stock || 0, category_id || 1, featured ? 1 : 0, JSON.stringify(images || [])]);
  res.json({ id: result.lastInsertRowid, message: 'Product created' });
});

router.put('/products/:id', adminAuth, async (req, res) => {
  const existing = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const { name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images } = req.body;
  await dbRun('UPDATE products SET name_ar=?, name_en=?, description_ar=?, description_en=?, price=?, stock=?, category_id=?, featured=?, images=? WHERE id=?',
    [name_ar || existing.name_ar, name_en || existing.name_en,
     description_ar !== undefined ? description_ar : existing.description_ar,
     description_en !== undefined ? description_en : existing.description_en,
     price || existing.price, stock !== undefined ? stock : existing.stock,
     category_id || existing.category_id, featured !== undefined ? (featured ? 1 : 0) : existing.featured,
     images ? JSON.stringify(images) : existing.images, req.params.id]);
  res.json({ message: 'Product updated' });
});

router.delete('/products/:id', adminAuth, async (req, res) => {
  await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ message: 'Product deleted' });
});

// --- Users ---
router.get('/users', adminAuth, async (req, res) => {
  const users = await dbAll('SELECT id, name, email, phone, address, role, created_at, (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count FROM users ORDER BY created_at DESC');
  res.json({ users });
});

router.get('/users/:id', adminAuth, async (req, res) => {
  const user = await dbGet('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const orders = await dbAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ user, orders: orders.map(o => ({ ...o, items: JSON.parse(o.items) })) });
});

// --- Dashboard Stats ---
router.get('/stats', adminAuth, async (req, res) => {
  const totalOrders = await dbGet('SELECT COUNT(*) as count FROM orders');
  const totalRevenue = await dbGet("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status != 'cancelled'");
  const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
  const totalProducts = await dbGet('SELECT COUNT(*) as count FROM products');
  const pendingOrders = await dbGet("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
  const ordersByStatus = await dbAll('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
  const recentOrders = await dbAll('SELECT o.id, o.total, o.status, o.created_at, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5');
  res.json({
    stats: {
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total,
      totalUsers: totalUsers.count,
      totalProducts: totalProducts.count,
      pendingOrders: pendingOrders.count,
      ordersByStatus
    },
    recentOrders: recentOrders.map(o => ({ ...o, items: [] }))
  });
});

// --- Coupons ---
router.get('/coupons', adminAuth, async (req, res) => {
  const coupons = await dbAll('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json({ coupons });
});

router.post('/coupons', adminAuth, async (req, res) => {
  try {
    const { code, discount_percent, max_uses, min_order, expires_at } = req.body;
    if (!code || !discount_percent) return res.status(400).json({ error: 'Code and discount percent required' });
    const existing = await dbGet('SELECT id FROM coupons WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Coupon code already exists' });
    const tableInfo = await dbAll("PRAGMA table_info(coupons)");
    const hasExpiresAt = tableInfo.some(c => c.name === 'expires_at');
    if (!hasExpiresAt) {
      try { await dbRun('ALTER TABLE coupons ADD COLUMN expires_at TEXT'); } catch(e) { /* ignore */ }
    }
    const result = await dbRun('INSERT INTO coupons (code, discount_percent, max_uses, min_order, expires_at) VALUES (?,?,?,?,?)',
      [code.toUpperCase(), discount_percent, max_uses || 0, min_order || 0, expires_at || null]);
    res.json({ id: result.lastInsertRowid, message: 'Coupon created' });
  } catch(e) { console.error('Coupon create error:', e); res.status(500).json({ error: e.message, stack: e.stack?.split('\n')[0] }); }
});

router.put('/coupons/:id', adminAuth, async (req, res) => {
  const { discount_percent, max_uses, min_order, is_active, expires_at } = req.body;
  const existing = await dbGet('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Coupon not found' });
  await dbRun('UPDATE coupons SET discount_percent=?, max_uses=?, min_order=?, is_active=?, expires_at=? WHERE id=?',
    [discount_percent !== undefined ? discount_percent : existing.discount_percent,
     max_uses !== undefined ? max_uses : existing.max_uses,
     min_order !== undefined ? min_order : existing.min_order,
     is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
     expires_at !== undefined ? expires_at : existing.expires_at, req.params.id]);
  res.json({ message: 'Coupon updated' });
});

router.delete('/coupons/:id', adminAuth, async (req, res) => {
  await dbRun('DELETE FROM coupons WHERE id = ?', [req.params.id]);
  res.json({ message: 'Coupon deleted' });
});

// Validate coupon (public, no auth needed)
router.post('/coupons/validate', async (req, res) => {
  const { code, order_total } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const coupon = await dbGet('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code.toUpperCase()]);
  if (!coupon) return res.status(404).json({ error: 'Invalid coupon code', valid: false });
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return res.json({ valid: false, error: 'Coupon usage limit reached' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.json({ valid: false, error: 'Coupon has expired' });
  if (order_total && order_total < coupon.min_order) return res.json({ valid: false, error: 'Minimum order of ' + coupon.min_order + ' required' });
  res.json({ valid: true, discount_percent: coupon.discount_percent, code: coupon.code });
});

// Track coupon usage
router.post('/coupons/use', adminAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const coupon = await dbGet('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);
  if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
  await dbRun('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
  res.json({ message: 'Coupon used' });
});

// --- Sales Data (for charts) ---
router.get('/sales-data', adminAuth, async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const orders = await dbAll("SELECT id, total, status, created_at FROM orders WHERE status != 'cancelled' ORDER BY created_at ASC");
  const salesByDay = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    salesByDay[key] = 0;
  }
  orders.forEach(o => {
    const day = o.created_at.split('T')[0];
    if (salesByDay[day] !== undefined) salesByDay[day] += o.total;
  });
  const labels = Object.keys(salesByDay);
  const data = Object.values(salesByDay);
  res.json({ labels, data, total: data.reduce((a,b) => a+b, 0) });
});

// --- Low Stock ---
router.get('/low-stock', adminAuth, async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10;
  const products = await dbAll('SELECT p.*, c.name_ar as category_ar, c.name_en as category_en FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.stock <= ? ORDER BY p.stock ASC', [threshold]);
  res.json({ products, threshold });
});

module.exports = router;
