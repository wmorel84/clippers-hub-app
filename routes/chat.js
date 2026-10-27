// Rutas del chat de la comunidad y los mensajes privados con el admin.
// Comunidad: sala única para todos los usuarios con sesión.
// Privados: cada clipper tiene UNA conversación con el equipo (admin);
// cualquier admin la atiende. Incluye respuestas (cita) y reacciones.
const fs = require('fs');
const path = require('path');
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { notifyAdmins } = require('../lib/notify');
const { normalizeWord, blockedWords, containsBlockedWord, cleanBlockedWord } = require('../lib/blocked');
const { uploadsDir, imageUpload, deleteUpload } = require('../lib/uploads');

const chatUpload = imageUpload('chat');

const router = express.Router();

const MAX_BODY = 500;
const EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉'];
const PAGE = 100;

const me = (req) =>
  db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(req.session.userId);
const isAdmin = (u) => u && u.role === 'admin';

function cleanBody(b) {
  const s = String(b == null ? '' : b).trim();
  return s ? s.slice(0, MAX_BODY) : '';
}

// Palabras restringidas: solo comunidad (el privado con el admin NO tiene
// filtro, decisión de Wilson). El aviso al autor es genérico a propósito:
// nunca revela cuál palabra coincidió. La lógica vive en lib/blocked.js
// porque Logros usa el mismo filtro.

// Reacciones agrupadas por mensaje: { msgId: [{emoji, count, mine}] }
function reactionsFor(scope, ids, myId) {
  const out = {};
  if (!ids.length) return out;
  const rows = db
    .prepare(
      `SELECT message_id, emoji, user_id FROM chat_reactions
       WHERE scope = ? AND message_id IN (${ids.map(() => '?').join(',')})`
    )
    .all(scope, ...ids);
  for (const r of rows) {
    const list = (out[r.message_id] = out[r.message_id] || []);
    let item = list.find((x) => x.emoji === r.emoji);
    if (!item) list.push((item = { emoji: r.emoji, count: 0, mine: false }));
    item.count++;
    if (r.user_id === myId) item.mine = true;
  }
  return out;
}

function shapeRoom(rows, myId) {
  const rx = reactionsFor('room', rows.map((r) => r.id), myId);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    author: r.author,
    author_id: r.user_id,
    is_admin: r.role === 'admin',
    mine: r.user_id === myId,
    pinned: r.pinned === 1,
    reply_to_id: r.reply_to_id,
    reply_body: r.reply_body,
    reply_author: r.reply_author,
    reactions: rx[r.id] || [],
    image_url: r.image_path ? '/api/chat/image/room/' + r.id : '',
    created_at: r.created_at,
  }));
}

const ROOM_SQL = `
  SELECT m.*, u.name AS author, u.role
  FROM chat_messages m JOIN users u ON u.id = m.user_id`;

// GET /api/chat/messages — últimos mensajes de la comunidad + el fijado
router.get('/messages', requireAuth, (req, res) => {
  const rows = db
    .prepare(`${ROOM_SQL} ORDER BY m.id DESC LIMIT ?`)
    .all(PAGE)
    .reverse();
  const pinnedRow = db.prepare(`${ROOM_SQL} WHERE m.pinned = 1 ORDER BY m.id DESC LIMIT 1`).get();
  res.json({
    messages: shapeRoom(rows, req.session.userId),
    pinned: pinnedRow ? shapeRoom([pinnedRow], req.session.userId)[0] : null,
    emojis: EMOJIS,
  });
});

// GET /api/chat/image/:scope/:id — la imagen de un mensaje, solo con sesión
router.get('/image/:scope/:id', requireAuth, (req, res) => {
  const scope = req.params.scope === 'dm' ? 'dm' : 'room';
  const table = scope === 'dm' ? 'dm_messages' : 'chat_messages';
  const row = db.prepare(`SELECT image_path FROM ${table} WHERE id = ?`).get(Number(req.params.id));
  if (!row || !row.image_path) return res.status(404).json({ error: 'Imagen no encontrada.' });
  const full = path.join(uploadsDir('chat'), path.basename(row.image_path));
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Imagen no encontrada.' });
  res.sendFile(full);
});

