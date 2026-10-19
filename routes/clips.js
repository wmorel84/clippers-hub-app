// Rutas de clips del usuario autenticado.
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { creditHeldEarning } = require('./wallet');

const router = express.Router();

function notify(userId, title, body) {
  db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(userId, title, body || '');
}

// Calcula la ganancia sugerida para un clip aprobado, a la tarifa del clipper.
// Devuelve { cents, reason, newViews, minViews }. reason: 'ok' | 'manual' | 'min' | 'max' | 'none'.
function suggestCredit(clip) {
  const margin = Math.min(100, Math.max(0, Number(clip.margin_pct) || 0));
  const rate = Number(clip.source_per_1k) * (1 - margin / 100);
  if (!(Number(clip.source_per_1k) > 0) || !(rate > 0)) {
    return { cents: 0, reason: 'manual', newViews: 0, minViews: 0 };
  }
  const minViews = (Number(clip.source_min_clip) / Number(clip.source_per_1k)) * 1000;
  const maxCents = Math.round(Number(clip.source_max_clip) * (1 - margin / 100) * 100);
  if (clip.views < minViews) {
    return { cents: 0, reason: 'min', newViews: 0, minViews: Math.round(minViews) };
  }
  if (maxCents > 0 && clip.credited_cents >= maxCents) {
    return { cents: 0, reason: 'max', newViews: 0, minViews: 0 };
  }
  const newViews = Math.max(0, clip.views - clip.credited_views);
  let cents = Math.round((newViews / 1000) * rate * 100);
  if (maxCents > 0) cents = Math.min(cents, maxCents - clip.credited_cents);
  if (!(cents > 0)) return { cents: 0, reason: 'none', newViews, minViews: 0 };
  return { cents, reason: 'ok', newViews, minViews: 0 };
}

function suggestReasonText(s) {
  if (s.reason === 'manual') return 'Campaña con pago manual: escribe el monto.';
  if (s.reason === 'min') return 'Aún no alcanza el mínimo (' + s.minViews.toLocaleString('es') + ' vistas).';
  if (s.reason === 'max') return 'Ya alcanzó el máximo por clip.';
  return 'Sin vistas nuevas para acreditar.';
}

function clipWithCampaign(id) {
  return db
    .prepare(
      `SELECT clips.*, campaigns.title AS campaign_title,
              campaigns.source_per_1k, campaigns.source_min_clip,
              campaigns.source_max_clip, campaigns.margin_pct
       FROM clips JOIN campaigns ON campaigns.id = clips.campaign_id
       WHERE clips.id = ?`
    )
    .get(id);
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Estima la ganancia TOTAL generada por un clip según sus vistas, a la tarifa
// del clipper (fuente × (1 − margen)), respetando mínimo de vistas y máximo
// por clip. Devuelve { cents, note, minViews }. note: 'ok' | 'manual' | 'min'.
function estimateTotal(clip) {
  const margin = Math.min(100, Math.max(0, Number(clip.margin_pct) || 0));
  const rate = Number(clip.source_per_1k) * (1 - margin / 100);
  if (!(Number(clip.source_per_1k) > 0) || !(rate > 0)) {
    return { cents: 0, note: 'manual', minViews: 0 };
  }
  const minViews = (Number(clip.source_min_clip) / Number(clip.source_per_1k)) * 1000;
  if (clip.views < minViews) {
    return { cents: 0, note: 'min', minViews: Math.round(minViews) };
  }
  const maxCents = Math.round(Number(clip.source_max_clip) * (1 - margin / 100) * 100);
  let cents = Math.round((clip.views / 1000) * rate * 100);
  if (maxCents > 0) cents = Math.min(cents, maxCents);
  return { cents, note: 'ok', minViews: 0 };
}

// GET /api/clips — clips del usuario actual
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT clips.id, clips.url, clips.status, clips.views, clips.created_at,
             clips.credited_cents,
             campaigns.title AS campaign_title,
             campaigns.source_per_1k, campaigns.source_min_clip,
             campaigns.source_max_clip, campaigns.margin_pct
      FROM clips
      JOIN campaigns ON campaigns.id = clips.campaign_id
      WHERE clips.user_id = ?
      ORDER BY clips.id DESC
    `)
    .all(req.session.userId);
  res.json({
    clips: rows.map((c) => {
      const e = estimateTotal(c);
      return {
        id: c.id, url: c.url, status: c.status, views: c.views,
        created_at: c.created_at, campaign_title: c.campaign_title,
        credited_cents: c.credited_cents,
        estimated_cents: e.cents,
        estimate_note: e.note === 'min' ? 'Mínimo: ' + e.minViews.toLocaleString('es') + ' vistas' : '',
      };
    }),
  });
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

// ---- Admin: revisión y acreditación (fase 4) ----

// GET /api/clips/admin/review — clips pendientes de revisión
router.get('/admin/review', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT clips.id, clips.url, clips.views, clips.created_at, clips.user_id,
              users.name AS clipper_name, campaigns.title AS campaign_title,
              campaigns.source_per_1k, campaigns.source_min_clip,
              campaigns.source_max_clip, campaigns.margin_pct
       FROM clips
       JOIN users ON users.id = clips.user_id
       JOIN campaigns ON campaigns.id = clips.campaign_id
       WHERE clips.status = 'pending'
       ORDER BY clips.id ASC`
    )
    .all();
  res.json({
    clips: rows.map((c) => {
      const e = estimateTotal(c);
      return {
        id: c.id, url: c.url, views: c.views, created_at: c.created_at,
        clipper_name: c.clipper_name, campaign_title: c.campaign_title,
        estimated_cents: e.cents,
        estimate_note: e.note === 'min' ? 'Mínimo: ' + e.minViews.toLocaleString('es') + ' vistas' : (e.note === 'manual' ? 'Pago manual' : ''),
      };
    }),
  });
});

