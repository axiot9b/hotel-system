const router = require('express').Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { RoomRate, RoomType } = require('../models');

router.use(authenticate);

// GET /api/room-rates — list all rates
router.get('/', async (req, res) => {
  try {
    const rates = await RoomRate.findAll({
      include: [{ model: RoomType, as: 'roomType', attributes: ['name', 'basePrice'] }],
      order: [['startDate', 'ASC']]
    });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tarifas' });
  }
});

// GET /api/room-rates/for-date?roomTypeId=&date= — rate applicable on a date
router.get('/for-date', async (req, res) => {
  try {
    const { roomTypeId, date } = req.query;
    if (!roomTypeId || !date) return res.json({ rate: null });

    const rate = await RoomRate.findOne({
      where: {
        roomTypeId,
        startDate: { [Op.lte]: date },
        endDate:   { [Op.gte]: date }
      },
      order: [['createdAt', 'DESC']]
    });
    res.json({ rate });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tarifa' });
  }
});

// POST /api/room-rates
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { roomTypeId, name, startDate, endDate, ratePerNight, description } = req.body;
    if (!roomTypeId || !name || !startDate || !endDate || !ratePerNight) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'La fecha de fin debe ser mayor o igual a la de inicio' });
    }
    const rate = await RoomRate.create({ roomTypeId, name, startDate, endDate, ratePerNight, description });
    const full = await RoomRate.findByPk(rate.id, {
      include: [{ model: RoomType, as: 'roomType', attributes: ['name', 'basePrice'] }]
    });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarifa' });
  }
});

// PUT /api/room-rates/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const rate = await RoomRate.findByPk(req.params.id);
    if (!rate) return res.status(404).json({ error: 'Tarifa no encontrada' });
    const { name, startDate, endDate, ratePerNight, description } = req.body;
    await rate.update({ name, startDate, endDate, ratePerNight, description });
    const full = await RoomRate.findByPk(rate.id, {
      include: [{ model: RoomType, as: 'roomType', attributes: ['name', 'basePrice'] }]
    });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tarifa' });
  }
});

// DELETE /api/room-rates/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const rate = await RoomRate.findByPk(req.params.id);
    if (!rate) return res.status(404).json({ error: 'Tarifa no encontrada' });
    await rate.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar tarifa' });
  }
});

module.exports = router;
