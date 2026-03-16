const router = require('express').Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { RoomBlock, Room, RoomType, User } = require('../models');
const logAudit = require('../utils/audit');

router.use(authenticate);

// GET /api/room-blocks?from=&to=
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.from || req.query.to) {
      const from = req.query.from || '2000-01-01';
      const to   = req.query.to   || '2099-12-31';
      where.startDate = { [Op.lt]: to };
      where.endDate   = { [Op.gt]: from };
    }
    const blocks = await RoomBlock.findAll({
      where,
      include: [
        { model: Room, as: 'room', attributes: ['roomNumber', 'floor'],
          include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] },
        { model: User, as: 'creator', attributes: ['fullName'] }
      ],
      order: [['startDate', 'ASC']]
    });
    res.json(blocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener bloqueos' });
  }
});

// POST /api/room-blocks
router.post('/', authorize('admin', 'manager', 'receptionist'), async (req, res) => {
  try {
    const { roomId, startDate, endDate, reason } = req.body;
    if (!roomId || !startDate || !endDate) {
      return res.status(400).json({ error: 'roomId, startDate y endDate son requeridos' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'La fecha de fin debe ser posterior a la de inicio' });
    }

    // Check for reservation conflicts
    const { Reservation } = require('../models');
    const conflict = await Reservation.findOne({
      where: {
        roomId,
        status: { [Op.notIn]: ['cancelled', 'no_show', 'checked_out'] },
        checkInDate:  { [Op.lt]: endDate },
        checkOutDate: { [Op.gt]: startDate }
      }
    });
    if (conflict) {
      return res.status(409).json({ error: 'Hay una reservación activa en esas fechas' });
    }

    const block = await RoomBlock.create({
      roomId, startDate, endDate,
      reason: reason || 'Bloqueo',
      createdBy: req.user.id
    });
    logAudit(req.user.id, 'create', 'room_block', block.id, { roomId, startDate, endDate, reason }, req.ip);
    res.status(201).json(block);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear bloqueo' });
  }
});

// DELETE /api/room-blocks/:id
router.delete('/:id', authorize('admin', 'manager', 'receptionist'), async (req, res) => {
  try {
    const block = await RoomBlock.findByPk(req.params.id);
    if (!block) return res.status(404).json({ error: 'Bloqueo no encontrado' });
    await block.destroy();
    logAudit(req.user.id, 'delete', 'room_block', block.id, { roomId: block.roomId, startDate: block.startDate }, req.ip);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar bloqueo' });
  }
});

module.exports = router;