// GET /api/chat/blocked-words — solo admin: la lista (nunca se muestra a clippers)
router.get('/blocked-words', requireAuth, (req, res) => {
  if (!isAdmin(me(req))) return res.status(403).json({ error: 'Solo el admin.' });
  res.json({ words: blockedWords() });
});

// POST /api/chat/blocked-words — solo admin: agregar una palabra
router.post('/blocked-words', requireAuth, (req, res) => {
  if (!isAdmin(me(req))) return res.status(403).json({ error: 'Solo el admin.' });
  const word = cleanBlockedWord(req.body && req.body.word);
  if (!word || word.length > 50) return res.status(400).json({ error: 'Palabra no válida.' });
  db.prepare('INSERT OR IGNORE INTO chat_blocked_words (word) VALUES (?)').run(word);
  res.status(201).json({ words: blockedWords() });
});

// DELETE /api/chat/blocked-words/:word — solo admin: quitar una palabra
router.delete('/blocked-words/:word', requireAuth, (req, res) => {
  if (!isAdmin(me(req))) return res.status(403).json({ error: 'Solo el admin.' });
  db.prepare('DELETE FROM chat_blocked_words WHERE word = ?').run(cleanBlockedWord(req.params.word));
  res.json({ words: blockedWords() });
});

// POST /api/chat/messages — enviar a la comunidad (texto, imagen o ambos)
router.post('/messages', requireAuth, (req, res) => {
  chatUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen no puede pasar de 3 MB.' : err.message });
    const body = cleanBody(req.body && req.body.body);
    const file = req.file;
    if (!body && !file) return res.status(400).json({ error: 'Escribe un mensaje o adjunta una imagen.' });
    const author = me(req);
    // Filtro solo comunidad: el admin queda exento; los privados no se revisan.
    // Se revisa el texto, los links dentro del texto y el nombre del archivo.
    // Si coincide, el mensaje NO se guarda, la imagen se borra y el aviso es
    // solo "Este mensaje no se pudo enviar": no dice cuál palabra ni el motivo.
    // Al admin sí le llega un aviso de que se bloqueó un mensaje (sin la palabra).
    if (!isAdmin(author) && (containsBlockedWord(body) || (file && containsBlockedWord(file.originalname)))) {
      if (file) deleteUpload('chat', file.filename);
      notifyAdmins('Mensaje bloqueado por palabras restringidas', (author ? author.name : 'Un clipper') + ' intentó enviar un mensaje en la comunidad que fue bloqueado por el filtro.');
      return res.status(400).json({ error: 'Este mensaje no se pudo enviar' });
    }
    let reply = null;
    const rid = Number(req.body && req.body.reply_to_id) || null;
    if (rid) {
      reply = db
        .prepare(
          `SELECT m.body, u.name AS author FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
        )
        .get(rid);
    }
    const info = db
      .prepare(
        'INSERT INTO chat_messages (user_id, body, reply_to_id, reply_body, reply_author, image_path) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(req.session.userId, body, reply ? rid : null, reply ? reply.body.slice(0, 140) : '', reply ? reply.author : '', file ? file.filename : '');
    // Aviso al admin por mensaje en la comunidad (no por sus propios mensajes;
    // se puede mutear desde Gestión sin apagar los demás avisos).
    if (!isAdmin(author)) {
      notifyAdmins('Nuevo mensaje en la comunidad', (author ? author.name : 'Un clipper') + ': ' + (body ? body.slice(0, 140) : '📷 Imagen'), 'chat');
    }
    const row = db.prepare(`${ROOM_SQL} WHERE m.id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ message: shapeRoom([row], req.session.userId)[0] });
  });
});

// DELETE /api/chat/messages/:id — autor o admin
router.delete('/messages/:id', requireAuth, (req, res) => {
  const u = me(req);
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  if (row.user_id !== u.id && !isAdmin(u)) return res.status(403).json({ error: 'Sin permiso.' });
  db.prepare('DELETE FROM chat_reactions WHERE scope = ? AND message_id = ?').run('room', row.id);
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(row.id);
  deleteUpload('chat', row.image_path);
  res.json({ ok: true });
});

