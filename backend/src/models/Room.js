const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Room', {
    roomNumber: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      field: 'room_number'
    },
    roomTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_type_id'
    },
    floor: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'reserved', 'cleaning', 'maintenance'),
      allowNull: false,
      defaultValue: 'available'
    },
    features: DataTypes.TEXT,
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'rooms',
    underscored: true
  });
};
