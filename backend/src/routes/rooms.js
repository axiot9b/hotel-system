const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { Room, RoomType } = require('../models');

router.use(authenticate);

// GET /api/rooms — listar todas las habitaciones
router.get('/', async (req, res) => {
  try {
    const { status, floor, typeId } = req.query;
    const where = { isActive: true };

    if (status) where.status = status;
    if (floor) where.floor = parseInt(floor);
    if (typeId) where.roomTypeId = parseInt(typeId);

    const rooms = await Room.findAll({
      where,
      include: [{ model: RoomType, as: 'roomType', attributes: ['id', 'name', 'basePrice', 'maxOccupancy'] }],
      order: [['roomNumber', 'ASC']]
    });

    res.json(rooms);
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({ error: 'Error al obtener habitaciones' });
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{ model: RoomType, as: 'roomType' }]
    });
    if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener habitación' });
  }
});

// POST /api/rooms
router.post('/', authorize('admin', 'manager'), [
  body('roomNumber').trim().notEmpty(),
  body('roomTypeId').isInt(),
  body('floor').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const room = await Room.create(req.body);
    const roomWithType = await Room.findByPk(room.id, {
      include: [{ model: RoomType, as: 'roomType' }]
    });
    res.status(201).json(roomWithType);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ese número de habitación ya existe' });
    }
    res.status(500).json({ error: 'Error al crear habitación' });
  }
});

// PUT /api/rooms/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

    await room.update(req.body);
    const updated = await Room.findByPk(room.id, {
      include: [{ model: RoomType, as: 'roomType' }]
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar habitación' });
  }
});

// PATCH /api/rooms/:id/status — cambiar estado rápido
router.patch('/:id/status', [
  body('status').isIn(['available', 'occupied', 'reserved', 'cleaning', 'maintenance'])
], async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Habitación no encontrada' });

    await room.update({ status: req.body.status });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

module.exports = router;
