// Rutas de vinculación de cuentas sociales (TikTok / Instagram) de los clippers.
// Flujo: el clipper registra el link de su perfil → se notifica a los admins →
// Wilson vincula la cuenta en la plataforma y envía el código de la bio por la
// app → el clipper lo pega y confirma → Wilson verifica en la plataforma.
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const PLATFORMS = ['tiktok', 'instagram'];

function platformName(p) {
  return p === 'tiktok' ? 'TikTok' : 'Instagram';
}

function notify(userId, title, body) {
  db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(
    userId,
    title,
    body || ''
  );
}

function notifyAdmins(title, body) {
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  for (const a of admins) notify(a.id, title, body);
}

function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/accounts — cuentas del clipper autenticado
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, platform, profile_url, status, verification_code, admin_note,
              created_at, updated_at
       FROM social_accounts
       WHERE user_id = ?
       ORDER BY id DESC`
    )
    .all(req.session.userId);
  res.json({ accounts: rows });
});

// POST /api/accounts — el clipper registra el link de su perfil
router.post('/', requireAuth, (req, res) => {
  const platform = String(req.body.platform || '').toLowerCase();
  const profile_url = String(req.body.profile_url || '').trim();
  if (!PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'Plataforma inválida. Elige TikTok o Instagram.' });
  }
  if (!isValidUrl(profile_url) || profile_url.length > 300) {
    return res.status(400).json({ error: 'Pega el link completo de tu perfil (https://…).' });
  }
  const dup = db
    .prepare(
      'SELECT id FROM social_accounts WHERE user_id = ? AND platform = ? AND profile_url = ?'
    )
    .get(req.session.userId, platform, profile_url);
  if (dup) {
    return res.status(400).json({ error: 'Esa cuenta ya está registrada.' });
  }
  const info = db
    .prepare('INSERT INTO social_accounts (user_id, platform, profile_url) VALUES (?, ?, ?)')
    .run(req.session.userId, platform, profile_url);
  const me = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
  notifyAdmins(
    'Nueva cuenta por vincular',
    `${me.name} quiere vincular su ${platformName(platform)}: ${profile_url}`
  );
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

// POST /api/accounts/:id/confirm-code — el clipper confirma que pegó el código
router.post('/:id/confirm-code', requireAuth, (req, res) => {
  const acc = db
    .prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  if (acc.status !== 'code_sent') {
    return res.status(400).json({ error: 'Aún no hay código enviado para esta cuenta.' });
  }
  db.prepare("UPDATE social_accounts SET status = 'code_confirmed', updated_at = datetime('now') WHERE id = ?").run(
    acc.id
  );
  const me = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
  notifyAdmins(
    'Código pegado en la bio',
    `${me.name} confirmó que pegó el código de verificación en su ${platformName(acc.platform)}. Verifícalo en la plataforma.`
  );
  res.json({ ok: true });
});

// DELETE /api/accounts/:id — el clipper elimina una cuenta suya no verificada
router.delete('/:id', requireAuth, (req, res) => {
  const acc = db
    .prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  if (acc.status === 'verified') {
    return res
      .status(400)
      .json({ error: 'Una cuenta verificada no se puede eliminar. Pídele a Wilson que la desvincule.' });
  }
  db.prepare('DELETE FROM social_accounts WHERE id = ?').run(acc.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Administración (solo Wilson)
// ---------------------------------------------------------------------------

// GET /api/accounts/admin/all — todas las cuentas con su clipper
router.get('/admin/all', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT sa.id, sa.user_id, sa.platform, sa.profile_url, sa.status,
              sa.verification_code, sa.admin_note, sa.created_at, sa.updated_at,
              u.name AS user_name, u.email AS user_email
       FROM social_accounts sa
       JOIN users u ON u.id = sa.user_id
       ORDER BY CASE sa.status
                  WHEN 'pending' THEN 0
                  WHEN 'code_confirmed' THEN 1
                  WHEN 'code_sent' THEN 2
                  ELSE 3
                END,
                sa.id DESC`
    )
    .all();
  res.json({ accounts: rows });
});

// POST /api/accounts/admin/:id/send-code — Wilson envía el código de la bio
router.post('/admin/:id/send-code', requireAdmin, (req, res) => {
  const code = String(req.body.code || '').trim().slice(0, 120);
  if (!code) return res.status(400).json({ error: 'Escribe el código de verificación.' });
  const acc = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  db.prepare(
    "UPDATE social_accounts SET status = 'code_sent', verification_code = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(code, acc.id);
  notify(
    acc.user_id,
    'Código de verificación listo',
    `Wilson te envió el código para vincular tu ${platformName(acc.platform)}. Pégalo en tu bio y pulsa «Ya lo pegué» en Mis cuentas.`
  );
  res.json({ ok: true });
});

// POST /api/accounts/admin/:id/verify — Wilson marca la cuenta como verificada
router.post('/admin/:id/verify', requireAdmin, (req, res) => {
  const acc = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  db.prepare("UPDATE social_accounts SET status = 'verified', updated_at = datetime('now') WHERE id = ?").run(
    acc.id
  );
  notify(
    acc.user_id,
    'Cuenta verificada',
    `Tu ${platformName(acc.platform)} quedó vinculada. Ya puedes participar en las campañas.`
  );
  res.json({ ok: true });
});

// POST /api/accounts/admin/:id/reject — Wilson rechaza la cuenta
router.post('/admin/:id/reject', requireAdmin, (req, res) => {
  const note = String(req.body.note || '').trim().slice(0, 300);
  const acc = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  db.prepare(
    "UPDATE social_accounts SET status = 'rejected', admin_note = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(note, acc.id);
  notify(
    acc.user_id,
    'Cuenta no aprobada',
    note || 'Tu cuenta no pudo vincularse. Revisa el link e inténtalo de nuevo.'
  );
  res.json({ ok: true });
});

module.exports = router;
