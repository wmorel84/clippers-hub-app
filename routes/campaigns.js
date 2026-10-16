// Rutas de campañas: lectura pública (solo activas), gestión solo admin.
const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const PUBLIC_FIELDS = `
  id, title, artist, platform, category, payout_text,
  budget_total, budget_remaining, deadline, requirements, brief,
  is_example, status, created_at, updated_at
`;

function toCampaign(row) {
  return { ...row, is_example: row.is_example === 1 };
}

// GET /api/campaigns — público: solo campañas activas
router.get('/', (req, res) => {
  const rows = db
    .prepare(`SELECT ${PUBLIC_FIELDS} FROM campaigns WHERE status = 'active' ORDER BY is_example ASC, id ASC`)
    .all();
  res.json({ campaigns: rows.map(toCampaign) });
});

// GET /api/campaigns/:id — público si está activa; admin puede ver cualquiera
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Campaña no encontrada.' });
  if (row.status !== 'active' && req.session?.role !== 'admin') {
    return res.status(404).json({ error: 'Campaña no encontrada.' });
  }
  res.json({ campaign: toCampaign(row) });
});

// POST /api/campaigns — solo admin
router.post('/', requireAdmin, (req, res) => {
  const b = req.body;
  const title = (b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });

  const info = db
    .prepare(`
      INSERT INTO campaigns
        (title, artist, platform, category, payout_text, budget_total, budget_remaining,
         deadline, requirements, brief, is_example, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      title,
      (b.artist || '').trim(),
      (b.platform || '').trim(),
      (b.category || 'musica').trim(),
      (b.payout_text || '').trim(),
      Number(b.budget_total) || 0,
      b.budget_remaining === undefined || b.budget_remaining === '' ? Number(b.budget_total) || 0 : Number(b.budget_remaining) || 0,
      (b.deadline || '').trim(),
      (b.requirements || '').trim(),
      (b.brief || '').trim(),
      b.is_example ? 1 : 0,
      b.status === 'inactive' ? 'inactive' : 'active'
    );

  const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM campaigns WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ campaign: toCampaign(row) });
});

// PUT /api/campaigns/:id — solo admin
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaña no encontrada.' });

  const b = req.body;
  const title = (b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });

  db.prepare(`
      UPDATE campaigns SET
        title = ?, artist = ?, platform = ?, category = ?, payout_text = ?,
        budget_total = ?, budget_remaining = ?, deadline = ?, requirements = ?,
        brief = ?, is_example = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
    title,
    (b.artist || '').trim(),
    (b.platform || '').trim(),
    (b.category || 'musica').trim(),
    (b.payout_text || '').trim(),
    Number(b.budget_total) || 0,
    b.budget_remaining === undefined || b.budget_remaining === '' ? Number(b.budget_total) || 0 : Number(b.budget_remaining) || 0,
    (b.deadline || '').trim(),
    (b.requirements || '').trim(),
    (b.brief || '').trim(),
    b.is_example ? 1 : 0,
    b.status === 'inactive' ? 'inactive' : 'active',
    req.params.id
  );

  const row = db.prepare(`SELECT ${PUBLIC_FIELDS} FROM campaigns WHERE id = ?`).get(req.params.id);
  res.json({ campaign: toCampaign(row) });
});

// DELETE /api/campaigns/:id — solo admin
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Campaña no encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
