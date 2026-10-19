// Base de datos SQLite (módulo integrado de Node 22+: node:sqlite).
// Todas las consultas usan parámetros (?) — nunca se concatena texto en SQL.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'hub.db');
const db = new DatabaseSync(DB_PATH);

// Activa claves foráneas.
db.exec('PRAGMA foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'clipper' CHECK (role IN ('admin', 'clipper')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      payout_text TEXT NOT NULL DEFAULT '',
      budget_total REAL NOT NULL DEFAULT 0,
      budget_remaining REAL NOT NULL DEFAULT 0,
      deadline TEXT NOT NULL DEFAULT '',
      requirements TEXT NOT NULL DEFAULT '',
      brief TEXT NOT NULL DEFAULT '',
      is_example INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Cuentas sociales de los clippers para vincular en las plataformas.
    -- Estados: pending (clipper registró el link) → code_sent (Wilson envió el
    -- código de la bio) → code_confirmed (clipper pegó el código) → verified
    -- (Wilson verificó en la plataforma) | rejected.
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
      profile_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'code_sent', 'code_confirmed', 'verified', 'rejected')),
      verification_code TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, platform, profile_url)
    );
  `);
}

// ---------------------------------------------------------------------------
// Datos semilla (solo si las tablas están vacías)
// ---------------------------------------------------------------------------
function seedCampaigns() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO campaigns
      (title, artist, platform, category, payout_text, budget_total, budget_remaining,
       deadline, requirements, brief, is_example, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  // Campaña REAL (datos extraídos de Lulosa el 15 oct 2026)
  insert.run(
    'Yuridia | Bajón Emocional',
    'Yuridia — "Bajón Emocional"',
    'Lulosa',
    'musica',
    '2 US$ por cada 1.000 vistas verificadas (bruto); mínimo 4 US$/clip; máximo 100 US$/clip',
    800,
    800,
    '2026-11-15',
    [
      'Cuenta social verificada.',
      'Usar el audio oficial de TikTok de la campaña.',
      'Incluir el hashtag #BajonEmocional.',
      'Letra de "Bajón Emocional" grande, legible y siempre en pantalla.',
      'Mencionar a @yuritababy.',
      'Publicar el clip como máximo 48 horas después.',
      'Engagement mínimo del 1% después de 100 vistas.',
      'Contenido en español para América Latina, América del Norte o Europa.',
      'Quedan 198 de 200 cupos de clips.',
    ].join('\n'),
    'Solo estilos aprobados: videoclip + letra en pantalla (principal), videos de Yuridia (shows/sesiones) + letra, ediciones limpias solo de letra. Letra grande y legible siempre en pantalla, sin errores de ortografía, audio oficial obligatorio, vertical 9:16, solo TikTok. Rechazado: clips sin letra en pantalla, otros artistas, fans o memes, chismes o vida personal de Yuridia, reacciones.',
    0
  );

  // Campaña REAL (verificada en Whop el 15 oct 2026) — enfoque público latino
  insert.run(
    'La Movida (Clipping Network)',
    'Artistas e influencers latinos',
    'Whop',
    'musica',
    '$1 por cada 1.000 vistas; hasta $30 por clip/video (según oportunidad)',
    500,
    500,
    '',
    [
      'Contenido en español enfocado en audiencia latina.',
      'Jalen FRFR: TikTok + Instagram Reels, oportunidad continua.',
      'MIXELSWORLD: hasta $30 por clip.',
      'Seguir el brief de cada oportunidad dentro de la red.',
    ].join('\n'),
    'Red de clipping enfocada en artistas e influencers latinos. Oportunidades recientes: Jalen FRFR ($1 por 1.000 vistas, máximo $30 por video, presupuesto $500) y MIXELSWORLD ($1 por 1.000 vistas, hasta $30 por clip, presupuesto inicial $500). Los presupuestos se agotan por orden de llegada.',
    0
  );

  // Campañas de EJEMPLO (marcadas claramente como muestra)
  const examples = [
    {
      title: 'Campaña de ejemplo — Artista demo "Medianoche"',
      artist: 'Artista demo',
      platform: 'Plataforma demo',
      category: 'musica',
      payout_text: 'US$ 2,00 / 1.000 vistas (ejemplo)',
      brief: 'Campaña de muestra para probar el diseño. No es una oferta real.',
      requirements: 'Usar el audio de muestra.\nIncluir subtítulos legibles.',
    },
    {
      title: 'Campaña de ejemplo — Producto demo "Glow Serum"',
      artist: 'Marca demo',
      platform: 'Plataforma demo',
      category: 'producto',
      payout_text: 'US$ 35 por clip (ejemplo)',
      brief: 'Campaña de muestra para probar el diseño. No es una oferta real.',
      requirements: 'Mostrar el producto en los primeros 5 segundos.\nGrabar con buena luz.',
    },
    {
      title: 'Campaña de ejemplo — Reto deportivo demo',
      artist: 'Marca demo',
      platform: 'Plataforma demo',
      category: 'producto',
      payout_text: 'US$ 50 por clip (ejemplo)',
      brief: 'Campaña de muestra para probar el diseño. No es una oferta real.',
      requirements: 'Incluir una toma en movimiento.\nUsar solo música autorizada.',
    },
    {
      title: 'Campaña de ejemplo — Gaming demo "Speedrun"',
      artist: 'Estudio demo',
      platform: 'Plataforma demo',
      category: 'gaming',
      payout_text: 'US$ 1,50 / 1.000 vistas (ejemplo)',
      brief: 'Campaña de muestra para probar el diseño. No es una oferta real.',
      requirements: 'Abrir con el momento de mayor tensión.\nIncluir subtítulos.',
    },
  ];
  for (const e of examples) {
    insert.run(e.title, e.artist, e.platform, e.category, e.payout_text, 0, 0, '', e.requirements, e.brief, 1);
  }
}

// Notificaciones de ejemplo: se crean para cada usuario nuevo (y para el admin
// creado con el script), para probar la campana sin datos inventados de otros.
function seedUserNotifications(userId) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?').get(userId).n;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)'
  );
  insert.run(
    userId,
    'Bienvenido al Hub de Wilson',
    'Esta es una notificación de ejemplo. Aquí verás avisos de campañas y pagos.'
  );
  insert.run(
    userId,
    'Campaña real disponible',
    'Yuridia | Bajón Emocional está activa hasta el 15 nov 2026. Revisa el brief en Campañas.'
  );
}

initSchema();
seedCampaigns();

// Migración: columna google_sub para el login con Google.
// En BDs ya creadas agrega la columna; en BDs nuevas no existe aún.
function migrateGoogleSub() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('google_sub')) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL'
  );
}
migrateGoogleSub();

// Migración: tarifas con margen por campaña (fase 2 del modelo Clippers Pro).
// source_* = lo que paga la fuente (solo admin); margin_pct = margen de Wilson;
// la tarifa que ve el clipper se calcula: fuente × (1 - margen/100).
// Si source_per_1k es 0, se usa el texto de pago manual (comportamiento anterior).
function migrateCampaignMargins() {
  const cols = db.prepare('PRAGMA table_info(campaigns)').all().map((c) => c.name);
  const add = (name, def) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE campaigns ADD COLUMN ${name} ${def}`);
  };
  add('source_per_1k', 'REAL NOT NULL DEFAULT 0');
  add('source_min_clip', 'REAL NOT NULL DEFAULT 0');
  add('source_max_clip', 'REAL NOT NULL DEFAULT 0');
  add('margin_pct', 'REAL NOT NULL DEFAULT 50');
}
migrateCampaignMargins();

// Crea el primer administrador desde variables de entorno.
// Solo actúa si ADMIN_EMAIL y ADMIN_PASSWORD están definidas y ese correo
// aún no existe. Pensado para el primer despliegue en Railway.
function seedAdminFromEnv() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';
  if (!email || !password) return;
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return;
  if (password.length < 8) {
    console.warn('ADMIN_PASSWORD debe tener al menos 8 caracteres; no se creó el admin.');
    return;
  }
  const bcrypt = require('bcryptjs');
  const password_hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(name, email, password_hash);
  seedUserNotifications(info.lastInsertRowid);
  console.log(`Administrador "${name}" creado desde variables de entorno.`);
}

seedAdminFromEnv();

module.exports = { db, seedUserNotifications };
