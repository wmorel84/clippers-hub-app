// Middlewares de autorización.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'No has iniciado sesión.' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  if (req.session && req.session.userId) {
    return res.status(403).json({ error: 'Se requiere rol de administrador.' });
  }
  return res.status(401).json({ error: 'No has iniciado sesión.' });
}

module.exports = { requireAuth, requireAdmin };
