// Noticias del canal: solo el admin publica; cada publicación avisa a todos
// los usuarios (campanita + push a los celulares con avisos activados).
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyAll } = require('../lib/notify');

const router = express.Router();

// GET /api/news — últimas noticias, con la campaña enlazada si la hay
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT n.id, n.title, n.body, n.campaign_id, n.image_url, n.created_at,
           c.title AS campaign_title, u.name AS author_name
    FROM news_posts n
    LEFT JOIN campaigns c ON c.id = n.campaign_id
    LEFT JOIN users u ON u.id = n.author_id
    ORDER BY n.id DESC LIMIT 50
  `).all();
  res.json({ news: rows });
});

// POST /api/news — solo admin. Publicar = avisar a todos (no hay borrador).
router.post('/', requireAdmin, (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 200);
  const body = String(req.body.body || '').trim().slice(0, 4000);
  const image_url = String(req.body.image_url || '').trim().slice(0, 600);
  const campaign_id = Number(req.body.campaign_id) || null;
  if (!title) return res.status(400).json({ error: 'La noticia necesita un título.' });
  if (campaign_id && !db.prepare('SELECT id FROM campaigns WHERE id = ?').get(campaign_id)) {
    return res.status(400).json({ error: 'La campaña enlazada no existe.' });
  }
  const info = db.prepare(
    'INSERT INTO news_posts (title, body, campaign_id, image_url, author_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, body, campaign_id, image_url, req.session.userId);
  notifyAll('📰 ' + title, body.slice(0, 140));
  res.status(201).json({ id: info.lastInsertRowid });
});

// DELETE /api/news/:id — solo admin
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM news_posts WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Noticia no encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
