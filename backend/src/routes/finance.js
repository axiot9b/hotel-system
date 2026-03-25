const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

router.use(authenticate, authorize('admin', 'manager', 'accounting'));

// ── Helpers ──────────────────────────────────────────────────────────────────
function firstDay() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function today() {
  return new Date().toISOString().split('T')[0];
}

// GET /api/finance/income?from=&to=
router.get('/income', async (req, res) => {
  try {
    const from = req.query.from || firstDay();
    const to   = req.query.to   || today();

    const [summary] = await sequelize.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE 0 END), 0)         AS gross_income,
        COALESCE(SUM(CASE WHEN payment_type = 'refund'  THEN amount ELSE 0 END), 0)         AS refunds,
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END), 0)   AS net_income,
        COALESCE(SUM(CASE WHEN payment_method = 'cash'     AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN payment_method = 'card'     AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS transfer,
        COALESCE(SUM(CASE WHEN payment_method = 'other'    AND payment_type != 'refund' THEN amount ELSE 0 END), 0) AS other,
        COUNT(DISTINCT reservation_id) AS transactions_count
      FROM payments
      WHERE DATE(created_at) BETWEEN :from AND :to
    `, { replacements: { from, to }, type: QueryTypes.SELECT });

    const byDay = await sequelize.query(`
      SELECT
        DATE(created_at)::text AS day,
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END), 0) AS net
      FROM payments
      WHERE DATE(created_at) BETWEEN :from AND :to
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `, { replacements: { from, to }, type: QueryTypes.SELECT });

    const byRoomType = await sequelize.query(`
      SELECT
        rt.name                                                                                       AS room_type,
        COALESCE(SUM(CASE WHEN p.payment_type != 'refund' THEN p.amount ELSE -p.amount END), 0)     AS net
      FROM payments p
      JOIN reservations r  ON r.id  = p.reservation_id
      JOIN rooms        rm ON rm.id = r.room_id
      JOIN room_types   rt ON rt.id = rm.room_type_id
      WHERE DATE(p.created_at) BETWEEN :from AND :to
      GROUP BY rt.id, rt.name
      ORDER BY net DESC
    `, { replacements: { from, to }, type: QueryTypes.SELECT });

    res.json({ summary, byDay, byRoomType, from, to });
  } catch (error) {
    console.error('income report:', error);
    res.status(500).json({ error: 'Error al generar reporte de ingresos' });
  }
});

// GET /api/finance/receivables
router.get('/receivables', async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT *
      FROM (
        SELECT
          r.id,
          g.first_name || ' ' || g.last_name   AS guest_name,
          g.phone                               AS guest_phone,
          rm.room_number,
          rt.name                               AS room_type_name,
          r.status,
          r.check_in_date::text,
          r.check_out_date::text,
          r.nights,
          r.total_amount::numeric,
          COALESCE(ec_agg.total_extra, 0)       AS total_extra,
          COALESCE(pay_agg.total_paid, 0)       AS total_paid,
          (r.total_amount + COALESCE(ec_agg.total_extra, 0)
            - COALESCE(pay_agg.total_paid, 0)) AS balance
        FROM reservations r
        JOIN guests     g  ON g.id  = r.guest_id
        JOIN rooms      rm ON rm.id = r.room_id
        JOIN room_types rt ON rt.id = rm.room_type_id
        LEFT JOIN (
          SELECT reservation_id, SUM(amount) AS total_extra
          FROM extra_charges GROUP BY reservation_id
        ) ec_agg  ON ec_agg.reservation_id  = r.id
        LEFT JOIN (
          SELECT reservation_id,
            SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END) AS total_paid
          FROM payments GROUP BY reservation_id
        ) pay_agg ON pay_agg.reservation_id = r.id
        WHERE r.status NOT IN ('cancelled', 'no_show')
      ) sub
      WHERE balance > 0.009
      ORDER BY balance DESC
    `, { type: QueryTypes.SELECT });

    res.json(rows);
  } catch (error) {
    console.error('receivables:', error);
    res.status(500).json({ error: 'Error al obtener cuentas por cobrar' });
  }
});

// GET /api/finance/occupancy?from=&to=
router.get('/occupancy', async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
    const to   = req.query.to   || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const rows = await sequelize.query(`
      WITH dates AS (
        SELECT generate_series(:from::date, :to::date, '1 day'::interval)::date AS day
      ),
      total_rooms AS (
        SELECT COUNT(*) AS total FROM rooms WHERE is_active = true
      )
      SELECT
        d.day::text,
        COALESCE(COUNT(r.id), 0)               AS occupied,
        (SELECT total FROM total_rooms)::integer AS total,
        ROUND(
          COALESCE(COUNT(r.id), 0) * 100.0
          / NULLIF((SELECT total FROM total_rooms), 0), 1
        ) AS pct
      FROM dates d
      LEFT JOIN reservations r
        ON  r.check_in_date  <= d.day
        AND r.check_out_date  > d.day
        AND r.status NOT IN ('cancelled', 'no_show')
      GROUP BY d.day
      ORDER BY d.day ASC
    `, { replacements: { from, to }, type: QueryTypes.SELECT });

    res.json({ rows, from, to });
  } catch (error) {
    console.error('occupancy:', error);
    res.status(500).json({ error: 'Error al generar reporte de ocupación' });
  }
});

