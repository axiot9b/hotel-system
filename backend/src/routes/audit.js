const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');

router.use(authenticate, authorize('admin', 'manager'));

// GET /api/audit
router.get('/', async (req, res) => {
  try {
    const { entity, action, userId, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    const offset = (page - 1) * limit;

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'fullName'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      logs: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

module.exports = router;
