// Envío de notificaciones push (Web Push) a los celulares de los usuarios.
// Las llaves VAPID viven SOLO en variables de entorno de Railway:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Sin llaves, todo esto es un no-op silencioso (la app funciona igual).
const webpush = require('web-push');
const { db } = require('../db');

let configured = false;
function ensureConfig() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  configured = true;
  return true;
}

function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

// Envía un push a TODOS los dispositivos suscritos de un usuario.
// Nunca lanza: un fallo de push no debe tumbar la acción que lo originó.
async function sendPushToUser(userId, payload) {
  try {
    if (!ensureConfig()) return;
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
    const body = JSON.stringify({
      title: payload.title || 'Clippers Pro',
      body: payload.body || '',
      url: payload.url || '/',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          // Suscripción muerta (app desinstalada, permiso revocado): se limpia.
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
          }
        }
      })
    );
  } catch (e) {
    /* silencioso a propósito */
  }
}

// Envía un push a TODOS los dispositivos suscritos (noticias, anuncios).
// Nunca lanza: un fallo de push no debe tumbar la publicación que lo originó.
async function sendPushToAllUsers(payload) {
  try {
    if (!ensureConfig()) return;
    const subs = db.prepare('SELECT * FROM push_subscriptions').all();
    const body = JSON.stringify({
      title: payload.title || 'Clippers Pro',
      body: payload.body || '',
      url: payload.url || '/',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
          }
        }
      })
    );
  } catch (e) { /* silencioso a propósito */ }
}

module.exports = { sendPushToUser, sendPushToAllUsers, publicKey };
