const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'full_name'
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'receptionist', 'accounting', 'housekeeping'),
      allowNull: false,
      defaultValue: 'receptionist'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    lastLogin: {
      type: DataTypes.DATE,
      field: 'last_login'
    }
  }, {
    tableName: 'users',
    underscored: true
  });
};
