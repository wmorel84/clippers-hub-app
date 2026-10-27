// Avisos compartidos: campanita en la app + push al celular.
// Un aviso nunca debe tumbar la acción que lo originó: todo fallo es silencioso.
const { db } = require('../db');
const { sendPushToUser, sendPushToAllUsers } = require('./push');

function notifyUser(userId, title, body) {
  try {
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(userId, title, body || '');
  } catch (e) { /* sin campanita: el push sigue intentándose */ }
  sendPushToUser(userId, { title, body: body || '' }).catch(() => {});
}

function notifyAdmins(title, body, prefKey) {
  try {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    for (const a of admins) {
      if (prefKey) {
        const pref = db.prepare('SELECT enabled FROM admin_notification_prefs WHERE admin_id = ? AND pref_key = ?').get(a.id, prefKey);
        if (pref && pref.enabled === 0) continue; // admin muteó este tipo de aviso
      }
      notifyUser(a.id, title, body);
    }
  } catch (e) { /* silencioso */ }
}

function notifyAll(title, body) {
  try {
    const users = db.prepare('SELECT id FROM users').all();
    for (const u of users) {
      try { db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(u.id, title, body || ''); } catch (e) {}
    }
  } catch (e) { /* silencioso */ }
  sendPushToAllUsers({ title, body: body || '' }).catch(() => {});
}

const ADMIN_PREFS = [
  { key: 'new_user', label: 'Usuario nuevo (registro)' },
  { key: 'user_login', label: 'Usuario que entra (login)' },
  { key: 'course_done', label: 'Clipper que termina un curso' },
  { key: 'chat', label: 'Mensaje en el chat de la comunidad' },
];

function adminPrefs(adminId) {
  const rows = db.prepare('SELECT pref_key, enabled FROM admin_notification_prefs WHERE admin_id = ?').all(adminId);
  const map = new Map(rows.map((r) => [r.pref_key, r.enabled]));
  return ADMIN_PREFS.map((p) => ({ key: p.key, label: p.label, enabled: map.has(p.key) ? map.get(p.key) === 1 : true }));
}

function setAdminPref(adminId, key, enabled) {
  if (!ADMIN_PREFS.some((p) => p.key === key)) throw new Error('Preferencia no válida.');
  db.prepare(`INSERT INTO admin_notification_prefs (admin_id, pref_key, enabled) VALUES (?, ?, ?)
    ON CONFLICT(admin_id, pref_key) DO UPDATE SET enabled = excluded.enabled`).run(adminId, key, enabled ? 1 : 0);
}

module.exports = { notifyUser, notifyAdmins, notifyAll, adminPrefs, setAdminPref, ADMIN_PREFS };
