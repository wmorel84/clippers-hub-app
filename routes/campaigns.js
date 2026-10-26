// Rutas de campañas: lectura pública (solo activas), gestión solo admin.
const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const PUBLIC_FIELDS = `
  id, title, artist, platform, category, payout_text,
  budget_total, budget_remaining, budget_reserved, deadline, requirements, brief,
  is_example, status, created_at, updated_at, image_url, materials
`;

// Campos solo para el admin (la tarifa fuente NUNCA sale en la API pública).
const ADMIN_FIELDS = PUBLIC_FIELDS + `, source_per_1k, source_min_clip, source_max_clip, margin_pct, source_min_engagement`;

// La vista pública necesita leer la tarifa fuente para calcular la del clipper,
// pero toCampaign() la elimina antes de responder.
const COMPUTE_FIELDS = ADMIN_FIELDS;

function cleanEngagement(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

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
  out.budget_reserved = round2(row.budget_reserved);
  // La tarifa fuente y el margen NUNCA salen en la respuesta pública.
  delete out.source_per_1k;
  delete out.source_min_clip;
  delete out.source_max_clip;
  delete out.margin_pct;
  // El engagement mínimo SÍ es público: es un requisito que el clipper debe cumplir.
  out.min_engagement_pct = Math.min(100, Math.max(0, Number(row.source_min_engagement) || 0));
  delete out.source_min_engagement;
  // El origen (Lulosa/Whop) tampoco: el clipper no debe saber de dónde viene.
  out.platform = '';
  return out;
}

function toAdminCampaign(row) {
  const out = { ...row, is_example: row.is_example === 1 };
  out.clipper_preview = clipperPayoutText(row);
  return out;
}

// Material de referencia: una URL por línea. Se extrae la primera URL de
// cada línea, así sirve pegar "Ref: https://..." tal como viene en Lulosa.
// Si el campo viene ausente (undefined) se devuelve undefined: en una
// actualización eso significa "conservar el material anterior", para que un
// import sin material no lo borre. El formulario del admin siempre lo envía
// (aunque sea vacío), así que desde ahí sí se puede quitar todo.
function cleanMaterials(v) {
  if (v === undefined) return undefined;
  const urls = String(v)
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/https?:\/\/[^\s"'<>]+/);
      return m ? m[0].replace(/[.,;:)]+$/, '') : '';
    })
    .filter(Boolean);
  return [...new Set(urls)].join('\n').slice(0, 4000);
}

// Sanitiza y valida los campos de una campaña (usado por crear, editar e importar).
// Lanza Error si el título falta.
function sanitizeCampaign(b) {
  b = b || {};
  const title = String(b.title || '').trim();
  if (!title) throw new Error('Falta el título.');
  const margin = Math.min(100, Math.max(0, b.margin_pct === undefined || b.margin_pct === '' ? 50 : Number(b.margin_pct) || 0));
  return {
    title,
    artist: String(b.artist || '').trim(),
    platform: String(b.platform || '').trim(),
    category: String(b.category || 'musica').trim() || 'musica',
    payout_text: String(b.payout_text || '').trim(),
    budget_total: Number(b.budget_total) || 0,
    budget_remaining: (b.budget_remaining === undefined || b.budget_remaining === '') ? (Number(b.budget_total) || 0) : (Number(b.budget_remaining) || 0),
    budget_reserved: Math.max(0, Number(b.budget_reserved) || 0),
    deadline: String(b.deadline || '').trim(),
    requirements: String(b.requirements || '').trim(),
    brief: String(b.brief || '').trim(),
    materials: cleanMaterials(b.materials),
    image_url: String(b.image_url || '').trim().slice(0, 600),
    is_example: b.is_example ? 1 : 0,
    status: b.status === 'inactive' ? 'inactive' : 'active',
    source_per_1k: Math.max(0, Number(b.source_per_1k) || 0),
    source_min_clip: Math.max(0, Number(b.source_min_clip) || 0),
    source_max_clip: Math.max(0, Number(b.source_max_clip) || 0),
    margin_pct: margin,
    source_min_engagement: cleanEngagement(b.source_min_engagement),
  };
}

