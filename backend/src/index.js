const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('express-async-errors');
const { initDb, dbRun, dbGet, dbAll } = require('./db.js');
const productsRouter = require('./routes/products.js');
const authRouter = require('./routes/auth.js');
const ordersRouter = require('./routes/orders.js');
const adminRouter = require('./routes/admin.js');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS - restrict to known origins
const allowedOrigins = [
  'https://omarelshamy19.github.io',
  'https://elshamyglow.vercel.app',
  'http://localhost:3000',
  'http://localhost:19006',
  'exp://192.168.1.2:19000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    callback(null, true);
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// Body parser with size limit
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

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
  ['أحمر شفاه MAC مات','MAC Matte Lipstick','أحمر شفاه مات طويل الثبات','Long-lasting matte lipstick in iconic shades',82,50,1,1,'["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400","https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400"]','flash_deal'],
  ['ماسكارا مابيلين سينسيشنال','Maybelline Lash Sensational','لتطويل وتكثيف الرموش','Volumizing & lengthening mascara for dramatic lashes',45,40,2,1,'["https://images.unsplash.com/photo-1631813657147-c6d10cf8c73e?w=400","https://images.unsplash.com/photo-1599733589046-10c7f0f8a7e2?w=400"]','flash_deal'],
  ['لوحة ظلال مورفي 35 لون','Morphe 35B Artistry Palette','35 لون ظلال عيون احترافية','35 professional eyeshadow shades in one palette',105,20,2,1,'["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400","https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400"]','featured'],
  ['فاونديشن فنتي بيوتي','Fenty Beauty Pro Filt\'r','كريم أساس سائل بملمس مات طبيعي','Soft matte longwear foundation with 50 shades',145,35,3,1,'["https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400","https://images.unsplash.com/photo-1631214502566-7c5bfd6ef3e3?w=400"]','featured'],
  ['كريم مرطب سيرافي','CeraVe Moisturizing Cream','مرطب يومي غني بالدهون الثلاثية','Daily moisturizing cream with ceramides',67,45,4,1,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400"]','flash_deal'],
  ['عطر شانيل نمبر 5','Chanel No. 5','العطر الأسطوري بنوتات زهرية','The iconic floral aldehyde perfume',500,15,5,1,'["https://images.unsplash.com/photo-1541643600914-78b084683601?w=400","https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=400"]','featured'],
  ['سيروم فيتامين C ذا أورديناري','The Ordinary Vitamin C Serum','سيروم مضيء ومضاد للأكسدة','Brightening vitamin C suspension 23% + HA spheres',45,25,4,0,'["https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]','flash_deal'],
  ['آيلاينر نيكس إيبك إنك','NYX Epic Ink Liner','آيلاينر أسود مقاوم للماء','Waterproof black eyeliner with precise felt tip',37,60,2,0,'["https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400","https://images.unsplash.com/photo-1599733594230-6b823cc09dd2?w=400"]','flash_deal'],
  ['بودرة لورا ميرسي الشفافة','Laura Mercier Translucent Powder','بودرة تثبيت شفافة خفيفة','Lightweight translucent setting powder',155,30,3,0,'["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400","https://images.unsplash.com/photo-1583241800691-cacc72ec51c1?w=400"]','featured'],
  ['بلاشر نارس أورجازم','NARS Orgasm Blush','بلاشر وردي ذهبي مشهور عالمياً','Iconic peachy-pink blush with gold shimmer',118,25,1,0,'["https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400","https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400"]','flash_deal'],
  ['هايلايتر فنتي كيلاوات','Fenty Beauty Killawatt Freestyle','هايلايتر مزدوج لامع محبب','Dual-finish highlighter in stunning shades',133,20,3,1,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400"]','featured'],
  ['كونسيلر تارت شيب تيب','Tarte Shape Tape Concealer','كونسيلر بتغطية كاملة يدوم طويلاً','Full coverage concealer that lasts all day',110,35,3,0,'["https://images.unsplash.com/photo-1631214502566-7c5bfd6ef3e3?w=400","https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400"]','flash_deal'],
  ['مثبت مكياج أوربان ديكاي','Urban Decay All Nighter','مثبت مكياج يدوم 16 ساعة','16-hour long-lasting makeup setting spray',133,30,3,0,'["https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400","https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400"]','featured'],
  ['جوس بومب من فنتي','Fenty Gloss Bomb','جلس شفاه لامع بلون عالمي','Universal lip luminizer for all skin tones',74,40,1,1,'["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400","https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=400"]','flash_deal'],
  ['بي بي كريم ميشا','Missha M Perfect BB Cream','بي بي كريم مع SPF45 للحماية','BB cream with SPF45 for glowing skin',67,30,3,0,'["https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400"]','bridal'],
  ['زيت شعر موروكان أويل','Moroccanoil Treatment','زيت الأركان المغربي لعلاج الشعر','Moroccan argan oil hair treatment',125,20,6,1,'["https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400","https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=400"]','bridal'],
  ['ماسك الطين من لوريال','L\'Oréal Pure Clay Mask','ماسك تنقية للوجه بالطين','Purifying clay face mask for clear skin',45,35,7,0,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]','bundle'],
  ['تونر ثيرز ويتش هازل','Thayers Witch Hazel Toner','تونر خالي من الكحول لتنقية المسام','Alcohol-free toner with aloe vera',37,45,7,0,'["https://images.unsplash.com/photo-1627384113745-fa7e2e8c6c8a?w=400","https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400"]','bundle'],
  ['كريم عين لا روش بوزاي','La Roche-Posay Eye Cream','كريم عين مضاد للتجاعيد والهالات','Anti-aging eye cream for dark circles',118,20,7,0,'["https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400","https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=400"]','bundle'],
  ['ميست ماريو باديسكو','Mario Badescu Facial Spray','رذاذ ترطيب للوجه بالورد','Hydrating facial spray with rosewater',45,40,7,0,'["https://images.unsplash.com/photo-1556229162-5c63ed7c4efb?w=400","https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400"]','bundle'],
];

let ready = false;

app.use(async (req, res, next) => {
  if (!ready) {
    try {
      await initDb();
      ready = true;
    } catch (e) {
      console.error('Init error:', e.message, e.stack?.split('\n')[0]);
      return res.status(500).json({ error: 'Init failed: ' + e.message });
    }
  }
  next();
});

// Seed check runs on every cold start (but only seeds if needed)
app.use(async (req, res, next) => {
  try {
    const adminExists = await dbGet("SELECT id FROM users WHERE role = 'admin'");
    if (!adminExists) {
      const adminEmail = process.env.ADMIN_EMAIL || 'omarelshamy1197@gmail.com';
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
      const hashed = require('bcryptjs').hashSync(adminPass, 10);
      await dbRun("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", ['Admin', adminEmail, hashed]);
    }
    const catCount = await dbGet("SELECT COUNT(*) as c FROM categories");
    if (!catCount || catCount.c === 0) {
      for (const c of categoriesData) await dbRun('INSERT INTO categories (name_ar, name_en) VALUES (?, ?)', c);
    }
    if (catCount && catCount.c > 0) {
      const prodWithTag = await dbGet("SELECT COUNT(*) as c FROM products WHERE tag IS NOT NULL AND tag != ''");
      if (!prodWithTag || prodWithTag.c < 5) {
        // Seed products with tags if there aren't enough tagged ones
        const cats = await dbAll("SELECT id, name_en FROM categories");
        const catMap = {};
        const catNames = ['Lipstick', 'Eye Makeup', 'Foundation & Concealer', 'Skincare', 'Perfumes', 'Hair Care', 'Face Care'];
        catNames.forEach((n, i) => {
          const found = cats.find(c => c.name_en === n);
          catMap[i + 1] = found ? found.id : null;
        });
        // Delete untagged products
        await dbRun("DELETE FROM products WHERE tag IS NULL OR tag = ''");
        for (const p of productsData) {
          const mappedP = [...p];
          if (mappedP[6] && catMap[mappedP[6]]) mappedP[6] = catMap[mappedP[6]];
          else mappedP[6] = null;
          await dbRun('INSERT INTO products (name_ar, name_en, description_ar, description_en, price, stock, category_id, featured, images, tag) VALUES (?,?,?,?,?,?,?,?,?,?)', mappedP);
        }
      }
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
  next();
});

// Apply auth rate limiter to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', async (req, res) => {
  try {
    const r = await require('./db.js').dbAll('SELECT 1 as ok');
    res.json({ status: 'ok', db: r });
  } catch(e) { res.status(500).json({ error: e.message, stack: e.stack?.split('\n')[0] }); }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
}

module.exports = app;
