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

router.post('/register', (req, res) => {
  const name = sanitize(req.body.name);
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  const phone = sanitize(req.body.phone);
  const address = sanitize(req.body.address);
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  if (name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
  const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = dbRun('INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)', [name, email, hashed, phone || null, address || null]);
  const verifyCode = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  dbRun('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [verifyCode, expiresAt, result.lastInsertRowid]);
  const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: result.lastInsertRowid, name, email, role: 'customer', email_verified: 0 } });
});

router.post('/login', (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, email_verified: user.email_verified } });
});

router.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbGet('SELECT id, name, email, phone, address, role, email_verified FROM users WHERE id = ?', [decoded.id]);
    res.json(user);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Send verification code
router.post('/send-verification', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Email already verified' });
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    dbRun('UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);
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
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email, subject: 'GlowRX - Verification Code',
          text: 'Your verification code is: ' + code,
          html: '<h2>GlowRX</h2><p>Your verification code is: <strong>' + code + '</strong></p>'
        });
        return res.json({ message: 'Verification code sent to your email' });
      } catch(e) {
        console.error('Email send failed:', e.message, e.code, e.stack);
        return res.json({ message: 'SMTP error: ' + e.message, code: code });
      }
    }
    console.log('SMTP not configured, showing code on screen');
    res.json({ message: 'Verification code sent', code: code });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Verify email
router.post('/verify-email', (req, res) => {
  const { code } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !code) return res.status(400).json({ error: 'Token and code required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ message: 'Already verified' });
    if (user.verification_expires_at && new Date(user.verification_expires_at) < new Date()) return res.status(400).json({ error: 'Code expired, request a new one' });
    if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid code' });
    dbRun('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);
    res.json({ message: 'Email verified' });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

// Google OAuth - redirect to Google
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const defaultRedirect = process.env.GOOGLE_REDIRECT_URI || 'https://cosmetics-store-api.vercel.app/api/auth/google/callback';
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
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://cosmetics-store-api.vercel.app/api/auth/google/callback';
  const frontendUrl = process.env.FRONTEND_URL || 'https://adhamkhaled1510.github.io/glowrx-store';
  // Check if state contains a custom redirect (from mobile app)
  let customRedirect = null;
  if (state) { try { const decoded = Buffer.from(state, 'base64').toString(); if (decoded.startsWith('http') || decoded.startsWith('glowrx://')) customRedirect = decoded; } catch {} }
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
    let user = dbGet('SELECT * FROM users WHERE email = ?', [googleUser.email]);
    if (user) {
      if (!user.google_id) dbRun('UPDATE users SET google_id = ? WHERE id = ?', [googleUser.id, user.id]);
    } else {
      const hashedPass = bcrypt.hashSync(Math.random().toString(36), 10);
      const result = dbRun("INSERT INTO users (name, email, password, google_id) VALUES (?, ?, ?, ?)", [googleUser.name || googleUser.email, googleUser.email, hashedPass, googleUser.id]);
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
      to, subject: 'GlowRX SMTP Test', text: 'If you receive this, SMTP is working!'
    });
    res.json({ status: 'OK', messageId: info.messageId });
  } catch(e) {
    res.json({ status: 'ERROR', error: e.message, code: e.code, stack: e.stack?.split('\n')[0] });
  }
});

module.exports = router;
