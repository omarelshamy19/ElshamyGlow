const { Router } = require('express');
const { dbAll, dbGet } = require('../db.js');

const router = Router();

router.get('/', async (req, res) => {
  const { category, featured, search, tag } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category_id = ?'; params.push(category); }
  if (featured) { sql += ' AND featured = 1'; }
  if (search) { sql += ' AND (name_ar LIKE ? OR name_en LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (tag) { sql += ' AND tag = ?'; params.push(tag); }
  sql += ' ORDER BY created_at DESC';
  const products = await dbAll(sql, params);
  const categories = await dbAll('SELECT * FROM categories');
  res.json({ products, categories });
});

router.get('/:id', async (req, res) => {
  const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

module.exports = router;
