const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { dbAll, dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-change-me';

router.post('/', (req, res) => {
  const { items, total, payment_method, shipping_address, phone, notes, coupon_code } = req.body;
  if (!items || !total || !payment_method) return res.status(400).json({ error: 'Items, total, and payment method are required' });
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Login required to place order' });
  let userId = null;
  try { 
    const decoded = jwt.verify(token, JWT_SECRET);
    userId = decoded.id;
    // Check email verification
    const user = dbGet('SELECT email_verified FROM users WHERE id = ?', [userId]);
    if (user && !user.email_verified) return res.status(403).json({ error: 'Please verify your email before ordering' });
  } catch { return res.status(401).json({ error: 'Login required to place order' }); }
  // Handle coupon
  let finalNotes = notes || '';
  if (coupon_code) {
    const coupon = dbGet('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [coupon_code.toUpperCase()]);
    if (coupon) {
      dbRun('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
      finalNotes = (finalNotes ? finalNotes + ' | ' : '') + 'Coupon: ' + coupon_code + ' (' + coupon.discount_percent + '% off)';
    }
  }
  const result = dbRun('INSERT INTO orders (user_id, items, total, payment_method, shipping_address, phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, JSON.stringify(items), total, payment_method, shipping_address || null, phone || null, finalNotes || null]);
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
