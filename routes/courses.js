// Rutas de la academia (Cursos): el contenido vive en content/course.js
// y aquí solo se sirve junto al progreso de cada usuario.
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { COURSE } = require('../content/course');

const router = express.Router();

// Solo se sirven las lecciones visibles: las marcadas con hidden quedan
// preparadas en el contenido (ej.: el mercado de USA) sin aparecer aún.
const LESSONS = COURSE.lessons.filter((l) => !l.hidden);
const publicBlocks = (l) => l.blocks.filter((b) => !b.hidden);

function doneSet(userId) {
  const rows = db.prepare('SELECT lesson_id FROM course_progress WHERE user_id = ?').all(userId);
  return new Set(rows.map((r) => r.lesson_id));
}

// GET /api/courses — portada del curso con progreso
router.get('/', requireAuth, (req, res) => {
  const done = doneSet(req.session.userId);
  const lessons = LESSONS.map((l, i) => ({
    id: l.id,
    title: l.title,
    order: i + 1,
    done: done.has(l.id),
  }));
  res.json({
    title: COURSE.title,
    intro: COURSE.intro,
    lessons,
    progress: { done: lessons.filter((l) => l.done).length, total: lessons.length },
  });
});

// GET /api/courses/lessons/:id — una lección completa
router.get('/lessons/:id', requireAuth, (req, res) => {
  const idx = LESSONS.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Lección no encontrada.' });
  const done = doneSet(req.session.userId);
  const l = LESSONS[idx];
  res.json({
    lesson: { id: l.id, title: l.title, order: idx + 1, blocks: publicBlocks(l), done: done.has(l.id) },
    prev: idx > 0 ? LESSONS[idx - 1].id : null,
    next: idx < LESSONS.length - 1 ? LESSONS[idx + 1].id : null,
    progress: { done: done.size, total: LESSONS.length },
  });
});

// POST /api/courses/lessons/:id/toggle — marcar/desmarcar como completada
router.post('/lessons/:id/toggle', requireAuth, (req, res) => {
  const l = LESSONS.find((x) => x.id === req.params.id);
  if (!l) return res.status(404).json({ error: 'Lección no encontrada.' });
  const uid = req.session.userId;
  const exists = db
    .prepare('SELECT lesson_id FROM course_progress WHERE user_id = ? AND lesson_id = ?')
    .get(uid, l.id);
  if (exists) {
    db.prepare('DELETE FROM course_progress WHERE user_id = ? AND lesson_id = ?').run(uid, l.id);
  } else {
    db.prepare('INSERT INTO course_progress (user_id, lesson_id) VALUES (?, ?)').run(uid, l.id);
  }
  const done = doneSet(uid);
  res.json({ done: done.has(l.id), progress: { done: done.size, total: LESSONS.length } });
});

module.exports = router;
