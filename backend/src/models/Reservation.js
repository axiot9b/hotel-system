const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Reservation', {
    guestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'guest_id'
    },
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_id'
    },
    checkInDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'check_in_date'
    },
    checkOutDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'check_out_date'
    },
    actualCheckIn: {
      type: DataTypes.DATE,
      field: 'actual_check_in'
    },
    actualCheckOut: {
      type: DataTypes.DATE,
      field: 'actual_check_out'
    },
    nights: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    adults: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    children: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'),
      allowNull: false,
      defaultValue: 'pending'
    },
    ratePerNight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'rate_per_night'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'total_amount'
    },
    notes: DataTypes.TEXT,
    source: {
      type: DataTypes.STRING(30),
      defaultValue: 'direct'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      field: 'created_by'
    }
  }, {
    tableName: 'reservations',
    underscored: true,
    validate: {
      datesValid() {
        if (this.checkOutDate <= this.checkInDate) {
          throw new Error('Fecha de salida debe ser posterior a fecha de entrada');
        }
      }
    }
  });
};
