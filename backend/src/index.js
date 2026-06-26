import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb, dbRun, dbGet } from './db.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

await initDb();
seedData();

export default app;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function seedData() {
  const cats = [{ name_ar: 'أحمر شفاه', name_en: 'Lipstick' }, { name_ar: 'مكياج عيون', name_en: 'Eye Makeup' }, { name_ar: 'أساس', name_en: 'Foundation' }, { name_ar: 'عناية بالبشرة', name_en: 'Skincare' }, { name_ar: 'عطور', name_en: 'Perfumes' }];
  const existing = dbGet("SELECT COUNT(*) as c FROM categories");
  if (existing && existing.c > 0) return;

  for (const c of cats) dbRun('INSERT INTO categories (name_ar, name_en) VALUES (?, ?)', [c.name_ar, c.name_en]);

  const products = [
    { name_ar: 'أحمر شفاه أحمر', name_en: 'Red Lipstick', desc_ar: 'طويل الثبات', desc_en: 'Long-lasting', price: 45, stock: 50, category_id: 1, featured: 1 },
    { name_ar: 'ماسكارا سوداء', name_en: 'Black Mascara', desc_ar: 'لتطويل الرموش', desc_en: 'Volumizing', price: 55, stock: 40, category_id: 2, featured: 1 },
    { name_ar: 'ظلال عيون', name_en: 'Eyeshadow Palette', desc_ar: '12 لون', desc_en: '12 colors', price: 85, stock: 20, category_id: 2, featured: 1 },
    { name_ar: 'كريم أساس', name_en: 'Foundation', desc_ar: 'سائل طبيعي', desc_en: 'Natural liquid', price: 70, stock: 35, category_id: 3, featured: 0 },
    { name_ar: 'مرطب للوجه', name_en: 'Face Moisturizer', desc_ar: 'يومي للبشرة', desc_en: 'Daily moisturizer', price: 60, stock: 45, category_id: 4, featured: 1 },
    { name_ar: 'عطر زهري', name_en: 'Floral Perfume', desc_ar: 'رائحة أزهار', desc_en: 'Floral scent', price: 120, stock: 15, category_id: 5, featured: 1 },
    { name_ar: 'سيروم فيتامين C', name_en: 'Vitamin C Serum', desc_ar: 'مضيء للبشرة', desc_en: 'Brightening', price: 95, stock: 25, category_id: 4, featured: 0 },
    { name_ar: 'آيلاينر أسود', name_en: 'Black Eyeliner', desc_ar: 'مقاوم للماء', desc_en: 'Waterproof', price: 35, stock: 60, category_id: 2, featured: 0 },
    { name_ar: 'بودرة وجه', name_en: 'Face Powder', desc_ar: 'شفافة لتثبيت', desc_en: 'Translucent setting', price: 50, stock: 30, category_id: 3, featured: 0 },
  ];
  for (const p of products) {
    dbRun('INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured) VALUES (?,?,?,?,?,?,?,?)',
      [p.name_ar, p.name_en, p.desc_ar, p.desc_en, p.price, p.stock, p.category_id, p.featured]);
  }
}
