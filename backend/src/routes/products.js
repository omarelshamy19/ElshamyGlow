const { Router } = require('express');
const { dbAll, dbGet } = require('../db.js');

const router = Router();

router.get('/', (req, res) => {
  const { category, featured, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category_id = ?'; params.push(category); }
  if (featured) { sql += ' AND featured = 1'; }
  if (search) { sql += ' AND (name_ar LIKE ? OR name_en LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';
  const products = dbAll(sql, params);
  const categories = dbAll('SELECT * FROM categories');
  res.json({ products, categories });
});

router.get('/:id', (req, res) => {
  const product = dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

module.exports = router;
