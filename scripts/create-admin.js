// Crea el primer usuario administrador.
// Uso interactivo: npm run setup-admin
// También acepta los 3 valores por stdin (nombre, email, contraseña, uno por línea).
// La contraseña se pide por consola y nunca se guarda en texto plano:
// solo se almacena su hash bcrypt en la base de datos.
const readline = require('readline');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { db, seedUserNotifications } = require('../db');

function askTTY(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function readAnswers() {
  if (process.stdin.isTTY) {
    return {
      name: await askTTY('Nombre: '),
      email: (await askTTY('Correo electrónico: ')).toLowerCase(),
      password: await askTTY('Contraseña (mínimo 8 caracteres): '),
    };
  }
  // Entrada por tubería: 3 líneas (nombre, email, contraseña).
  const lines = fs.readFileSync(0, 'utf-8').split(/\r?\n/);
  return {
    name: (lines[0] || '').trim(),
    email: (lines[1] || '').trim().toLowerCase(),
    password: (lines[2] || '').trim(),
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

(async () => {
  console.log('=== Crear administrador del Hub de Clippers ===\n');

  const { name, email, password } = await readAnswers();

  if (name.length < 2) {
    console.error('El nombre debe tener al menos 2 caracteres.');
    process.exit(1);
  }
  if (!isValidEmail(email)) {
    console.error('Correo electrónico no válido.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    console.error('Ese correo ya está registrado.');
    process.exit(1);
  }

  const password_hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(name, email, password_hash);

  seedUserNotifications(info.lastInsertRowid);

  console.log(`\nAdministrador "${name}" creado con éxito (id ${info.lastInsertRowid}).`);
  console.log('Ya puedes iniciar sesión en la app con ese correo y contraseña.');
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
