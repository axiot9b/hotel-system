const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Soporta DATABASE_URL (Neon, Railway, Supabase, etc.) o variables individuales
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false
    })
  : new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging
      }
    );

const User = require('./User')(sequelize);
const Guest = require('./Guest')(sequelize);
const RoomType = require('./RoomType')(sequelize);
const Room = require('./Room')(sequelize);
const Reservation = require('./Reservation')(sequelize);
const Payment = require('./Payment')(sequelize);
const ExtraCharge = require('./ExtraCharge')(sequelize);
const HousekeepingTask = require('./HousekeepingTask')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const DailyCash = require('./DailyCash')(sequelize);
const MaintenanceLog = require('./MaintenanceLog')(sequelize);
const RoomBlock = require('./RoomBlock')(sequelize);
const RoomRate  = require('./RoomRate')(sequelize);

// Relaciones
RoomType.hasMany(Room, { foreignKey: 'roomTypeId', as: 'rooms' });
Room.belongsTo(RoomType, { foreignKey: 'roomTypeId', as: 'roomType' });

Guest.hasMany(Reservation, { foreignKey: 'guestId', as: 'reservations' });
Reservation.belongsTo(Guest, { foreignKey: 'guestId', as: 'guest' });

Room.hasMany(Reservation, { foreignKey: 'roomId', as: 'reservations' });
Reservation.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

Reservation.hasMany(Payment, { foreignKey: 'reservationId', as: 'payments' });
Payment.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });

Reservation.hasMany(ExtraCharge, { foreignKey: 'reservationId', as: 'extraCharges' });
ExtraCharge.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });

User.hasMany(Reservation, { foreignKey: 'createdBy', as: 'createdReservations' });
Reservation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Room.hasMany(HousekeepingTask, { foreignKey: 'roomId', as: 'tasks' });
HousekeepingTask.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

User.hasMany(HousekeepingTask, { foreignKey: 'assignedTo', as: 'assignedTasks' });
HousekeepingTask.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(DailyCash, { foreignKey: 'openedBy', as: 'openedCash' });
DailyCash.belongsTo(User, { foreignKey: 'openedBy', as: 'opener' });
User.hasMany(DailyCash, { foreignKey: 'closedBy', as: 'closedCash' });
DailyCash.belongsTo(User, { foreignKey: 'closedBy', as: 'closer' });

Room.hasMany(MaintenanceLog, { foreignKey: 'roomId', as: 'maintenanceLogs' });
MaintenanceLog.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });
User.hasMany(MaintenanceLog, { foreignKey: 'reportedBy', as: 'reportedMaintenance' });
MaintenanceLog.belongsTo(User, { foreignKey: 'reportedBy', as: 'reporter' });

Room.hasMany(RoomBlock, { foreignKey: 'roomId', as: 'blocks' });
RoomBlock.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });
User.hasMany(RoomBlock, { foreignKey: 'createdBy', as: 'roomBlocks' });
RoomBlock.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

RoomType.hasMany(RoomRate, { foreignKey: 'roomTypeId', as: 'rates' });
RoomRate.belongsTo(RoomType, { foreignKey: 'roomTypeId', as: 'roomType' });

module.exports = {
  sequelize,
  User,
  Guest,
  RoomType,
  Room,
  Reservation,
  Payment,
  ExtraCharge,
  HousekeepingTask,
  AuditLog,
  DailyCash,
  MaintenanceLog,
  RoomBlock,
  RoomRate
};
