const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Payment', {
    reservationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reservation_id'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'card', 'transfer', 'other'),
      allowNull: false,
      field: 'payment_method'
    },
    paymentType: {
      type: DataTypes.ENUM('deposit', 'payment', 'refund'),
      allowNull: false,
      defaultValue: 'payment',
      field: 'payment_type'
    },
    reference: DataTypes.STRING(100),
    notes: DataTypes.TEXT,
    receivedBy: {
      type: DataTypes.INTEGER,
      field: 'received_by'
    }
  }, {
    tableName: 'payments',
    underscored: true,
    updatedAt: false
  });
};