function insertCampaign(c) {
  return db.prepare(`
      INSERT INTO campaigns
        (title, artist, platform, category, payout_text, budget_total, budget_remaining, budget_reserved,
         deadline, requirements, brief, is_example, status,
         source_per_1k, source_min_clip, source_max_clip, margin_pct, source_min_engagement, image_url, materials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    c.title, c.artist, c.platform, c.category, c.payout_text, c.budget_total, c.budget_remaining, c.budget_reserved,
    c.deadline, c.requirements, c.brief, c.is_example, c.status,
    c.source_per_1k, c.source_min_clip, c.source_max_clip, c.margin_pct, c.source_min_engagement, c.image_url,
    c.materials === undefined ? '' : c.materials
  ).lastInsertRowid;
}

function updateCampaign(id, c) {
  const base = [
    c.title, c.artist, c.platform, c.category, c.payout_text, c.budget_total, c.budget_remaining, c.budget_reserved,
    c.deadline, c.requirements, c.brief, c.is_example, c.status,
    c.source_per_1k, c.source_min_clip, c.source_max_clip, c.margin_pct, c.source_min_engagement,
    c.image_url, c.image_url,
  ];
  if (c.materials === undefined) {
    // Sin material en el payload: se conserva el anterior.
    db.prepare(`
        UPDATE campaigns SET
          title = ?, artist = ?, platform = ?, category = ?, payout_text = ?,
          budget_total = ?, budget_remaining = ?, budget_reserved = ?, deadline = ?, requirements = ?,
          brief = ?, is_example = ?, status = ?, updated_at = datetime('now'),
          source_per_1k = ?, source_min_clip = ?, source_max_clip = ?, margin_pct = ?,
          source_min_engagement = ?, image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END
        WHERE id = ?
      `).run(...base, id);
  } else {
    db.prepare(`
        UPDATE campaigns SET
          title = ?, artist = ?, platform = ?, category = ?, payout_text = ?,
          budget_total = ?, budget_remaining = ?, budget_reserved = ?, deadline = ?, requirements = ?,
          brief = ?, is_example = ?, status = ?, updated_at = datetime('now'),
          source_per_1k = ?, source_min_clip = ?, source_max_clip = ?, margin_pct = ?,
          source_min_engagement = ?, image_url = CASE WHEN ? <> '' THEN ? ELSE image_url END,
          materials = ?
        WHERE id = ?
      `).run(...base, c.materials, id);
  }
}

// ---------- Imagen automática (pedido de Wilson, 20 oct 2026) ----------
// Cuando una campaña queda sin imagen, la app busca sola la foto del artista
// en Wikipedia (español, luego inglés) y guarda la URL. Si no hay foto, usa
// una temática local por defecto (música). Solo rellena campos vacíos: una
// imagen puesta a mano en el panel siempre se respeta.
const AUTO_IMAGE_FALLBACK = { musica: '/img/campaigns/la-movida.jpg' };

async function wikiImage(name) {
  for (const lang of ['es', 'en']) {
    try {
      const url = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' +
        encodeURIComponent(String(name).trim().replace(/ /g, '_'));
      const r = await fetch(url, {
        headers: { 'User-Agent': 'ClippersPro/1.0 (imagen automatica de campana)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.type && d.type !== 'standard') continue; // evita desambiguaciones
      const img = (d.originalimage && d.originalimage.source) || (d.thumbnail && d.thumbnail.source);
      if (img && /\.(jpe?g|png)$/i.test(img.split('?')[0])) return img;
    } catch (e) { /* se prueba el siguiente idioma */ }
  }
  return '';
}

function artistCandidates(artist, title) {
  const names = [];
  const raw = String(artist || '').trim();
  if (raw) {
    names.push(raw);
    raw.split(/\s*(?:&| y | ft\.? | feat\.? |,)\s*/i).forEach((p) => {
      const t = p.trim();
      if (t && !names.includes(t)) names.push(t);
    });
  }
  const head = String(title || '').split('|')[0].split(' - ')[0].trim();
  if (head && !names.includes(head)) names.push(head);
  return names;
}

async function autoImageFor(row) {
  const names = artistCandidates(row.artist, row.title);
  for (const n of names) {
    const img = await wikiImage(n);
    if (img) return img;
  }
  return AUTO_IMAGE_FALLBACK[row.category] || '';
}

// Rellena en segundo plano la imagen de una campaña si quedó vacía.
// No bloquea la respuesta al admin; si algo falla, la campaña queda sin
// imagen y se reintenta en la próxima actualización que la toque.
function fillImageAsync(id) {
  try {
    const row = db.prepare('SELECT id, title, artist, category, image_url FROM campaigns WHERE id = ?').get(id);
    if (!row || row.image_url) return;
    autoImageFor(row)
      .then((img) => {
        if (img) {
          db.prepare("UPDATE campaigns SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '')").run(img, id);
        }
      })
      .catch(() => {});
  } catch (e) { /* sin imagen por ahora */ }
}

// OJO: registrada antes de /:id para que "admin" no se interprete como un id.
router.get('/admin/all', requireAdmin, (req, res) => {
  const rows = db
    .prepare(`SELECT ${ADMIN_FIELDS} FROM campaigns ORDER BY status DESC, id ASC`)
    .all();
  res.json({ campaigns: rows.map(toAdminCampaign) });
});

// GET /api/campaigns — con sesión: la lista real. Sin sesión: SOLO el conteo
// (la landing y la página pública lo leen en vivo; las campañas reales son
// confidenciales y no se entregan a visitantes sin cuenta).
// CORS abierto: la landing pública lee el conteo desde otro dominio.
router.get('/', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const rows = db
    .prepare(`SELECT ${COMPUTE_FIELDS} FROM campaigns WHERE status = 'active' ORDER BY is_example ASC, id ASC`)
    .all();
  const campaigns = rows.map(toCampaign);
  const count = campaigns.filter((c) => !c.is_example).length;
  if (!req.session || !req.session.userId) return res.json({ campaigns: [], count });
  res.json({ campaigns, count });
});

// GET /api/campaigns/:id — solo con sesión (confidencialidad); admin puede ver cualquiera
router.get('/:id', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(404).json({ error: 'Campaña no encontrada.' });
  }
  const row = db.prepare(`SELECT ${COMPUTE_FIELDS} FROM campaigns WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Campaña no encontrada.' });
  if (row.status !== 'active' && req.session?.role !== 'admin') {
    return res.status(404).json({ error: 'Campaña no encontrada.' });
  }
  res.json({ campaign: toCampaign(row) });
});

