const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('DailyCash', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true
    },
    openingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'opening_balance'
    },
    closingBalance: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'closing_balance'
    },
    totalIncome: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'total_income'
    },
    totalExpenses: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'total_expenses'
    },
    status: {
      type: DataTypes.ENUM('open', 'closed'),
      defaultValue: 'open'
    },
    openedBy: {
      type: DataTypes.INTEGER,
      field: 'opened_by'
    },
    closedBy: {
      type: DataTypes.INTEGER,
      field: 'closed_by'
    },
    notes: DataTypes.TEXT
  }, {
    tableName: 'daily_cash',
    underscored: true
  });
};
