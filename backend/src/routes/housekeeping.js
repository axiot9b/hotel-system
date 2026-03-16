const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { HousekeepingTask, Room, RoomType, User } = require('../models');

router.use(authenticate);

const taskIncludes = [
  { model: Room, as: 'room', attributes: ['id', 'roomNumber', 'floor', 'status'],
    include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] },
  { model: User, as: 'assignedUser', attributes: ['id', 'fullName', 'role'] }
];

// GET /api/housekeeping
router.get('/', async (req, res) => {
  try {
    const { status, roomId, assignedTo } = req.query;
    const where = {};
    if (status) where.status = status;
    if (roomId) where.roomId = roomId;
    if (assignedTo) where.assignedTo = assignedTo;

    const tasks = await HousekeepingTask.findAll({
      where,
      include: taskIncludes,
      order: [['createdAt', 'DESC']]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
});

// GET /api/housekeeping/rooms-cleaning — habitaciones pendientes de limpieza sin tarea activa
router.get('/rooms-cleaning', async (req, res) => {
  try {
    const rooms = await Room.findAll({
      where: { status: 'cleaning', isActive: true },
      include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }],
      order: [['roomNumber', 'ASC']]
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener habitaciones' });
  }
});

// POST /api/housekeeping
router.post('/', [
  body('roomId').isInt(),
  body('taskType').optional().isIn(['cleaning', 'deep_cleaning', 'inspection', 'restock'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const task = await HousekeepingTask.create({
      roomId: req.body.roomId,
      assignedTo: req.body.assignedTo || null,
      taskType: req.body.taskType || 'cleaning',
      notes: req.body.notes || null,
      status: 'pending'
    });
    const full = await HousekeepingTask.findByPk(task.id, { include: taskIncludes });
    res.status(201).json(full);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

// PATCH /api/housekeeping/:id — actualizar estado, asignado, notas
router.patch('/:id', async (req, res) => {
  try {
    const task = await HousekeepingTask.findByPk(req.params.id, { include: taskIncludes });
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.assignedTo !== undefined) updates.assignedTo = req.body.assignedTo;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    // Al completar: registrar hora y liberar la habitación si estaba en cleaning
    if (req.body.status === 'completed') {
      updates.completedAt = new Date();
      if (task.room?.status === 'cleaning') {
        await Room.update({ status: 'available' }, { where: { id: task.roomId } });
      }
    }

    await task.update(updates);
    const updated = await HousekeepingTask.findByPk(task.id, { include: taskIncludes });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// DELETE /api/housekeeping/:id
router.delete('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    const task = await HousekeepingTask.findByPk(req.params.id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    await task.destroy();
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

module.exports = router;
