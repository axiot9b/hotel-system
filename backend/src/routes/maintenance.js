const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { MaintenanceLog, Room, RoomBlock } = require('../models');
const logAudit = require('../utils/audit');

router.use(authenticate);

// GET /api/maintenance?roomId=&status=&page=
router.get('/', async (req, res) => {
  try {
    const { roomId, status, page = 1, limit = 30 } = req.query;
    const where = {};
    if (roomId) where.roomId = roomId;
    if (status) where.status = status;

    const { count, rows } = await MaintenanceLog.findAndCountAll({
      where,
      include: [
        { model: Room, as: 'room', attributes: ['roomNumber', 'floor'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      logs: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial de mantenimiento' });
  }
});

// POST /api/maintenance
router.post('/', async (req, res) => {
  try {
    const { roomId, type, priority, description, blockStartDate, blockEndDate } = req.body;
    if (!roomId || !description) {
      return res.status(400).json({ error: 'roomId y description son requeridos' });
    }

    let roomBlockId = null;

    // Crear bloqueo en el calendario si se proporcionan fechas
    if (blockStartDate && blockEndDate) {
      const block = await RoomBlock.create({
        roomId,
        startDate:  blockStartDate,
        endDate:    blockEndDate,
        reason:     `Mantenimiento: ${description.substring(0, 80)}`,
        createdBy:  req.user.id
      });
      roomBlockId = block.id;
    }

    const log = await MaintenanceLog.create({
      roomId,
      reportedBy:     req.user.id,
      type:           type     || 'repair',
      priority:       priority || 'normal',
      description,
      status:         'open',
      blockStartDate: blockStartDate || null,
      blockEndDate:   blockEndDate   || null,
      roomBlockId
    });

    logAudit(req.user.id, 'create', 'maintenance', log.id, { roomId, type: log.type }, req.ip);
    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear registro de mantenimiento' });
  }
});

// PATCH /api/maintenance/:id
router.patch('/:id', async (req, res) => {
  try {
    const log = await MaintenanceLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Registro no encontrado' });

    const updates = {};
    if (req.body.status) {
      updates.status = req.body.status;
      if (req.body.status === 'in_progress' && !log.startedAt) updates.startedAt = new Date();
      if (req.body.status === 'closed') {
        updates.closedAt = new Date();
        // Eliminar el bloqueo del calendario al cerrar
        if (log.roomBlockId) {
          await RoomBlock.destroy({ where: { id: log.roomBlockId } });
          updates.roomBlockId = null;
        }
      }
    }
    if (req.body.resolution !== undefined) updates.resolution = req.body.resolution;
    if (req.body.cost       !== undefined) updates.cost       = req.body.cost;
    if (req.body.priority   !== undefined) updates.priority   = req.body.priority;

    await log.update(updates);
    logAudit(req.user.id, 'update', 'maintenance', log.id, { status: log.status }, req.ip);
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar registro' });
  }
});

module.exports = router;
