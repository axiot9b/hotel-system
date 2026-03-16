const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ExtraCharge', {
    reservationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reservation_id'
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('service', 'minibar', 'damage', 'late_checkout', 'other'),
      defaultValue: 'service'
    },
    chargedBy: {
      type: DataTypes.INTEGER,
      field: 'charged_by'
    }
  }, {
    tableName: 'extra_charges',
    underscored: true,
    updatedAt: false
  });
};
