// Billetera del usuario autenticado (resumen calculado de sus clips).
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/wallet — resumen: clips aprobados/pendientes y vistas
router.get('/', requireAuth, (req, res) => {
  const row = db
    .prepare(`
      SELECT
        COUNT(*) AS total_clips,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_clips,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_clips,
        COALESCE(SUM(views), 0) AS total_views
      FROM clips
      WHERE user_id = ?
    `)
    .get(req.session.userId);

  res.json({
    wallet: {
      total_clips: row.total_clips,
      approved_clips: row.approved_clips,
      pending_clips: row.pending_clips,
      total_views: row.total_views,
      // Los pagos los confirma Wilson manualmente por ahora.
      balance: 0,
      note: 'Los pagos se confirman manualmente. Aquí verás tu saldo cuando Wilson registre tus ganancias.',
    },
  });
});

module.exports = router;