// POST /api/chat/messages/:id/pin — fijar (solo admin; un solo fijado)
router.post('/messages/:id/pin', requireAuth, (req, res) => {
  const u = me(req);
  if (!isAdmin(u)) return res.status(403).json({ error: 'Solo el admin fija mensajes.' });
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM chat_messages WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Mensaje no encontrado.' });
  db.prepare('UPDATE chat_messages SET pinned = 0').run();
  db.prepare('UPDATE chat_messages SET pinned = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

// DELETE /api/chat/messages/:id/pin — quitar el fijado (solo admin)
router.delete('/messages/:id/pin', requireAuth, (req, res) => {
  const u = me(req);
  if (!isAdmin(u)) return res.status(403).json({ error: 'Solo el admin.' });
  db.prepare('UPDATE chat_messages SET pinned = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// POST /api/chat/react — alternar una reacción {scope, message_id, emoji}
router.post('/react', requireAuth, (req, res) => {
  const scope = req.body && req.body.scope === 'dm' ? 'dm' : 'room';
  const mid = Number(req.body && req.body.message_id) || 0;
  const emoji = String((req.body && req.body.emoji) || '');
  if (!EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Reacción no válida.' });
  const table = scope === 'dm' ? 'dm_messages' : 'chat_messages';
  const msg = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(mid);
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  if (scope === 'dm') {
    const u = me(req);
    if (msg.clipper_id !== u.id && !isAdmin(u)) return res.status(403).json({ error: 'Sin permiso.' });
  }
  const existing = db
    .prepare('SELECT id FROM chat_reactions WHERE scope = ? AND message_id = ? AND user_id = ? AND emoji = ?')
    .get(scope, mid, req.session.userId, emoji);
  if (existing) {
    db.prepare('DELETE FROM chat_reactions WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO chat_reactions (scope, message_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(
      scope, mid, req.session.userId, emoji
    );
  }
  const rx = reactionsFor(scope, [mid], req.session.userId);
  res.json({ reactions: rx[mid] || [] });
});

// GET /api/chat/unread — contadores para la insignia del menú
router.get('/unread', requireAuth, (req, res) => {
  const u = me(req);
  const seen = db.prepare('SELECT last_id FROM chat_seen WHERE user_id = ?').get(u.id);
  const lastSeen = seen ? seen.last_id : 0;
  const room = db
    .prepare('SELECT COUNT(*) AS c FROM chat_messages WHERE id > ? AND user_id != ?')
    .get(lastSeen, u.id).c;
  let dm = 0;
  if (isAdmin(u)) {
    dm = db.prepare('SELECT COUNT(*) AS c FROM dm_messages WHERE read_by_admin = 0 AND sender_id != ?').get(u.id).c;
  } else {
    dm = db
      .prepare('SELECT COUNT(*) AS c FROM dm_messages WHERE clipper_id = ? AND read_by_clipper = 0 AND sender_id != ?')
      .get(u.id, u.id).c;
  }
  res.json({ room, dm, total: room + dm });
});

// POST /api/chat/seen — marcar la comunidad como leída hasta el último mensaje
router.post('/seen', requireAuth, (req, res) => {
  const max = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM chat_messages').get().m;
  db.prepare(
    'INSERT INTO chat_seen (user_id, last_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_id = excluded.last_id'
  ).run(req.session.userId, max);
  res.json({ ok: true });
});

// ---------- Privados (clipper <-> admin) ----------

function shapeDm(rows, myId) {
  const rx = reactionsFor('dm', rows.map((r) => r.id), myId);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    author: r.author,
    author_id: r.sender_id,
    is_admin: r.role === 'admin',
    mine: r.sender_id === myId,
    reply_to_id: r.reply_to_id,
    reply_body: r.reply_body,
    reply_author: r.reply_author,
    reactions: rx[r.id] || [],
    image_url: r.image_path ? '/api/chat/image/dm/' + r.id : '',
    created_at: r.created_at,
  }));
}

const DM_SQL = `
  SELECT d.*, u.name AS author, u.role
  FROM dm_messages d JOIN users u ON u.id = d.sender_id`;

// GET /api/chat/dm/threads — solo admin: lista de conversaciones
router.get('/dm/threads', requireAuth, (req, res) => {
  const u = me(req);
  if (!isAdmin(u)) return res.status(403).json({ error: 'Solo el admin.' });
  const rows = db
    .prepare(
      `SELECT d.clipper_id, cu.name AS clipper_name,
              (SELECT body FROM dm_messages WHERE clipper_id = d.clipper_id ORDER BY id DESC LIMIT 1) AS last_body,
              (SELECT created_at FROM dm_messages WHERE clipper_id = d.clipper_id ORDER BY id DESC LIMIT 1) AS last_at,
              (SELECT COUNT(*) FROM dm_messages WHERE clipper_id = d.clipper_id AND read_by_admin = 0 AND sender_id != ?) AS unread
       FROM dm_messages d JOIN users cu ON cu.id = d.clipper_id
       GROUP BY d.clipper_id
       ORDER BY last_at DESC`
    )
    .all(u.id);
  res.json({ threads: rows });
});

// GET /api/chat/dm/:clipperId — mensajes de una conversación (y marca leída)
router.get('/dm/:clipperId', requireAuth, (req, res) => {
  const u = me(req);
  const clipperId = isAdmin(u) ? Number(req.params.clipperId) || 0 : u.id;
  if (!clipperId) return res.status(400).json({ error: 'Conversación no válida.' });
  const rows = db
    .prepare(`${DM_SQL} WHERE d.clipper_id = ? ORDER BY d.id DESC LIMIT ?`)
    .all(clipperId, PAGE)
    .reverse();
  if (isAdmin(u)) {
    db.prepare('UPDATE dm_messages SET read_by_admin = 1 WHERE clipper_id = ?').run(clipperId);
  } else {
    db.prepare('UPDATE dm_messages SET read_by_clipper = 1 WHERE clipper_id = ?').run(clipperId);
  }
  const clipper = db.prepare('SELECT name FROM users WHERE id = ?').get(clipperId);
  res.json({ messages: shapeDm(rows, u.id), clipper_id: clipperId, clipper_name: clipper ? clipper.name : '', emojis: EMOJIS });
});

// POST /api/chat/dm/:clipperId — enviar en la conversación (SIN filtro, como
// siempre: el privado con el admin no tiene palabras restringidas).
router.post('/dm/:clipperId', requireAuth, (req, res) => {
  chatUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'La imagen no puede pasar de 3 MB.' : err.message });
    const u = me(req);
    const clipperId = isAdmin(u) ? Number(req.params.clipperId) || 0 : u.id;
    if (!clipperId) {
      if (req.file) deleteUpload('chat', req.file.filename);
      return res.status(400).json({ error: 'Conversación no válida.' });
    }
    const body = cleanBody(req.body && req.body.body);
    const file = req.file;
    if (!body && !file) return res.status(400).json({ error: 'Escribe un mensaje o adjunta una imagen.' });
    let reply = null;
    const rid = Number(req.body && req.body.reply_to_id) || null;
    if (rid) {
      reply = db
        .prepare(
          `SELECT d.body, u.name AS author FROM dm_messages d JOIN users u ON u.id = d.sender_id WHERE d.id = ? AND d.clipper_id = ?`
        )
        .get(rid, clipperId);
    }
    const fromAdmin = isAdmin(u);
    const info = db
      .prepare(
        `INSERT INTO dm_messages (clipper_id, sender_id, body, reply_to_id, reply_body, reply_author, read_by_clipper, read_by_admin, image_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        clipperId, u.id, body, reply ? rid : null,
        reply ? reply.body.slice(0, 140) : '', reply ? reply.author : '',
        fromAdmin ? 0 : 1, fromAdmin ? 1 : 0, file ? file.filename : ''
      );
    const row = db.prepare(`${DM_SQL} WHERE d.id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ message: shapeDm([row], u.id)[0] });
  });
});

// DELETE /api/chat/dm/:id — autor o admin
router.delete('/dm/:id', requireAuth, (req, res) => {
  const u = me(req);
  const row = db.prepare('SELECT * FROM dm_messages WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  if (row.sender_id !== u.id && !isAdmin(u)) return res.status(403).json({ error: 'Sin permiso.' });
  db.prepare('DELETE FROM chat_reactions WHERE scope = ? AND message_id = ?').run('dm', row.id);
  db.prepare('DELETE FROM dm_messages WHERE id = ?').run(row.id);
  deleteUpload('chat', row.image_path);
  res.json({ ok: true });
});

module.exports = router;
