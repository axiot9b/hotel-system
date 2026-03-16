// Si se ejecuta directamente, cargar .env primero
if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
}

const bcrypt = require('bcryptjs');
const { User, RoomType, Room } = require('../models');

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

  // Tipos de habitación
  const types = [
    { name: 'Estándar', description: 'Habitación estándar con cama doble', basePrice: 800, maxOccupancy: 2 },
    { name: 'Superior', description: 'Habitación superior con vista', basePrice: 1200, maxOccupancy: 2 },
    { name: 'Suite', description: 'Suite con sala y jacuzzi', basePrice: 2000, maxOccupancy: 3 },
    { name: 'Familiar', description: 'Habitación amplia con 2 camas', basePrice: 1500, maxOccupancy: 4 }
  ];

  for (const type of types) {
    await RoomType.findOrCreate({ where: { name: type.name }, defaults: type });
  }
  console.log('✓ Tipos de habitación creados');

  // Habitaciones de ejemplo
  const roomTypes = await RoomType.findAll();
  const typeMap = Object.fromEntries(roomTypes.map(t => [t.name, t.id]));

  const rooms = [
    { roomNumber: '101', roomTypeId: typeMap['Estándar'], floor: 1 },
    { roomNumber: '102', roomTypeId: typeMap['Estándar'], floor: 1 },
    { roomNumber: '103', roomTypeId: typeMap['Superior'], floor: 1 },
    { roomNumber: '201', roomTypeId: typeMap['Superior'], floor: 2 },
    { roomNumber: '202', roomTypeId: typeMap['Suite'], floor: 2 },
    { roomNumber: '203', roomTypeId: typeMap['Familiar'], floor: 2 },
    { roomNumber: '301', roomTypeId: typeMap['Suite'], floor: 3 },
    { roomNumber: '302', roomTypeId: typeMap['Familiar'], floor: 3 },
    { roomNumber: '303', roomTypeId: typeMap['Estándar'], floor: 3 },
    { roomNumber: '304', roomTypeId: typeMap['Superior'], floor: 3 }
  ];

  for (const room of rooms) {
    await Room.findOrCreate({ where: { roomNumber: room.roomNumber }, defaults: room });
  }
  console.log('✓ Habitaciones creadas (10 habitaciones, 3 pisos)');
  console.log('Seed completado.');
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
