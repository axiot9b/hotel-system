const router = require('express').Router();
const { body, validationResult, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { Guest, Reservation, Room, sequelize } = require('../models');
const logAudit = require('../utils/audit');
const { Op } = require('sequelize');

router.use(authenticate);

// GET /api/guests — listar con búsqueda y paginación
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { idNumber: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Guest.findAndCountAll({
      where,
      order: [['lastName', 'ASC'], ['firstName', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      guests: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error listing guests:', error);
    res.status(500).json({ error: 'Error al obtener huéspedes' });
  }
});

// GET /api/guests/:id
router.get('/:id', async (req, res) => {
  try {
    const guest = await Guest.findByPk(req.params.id);
    if (!guest) return res.status(404).json({ error: 'Huésped no encontrado' });

    // Financial + stay summary
    const [stats] = await sequelize.query(`
      SELECT
        COUNT(r.id)                                                            AS total_stays,
        COALESCE(SUM(r.nights), 0)                                            AS total_nights,
        ROUND(AVG(r.nights)::numeric, 1)                                      AS avg_nights,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type != 'refund'), 0)  AS gross_paid,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type = 'refund'),  0)  AS refunded
      FROM reservations r
      LEFT JOIN payments p ON p.reservation_id = r.id
      WHERE r.guest_id = :guestId
        AND r.status NOT IN ('cancelled', 'no_show')
    `, { replacements: { guestId: guest.id }, type: sequelize.QueryTypes.SELECT });

    const recentReservations = await Reservation.findAll({
      where: { guestId: guest.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{ model: Room, as: 'room', attributes: ['roomNumber', 'floor'] }]
    });

    res.json({
      ...guest.toJSON(),
      stats: {
        totalStays:  parseInt(stats.total_stays)  || 0,
        totalNights: parseInt(stats.total_nights) || 0,
        avgNights:   parseFloat(stats.avg_nights) || 0,
        ltv:         parseFloat(stats.gross_paid) - parseFloat(stats.refunded) || 0
      },
      recentReservations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener huésped' });
  }
});

// POST /api/guests
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Nombre requerido'),
  body('lastName').trim().notEmpty().withMessage('Apellido requerido')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Detectar documento duplicado
    if (req.body.idNumber) {
      const existing = await Guest.findOne({ where: { idNumber: req.body.idNumber } });
      if (existing) {
        return res.status(409).json({
          error: `Ya existe un huésped con ese número de documento`,
          guest: existing
        });
      }
    }

    const guest = await Guest.create(req.body);
    logAudit(req.user.id, 'create', 'guest', guest.id, { firstName: guest.firstName, lastName: guest.lastName }, req.ip);
    res.status(201).json(guest);
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({ error: 'Error al crear huésped' });
  }
});

// PUT /api/guests/:id
router.put('/:id', async (req, res) => {
  try {
    const guest = await Guest.findByPk(req.params.id);
    if (!guest) return res.status(404).json({ error: 'Huésped no encontrado' });

    await guest.update(req.body);
    res.json(guest);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar huésped' });
  }
});

module.exports = router;
