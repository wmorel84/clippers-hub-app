// Palabras restringidas (oct 2026): se comparan palabras completas, sin
// importar mayúsculas ni acentos. El aviso al autor es genérico a propósito:
// nunca revela cuál palabra coincidió. Se usa en la comunidad y en Logros;
// el privado con el admin NO tiene filtro (decisión de Wilson, oct 2026).
const { db } = require('../db');

function normalizeWord(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function blockedWords() {
  return db
    .prepare('SELECT word FROM chat_blocked_words ORDER BY word')
    .all()
    .map((r) => r.word);
}

function containsBlockedWord(text) {
  const words = blockedWords();
  if (!words.length) return false;
  // El texto se parte por cualquier cosa que no sea letra/número, así que un
  // link como lulosa.com también se revisa (tokens: lulosa, com) y el nombre
  // de un archivo (mi-foto-lulosa.png) también.
  const tokens = new Set(normalizeWord(text).split(/[^a-z0-9]+/).filter(Boolean));
  return words.some((w) => tokens.has(w));
}

function cleanBlockedWord(w) {
  return normalizeWord(w).replace(/[^a-z0-9]/g, '');
}

module.exports = { normalizeWord, blockedWords, containsBlockedWord, cleanBlockedWord };
