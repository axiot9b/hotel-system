const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MaintenanceLog', {
    roomId:      { type: DataTypes.INTEGER, allowNull: false },
    reportedBy:  { type: DataTypes.INTEGER },
    type:        { type: DataTypes.ENUM('repair', 'inspection', 'preventive', 'cleaning'), defaultValue: 'repair' },
    status:      { type: DataTypes.ENUM('open', 'in_progress', 'closed'), defaultValue: 'open' },
    priority:    { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' },
    description: { type: DataTypes.TEXT, allowNull: false },
    resolution:  { type: DataTypes.TEXT },
    cost:        { type: DataTypes.DECIMAL(10, 2) },
    startedAt:   { type: DataTypes.DATE },
    closedAt:    { type: DataTypes.DATE }
  }, {
    tableName: 'maintenance_logs',
    underscored: true
  });
};
