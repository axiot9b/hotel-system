const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { Reservation, Guest, Room, RoomType, Payment, ExtraCharge, HousekeepingTask, sequelize } = require('../models');
const logAudit = require('../utils/audit');
const { sendReservationConfirmation, sendCheckoutReceipt } = require('../utils/email');
const { Op } = require('sequelize');

router.use(authenticate);

const reservationIncludes = [
  { model: Guest, as: 'guest', attributes: ['id', 'firstName', 'lastName', 'phone', 'email', 'idNumber'] },
  { model: Room, as: 'room', include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] },
  { model: Payment, as: 'payments' },
  { model: ExtraCharge, as: 'extraCharges' }
];

// GET /api/reservations
router.get('/', async (req, res) => {
  try {
    const { status, from, to, guestId, roomId, page = 1, limit = 20 } = req.query;
    const where = {};
    const offset = (page - 1) * limit;

    if (status) where.status = status;
    if (guestId) where.guestId = guestId;
    if (roomId) where.roomId = roomId;
    if (from || to) {
      where.checkInDate = {};
      if (from) where.checkInDate[Op.gte] = from;
      if (to) where.checkInDate[Op.lte] = to;
    }

    const { count, rows } = await Reservation.findAndCountAll({
      where,
      include: reservationIncludes,
      order: [['checkInDate', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      reservations: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error listing reservations:', error);
    res.status(500).json({ error: 'Error al obtener reservaciones' });
  }
});

// GET /api/reservations/:id
router.get('/:id', async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: reservationIncludes
    });
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener reservación' });
  }
});

// POST /api/reservations — crear reservación
router.post('/', [
  body('guestId').isInt(),
  body('roomId').isInt(),
  body('checkInDate').isDate(),
  body('checkOutDate').isDate(),
  body('ratePerNight').isFloat({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { guestId, roomId, checkInDate, checkOutDate, ratePerNight, adults, children, notes, source } = req.body;

    // Verificar conflictos de fechas
    const conflict = await Reservation.findOne({
      where: {
        roomId,
        status: { [Op.notIn]: ['cancelled', 'checked_out', 'no_show'] },
        checkInDate: { [Op.lt]: checkOutDate },
        checkOutDate: { [Op.gt]: checkInDate }
      }
    });

    if (conflict) {
      return res.status(409).json({ error: 'La habitación no está disponible en esas fechas' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = nights * parseFloat(ratePerNight);

    const full = await sequelize.transaction(async (t) => {
      const reservation = await Reservation.create({
        guestId, roomId, checkInDate, checkOutDate,
        nights, ratePerNight, totalAmount,
        adults: adults || 1,
        children: children || 0,
        notes,
        source: source || 'direct',
        createdBy: req.user.id
      }, { transaction: t });

      // Actualizar estado de habitación si check-in es hoy
      const today = new Date().toISOString().split('T')[0];
      if (checkInDate === today) {
        await Room.update({ status: 'reserved' }, { where: { id: roomId }, transaction: t });
      }

      return Reservation.findByPk(reservation.id, { include: reservationIncludes, transaction: t });
    });

    res.status(201).json(full);
    logAudit(req.user.id, 'create', 'reservation', full.id, { guestId, roomId, checkInDate, checkOutDate, totalAmount }, req.ip);
    sendReservationConfirmation(full).catch(() => {});
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Error al crear reservación' });
  }
});

// PATCH /api/reservations/:id/dates — mover fechas (desde calendario)
router.patch('/:id/dates', async (req, res) => {
  try {
    const { checkInDate, checkOutDate } = req.body;
    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'checkInDate y checkOutDate son requeridos' });
    }
    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'La fecha de salida debe ser posterior a la de entrada' });
    }

    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });
    if (['checked_out', 'cancelled', 'no_show'].includes(reservation.status)) {
      return res.status(400).json({ error: 'No se pueden cambiar fechas de esta reservación' });
    }

    // Verificar conflictos con otras reservaciones en la misma habitación
    const conflict = await Reservation.findOne({
      where: {
        roomId: reservation.roomId,
        id: { [Op.ne]: reservation.id },
        status: { [Op.notIn]: ['cancelled', 'no_show', 'checked_out'] },
        checkInDate: { [Op.lt]: checkOutDate },
        checkOutDate: { [Op.gt]: checkInDate }
      }
    });
    if (conflict) {
      return res.status(409).json({ error: 'Conflicto: la habitación ya está ocupada en esas fechas' });
    }

    const nights = Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000);
    const totalAmount = nights * parseFloat(reservation.ratePerNight);
    await reservation.update({ checkInDate, checkOutDate, nights, totalAmount });

    logAudit(req.user.id, 'update', 'reservation', reservation.id,
      { checkInDate, checkOutDate, nights }, req.ip);
    res.json(reservation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar fechas' });
  }
});

