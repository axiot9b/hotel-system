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
    startedAt:      { type: DataTypes.DATE },
    closedAt:       { type: DataTypes.DATE },
    blockStartDate: { type: DataTypes.DATEONLY, field: 'block_start_date' },
    blockEndDate:   { type: DataTypes.DATEONLY, field: 'block_end_date' },
    roomBlockId:    { type: DataTypes.INTEGER,  field: 'room_block_id' }
  }, {
    tableName: 'maintenance_logs',
    underscored: true
  });
};
