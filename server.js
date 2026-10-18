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
