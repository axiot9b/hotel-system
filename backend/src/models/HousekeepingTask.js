const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('HousekeepingTask', {
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_id'
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      field: 'assigned_to'
    },
    taskType: {
      type: DataTypes.ENUM('cleaning', 'deep_cleaning', 'inspection', 'restock'),
      allowNull: false,
      defaultValue: 'cleaning',
      field: 'task_type'
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    notes: DataTypes.TEXT,
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at'
    }
  }, {
    tableName: 'housekeeping_tasks',
    underscored: true
  });
};
