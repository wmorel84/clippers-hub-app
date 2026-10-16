// Rutas de notificaciones del usuario autenticado.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — notificaciones del usuario (no leídas primero)
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT id, title, body, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY is_read ASC, id DESC
      LIMIT 50
    `)
    .all(req.session.userId);
  const unread = rows.filter((r) => r.is_read === 0).length;
  res.json({ notifications: rows, unread });
});

// POST /api/notifications/read-all — marcar todas como leídas
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.session.userId);
  res.json({ ok: true });
});

// POST /api/notifications/:id/read — marcar una como leída
router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
