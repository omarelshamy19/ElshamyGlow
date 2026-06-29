const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../db.js');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';
const crypto = require('crypto');
if (!process.env.JWT_SECRET) console.warn('WARNING: JWT_SECRET not set, using fallback (insecure)');

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'()]/g, '').trim();
}

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

router.post('/register', async (req, res) => {
  const name = sanitize(req.body.name);
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  const phone = sanitize(req.body.phone);
  const address = sanitize(req.body.address);
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  if (name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = await dbRun('INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)', [name, email, hashed, phone || null, address || null]);
  const verifyCode = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await dbRun('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [verifyCode, expiresAt, result.lastInsertRowid]);
  const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: result.lastInsertRowid, name, email, role: 'customer', email_verified: 0 } });
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, email_verified: user.email_verified } });
});

router.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT id, name, email, phone, address, role, email_verified FROM users WHERE id = ?', [decoded.id]);
    res.json(user);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Send verification code
router.post('/send-verification', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Email already verified' });
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await dbRun('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: `"ElShamyGlow" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: user.email,
          subject: '🔐 ElShamyGlow - Email Verification Code',
          text: 'Welcome to ElShamyGlow!\n\nYour verification code is: ' + code + '\n\nThis code expires in 10 minutes.\n\nIf you did not create an account, please ignore this email.\n\nThank you,\nElShamyGlow Team',
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}.container{max-width:480px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#C2185B,#8E0040);color:#fff;text-align:center;padding:30px 20px}.header h1{margin:0;font-size:22px;font-weight:700}.header p{margin:5px 0 0;opacity:0.9;font-size:14px}.body{padding:30px 20px;text-align:center}.body p{color:#333;font-size:15px;line-height:1.6;margin:0 0 20px}.code{display:inline-block;background:#f8f4ff;border:2px dashed #C2185B;border-radius:12px;padding:12px 32px;font-size:32px;font-weight:800;letter-spacing:8px;color:#C2185B;margin:10px 0}.expires{color:#999;font-size:13px;margin-top:20px}.footer{background:#fafafa;padding:20px;text-align:center;color:#999;font-size:12px;border-top:1px solid #eee}.footer a{color:#C2185B;text-decoration:none}</style></head><body><div class="container"><div class="header"><h1>🔐 Email Verification</h1><p>ElShamyGlow</p></div><div class="body"><p>Welcome! Use the code below to verify your email address:</p><div class="code">${code}</div><p class="expires">⏱ This code expires in 10 minutes</p><p style="color:#666;font-size:13px;margin-top:24px">If you didn't create an account, you can safely ignore this email.</p></div><div class="footer"><p>ElShamyGlow — Egypt's trusted cosmetics store</p><p>Questions? Contact us at omarelshamy1197@gmail.com</p></div></div></body></html>`
        });
        return res.json({ message: 'Verification code sent to your email', code });
      } catch(e) {
        console.error('Email send failed:', e.message, e.code, e.stack);
        return res.json({ message: 'SMTP error: ' + e.message, code: code });
      }
    }
    console.log('SMTP not configured, showing code on screen');
    res.json({ message: 'Verification code sent to your email', code });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  const { code } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !code) return res.status(400).json({ error: 'Token and code required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Already verified' });
    if (user.verification_expires_at && new Date(user.verification_expires_at) < new Date()) return res.status(400).json({ error: 'Code expired, request a new one' });
    if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid code' });
    await dbRun('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);
    res.json({ message: 'Email verified' });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Google OAuth - redirect to Google
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const defaultRedirect = process.env.GOOGLE_REDIRECT_URI || 'https://elshamyglow.vercel.app/api/auth/google/callback';
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });
  const redirectUri = req.query.redirect_uri || defaultRedirect;
  const state = req.query.redirect_uri ? Buffer.from(req.query.redirect_uri).toString('base64') : '';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(defaultRedirect)}&response_type=code&scope=email%20profile${state ? '&state=' + encodeURIComponent(state) : ''}`;
  res.redirect(url);
});

// Google OAuth - callback
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://elshamyglow.vercel.app/api/auth/google/callback';
  const frontendUrl = process.env.FRONTEND_URL || 'https://omarelshamy19.github.io/ElshamyGlow';
  let customRedirect = null;
  if (state) { try { const decoded = Buffer.from(state, 'base64').toString(); if (decoded.startsWith('http') || decoded.startsWith('elshamyglow://')) customRedirect = decoded; } catch {} }
  if (!code || !clientId || !clientSecret) return res.status(400).json({ error: 'Missing params' });
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(customRedirect || frontendUrl + '?error=google_auth_failed');
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokenData.access_token } });
    const googleUser = await userRes.json();
    if (!googleUser.email) return res.redirect(customRedirect || frontendUrl + '?error=no_email');
    let user = await dbGet('SELECT * FROM users WHERE email = ?', [googleUser.email]);
    if (user) {
      if (!user.google_id) await dbRun('UPDATE users SET google_id = ? WHERE id = ?', [googleUser.id, user.id]);
    } else {
      const hashedPass = bcrypt.hashSync(Math.random().toString(36), 10);
      const result = await dbRun("INSERT INTO users (name, email, password, google_id) VALUES (?, ?, ?, ?)", [googleUser.name || googleUser.email, googleUser.email, hashedPass, googleUser.id]);
      user = { id: result.lastInsertRowid, email: googleUser.email, name: googleUser.name || googleUser.email, role: 'customer' };
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    const dest = customRedirect ? customRedirect + '?token=' + token : frontendUrl + '?token=' + token;
    res.redirect(dest);
  } catch(e) {
    res.redirect(customRedirect || frontendUrl + '?error=google_auth_error');
  }
});

// Test email SMTP
router.get('/test-email', async (req, res) => {
  const to = req.query.email || process.env.SMTP_USER || 'test@example.com';
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) return res.json({ status: 'SMTP_NOT_CONFIGURED', env_checks: { SMTP_HOST: !!process.env.SMTP_HOST, SMTP_PORT: process.env.SMTP_PORT, SMTP_USER: !!process.env.SMTP_USER, SMTP_PASS: !!process.env.SMTP_PASS } });
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost, port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to, subject: 'ElshamyGlow SMTP Test', text: 'If you receive this, SMTP is working!'
    });
    res.json({ status: 'OK', messageId: info.messageId });
  } catch(e) {
    res.json({ status: 'ERROR', error: e.message, code: e.code, stack: e.stack?.split('\n')[0] });
  }
});

module.exports = router;
