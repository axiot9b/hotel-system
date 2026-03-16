const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RoomType', {
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: DataTypes.TEXT,
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'base_price'
    },
    maxOccupancy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      field: 'max_occupancy'
    }
  }, {
    tableName: 'room_types',
    underscored: true
  });
};
