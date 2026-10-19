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

// Campos solo para el admin (la tarifa fuente NUNCA sale en la API pública).
const ADMIN_FIELDS = PUBLIC_FIELDS + `, source_per_1k, source_min_clip, source_max_clip, margin_pct`;

// La vista pública necesita leer la tarifa fuente para calcular la del clipper,
// pero toCampaign() la elimina antes de responder.
const COMPUTE_FIELDS = ADMIN_FIELDS;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function marginFactor(row) {
  const m = Math.min(100, Math.max(0, Number(row.margin_pct)));
  return (100 - m) / 100;
}

function money(n) {
  return 'US$' + round2(n).toFixed(2);
}

// Texto de pago que ve el clipper: calculado desde la fuente y el margen.
// Si la campaña no tiene tarifa fuente, se usa el texto manual.
function clipperPayoutText(row) {
  if (Number(row.source_per_1k) > 0) {
    const f = marginFactor(row);
    let t = `${money(Number(row.source_per_1k) * f)} por cada 1.000 vistas`;
    const min = round2(Number(row.source_min_clip) * f);
    const max = round2(Number(row.source_max_clip) * f);
    if (min > 0 || max > 0) t += ` (mín. ${money(min)}/clip · máx. ${money(max)}/clip)`;
    return t;
  }
  return row.payout_text;
}

function toCampaign(row) {
  // Vista pública: tarifa del clipper calculada con el margen.
  // El presupuesto se muestra TAL CUAL se ve en la fuente (sin escalar),
  // porque Wilson lo actualiza manualmente desde ahí.
  const out = { ...row, is_example: row.is_example === 1 };
  out.payout_text = clipperPayoutText(row);
  out.budget_total = round2(row.budget_total);
  out.budget_remaining = round2(row.budget_remaining);
  // La tarifa fuente y el margen NUNCA salen en la respuesta pública.
  delete out.source_per_1k;
  delete out.source_min_clip;
  delete out.source_max_clip;
  delete out.margin_pct;
  // El origen (Lulosa/Whop) tampoco: el clipper no debe saber de dónde viene.
  out.platform = '';
  return out;
}

function toAdminCampaign(row) {
  const out = { ...row, is_example: row.is_example === 1 };
  out.clipper_preview = clipperPayoutText(row);
  return out;
}

// GET /api/campaigns/admin/all — solo admin: incluye tarifa fuente y margen.
// OJO: registrada antes de /:id para que "admin" no se interprete como un id.
router.get('/admin/all', requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT ${ADMIN_FIELDS} FROM campaigns ORDER BY status DESC, id ASC`)
    .all();
  res.json({ campaigns: rows.map(toAdminCampaign) });
});

// GET /api/campaigns — público: solo campañas activas
router.get('/', (req, res) => {
  const rows = db
    .prepare(`SELECT ${COMPUTE_FIELDS} FROM campaigns WHERE status = 'active' ORDER BY is_example ASC, id ASC`)
    .all();
  res.json({ campaigns: rows.map(toCampaign) });
});

// GET /api/campaigns/:id — público si está activa; admin puede ver cualquiera
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT ${COMPUTE_FIELDS} FROM campaigns WHERE id = ?`).get(req.params.id);
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

  const margin = Math.min(100, Math.max(0, b.margin_pct === undefined || b.margin_pct === '' ? 50 : Number(b.margin_pct) || 0));

  const info = db
    .prepare(`
      INSERT INTO campaigns
        (title, artist, platform, category, payout_text, budget_total, budget_remaining,
         deadline, requirements, brief, is_example, status,
         source_per_1k, source_min_clip, source_max_clip, margin_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      b.status === 'inactive' ? 'inactive' : 'active',
      Math.max(0, Number(b.source_per_1k) || 0),
      Math.max(0, Number(b.source_min_clip) || 0),
      Math.max(0, Number(b.source_max_clip) || 0),
      margin
    );

  const row = db.prepare(`SELECT ${ADMIN_FIELDS} FROM campaigns WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ campaign: toAdminCampaign(row) });
});

// PUT /api/campaigns/:id — solo admin
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaña no encontrada.' });

  const b = req.body;
  const title = (b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'El título es obligatorio.' });

  const margin = Math.min(100, Math.max(0, b.margin_pct === undefined || b.margin_pct === '' ? 50 : Number(b.margin_pct) || 0));

  db.prepare(`
      UPDATE campaigns SET
        title = ?, artist = ?, platform = ?, category = ?, payout_text = ?,
        budget_total = ?, budget_remaining = ?, deadline = ?, requirements = ?,
        brief = ?, is_example = ?, status = ?, updated_at = datetime('now'),
        source_per_1k = ?, source_min_clip = ?, source_max_clip = ?, margin_pct = ?
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
    Math.max(0, Number(b.source_per_1k) || 0),
    Math.max(0, Number(b.source_min_clip) || 0),
    Math.max(0, Number(b.source_max_clip) || 0),
    margin,
    req.params.id
  );

  const row = db.prepare(`SELECT ${ADMIN_FIELDS} FROM campaigns WHERE id = ?`).get(req.params.id);
  res.json({ campaign: toAdminCampaign(row) });
});

// DELETE /api/campaigns/:id — solo admin
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Campaña no encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
