const { Router } = require('express');
const { dbAll, dbGet } = require('../db.js');

const router = Router();

router.get('/', async (req, res) => {
  const { category, featured, search, tag, brand, min_price, max_price } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category_id = ?'; params.push(category); }
  if (featured) { sql += ' AND featured = 1'; }
  if (search) { sql += ' AND (name_ar LIKE ? OR name_en LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (tag) { sql += ' AND tag = ?'; params.push(tag); }
  if (brand) { sql += ' AND brand = ?'; params.push(brand); }
  if (min_price) { sql += ' AND price >= ?'; params.push(min_price); }
  if (max_price) { sql += ' AND price <= ?'; params.push(max_price); }
  sql += ' ORDER BY created_at DESC';
  const products = await dbAll(sql, params);
  const categories = await dbAll('SELECT * FROM categories');
  res.json({ products, categories });
});

router.get('/brands', async (req, res) => {
  const brands = await dbAll("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand");
  res.json(brands);
});

router.get('/:id', async (req, res) => {
  const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

module.exports = router;
