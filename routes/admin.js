// Respaldo y restauración de la base de datos (solo administradores).
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const { requireAdmin } = require('../middleware/auth');
const { db } = require('../db');

const router = express.Router();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'hub.db');
const EXPECTED_TABLES = ['users', 'campaigns', 'clips', 'notifications'];

// Descarga una copia de la base de datos.
router.get('/backup', requireAdmin, (req, res) => {
  try {
    const check = db.prepare('PRAGMA integrity_check').get();
    if (!check || check.integrity_check !== 'ok') {
      return res.status(500).json({ error: 'La base de datos no pasó la verificación de integridad.' });
    }
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo verificar la base de datos.' });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.download(DB_PATH, `hub-respaldo-${stamp}.db`, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'No se pudo generar el respaldo.' });
    }
  });
});

// Restaura la base de datos desde un archivo .db subido.
// El archivo se valida antes de reemplazar el actual.
// IMPORTANTE: después hay que reiniciar el servicio en Railway para aplicarlo.
router.post(
  '/restore',
  requireAdmin,
  express.raw({ type: 'application/octet-stream', limit: '50mb' }),
  (req, res) => {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }
    // Todo archivo SQLite empieza con la firma "SQLite format 3\0".
    if (req.body.slice(0, 16).toString('utf8') !== 'SQLite format 3\0') {
      return res.status(400).json({ error: 'El archivo no parece una base de datos SQLite.' });
    }
    const tmp = path.join(os.tmpdir(), `hub-restore-${Date.now()}.db`);
    try {
      fs.writeFileSync(tmp, req.body);
      const check = new DatabaseSync(tmp, { readOnly: true });
      try {
        const integrity = check.prepare('PRAGMA integrity_check').get();
        if (!integrity || integrity.integrity_check !== 'ok') {
          throw new Error('la verificación de integridad falló');
        }
        const tables = check
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
          .map((r) => r.name);
        for (const t of EXPECTED_TABLES) {
          if (!tables.includes(t)) throw new Error(`falta la tabla "${t}"`);
        }
      } finally {
        check.close();
      }
      fs.copyFileSync(tmp, DB_PATH);
      res.json({
        ok: true,
        message: 'Respaldo restaurado. Reinicia el servicio en Railway para aplicarlo.',
      });
    } catch (e) {
      res.status(400).json({ error: 'El archivo no es un respaldo válido: ' + e.message });
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
);

module.exports = router;