// PATCH /api/reservations/:id/check-in
router.patch('/:id/check-in', async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      return res.status(400).json({ error: 'Solo reservaciones pendientes o confirmadas pueden hacer check-in' });
    }

    await reservation.update({
      status: 'checked_in',
      actualCheckIn: new Date()
    });
    await Room.update({ status: 'occupied' }, { where: { id: reservation.roomId } });

    const full = await Reservation.findByPk(reservation.id, { include: reservationIncludes });
    logAudit(req.user.id, 'check_in', 'reservation', reservation.id, { roomId: reservation.roomId }, req.ip);
    res.json(full);
  } catch (error) {
    res.status(500).json({ error: 'Error al hacer check-in' });
  }
});

// PATCH /api/reservations/:id/check-out
router.patch('/:id/check-out', async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [{ model: Payment, as: 'payments' }, { model: ExtraCharge, as: 'extraCharges' }]
    });
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });
    if (reservation.status !== 'checked_in') {
      return res.status(400).json({ error: 'Solo reservaciones con check-in pueden hacer check-out' });
    }

    // Calcular balance
    const totalCharges = parseFloat(reservation.totalAmount)
      + reservation.extraCharges.reduce((s, c) => s + parseFloat(c.amount), 0);
    const totalPaid = reservation.payments.reduce((s, p) => {
      return p.paymentType === 'refund' ? s - parseFloat(p.amount) : s + parseFloat(p.amount);
    }, 0);
    const balance = totalCharges - totalPaid;

    await reservation.update({
      status: 'checked_out',
      actualCheckOut: new Date()
    });
    await Room.update({ status: 'cleaning' }, { where: { id: reservation.roomId } });

    // Actualizar estadías del huésped
    await Guest.increment('totalStays', { by: 1, where: { id: reservation.guestId } });

    // Crear tarea de limpieza automáticamente
    await HousekeepingTask.create({ roomId: reservation.roomId, taskType: 'cleaning', status: 'pending' });

    const full = await Reservation.findByPk(reservation.id, { include: reservationIncludes });
    logAudit(req.user.id, 'check_out', 'reservation', reservation.id, { roomId: reservation.roomId, balance }, req.ip);
    sendCheckoutReceipt(full, balance).catch(() => {});
    res.json({ reservation: full, balance });
  } catch (error) {
    console.error('Error check-out:', error);
    res.status(500).json({ error: 'Error al hacer check-out' });
  }
});

// PATCH /api/reservations/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });
    if (['checked_out', 'cancelled'].includes(reservation.status)) {
      return res.status(400).json({ error: 'No se puede cancelar esta reservación' });
    }

    await reservation.update({ status: 'cancelled' });
    if (['reserved', 'occupied'].includes((await Room.findByPk(reservation.roomId)).status)) {
      await Room.update({ status: 'available' }, { where: { id: reservation.roomId } });
    }

    logAudit(req.user.id, 'cancel', 'reservation', reservation.id, { roomId: reservation.roomId }, req.ip);
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

// POST /api/reservations/:id/payments
router.post('/:id/payments', [
  body('amount').isFloat({ min: 0.01 }),
  body('paymentMethod').isIn(['cash', 'card', 'transfer', 'other']),
  body('paymentType').optional().isIn(['deposit', 'payment', 'refund'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });

    const payment = await Payment.create({
      reservationId: reservation.id,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      paymentType: req.body.paymentType || 'payment',
      reference: req.body.reference,
      notes: req.body.notes,
      receivedBy: req.user.id
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar pago' });
  }
});

// POST /api/reservations/:id/charges
router.post('/:id/charges', [
  body('description').trim().notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  body('category').optional().isIn(['service', 'minibar', 'damage', 'late_checkout', 'other'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Reservación no encontrada' });

    const charge = await ExtraCharge.create({
      reservationId: reservation.id,
      description: req.body.description,
      amount: req.body.amount,
      category: req.body.category || 'service',
      chargedBy: req.user.id
    });

    res.status(201).json(charge);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar cargo' });
  }
});

module.exports = router;
