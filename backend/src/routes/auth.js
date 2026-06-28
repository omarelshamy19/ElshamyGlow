const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cosmetics-store-secret-key';

router.post('/register', (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = dbRun('INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)', [name, email, hashed, phone || null, address || null]);
  const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'customer' }, JWT_SECRET);
  res.json({ token, user: { id: result.lastInsertRowid, name, email, role: 'customer' } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbGet('SELECT id, name, email, phone, address, role FROM users WHERE id = ?', [decoded.id]);
    res.json(user);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Google OAuth - redirect to Google
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://cosmetics-store-api.vercel.app/api/auth/google/callback';
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile`;
  res.redirect(url);
});

// Google OAuth - callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://cosmetics-store-api.vercel.app/api/auth/google/callback';
  const frontendUrl = process.env.FRONTEND_URL || 'https://adhamkhaled1510.github.io/glowrx-store';
  if (!code || !clientId || !clientSecret) return res.status(400).json({ error: 'Missing params' });
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(frontendUrl + '?error=google_auth_failed');
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokenData.access_token } });
    const googleUser = await userRes.json();
    if (!googleUser.email) return res.redirect(frontendUrl + '?error=no_email');
    let user = dbGet('SELECT * FROM users WHERE email = ?', [googleUser.email]);
    if (user) {
      if (!user.google_id) dbRun('UPDATE users SET google_id = ? WHERE id = ?', [googleUser.id, user.id]);
    } else {
      const hashedPass = require('bcryptjs').hashSync(Math.random().toString(36), 10);
      const result = dbRun("INSERT INTO users (name, email, password, google_id) VALUES (?, ?, ?, ?)", [googleUser.name || googleUser.email, googleUser.email, hashedPass, googleUser.id]);
      user = { id: result.lastInsertRowid, email: googleUser.email, name: googleUser.name || googleUser.email, role: 'customer' };
    }
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'cosmetics-store-secret-key';
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
    res.redirect(frontendUrl + '?token=' + token);
  } catch(e) {
    res.redirect(frontendUrl + '?error=google_auth_error');
  }
});

module.exports = router;
