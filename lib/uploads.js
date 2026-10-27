// Subida de imágenes: se guardan en el volumen persistente (misma carpeta
// que la base de datos), nunca en public/, para que un despliegue no las
// borre. Límite 3 MB, solo imágenes.
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'hub.db');
const UPLOADS_BASE = path.join(path.dirname(DB_PATH), 'uploads');

function uploadsDir(subfolder) {
  const dir = path.join(UPLOADS_BASE, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function imageUpload(subfolder) {
  const dir = uploadsDir(subfolder);
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
        cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
      },
    }),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP o GIF).'));
    },
  });
}

function deleteUpload(subfolder, filename) {
  if (!filename) return;
  try { fs.rmSync(path.join(uploadsDir(subfolder), path.basename(filename)), { force: true }); } catch (e) {}
}

module.exports = { uploadsDir, imageUpload, deleteUpload };
