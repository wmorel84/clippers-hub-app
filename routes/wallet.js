// Billetera con retención antifraude (fase 3 del modelo Clippers Pro).
// - Las ganancias que registra Wilson quedan RETENIDAS 14 días y luego se liberan.
// - El clipper guarda su cuenta PANA para recibir los pagos.
// - Los pagos los hace Wilson por la app PANA y los registra aquí.
// Montos en centavos (INTEGER) para evitar errores de decimales.
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
// NOTA: estimateTotal se carga de forma diferida dentro del handler (require
// circular con routes/clips.js: clips.js también requiere este módulo).

const router = express.Router();

// Días de retención antifraude antes de liberar una ganancia.
const HOLD_DAYS = 14;

function notify(userId, title, body) {
  db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(
    userId,
    title,
    body || ''
  );
}

// Libera las ganancias retenidas cuya fecha ya llegó.
function releaseDueHolds() {
  db.prepare(
    "UPDATE wallet_tx SET status = 'available', available_at = NULL WHERE status = 'held' AND available_at IS NOT NULL AND available_at <= datetime('now')"
  ).run();
}

function balances(userId) {
  releaseDueHolds();
  return db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('available', 'paid') THEN amount_cents ELSE 0 END), 0) AS available_cents,
        COALESCE(SUM(CASE WHEN status = 'held' THEN amount_cents ELSE 0 END), 0) AS held_cents,
        COALESCE(SUM(CASE WHEN kind = 'earning' THEN amount_cents ELSE 0 END), 0) AS earned_cents,
        COALESCE(SUM(CASE WHEN kind = 'payout' THEN -amount_cents ELSE 0 END), 0) AS paid_cents
      FROM wallet_tx
      WHERE user_id = ?
    `
    )
    .get(userId);
}

function fmtDateES(iso) {
  return new Date(iso + 'Z').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Acredita una ganancia retenida HOLD_DAYS días. Devuelve { id, available_at }.
// Lo usan el panel de billetera y la fase 4 (aprobación de clips).
function creditHeldEarning(userId, cents, campaignTitle, note) {
  const info = db
    .prepare(
      "INSERT INTO wallet_tx (user_id, kind, amount_cents, status, available_at, campaign_title, note) VALUES (?, 'earning', ?, 'held', datetime('now', ?), ?, ?)"
    )
    .run(userId, cents, '+' + HOLD_DAYS + ' days', campaignTitle || '', note || '');
  const release = db.prepare('SELECT available_at FROM wallet_tx WHERE id = ?').get(info.lastInsertRowid).available_at;
  notify(
    userId,
    'Nueva ganancia registrada: US$' + (cents / 100).toFixed(2),
    ((campaignTitle || '') + (note ? '. ' + note : '')).trim() + ' Se libera el ' + fmtDateES(release) + ' (retención antifraude de ' + HOLD_DAYS + ' días).'
  );
  return { id: info.lastInsertRowid, available_at: release };
}

function txsFor(userId, limit) {
  return db
    .prepare(
      'SELECT id, kind, amount_cents, status, available_at, campaign_title, note, created_at FROM wallet_tx WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    )
    .all(userId, limit || 50);
}

function dollarsToCents(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1000000) return 0;
  return Math.round(n * 100);
}

// GET /api/wallet — resumen del clipper: clips, saldos, PANA y movimientos
router.get('/', requireAuth, (req, res) => {
  const stats = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total_clips,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_clips,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_clips,
        COALESCE(SUM(views), 0) AS total_views
      FROM clips
      WHERE user_id = ?
    `
    )
    .get(req.session.userId);

  const user = db
    .prepare('SELECT pana_account FROM users WHERE id = ?')
    .get(req.session.userId);

  const b = balances(req.session.userId);

  // Total estimado de los clips que ya cumplen el mínimo (a tarifa del clipper).
  const { estimateTotal } = require('./clips');
  const clipRows = db
    .prepare(
      `SELECT clips.views,
              campaigns.source_per_1k, campaigns.source_min_clip,
              campaigns.source_max_clip, campaigns.margin_pct
       FROM clips
       JOIN campaigns ON campaigns.id = clips.campaign_id
       WHERE clips.user_id = ? AND clips.status != 'rejected'`
    )
    .all(req.session.userId);
  const estimatedTotalCents = clipRows.reduce((sum, c) => sum + estimateTotal(c).cents, 0);

  res.json({
    wallet: {
      total_clips: stats.total_clips,
      approved_clips: stats.approved_clips,
      pending_clips: stats.pending_clips,
      total_views: stats.total_views,
      available_cents: b.available_cents,
      held_cents: b.held_cents,
      earned_cents: b.earned_cents,
      paid_cents: b.paid_cents,
      estimated_total_cents: estimatedTotalCents,
      hold_days: HOLD_DAYS,
      pana_account: (user && user.pana_account) || '',
      transactions: txsFor(req.session.userId, 50),
      note: 'Las ganancias se retienen ' + HOLD_DAYS + ' días como medida antifraude antes de liberarse.',
    },
  });
});

