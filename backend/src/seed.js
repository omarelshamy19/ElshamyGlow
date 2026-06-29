import { initDb, dbRun } from './db.js';

async function seed() {
  await initDb();

  const categories = [
    { name_ar: 'أحمر شفاه', name_en: 'Lipstick' },
    { name_ar: 'مكياج عيون', name_en: 'Eye Makeup' },
    { name_ar: 'أساس', name_en: 'Foundation' },
    { name_ar: 'عناية بالبشرة', name_en: 'Skincare' },
    { name_ar: 'عطور', name_en: 'Perfumes' },
  ];

  for (const c of categories) {
    dbRun('INSERT INTO categories (name_ar, name_en) VALUES (?, ?)', [c.name_ar, c.name_en]);
  }

  const products = [
    { name_ar: 'أحمر شفاه أحمر', name_en: 'Red Lipstick', desc_ar: 'أحمر شفاه طويل الثبات', desc_en: 'Long-lasting red lipstick', price: 45, stock: 50, category_id: 1, featured: 1, tag: 'flash_deal' },
    { name_ar: 'أحمر شفاه وردي', name_en: 'Pink Lipstick', desc_ar: 'لون وردي ناعم', desc_en: 'Soft pink lipstick', price: 40, stock: 30, category_id: 1, featured: 0, tag: 'flash_deal' },
    { name_ar: 'ماسكارا سوداء', name_en: 'Black Mascara', desc_ar: 'ماسكارا لتطويل الرموش', desc_en: 'Volumizing black mascara', price: 55, stock: 40, category_id: 2, featured: 1, tag: 'flash_deal' },
    { name_ar: 'ظلال عيون', name_en: 'Eyeshadow Palette', desc_ar: 'لوحة ظلال عيون 12 لون', desc_en: '12-color eyeshadow palette', price: 85, stock: 20, category_id: 2, featured: 1, tag: 'featured' },
    { name_ar: 'كريم أساس', name_en: 'Foundation', desc_ar: 'كريم أساس سائل طبيعي', desc_en: 'Natural liquid foundation', price: 70, stock: 35, category_id: 3, featured: 0, tag: 'flash_deal' },
    { name_ar: 'مرطب للوجه', name_en: 'Face Moisturizer', desc_ar: 'مرطب يومي للبشرة', desc_en: 'Daily face moisturizer', price: 60, stock: 45, category_id: 4, featured: 1, tag: 'featured' },
    { name_ar: 'عطر زهري', name_en: 'Floral Perfume', desc_ar: 'عطر برائحة الأزهار', desc_en: 'Floral-scented perfume', price: 120, stock: 15, category_id: 5, featured: 1, tag: 'bridal' },
    { name_ar: 'سيروم فيتامين C', name_en: 'Vitamin C Serum', desc_ar: 'سيروم مضيء للبشرة', desc_en: 'Brightening vitamin C serum', price: 95, stock: 25, category_id: 4, featured: 0, tag: 'bundle' },
    { name_ar: 'آيلاينر أسود', name_en: 'Black Eyeliner', desc_ar: 'قلم آيلاينر مقاوم للماء', desc_en: 'Waterproof black eyeliner', price: 35, stock: 60, category_id: 2, featured: 0, tag: 'bundle' },
    { name_ar: 'بودرة وجه', name_en: 'Face Powder', desc_ar: 'بودرة تثبيت شفافة', desc_en: 'Translucent setting powder', price: 50, stock: 30, category_id: 3, featured: 0, tag: 'bundle' },
  ];

  for (const p of products) {
    dbRun(
      'INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.name_ar, p.name_en, p.desc_ar, p.desc_en, p.price, p.stock, p.category_id, p.featured, p.tag]
    );
  }

  console.log('Seed data inserted successfully!');
}

seed().catch(console.error);