// GET /api/finance/monthly?year=&month=
router.get('/monthly', async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year  || now.getFullYear());
    const month = parseInt(req.query.month || (now.getMonth() + 1));

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate   = new Date(year, month, 1).toISOString().split('T')[0]; // first day of NEXT month

    // ── Ingresos del mes ──────────────────────────────────────────────────────
    const [income] = await sequelize.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE 0 END), 0)       AS gross_income,
        COALESCE(SUM(CASE WHEN payment_type = 'refund'  THEN amount ELSE 0 END), 0)       AS refunds,
        COALESCE(SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END), 0) AS net_income,
        COUNT(DISTINCT reservation_id) AS payment_count
      FROM payments
      WHERE created_at >= :startDate AND created_at < :endDate
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    // ── Por método de pago ────────────────────────────────────────────────────
    const byMethod = await sequelize.query(`
      SELECT
        payment_method,
        SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE 0 END) AS gross,
        COUNT(*) AS count
      FROM payments
      WHERE created_at >= :startDate AND created_at < :endDate
      GROUP BY payment_method
      ORDER BY gross DESC
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    // ── Por tipo de habitación (check-outs del mes) ───────────────────────────
    const byRoomType = await sequelize.query(`
      SELECT
        rt.name                                    AS room_type,
        COUNT(DISTINCT r.id)                       AS reservations,
        SUM(r.nights)                              AS nights_sold,
        SUM(r.total_amount)                        AS revenue,
        ROUND(AVG(r.rate_per_night)::numeric, 2)   AS avg_rate
      FROM reservations r
      JOIN rooms      rm ON rm.id = r.room_id
      JOIN room_types rt ON rt.id = rm.room_type_id
      WHERE r.check_out_date >= :startDate AND r.check_out_date < :endDate
        AND r.status IN ('checked_out', 'checked_in')
      GROUP BY rt.id, rt.name
      ORDER BY revenue DESC
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    // ── Nuevas reservaciones del mes ──────────────────────────────────────────
    const [newRes] = await sequelize.query(`
      SELECT
        COUNT(*)             AS total_created,
        SUM(total_amount)    AS total_value,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
      FROM reservations
      WHERE created_at >= :startDate AND created_at < :endDate
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    // ── Ocupación promedio del mes ────────────────────────────────────────────
    const [occupancy] = await sequelize.query(`
      WITH days AS (
        SELECT generate_series(:startDate::date, (:endDate::date - interval '1 day'), '1 day') AS day
      ),
      total_rooms AS (SELECT COUNT(*) AS total FROM rooms WHERE is_active = true)
      SELECT
        ROUND(AVG(
          (SELECT COUNT(*) FROM reservations r
           WHERE r.check_in_date <= d.day AND r.check_out_date > d.day
             AND r.status NOT IN ('cancelled','no_show'))
          * 100.0 / NULLIF((SELECT total FROM total_rooms), 0)
        ), 1) AS avg_occupancy_pct
      FROM days d
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    // ── Cuentas por cobrar al cierre del mes ──────────────────────────────────
    const receivables = await sequelize.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(balance), 0) AS total
      FROM (
        SELECT
          r.id,
          (r.total_amount
            + COALESCE((SELECT SUM(amount) FROM extra_charges ec WHERE ec.reservation_id = r.id), 0)
            - COALESCE((SELECT SUM(CASE WHEN payment_type != 'refund' THEN amount ELSE -amount END)
                        FROM payments p WHERE p.reservation_id = r.id
                          AND p.created_at < :endDate), 0)
          ) AS balance
        FROM reservations r
        WHERE r.status NOT IN ('cancelled', 'no_show')
          AND r.check_in_date < :endDate
      ) sub
      WHERE balance > 0.009
    `, { replacements: { endDate }, type: QueryTypes.SELECT });

    // ── Gastos del mes ────────────────────────────────────────────────────────
    const expenses = await sequelize.query(`
      SELECT
        category,
        COUNT(*)        AS count,
        SUM(amount)     AS total
      FROM expenses
      WHERE created_at >= :startDate AND created_at < :endDate
      GROUP BY category
      ORDER BY total DESC
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    const [expenseSummary] = await sequelize.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE created_at >= :startDate AND created_at < :endDate
    `, { replacements: { startDate, endDate }, type: QueryTypes.SELECT });

    const taxRate = parseFloat(process.env.HOTEL_TAX_RATE || 0.10);
    res.json({
      year, month, startDate, endDate,
      taxRate,
      income,
      byMethod,
      byRoomType,
      expenses,
      expenseSummary,
      newReservations: newRes,
      occupancy: occupancy[0] ?? { avg_occupancy_pct: 0 },
      receivables: receivables[0] ?? { count: 0, total: 0 }
    });
  } catch (error) {
    console.error('monthly report:', error);
    res.status(500).json({ error: 'Error al generar reporte mensual' });
  }
});

module.exports = router;
