// Rutas de clips del usuario autenticado.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/clips — clips del usuario actual
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT clips.id, clips.url, clips.status, clips.views, clips.created_at,
             campaigns.title AS campaign_title
      FROM clips
      JOIN campaigns ON campaigns.id = clips.campaign_id
      WHERE clips.user_id = ?
      ORDER BY clips.id DESC
    `)
    .all(req.session.userId);
  res.json({ clips: rows });
});

// POST /api/clips — registrar un clip enviado
router.post('/', requireAuth, (req, res) => {
  const campaign_id = Number(req.body.campaign_id);
  const url = (req.body.url || '').trim();

  if (!campaign_id) return res.status(400).json({ error: 'Falta la campaña.' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'La URL del clip no es válida.' });

  const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ? AND status = 'active'").get(campaign_id);
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada o inactiva.' });

  const info = db
    .prepare('INSERT INTO clips (user_id, campaign_id, url, status) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, campaign_id, url, 'pending');

  const row = db.prepare('SELECT id, url, status, views, created_at FROM clips WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ clip: row });
});

module.exports = router;
