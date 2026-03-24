const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Reservation, Room, RoomType, Guest, Payment, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

router.use(authenticate);

// GET /api/dashboard — datos en tiempo real para el dashboard
router.get('/', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Conteo de habitaciones por estado
    const roomStats = await Room.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: { isActive: true },
      group: ['status'],
      raw: true
    });

    const totalRooms = roomStats.reduce((sum, r) => sum + parseInt(r.count), 0);
    const occupiedCount = parseInt(roomStats.find(r => r.status === 'occupied')?.count || 0);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    // Check-ins de hoy
    const todayCheckIns = await Reservation.count({
      where: { checkInDate: today, status: { [Op.in]: ['pending', 'confirmed'] } }
    });

    // Check-outs de hoy
    const todayCheckOuts = await Reservation.count({
      where: { checkOutDate: today, status: 'checked_in' }
    });

    // Ingresos de hoy
    const todayIncome = await Payment.sum('amount', {
      where: {
        createdAt: { [Op.gte]: new Date(today) },
        paymentType: { [Op.ne]: 'refund' }
      }
    });

    // Reservas futuras (próximos 7 días)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingReservations = await Reservation.count({
      where: {
        checkInDate: { [Op.gt]: today, [Op.lte]: nextWeek.toISOString().split('T')[0] },
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    // Huéspedes activos (checked_in)
    const activeGuests = await Reservation.count({
      where: { status: 'checked_in' }
    });

    // ADR + RevPAR (mes actual)
    const monthStart = today.substring(0, 7) + '-01';
    const daysElapsed = new Date().getDate();
    const [kpi] = await sequelize.query(`
      SELECT
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_type != 'refund'), 0) AS revenue,
        COALESCE(SUM(r.nights), 0)                                           AS nights_sold
      FROM reservations r
      LEFT JOIN payments p ON p.reservation_id = r.id
      WHERE r.check_in_date >= :monthStart
        AND r.status IN ('checked_in', 'checked_out')
    `, { replacements: { monthStart }, type: sequelize.QueryTypes.SELECT });

    const revenue    = parseFloat(kpi.revenue) || 0;
    const nightsSold = parseInt(kpi.nights_sold) || 0;
    const adr    = nightsSold > 0 ? revenue / nightsSold : 0;
    const revpar = totalRooms > 0 && daysElapsed > 0 ? revenue / (totalRooms * daysElapsed) : 0;

    // Llegadas de hoy (pending/confirmed con check-in hoy)
    const todayArrivals = await Reservation.findAll({
      where: { checkInDate: today, status: { [Op.in]: ['pending', 'confirmed'] } },
      include: [
        { model: Guest, as: 'guest', attributes: ['firstName', 'lastName', 'phone'] },
        { model: Room,  as: 'room',  attributes: ['roomNumber'], include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] }
      ],
      order: [['checkInDate', 'ASC']]
    });

    // Salidas de hoy (checked_in con check-out hoy)
    const todayDepartures = await Reservation.findAll({
      where: { checkOutDate: today, status: 'checked_in' },
      include: [
        { model: Guest, as: 'guest', attributes: ['firstName', 'lastName', 'phone'] },
        { model: Room,  as: 'room',  attributes: ['roomNumber'], include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] }
      ],
      order: [['checkOutDate', 'ASC']]
    });

    // Últimas 5 reservaciones recientes
    const recentReservations = await Reservation.findAll({
      include: [
        { model: Guest, as: 'guest', attributes: ['firstName', 'lastName'] },
        { model: Room, as: 'room', attributes: ['roomNumber'], include: [{ model: RoomType, as: 'roomType', attributes: ['name'] }] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Reservaciones por canal de origen (últimos 90 días)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sourceStats = await Reservation.findAll({
      attributes: ['source', [fn('COUNT', col('id')), 'count']],
      where: {
        status: { [Op.notIn]: ['cancelled', 'no_show'] },
        checkInDate: { [Op.gte]: ninetyDaysAgo.toISOString().split('T')[0] }
      },
      group: ['source'],
      order: [[literal('count'), 'DESC']],
      raw: true
    });

    res.json({
      rooms: {
        total: totalRooms,
        byStatus: roomStats.reduce((acc, r) => ({ ...acc, [r.status]: parseInt(r.count) }), {}),
        occupancyRate
      },
      today: {
        checkIns: todayCheckIns,
        checkOuts: todayCheckOuts,
        income: parseFloat(todayIncome || 0)
      },
      upcomingReservations,
      activeGuests,
      todayArrivals,
      todayDepartures,
      recentReservations,
      kpis: { adr: Math.round(adr * 100) / 100, revpar: Math.round(revpar * 100) / 100 },
      sourceStats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
});

module.exports = router;
