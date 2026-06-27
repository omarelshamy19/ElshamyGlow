const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, dbRun, dbGet, dbAll } = require('./db.js');
const productsRouter = require('./routes/products.js');
const authRouter = require('./routes/auth.js');
const ordersRouter = require('./routes/orders.js');
const adminRouter = require('./routes/admin.js');

const app = express();
app.use(cors());
app.use(express.json());

const categoriesData = [
  ['أحمر شفاه', 'Lipstick'],
  ['مكياج عيون', 'Eye Makeup'],
  ['أساس وكونسيلر', 'Foundation & Concealer'],
  ['عناية بالبشرة', 'Skincare'],
  ['عطور', 'Perfumes'],
  ['شعر', 'Hair Care'],
  ['بشرة', 'Face Care'],
];

const productsData = [
  ['أحمر شفاه MAC مات','MAC Matte Lipstick','أحمر شفاه مات طويل الثبات','Long-lasting matte lipstick in iconic shades',82,50,1,1,'["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400","https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400"]'],
  ['ماسكارا مابيلين سينسيشنال','Maybelline Lash Sensational','لتطويل وتكثيف الرموش','Volumizing & lengthening mascara for dramatic lashes',45,40,2,1,'["https://images.unsplash.com/photo-1631813657147-c6d10cf8c73e?w=400","https://images.unsplash.com/photo-1599733589046-10c7f0f8a7e2?w=400"]'],
  ['لوحة ظلال مورفي 35 لون','Morphe 35B Artistry Palette','35 لون ظلال عيون احترافية','35 professional eyeshadow shades in one palette',105,20,2,1,'["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400","https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400"]'],
  ['فاونديشن فنتي بيوتي','Fenty Beauty Pro Filt\'r','كريم أساس سائل بملمس مات طبيعي','Soft matte longwear foundation with 50 shades',145,35,3,1,'["https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400","https://images.unsplash.com/photo-1631214502566-7c5bfd6ef3e3?w=400"]'],
  ['كريم مرطب سيرافي','CeraVe Moisturizing Cream','مرطب يومي غني بالدهون الثلاثية','Daily moisturizing cream with ceramides',67,45,4,1,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400"]'],
  ['عطر شانيل نمبر 5','Chanel No. 5','العطر الأسطوري بنوتات زهرية','The iconic floral aldehyde perfume',500,15,5,1,'["https://images.unsplash.com/photo-1541643600914-78b084683601?w=400","https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=400"]'],
  ['سيروم فيتامين C ذا أورديناري','The Ordinary Vitamin C Serum','سيروم مضيء ومضاد للأكسدة','Brightening vitamin C suspension 23% + HA spheres',45,25,4,0,'["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]'],
  ['آيلاينر نيكس إيبك إنك','NYX Epic Ink Liner','آيلاينر أسود مقاوم للماء','Waterproof black eyeliner with precise felt tip',37,60,2,0,'["https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400","https://images.unsplash.com/photo-1599733594230-6b823cc09dd2?w=400"]'],
  ['بودرة لورا ميرسي الشفافة','Laura Mercier Translucent Powder','بودرة تثبيت شفافة خفيفة','Lightweight translucent setting powder',155,30,3,0,'["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400","https://images.unsplash.com/photo-1583241800691-cacc72ec51c1?w=400"]'],
  ['بلاشر نارس أورجازم','NARS Orgasm Blush','بلاشر وردي ذهبي مشهور عالمياً','Iconic peachy-pink blush with gold shimmer',118,25,1,0,'["https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400","https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400"]'],
  ['هايلايتر فنتي كيلاوات','Fenty Beauty Killawatt Freestyle','هايلايتر مزدوج لامع محبب','Dual-finish highlighter in stunning shades',133,20,3,1,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400"]'],
  ['كونسيلر تارت شيب تيب','Tarte Shape Tape Concealer','كونسيلر بتغطية كاملة يدوم طويلاً','Full coverage concealer that lasts all day',110,35,3,0,'["https://images.unsplash.com/photo-1631214502566-7c5bfd6ef3e3?w=400","https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400"]'],
  ['مثبت مكياج أوربان ديكاي','Urban Decay All Nighter','مثبت مكياج يدوم 16 ساعة','16-hour long-lasting makeup setting spray',133,30,3,0,'["https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400","https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400"]'],
  ['جوس بومب من فنتي','Fenty Gloss Bomb','جلس شفاه لامع بلون عالمي','Universal lip luminizer for all skin tones',74,40,1,1,'["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400","https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400"]'],
  ['بي بي كريم ميشا','Missha M Perfect BB Cream','بي بي كريم مع SPF45 للحماية','BB cream with SPF45 for glowing skin',67,30,3,0,'["https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400"]'],
  ['زيت شعر موروكان أويل','Moroccanoil Treatment','زيت الأركان المغربي لعلاج الشعر','Moroccan argan oil hair treatment',125,20,6,1,'["https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400","https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400"]'],
  ['ماسك الطين من لوريال','L\'Oréal Pure Clay Mask','ماسك تنقية للوجه بالطين','Purifying clay face mask for clear skin',45,35,7,0,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]'],
  ['تونر ثيرز ويتش هازل','Thayers Witch Hazel Toner','تونر خالي من الكحول لتنقية المسام','Alcohol-free toner with aloe vera',37,45,7,0,'["https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400"]'],
  ['كريم عين لا روش بوزاي','La Roche-Posay Eye Cream','كريم عين مضاد للتجاعيد والهالات','Anti-aging eye cream for dark circles',118,20,7,0,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]'],
  ['ميست ماريو باديسكو','Mario Badescu Facial Spray','رذاذ ترطيب للوجه بالورد','Hydrating facial spray with rosewater',45,40,7,0,'["https://images.unsplash.com/photo-1556229162-5c63ed7c4efb?w=400","https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400"]'],
];

let ready = false;
let initPromise = null;
app.use((req, res, next) => {
  if (ready) return next();
  if (!initPromise) {
    initPromise = initDb().then(() => {
      const catCount = dbGet("SELECT COUNT(*) as c FROM categories");
      if (!catCount || catCount.c === 0) {
        for (const c of categoriesData) dbRun('INSERT INTO categories (name_ar, name_en) VALUES (?, ?)', c);
      } else {
        const count = dbGet("SELECT COUNT(*) as c FROM categories");
        if (count.c < categoriesData.length) {
          const existing = categoriesData.slice(count.c);
          for (const c of existing) dbRun('INSERT INTO categories (name_ar, name_en) VALUES (?, ?)', c);
        }
      }
      const prodCount = dbGet("SELECT COUNT(*) as c FROM products");
      if (!prodCount || prodCount.c === 0) {
        for (const p of productsData) dbRun('INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images) VALUES (?,?,?,?,?,?,?,?,?)', p);
      }
      const adminExists = dbGet("SELECT id FROM users WHERE role = 'admin'");
      if (!adminExists) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@glowrx.com';
        const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
        const hashed = require('bcryptjs').hashSync(adminPass, 10);
        dbRun("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", ['Admin', adminEmail, hashed]);
      }
      ready = true;
    }).catch(e => console.error('Init error:', e));
  }
  initPromise.then(() => next()).catch(() => next());
});

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/debug', (req, res) => {
  try {
    const cats = dbAll('SELECT * FROM categories');
    res.json({ cats, ready });
  } catch(e) {
    res.json({ error: e.message });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
}

module.exports = app;
