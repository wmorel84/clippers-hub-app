// Rutas de autenticación: registro, login, logout, sesión actual y login con Google.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { db, seedUserNotifications } = require('../db');

const router = express.Router();
const BCRYPT_COST = 12;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, created_at: row.created_at };
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (name.length < 2) return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Correo electrónico no válido.' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Ese correo ya está registrado.' });

  const password_hash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email, password_hash, 'clipper');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  seedUserNotifications(user.id);

  req.session.userId = user.id;
  req.session.role = user.role;
  return res.status(201).json({ user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  return res.json({ user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    res.clearCookie('hub.sid');
    return res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'No has iniciado sesión.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
  return res.json({ user: publicUser(user) });
});

// GET /api/auth/google-client-id — el ID de cliente es público (va en el frontend)
router.get('/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

// POST /api/auth/google — login/registro con el botón "Continuar con Google".
// El frontend envía el ID token (JWT) que genera Google; aquí se verifica la
// firma con la librería oficial. Nunca se confía en datos sin verificar.
router.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'El login con Google aún no está configurado.' });
  }
  const credential = req.body.credential;
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'Falta la credencial de Google.' });
  }
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const p = ticket.getPayload();
    if (!p || !p.sub || !p.email || p.email_verified !== true) {
      throw new Error('Token de Google no válido.');
    }
    const email = p.email.trim().toLowerCase();

    // 1) ¿Ya existe un usuario vinculado a este Google?
    let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(p.sub);

    // 2) Si no, ¿existe la cuenta por correo? Se vincula (mismo dueño verificado).
    if (!user) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user) {
        db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(p.sub, user.id);
      }
    }

    // 3) Si no existe, se crea la cuenta de clipper.
    if (!user) {
      const name = String(p.name || email.split('@')[0]).slice(0, 100);
      // Hash aleatorio inutilizable: esta cuenta entra solo con Google.
      const fakeHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_COST);
      const info = db
        .prepare("INSERT INTO users (name, email, password_hash, role, google_sub) VALUES (?, ?, ?, 'clipper', ?)")
        .run(name, email, fakeHash, p.sub);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      seedUserNotifications(user.id);
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    return res.json({ user: publicUser(user) });
  } catch (e) {
    return res.status(401).json({ error: 'No se pudo verificar tu cuenta de Google.' });
  }
});

module.exports = router;
