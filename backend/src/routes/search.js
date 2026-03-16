const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.use(authenticate);

// GET /api/search?q=
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ guests: [], rooms: [], reservations: [] });

    const like = `%${q}%`;

    const [guests, rooms, reservations] = await Promise.all([
      sequelize.query(`
        SELECT id, first_name, last_name, phone, email, id_number
        FROM guests
        WHERE first_name ILIKE :like OR last_name ILIKE :like
           OR id_number ILIKE :like OR phone ILIKE :like OR email ILIKE :like
        ORDER BY last_name, first_name
        LIMIT 6
      `, { replacements: { like }, type: QueryTypes.SELECT }),

      sequelize.query(`
        SELECT r.id, r.room_number, rt.name AS type_name, r.status, r.floor
        FROM rooms r
        JOIN room_types rt ON rt.id = r.room_type_id
        WHERE r.room_number ILIKE :like OR rt.name ILIKE :like
        ORDER BY r.room_number
        LIMIT 6
      `, { replacements: { like }, type: QueryTypes.SELECT }),

      sequelize.query(`
        SELECT r.id, r.check_in_date::text, r.check_out_date::text, r.status,
               g.first_name || ' ' || g.last_name AS guest_name,
               rm.room_number
        FROM reservations r
        JOIN guests g  ON g.id  = r.guest_id
        JOIN rooms  rm ON rm.id = r.room_id
        WHERE g.first_name ILIKE :like OR g.last_name ILIKE :like
           OR rm.room_number ILIKE :like
           OR CAST(r.id AS TEXT) = :exact
        ORDER BY r.created_at DESC
        LIMIT 6
      `, { replacements: { like, exact: q }, type: QueryTypes.SELECT })
    ]);

    res.json({ guests, rooms, reservations });
  } catch (err) {
    console.error('search:', err);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

module.exports = router;