// GET /api/clips/admin/approved — clips aprobados con datos para acreditar
router.get('/admin/approved', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT clips.id, clips.url, clips.views, clips.credited_views, clips.credited_cents,
              clips.created_at, users.name AS clipper_name, campaigns.title AS campaign_title,
              campaigns.source_per_1k, campaigns.source_min_clip,
              campaigns.source_max_clip, campaigns.margin_pct
       FROM clips
       JOIN users ON users.id = clips.user_id
       JOIN campaigns ON campaigns.id = clips.campaign_id
       WHERE clips.status = 'approved'
       ORDER BY clips.id DESC`
    )
    .all();
  res.json({
    clips: rows.map((c) => {
      const s = suggestCredit(c);
      const e = estimateTotal(c);
      return {
        id: c.id, url: c.url, views: c.views,
        credited_views: c.credited_views, credited_cents: c.credited_cents,
        created_at: c.created_at, clipper_name: c.clipper_name, campaign_title: c.campaign_title,
        estimated_cents: e.cents,
        suggested_cents: s.cents, suggest_reason: s.reason,
        suggest_text: s.reason === 'ok' ? '' : suggestReasonText(s),
        min_views: s.minViews || 0, new_views: s.newViews || 0,
      };
    }),
  });
});

// POST /api/clips/admin/:id/approve — aprobar un clip
router.post('/admin/:id/approve', requireAdmin, (req, res) => {
  const clip = db.prepare('SELECT id, user_id, status FROM clips WHERE id = ?').get(req.params.id);
  if (!clip) return res.status(404).json({ error: 'Clip no encontrado.' });
  if (clip.status !== 'pending') return res.status(400).json({ error: 'El clip ya fue revisado.' });
  db.prepare("UPDATE clips SET status = 'approved' WHERE id = ?").run(clip.id);
  notify(clip.user_id, 'Tu clip fue aprobado', 'Ya está participando por ganancias. Las verás en tu Billetera cuando se acrediten.');
  res.json({ ok: true });
});

// POST /api/clips/admin/:id/reject — rechazar un clip
router.post('/admin/:id/reject', requireAdmin, (req, res) => {
  const clip = db.prepare('SELECT id, user_id, status FROM clips WHERE id = ?').get(req.params.id);
  if (!clip) return res.status(404).json({ error: 'Clip no encontrado.' });
  if (clip.status !== 'pending') return res.status(400).json({ error: 'El clip ya fue revisado.' });
  const note = String((req.body && req.body.note) || '').trim().slice(0, 300);
  db.prepare("UPDATE clips SET status = 'rejected', admin_note = ? WHERE id = ?").run(note, clip.id);
  notify(clip.user_id, 'Tu clip no fue aprobado', note);
  res.json({ ok: true });
});

// POST /api/clips/admin/:id/views — actualizar vistas de un clip aprobado
router.post('/admin/:id/views', requireAdmin, (req, res) => {
  const clip = db.prepare('SELECT id, status FROM clips WHERE id = ?').get(req.params.id);
  if (!clip) return res.status(404).json({ error: 'Clip no encontrado.' });
  if (clip.status !== 'approved') return res.status(400).json({ error: 'Solo se actualizan vistas de clips aprobados.' });
  const views = Math.max(0, Math.floor(Number(req.body && req.body.views) || 0));
  db.prepare('UPDATE clips SET views = ? WHERE id = ?').run(views, clip.id);
  res.json({ ok: true, views });
});

// POST /api/clips/admin/:id/credit — acreditar ganancia a la billetera (retenida 14 días)
router.post('/admin/:id/credit', requireAdmin, (req, res) => {
  const clip = clipWithCampaign(req.params.id);
  if (!clip) return res.status(404).json({ error: 'Clip no encontrado.' });
  if (clip.status !== 'approved') return res.status(400).json({ error: 'Solo se acredita en clips aprobados.' });
  const s = suggestCredit(clip);
  let cents = s.cents;
  if (req.body && req.body.amount !== undefined && req.body.amount !== '') {
    const manual = Math.round(Number(req.body.amount) * 100);
    if (!(manual > 0)) return res.status(400).json({ error: 'Monto inválido.' });
    cents = manual;
  }
  if (!(cents > 0)) return res.status(400).json({ error: suggestReasonText(s) });

  const tx = creditHeldEarning(clip.user_id, cents, clip.campaign_title, 'Clip aprobado · ' + s.newViews.toLocaleString('es') + ' vistas nuevas');
  db.prepare('UPDATE clips SET credited_views = ?, credited_cents = credited_cents + ? WHERE id = ?').run(
    clip.views,
    cents,
    clip.id
  );
  res.json({ ok: true, tx_id: tx.id, cents });
});

module.exports = router;