// PUT /api/wallet/pana — el clipper guarda su cuenta PANA
router.put('/pana', requireAuth, (req, res) => {
  const pana = String((req.body && req.body.pana_account) || '').trim().slice(0, 120);
  if (!pana) return res.status(400).json({ error: 'Escribe tu cuenta PANA.' });
  db.prepare('UPDATE users SET pana_account = ? WHERE id = ?').run(pana, req.session.userId);
  res.json({ ok: true, pana_account: pana });
});

// GET /api/wallet/admin/users — clippers con saldos y PANA (admin)
router.get('/admin/users', requireAdmin, (req, res) => {
  releaseDueHolds();
  const users = db
    .prepare("SELECT id, name, email, COALESCE(pana_account, '') AS pana_account FROM users WHERE role != 'admin' ORDER BY name")
    .all();
  res.json({
    users: users.map((u) => {
      const b = balances(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        pana_account: u.pana_account,
        available_cents: b.available_cents,
        held_cents: b.held_cents,
        earned_cents: b.earned_cents,
        paid_cents: b.paid_cents,
      };
    }),
    hold_days: HOLD_DAYS,
  });
});

// POST /api/wallet/admin/credit — registrar ganancia (retenida 14 días)
router.post('/admin/credit', requireAdmin, (req, res) => {
  const userId = Number(req.body && req.body.user_id);
  const cents = dollarsToCents(req.body && req.body.amount);
  const campaign = String((req.body && req.body.campaign_title) || '').trim().slice(0, 200);
  const note = String((req.body && req.body.note) || '').trim().slice(0, 300);
  const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'Clipper no encontrado.' });
  if (!cents) return res.status(400).json({ error: 'Monto inválido. Usa un número mayor a 0.' });

  const tx = creditHeldEarning(userId, cents, campaign, note);
  res.json({ ok: true, id: tx.id });
});

// POST /api/wallet/admin/payout — registrar pago enviado por PANA
router.post('/admin/payout', requireAdmin, (req, res) => {
  const userId = Number(req.body && req.body.user_id);
  const cents = dollarsToCents(req.body && req.body.amount);
  const note = String((req.body && req.body.note) || '').trim().slice(0, 300);
  const target = db.prepare("SELECT id, name, COALESCE(pana_account, '') AS pana_account FROM users WHERE id = ?").get(userId);
  if (!target) return res.status(404).json({ error: 'Clipper no encontrado.' });
  if (!cents) return res.status(400).json({ error: 'Monto inválido. Usa un número mayor a 0.' });
  if (!target.pana_account) {
    return res.status(400).json({ error: target.name + ' aún no registra su cuenta PANA. Pídesela antes de pagar.' });
  }
  const b = balances(userId);
  if (cents > b.available_cents) {
    return res.status(400).json({
      error: 'Saldo disponible insuficiente: US$' + (b.available_cents / 100).toFixed(2) + '.',
    });
  }

  const info = db
    .prepare("INSERT INTO wallet_tx (user_id, kind, amount_cents, status, note) VALUES (?, 'payout', ?, 'paid', ?)")
    .run(userId, -cents, note);
  notify(userId, 'Pago enviado por PANA: US$' + (cents / 100).toFixed(2), note);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// POST /api/wallet/admin/adjust — ajuste manual inmediato (+ o -)
router.post('/admin/adjust', requireAdmin, (req, res) => {
  const userId = Number(req.body && req.body.user_id);
  const raw = Number(req.body && req.body.amount);
  const note = String((req.body && req.body.note) || '').trim().slice(0, 300);
  const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'Clipper no encontrado.' });
  if (!Number.isFinite(raw) || raw === 0 || Math.abs(raw) > 1000000) {
    return res.status(400).json({ error: 'Monto inválido. Usa un número distinto de 0 (puede ser negativo).' });
  }
  const cents = Math.round(raw * 100);
  const info = db
    .prepare("INSERT INTO wallet_tx (user_id, kind, amount_cents, status, note) VALUES (?, 'adjustment', ?, 'available', ?)")
    .run(userId, cents, note);
  notify(userId, 'Ajuste en tu billetera: ' + (cents > 0 ? '+' : '-') + 'US$' + Math.abs(cents / 100).toFixed(2), note);
  res.json({ ok: true, id: info.lastInsertRowid });
});

module.exports = router;
module.exports.creditHeldEarning = creditHeldEarning;
module.exports.HOLD_DAYS = HOLD_DAYS;
