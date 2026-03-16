const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.use(authenticate);

// GET /api/notifications — resumen de alertas operacionales
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [checkIns] = await sequelize.query(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE status IN ('pending', 'confirmed')
        AND check_in_date = :today
    `, { replacements: { today }, type: QueryTypes.SELECT });

    const [checkOuts] = await sequelize.query(`
      SELECT COUNT(*) AS count
      FROM reservations
      WHERE status = 'checked_in'
        AND check_out_date = :today
    `, { replacements: { today }, type: QueryTypes.SELECT });

    const [housekeeping] = await sequelize.query(`
      SELECT COUNT(*) AS count
      FROM housekeeping_tasks
      WHERE status = 'pending'
    `, { type: QueryTypes.SELECT });

    const [cleaning] = await sequelize.query(`
      SELECT COUNT(*) AS count
      FROM rooms
      WHERE status = 'cleaning' AND is_active = true
    `, { type: QueryTypes.SELECT });

    const [cash] = await sequelize.query(`
      SELECT COUNT(*) AS count
      FROM daily_cash
      WHERE date = :today AND status = 'open'
    `, { replacements: { today }, type: QueryTypes.SELECT });

    res.json({
      checkInsToday:     parseInt(checkIns.count)    || 0,
      checkOutsToday:    parseInt(checkOuts.count)   || 0,
      pendingTasks:      parseInt(housekeeping.count) || 0,
      roomsCleaning:     parseInt(cleaning.count)    || 0,
      cashOpen:          parseInt(cash.count) > 0
    });
  } catch (error) {
    console.error('notifications:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

module.exports = router;
