const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RoomBlock', {
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_id'
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
    reason: {
      type: DataTypes.STRING,
      defaultValue: 'Bloqueo'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      field: 'created_by'
    }
  }, {
    tableName: 'room_blocks',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
};