// POST /api/campaigns — solo admin
router.post('/', requireAdmin, (req, res) => {
  let c;
  try { c = sanitizeCampaign(req.body); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const id = insertCampaign(c);
  fillImageAsync(id);
  const row = db.prepare(`SELECT ${ADMIN_FIELDS} FROM campaigns WHERE id = ?`).get(id);
  res.status(201).json({ campaign: toAdminCampaign(row) });
});

// POST /api/campaigns/admin/import — importación masiva (upsert por título)
router.post('/admin/import', requireAdmin, (req, res) => {
  const list = req.body && req.body.campaigns;
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'Envía un arreglo "campaigns" con al menos 1 campaña.' });
  }
  if (list.length > 100) return res.status(400).json({ error: 'Máximo 100 campañas por importación.' });
  const find = db.prepare('SELECT id FROM campaigns WHERE title = ?');
  let inserted = 0, updated = 0;
  const errors = [];
  for (const b of list) {
    try {
      const c = sanitizeCampaign(b);
      const ex = find.get(c.title);
      if (ex) { updateCampaign(ex.id, c); updated++; fillImageAsync(ex.id); }
      else { const nid = insertCampaign(c); inserted++; fillImageAsync(nid); }
    } catch (e) {
      errors.push({ title: (b && b.title) || '(sin título)', error: e.message });
    }
  }
  res.json({ ok: true, inserted, updated, errors });
});

// PUT /api/campaigns/:id — solo admin
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campaña no encontrada.' });
  let c;
  try { c = sanitizeCampaign(req.body); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  updateCampaign(req.params.id, c);
  fillImageAsync(req.params.id);
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
