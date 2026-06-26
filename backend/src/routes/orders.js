const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { dbAll, dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cosmetics-store-secret-key';

router.post('/', (req, res) => {
  const { items, total, payment_method, shipping_address, phone, notes } = req.body;
  if (!items || !total || !payment_method) return res.status(400).json({ error: 'Items, total, and payment method are required' });
  const token = req.headers.authorization?.split(' ')[1];
  let userId = null;
  if (token) { try { userId = jwt.verify(token, JWT_SECRET).id; } catch {} }
  const result = dbRun('INSERT INTO orders (user_id, items, total, payment_method, shipping_address, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, JSON.stringify(items), total, payment_method, shipping_address || null, phone || null, notes || null]);
  res.json({ id: result.lastInsertRowid, message: 'Order placed successfully' });
});

router.get('/', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orders = dbAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [decoded.id]);
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;
