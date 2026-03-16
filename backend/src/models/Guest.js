const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Guest', {
    firstName: {
      type: DataTypes.STRING(80),
      allowNull: false,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING(80),
      allowNull: false,
      field: 'last_name'
    },
    idType: {
      type: DataTypes.ENUM('dni', 'passport', 'license', 'other'),
      defaultValue: 'dni',
      field: 'id_type'
    },
    idNumber: {
      type: DataTypes.STRING(30),
      field: 'id_number'
    },
    email: {
      type: DataTypes.STRING(100),
      validate: { isEmail: true }
    },
    phone: DataTypes.STRING(30),
    country: DataTypes.STRING(60),
    city: DataTypes.STRING(60),
    address: DataTypes.TEXT,
    notes: DataTypes.TEXT,
    isFrequent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_frequent'
    },
    totalStays: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_stays'
    }
  }, {
    tableName: 'guests',
    underscored: true
  });
};
