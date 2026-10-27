// Servidor principal de Clippers Pro.
const path = require('path');
const express = require('express');
const session = require('express-session');

require('./db'); // inicializa esquema y datos semilla

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const clipRoutes = require('./routes/clips');
const notificationRoutes = require('./routes/notifications');
const walletRoutes = require('./routes/wallet');
const accountRoutes = require('./routes/accounts');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const courseRoutes = require('./routes/courses');
const pushRoutes = require('./routes/push');
const newsRoutes = require('./routes/news');
const achievementRoutes = require('./routes/achievements');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1); // necesario detrás de proxies (Railway, Render, etc.)
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 16) {
  console.warn(
    'ADVERTENCIA: SESSION_SECRET no está definido o es muy corto. ' +
    'Define uno largo y aleatorio en tu archivo .env antes de usar en producción.'
  );
}

app.use(
  session({
    name: 'hub.sid',
    secret: sessionSecret || 'solo-para-desarrollo-cambia-este-valor',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    },
  })
);

// API
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/clips', clipRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/achievements', achievementRoutes);

// ---------- Puerta de la app (decisión de Wilson, 21 oct 2026) ----------
// Sin sesión, lo primero que se ve es la pantalla de acceso partida
// (acceso.html): «la puerta será la pantalla de acceso». La página pública
// tipo landing ya no se usa como puerta. El panel completo y el brief de
// cada campaña solo se sirven con sesión iniciada.
const isLoggedIn = (req) => !!(req.session && req.session.userId);
const sendPublic = (res, file) => res.sendFile(path.join(__dirname, 'public', file));

app.get(['/', '/index.html'], (req, res) => {
  sendPublic(res, isLoggedIn(req) ? 'index.html' : 'acceso.html');
});

// Entrada directa a la app: la página de acceso partida (marca + login).
app.get('/acceso', (req, res) => sendPublic(res, 'acceso.html'));

// La antigua puerta (inicio.html) ya no se muestra a nadie.
app.get('/inicio.html', (req, res) => sendPublic(res, 'acceso.html'));

// Página propia del brief de cada campaña: /campana/<id>
// (antes el brief se abría en una ventana emergente; Wilson pidió página con su enlace)
app.get('/campana/:id', (req, res) => {
  if (!isLoggedIn(req)) return sendPublic(res, 'acceso.html');
  sendPublic(res, 'brief.html');
});

// Frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Página pública de política de privacidad (exigida por Google OAuth)
app.get('/privacidad', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacidad.html'));
});

// Manejo de errores JSON
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Clippers Pro escuchando en http://localhost:${PORT}`);
});
