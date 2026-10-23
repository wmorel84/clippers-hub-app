// Rutas de suscripción a notificaciones push del celular.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { publicKey } = require('../lib/push');

const router = express.Router();

// GET /api/push/key — llave pública VAPID (vacía si el push no está configurado)
router.get('/key', requireAuth, (req, res) => {
  res.json({ key: publicKey() });
});

// POST /api/push/subscribe — guarda (o actualiza) la suscripción de este dispositivo
router.post('/subscribe', requireAuth, (req, res) => {
  const sub = (req.body && req.body.subscription) || {};
  const endpoint = String(sub.endpoint || '');
  const keys = sub.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Suscripción incompleta.' });
  }
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(req.session.userId, endpoint, String(keys.p256dh), String(keys.auth));
  res.json({ ok: true });
});

// POST /api/push/unsubscribe — elimina la suscripción de este dispositivo
router.post('/unsubscribe', requireAuth, (req, res) => {
  const endpoint = String((req.body && req.body.endpoint) || '');
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.session.userId);
  }
  res.json({ ok: true });
});

module.exports = router;
