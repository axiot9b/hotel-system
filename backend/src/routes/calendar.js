const router = require('express').Router();
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { Room, RoomType, Reservation, Guest, RoomBlock, User } = require('../models');

router.use(authenticate);

function today() { return new Date().toISOString().split('T')[0]; }
function daysAhead(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]; }

// GET /api/calendar?from=&to=
router.get('/', async (req, res) => {
  try {
    const from = req.query.from || today();
    const to   = req.query.to   || daysAhead(13);

    const rooms = await Room.findAll({
      where: { isActive: true },
      include: [
        {
          model: RoomType,
          as: 'roomType',
          attributes: ['name']
        },
        {
          model: Reservation,
          as: 'reservations',
          required: false,
          where: {
            status: { [Op.notIn]: ['cancelled', 'no_show'] },
            checkInDate:  { [Op.lt]: to },   // empieza antes del fin del rango
            checkOutDate: { [Op.gt]: from }  // termina después del inicio del rango
          },
          include: [{
            model: Guest,
            as: 'guest',
            attributes: ['firstName', 'lastName', 'phone', 'email']
          }],
          attributes: ['id', 'checkInDate', 'checkOutDate', 'status', 'nights', 'adults', 'children', 'totalAmount', 'notes', 'guestId', 'createdAt']
        },
        {
          model: RoomBlock,
          as: 'blocks',
          required: false,
          where: {
            startDate: { [Op.lt]: to },
            endDate:   { [Op.gt]: from }
          },
          include: [{ model: User, as: 'creator', attributes: ['fullName'] }],
          attributes: ['id', 'startDate', 'endDate', 'reason']
        }
      ],
      order: [['floor', 'ASC'], ['roomNumber', 'ASC']]
    });

    res.json({ rooms, from, to });
  } catch (error) {
    console.error('calendar:', error);
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
});

module.exports = router;
