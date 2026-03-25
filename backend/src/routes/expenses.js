const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Expense, User } = require('../models');
const { Op } = require('sequelize');

router.use(authenticate);

// GET /api/expenses?from=&to=&category=&page=
router.get('/', async (req, res) => {
  try {
    const { from, to, category, page = 1, limit = 50 } = req.query;
    const where = {};
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to)   where.date[Op.lte] = to;
    }

    const { count, rows } = await Expense.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['fullName'] }],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ expenses: rows, total: count, totalPages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { date, category, description, amount } = req.body;
    if (!date || !description || !amount) {
      return res.status(400).json({ error: 'date, description y amount son requeridos' });
    }
    const expense = await Expense.create({
      date, category: category || 'other', description,
      amount: parseFloat(amount), createdBy: req.user.id
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });
    await expense.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
