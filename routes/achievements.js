// Logros de los clippers: publicación al instante, con captura de pantalla.
// La imagen se guarda en el volumen persistente (misma carpeta que la BD),
// nunca en public/, para que un despliegue no la borre.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { containsBlockedWord } = require('../lib/blocked');
const { notifyAdmins } = require('../lib/notify');

const router = express.Router();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'hub.db');
const UPLOADS_DIR = path.join(path.dirname(DB_PATH), 'uploads', 'achievements');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB por captura
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP o GIF).'));
  },
});

const EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉'];

// Reacciones agrupadas por logro, igual que en el chat.
function reactionsFor(ids, myId) {
  const out = {};
  if (!ids.length) return out;
  const rows = db.prepare(`
    SELECT message_id, emoji, user_id FROM chat_reactions
    WHERE scope = 'achievements' AND message_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  // La tabla de reacciones del chat guarda message_id; para Logros se reusa
  // ese campo con el id del logro (scope 'achievements' lo distingue).
  const byId = {};
  for (const r of rows) {
    byId[r.message_id] = byId[r.message_id] || {};
    byId[r.message_id][r.emoji] = byId[r.message_id][r.emoji] || { emoji: r.emoji, count: 0, mine: false };
    byId[r.message_id][r.emoji].count++;
    if (r.user_id === myId) byId[r.message_id][r.emoji].mine = true;
  }
  for (const id of Object.keys(byId)) out[id] = Object.values(byId[id]);
  return out;
}

// GET /api/achievements — últimos logros, con nombre del autor
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.user_id, a.title, a.body, a.image_path, a.created_at, a.reply_to_id, a.reply_body, a.reply_author, a.pinned, u.name AS author_name, u.role AS author_role
    FROM achievements a JOIN users u ON u.id = a.user_id
    ORDER BY a.pinned DESC, a.id DESC LIMIT 50
  `).all();
  const rx = reactionsFor(rows.map((r) => r.id), req.session.userId);
  res.json({ achievements: rows.map((r) => ({ ...r, image_url: r.image_path ? '/api/achievements/image/' + r.id : '', reactions: rx[r.id] || [] })) });
});

// GET /api/achievements/image/:id — la captura, solo con sesión
router.get('/image/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT image_path FROM achievements WHERE id = ?').get(Number(req.params.id));
  if (!row || !row.image_path) return res.status(404).json({ error: 'Imagen no encontrada.' });
  const full = path.join(UPLOADS_DIR, path.basename(row.image_path));
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Imagen no encontrada.' });
  res.sendFile(full);
});

// POST /api/achievements — publicar al instante (texto + captura opcional)
router.post('/', requireAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La captura no puede pasar de 3 MB.' : err.message });
    const title = String(req.body.title || '').trim().slice(0, 200);
    const body = String(req.body.body || '').trim().slice(0, 2000);
    if (!title && !body && !req.file) {
      return res.status(400).json({ error: 'Escribe tu logro o adjunta una imagen.' });
    }
    // Filtro de palabras restringidas, igual que en la comunidad: texto,
    // links dentro del texto y nombre de la imagen. El admin queda exento.
    // Si coincide, NO se publica y al autor solo le sale el aviso genérico;
    // al admin sí le llega un aviso de que se bloqueó un logro.
    if (req.session.role !== 'admin' && (containsBlockedWord(title + ' ' + body) || (req.file && containsBlockedWord(req.file.originalname)))) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      const author = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
      notifyAdmins('Logro bloqueado por palabras restringidas', (author ? author.name : 'Un clipper') + ' intentó publicar un logro que fue bloqueado por el filtro.');
      return res.status(400).json({ error: 'Este mensaje no se pudo enviar' });
    }
    const rid = Number(req.body.reply_to_id) || null;
    let replyBody = '', replyAuthor = '';
    if (rid) {
      const target = db.prepare(`
        SELECT a.body, a.title, u.name AS author_name FROM achievements a JOIN users u ON u.id = a.user_id WHERE a.id = ?
      `).get(rid);
      if (target) { replyBody = target.body || target.title || ''; replyAuthor = target.author_name || ''; }
    }
    const info = db.prepare(
      'INSERT INTO achievements (user_id, title, body, image_path, reply_to_id, reply_body, reply_author) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.session.userId, title, body, req.file ? req.file.filename : '', rid, replyBody, replyAuthor);
    res.status(201).json({ id: info.lastInsertRowid });
  });
});

// POST /api/achievements/:id/react — alternar una reacción (igual que en el chat)
router.post('/:id/react', requireAuth, (req, res) => {
  const mid = Number(req.params.id);
  const emoji = String((req.body && req.body.emoji) || '');
  if (!EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Reacción no válida.' });
  if (!db.prepare('SELECT id FROM achievements WHERE id = ?').get(mid)) return res.status(404).json({ error: 'Logro no encontrado.' });
  const existing = db.prepare("SELECT id FROM chat_reactions WHERE scope = 'achievements' AND message_id = ? AND user_id = ? AND emoji = ?").get(mid, req.session.userId, emoji);
  if (existing) db.prepare('DELETE FROM chat_reactions WHERE id = ?').run(existing.id);
  else db.prepare("INSERT INTO chat_reactions (scope, message_id, user_id, emoji) VALUES ('achievements', ?, ?, ?)").run(mid, req.session.userId, emoji);
  res.json({ reactions: reactionsFor([mid], req.session.userId)[mid] || [] });
});

// POST /api/achievements/:id/pin — fijar (solo admin; un solo fijado, igual que en el chat)
router.post('/:id/pin', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo el admin fija logros.' });
  if (!db.prepare('SELECT id FROM achievements WHERE id = ?').get(Number(req.params.id))) return res.status(404).json({ error: 'Logro no encontrado.' });
  db.prepare('UPDATE achievements SET pinned = 0').run();
  db.prepare('UPDATE achievements SET pinned = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/achievements/:id/pin — quitar el fijado (solo admin)
router.delete('/:id/pin', requireAuth, (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Solo el admin.' });
  db.prepare('UPDATE achievements SET pinned = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/achievements/:id — el autor o el admin
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM achievements WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Logro no encontrado.' });
  const isAdmin = req.session.role === 'admin';
  if (row.user_id !== req.session.userId && !isAdmin) return res.status(403).json({ error: 'Sin permiso.' });
  db.prepare("DELETE FROM chat_reactions WHERE scope = 'achievements' AND message_id = ?").run(row.id);
  db.prepare('DELETE FROM achievements WHERE id = ?').run(row.id);
  if (row.image_path) fs.rmSync(path.join(UPLOADS_DIR, path.basename(row.image_path)), { force: true });
  res.json({ ok: true });
});

module.exports = router;
