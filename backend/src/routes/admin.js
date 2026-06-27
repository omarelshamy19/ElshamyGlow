const { Router } = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbAll, dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cosmetics-store-secret-key';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

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
router.get('/orders', adminAuth, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id';
  const params = [];
  if (status) { sql += ' WHERE o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const orders = dbAll(sql, params);
  const count = dbGet('SELECT COUNT(*) as total FROM orders' + (status ? ' WHERE status = ?' : ''), status ? [status] : []);
  res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items) })), total: count.total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/orders/:id', adminAuth, (req, res) => {
  const order = dbGet('SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.items = JSON.parse(order.items);
  res.json(order);
});

router.put('/orders/:id/status', adminAuth, (req, res) => {
  const { status, payment_status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  dbRun('UPDATE orders SET status = ?, payment_status = COALESCE(?, payment_status) WHERE id = ?', [status, payment_status || null, req.params.id]);
  res.json({ message: 'Order updated' });
});

// --- Products ---
router.get('/products', adminAuth, (req, res) => {
  const products = dbAll('SELECT p.*, c.name_ar as category_ar, c.name_en as category_en FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC');
  res.json({ products });
});

router.post('/products', adminAuth, (req, res) => {
  const { name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images } = req.body;
  if (!name_ar || !name_en || !price) return res.status(400).json({ error: 'Name (AR/EN) and price are required' });
  const result = dbRun('INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images) VALUES (?,?,?,?,?,?,?,?,?)',
    [name_ar, name_en, description_ar || '', description_en || '', price, stock || 0, category_id || 1, featured ? 1 : 0, JSON.stringify(images || [])]);
  res.json({ id: result.lastInsertRowid, message: 'Product created' });
});

router.put('/products/:id', adminAuth, (req, res) => {
  const existing = dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const { name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images } = req.body;
  dbRun('UPDATE products SET name_ar=?, name_en=?, description_ar=?, description_en=?, price=?, stock=?, category_id=?, featured=?, images=? WHERE id=?',
    [name_ar || existing.name_ar, name_en || existing.name_en,
     description_ar !== undefined ? description_ar : existing.description_ar,
     description_en !== undefined ? description_en : existing.description_en,
     price || existing.price, stock !== undefined ? stock : existing.stock,
     category_id || existing.category_id, featured !== undefined ? (featured ? 1 : 0) : existing.featured,
     images ? JSON.stringify(images) : existing.images, req.params.id]);
  res.json({ message: 'Product updated' });
});

router.delete('/products/:id', adminAuth, (req, res) => {
  dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ message: 'Product deleted' });
});

// --- Users ---
router.get('/users', adminAuth, (req, res) => {
  const users = dbAll('SELECT id, name, email, phone, address, role, created_at, (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count FROM users ORDER BY created_at DESC');
  res.json({ users });
});

router.get('/users/:id', adminAuth, (req, res) => {
  const user = dbGet('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const orders = dbAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ user, orders: orders.map(o => ({ ...o, items: JSON.parse(o.items) })) });
});

// --- Dashboard Stats ---
router.get('/stats', adminAuth, (req, res) => {
  const totalOrders = dbGet('SELECT COUNT(*) as count FROM orders');
  const totalRevenue = dbGet('SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status != "cancelled"');
  const totalUsers = dbGet('SELECT COUNT(*) as count FROM users');
  const totalProducts = dbGet('SELECT COUNT(*) as count FROM products');
  const pendingOrders = dbGet('SELECT COUNT(*) as count FROM orders WHERE status = "pending"');
  const ordersByStatus = dbAll('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
  const recentOrders = dbAll('SELECT o.id, o.total, o.status, o.created_at, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5');
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

module.exports = router;
