const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { RoomType } = require('../models');

router.use(authenticate);

// GET /api/room-types
router.get('/', async (_req, res) => {
  try {
    const types = await RoomType.findAll({ order: [['name', 'ASC']] });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipos de habitación' });
  }
});

// POST /api/room-types
router.post('/', authorize('admin', 'manager'), [
  body('name').trim().notEmpty(),
  body('basePrice').isFloat({ min: 0 }),
  body('maxOccupancy').isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const type = await RoomType.create(req.body);
    res.status(201).json(type);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ese tipo de habitación ya existe' });
    }
    res.status(500).json({ error: 'Error al crear tipo' });
  }
});

// PUT /api/room-types/:id
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const type = await RoomType.findByPk(req.params.id);
    if (!type) return res.status(404).json({ error: 'Tipo no encontrado' });
    await type.update(req.body);
    res.json(type);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar tipo' });
  }
});

module.exports = router;
