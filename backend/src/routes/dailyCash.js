const router = require('express').Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const { DailyCash, User, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const logAudit = require('../utils/audit');

router.use(authenticate);

// GET /api/daily-cash/today — estado de la caja de hoy + totales de pagos
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const cash = await DailyCash.findOne({
      where: { date: today },
      include: [
        { model: User, as: 'opener', attributes: ['id', 'fullName'] },
        { model: User, as: 'closer', attributes: ['id', 'fullName'] }
      ]
    });

    const [totals] = await sequelize.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE 0 END), 0)  AS gross_income,
        COALESCE(SUM(CASE WHEN payment_type = 'refund'  THEN amount ELSE 0 END), 0)  AS refunds,
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END), 0) AS net_income,
        COALESCE(SUM(CASE WHEN payment_method = 'cash'     AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN payment_method = 'card'     AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS transfer,
        COUNT(DISTINCT reservation_id) AS transactions
      FROM payments
      WHERE DATE(created_at AT TIME ZONE 'UTC') = :today
    `, { replacements: { today }, type: QueryTypes.SELECT });

    res.json({ cash, todayTotals: totals });
  } catch (error) {
    console.error('daily-cash today:', error);
    res.status(500).json({ error: 'Error al obtener caja' });
  }
});

// GET /api/daily-cash — historial
router.get('/', authorize('admin', 'manager', 'accounting'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from) where.date = { ...(where.date || {}), [Op.gte]: from };
    if (to)   where.date = { ...(where.date || {}), [Op.lte]: to };

    const records = await DailyCash.findAll({
      where,
      include: [
        { model: User, as: 'opener', attributes: ['id', 'fullName'] },
        { model: User, as: 'closer', attributes: ['id', 'fullName'] }
      ],
      order: [['date', 'DESC']],
      limit: 60
    });

    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar caja' });
  }
});

// POST /api/daily-cash/open — abrir caja
router.post('/open', authorize('admin', 'manager', 'accounting'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await DailyCash.findOne({ where: { date: today } });
    if (existing) return res.status(409).json({ error: 'La caja ya está abierta hoy' });

    const cash = await DailyCash.create({
      date: today,
      openingBalance: parseFloat(req.body.openingBalance) || 0,
      notes: req.body.notes || null,
      openedBy: req.user.id,
      status: 'open'
    });

    logAudit(req.user.id, 'open', 'daily_cash', cash.id, { date: today, openingBalance: cash.openingBalance }, req.ip);
    res.status(201).json(cash);
  } catch (error) {
    res.status(500).json({ error: 'Error al abrir caja' });
  }
});

// PATCH /api/daily-cash/:id/close — cerrar caja con arqueo
router.patch('/:id/close', authorize('admin', 'manager', 'accounting'), async (req, res) => {
  try {
    const cash = await DailyCash.findByPk(req.params.id);
    if (!cash) return res.status(404).json({ error: 'Caja no encontrada' });
    if (cash.status === 'closed') return res.status(400).json({ error: 'La caja ya está cerrada' });

    const [totals] = await sequelize.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END), 0) AS net_income
      FROM payments
      WHERE DATE(created_at AT TIME ZONE 'UTC') = :date
    `, { replacements: { date: cash.date }, type: QueryTypes.SELECT });

    await cash.update({
      closingBalance: parseFloat(req.body.closingBalance) || 0,
      totalIncome: parseFloat(totals.net_income) || 0,
      notes: req.body.notes || cash.notes,
      closedBy: req.user.id,
      status: 'closed'
    });

    logAudit(req.user.id, 'close', 'daily_cash', cash.id, { date: cash.date, closingBalance: cash.closingBalance }, req.ip);
    res.json(cash);
  } catch (error) {
    console.error('close cash:', error);
    res.status(500).json({ error: 'Error al cerrar caja' });
  }
});

module.exports = router;
