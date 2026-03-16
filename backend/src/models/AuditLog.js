const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AuditLog', {
    userId: {
      type: DataTypes.INTEGER,
      field: 'user_id'
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entityId: {
      type: DataTypes.INTEGER,
      field: 'entity_id'
    },
    details: DataTypes.JSONB,
    ipAddress: {
      type: DataTypes.STRING(45),
      field: 'ip_address'
    }
  }, {
    tableName: 'audit_log',
    underscored: true,
    updatedAt: false
  });
};
