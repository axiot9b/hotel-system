const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Expense', {
    date:             { type: DataTypes.DATEONLY, allowNull: false },
    category:         {
      type: DataTypes.ENUM('maintenance', 'supplies', 'utilities', 'salaries', 'marketing', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    description:      { type: DataTypes.TEXT, allowNull: false },
    amount:           { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    createdBy:        { type: DataTypes.INTEGER, field: 'created_by' },
    maintenanceLogId: { type: DataTypes.INTEGER, field: 'maintenance_log_id' }
  }, {
    tableName: 'expenses',
    underscored: true,
    updatedAt: false
  });
};
