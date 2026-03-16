const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { User } = require('../models');
const logAudit = require('../utils/audit');

router.use(authenticate, authorize('admin'));

const safeUser = (u) => ({
  id: u.id, username: u.username, fullName: u.fullName,
  email: u.email, role: u.role, isActive: u.isActive,
  lastLogin: u.lastLogin, createdAt: u.createdAt
});

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['passwordHash'] },
      order: [['fullName', 'ASC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users
router.post('/', [
  body('username').trim().notEmpty(),
  body('fullName').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
  body('role').isIn(['admin', 'manager', 'receptionist', 'accounting', 'housekeeping'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      username: req.body.username,
      fullName: req.body.fullName,
      email: req.body.email,
      role: req.body.role,
      passwordHash,
      isActive: true
    });
    logAudit(req.user.id, 'create', 'user', user.id, { username: user.username, role: user.role }, req.ip);
    res.status(201).json(safeUser(user));
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El usuario o email ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id
router.put('/:id', [
  body('fullName').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['admin', 'manager', 'receptionist', 'accounting', 'housekeeping']),
  body('password').optional().isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updates = {};
    if (req.body.fullName) updates.fullName = req.body.fullName;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 10);

    await user.update(updates);
    logAudit(req.user.id, 'update', 'user', user.id, { fields: Object.keys(updates) }, req.ip);
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PATCH /api/users/:id/toggle — activar / desactivar
router.patch('/:id/toggle', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
    }
    await user.update({ isActive: !user.isActive });
    logAudit(req.user.id, user.isActive ? 'activate' : 'deactivate', 'user', user.id, {}, req.ip);
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

module.exports = router;
