const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RoomRate', {
    roomTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_type_id'
    },
    name: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'start_date'
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'end_date'
    },
    ratePerNight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'rate_per_night'
    },
    description: DataTypes.TEXT
  }, {
    tableName: 'room_rates',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
};
