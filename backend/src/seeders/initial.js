// Si se ejecuta directamente, cargar .env primero
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
}

const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function seed() {
  console.log('Ejecutando seed...');

  // Usuario admin por defecto
  const adminExists = await User.findOne({ where: { username: 'admin' } });
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      email: 'admin@hotel.local',
      passwordHash: hash,
      fullName: 'Administrador',
      role: 'admin'
    });
    console.log('✓ Usuario admin creado (admin / admin123)');
  }

  // Recepcionista de ejemplo
  const recExists = await User.findOne({ where: { username: 'recepcion' } });
  if (!recExists) {
    const hash = await bcrypt.hash('recepcion123', 10);
    await User.create({
      username: 'recepcion',
      email: 'recepcion@hotel.local',
      passwordHash: hash,
      fullName: 'Recepcionista',
      role: 'receptionist'
    });
    console.log('✓ Usuario recepción creado');
  }

  console.log('Seed completado. Sistema listo — agrega tus tipos de habitación y habitaciones desde la app.');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const { sequelize } = require('../models');

  sequelize.authenticate()
    .then(() => sequelize.sync())
    .then(() => seed())
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = seed;
