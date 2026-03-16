const request = require('supertest');

jest.mock('../models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
  Guest: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn(), increment: jest.fn() },
  Room: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn(), update: jest.fn() },
  RoomType: { findAll: jest.fn(), findByPk: jest.fn() },
  Reservation: {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  Payment: { findAll: jest.fn(), create: jest.fn() },
  ExtraCharge: { findAll: jest.fn(), create: jest.fn() },
  HousekeepingTask: { findAll: jest.fn(), create: jest.fn().mockResolvedValue({}) },
  AuditLog: { create: jest.fn().mockResolvedValue({}) },
  sequelize: {
    authenticate: jest.fn(),
    sync: jest.fn(),
    query: jest.fn(),
    // Simula una transacción ejecutando el callback con un objeto fake de transacción
    transaction: jest.fn(async (cb) => cb({ /* fake transaction */ })),
  },
}));

const app = require('../app');
const { generateToken } = require('../config/auth');
const { Reservation, Room, Guest } = require('../models');

const adminToken = generateToken({ id: 1, username: 'admin', role: 'admin' });
const receptionToken = generateToken({ id: 3, username: 'recepcion', role: 'receptionist' });

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Devuelve una reservación mock con métodos de instancia */
function mockReservation(overrides = {}) {
  const base = {
    id: 1,
    guestId: 10,
    roomId: 5,
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-04',
    nights: 3,
    ratePerNight: '150.00',
    totalAmount: '450.00',
    status: 'pending',
    adults: 2,
    children: 0,
    notes: null,
    payments: [],
    extraCharges: [],
    update: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  // update devuelve el propio objeto actualizado
  base.update.mockImplementation((changes) => {
    Object.assign(base, changes);
    return Promise.resolve(base);
  });
  return base;
}

/** Payload mínimo válido para crear una reservación */
const validPayload = {
  guestId: 10,
  roomId: 5,
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-04',
  ratePerNight: 150,
  adults: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: sin conflictos de fecha, Room.update siempre ok
  Reservation.findOne.mockResolvedValue(null);
  Room.update.mockResolvedValue([1]);
  Room.findByPk.mockResolvedValue({ id: 5, status: 'available' });
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/reservations
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/reservations', () => {
  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(401);
  });

  it('retorna lista paginada', async () => {
    Reservation.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [mockReservation({ id: 1 }), mockReservation({ id: 2 })],
    });

    const res = await request(app)
      .get('/api/reservations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reservations).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
  });

  it('pasa filtro de status al query', async () => {
    Reservation.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await request(app)
      .get('/api/reservations?status=pending')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(Reservation.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/reservations — CREAR RESERVACIÓN
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/reservations — crear reservación', () => {
  describe('validación de campos requeridos', () => {
    it('400 si falta guestId', async () => {
      const { guestId: _, ...payload } = validPayload;
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('400 si falta roomId', async () => {
      const { roomId: _, ...payload } = validPayload;
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('400 si falta checkInDate', async () => {
      const { checkInDate: _, ...payload } = validPayload;
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('400 si falta checkOutDate', async () => {
      const { checkOutDate: _, ...payload } = validPayload;
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('400 si falta ratePerNight', async () => {
      const { ratePerNight: _, ...payload } = validPayload;
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(payload);
      expect(res.status).toBe(400);
    });

    it('400 si ratePerNight es negativo', async () => {
      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({ ...validPayload, ratePerNight: -50 });
      expect(res.status).toBe(400);
    });
  });

  describe('conflicto de fechas', () => {
    it('409 si la habitación ya tiene una reserva activa en esas fechas', async () => {
      Reservation.findOne.mockResolvedValue(mockReservation({ id: 99 }));

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/no está disponible/i);
    });

    it('crea la reserva cuando no existe conflicto', async () => {
      Reservation.findOne.mockResolvedValue(null); // sin conflicto
      const created = mockReservation({ id: 1 });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(validPayload);

      expect(res.status).toBe(201);
    });
  });

  describe('cálculo de noches y monto total', () => {
    it('calcula correctamente 3 noches a $150/noche = $450 total', async () => {
      const created = mockReservation({ id: 1 });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validPayload); // 2026-04-01 → 2026-04-04 = 3 noches

      expect(Reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ nights: 3, totalAmount: 450 }),
        expect.objectContaining({ transaction: expect.anything() })
      );
    });

    it('calcula correctamente 1 noche a $200/noche = $200 total', async () => {
      const created = mockReservation({ id: 2 });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validPayload,
          checkInDate: '2026-05-10',
          checkOutDate: '2026-05-11',
          ratePerNight: 200,
        });

      expect(Reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ nights: 1, totalAmount: 200 }),
        expect.objectContaining({ transaction: expect.anything() })
      );
    });

    it('calcula correctamente 7 noches a $90/noche = $630 total', async () => {
      const created = mockReservation({ id: 3 });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validPayload,
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-08',
          ratePerNight: 90,
        });

      expect(Reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ nights: 7, totalAmount: 630 }),
        expect.objectContaining({ transaction: expect.anything() })
      );
    });
  });

  describe('actualización de estado de habitación', () => {
    it('marca la habitación como reserved si el check-in es hoy', async () => {
      const today = new Date().toISOString().split('T')[0];
      const created = mockReservation({ checkInDate: today });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({ ...validPayload, checkInDate: today, checkOutDate: '2099-01-01' });

      expect(Room.update).toHaveBeenCalledWith(
        { status: 'reserved' },
        expect.objectContaining({ where: { id: validPayload.roomId }, transaction: expect.anything() })
      );
    });

    it('NO actualiza la habitación si el check-in es en el futuro', async () => {
      const created = mockReservation({ id: 1 });
      Reservation.create.mockResolvedValue(created);
      Reservation.findByPk.mockResolvedValue(created);

      await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(validPayload); // checkInDate: '2026-04-01' (futuro)

      expect(Room.update).not.toHaveBeenCalled();
    });
  });

  it('registra el usuario que creó la reserva', async () => {
    const created = mockReservation({ id: 1 });
    Reservation.create.mockResolvedValue(created);
    Reservation.findByPk.mockResolvedValue(created);

    await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${receptionToken}`) // id: 3
      .send(validPayload);

    expect(Reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 3 }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/reservations/:id/cancel — CANCELAR RESERVACIÓN
// ══════════════════════════════════════════════════════════════════════════════

describe('PATCH /api/reservations/:id/cancel — cancelar reservación', () => {
  it('404 si la reservación no existe', async () => {
    Reservation.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/reservations/999/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Reservación no encontrada');
  });

  it('400 si la reservación ya está cancelada', async () => {
    Reservation.findByPk.mockResolvedValue(mockReservation({ status: 'cancelled' }));

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no se puede cancelar/i);
  });

  it('400 si la reservación ya tiene check-out', async () => {
    Reservation.findByPk.mockResolvedValue(mockReservation({ status: 'checked_out' }));

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no se puede cancelar/i);
  });

  it('cancela una reservación pendiente y libera la habitación', async () => {
    const reservation = mockReservation({ status: 'pending', roomId: 5 });
    Reservation.findByPk.mockResolvedValue(reservation);
    Room.findByPk.mockResolvedValue({ id: 5, status: 'reserved' });

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(reservation.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(Room.update).toHaveBeenCalledWith(
      { status: 'available' },
      { where: { id: 5 } }
    );
  });

  it('cancela una reservación confirmada y libera la habitación', async () => {
    const reservation = mockReservation({ status: 'confirmed', roomId: 5 });
    Reservation.findByPk.mockResolvedValue(reservation);
    Room.findByPk.mockResolvedValue({ id: 5, status: 'reserved' });

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(reservation.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('cancela una reservación con check-in activo y libera la habitación ocupada', async () => {
    const reservation = mockReservation({ status: 'checked_in', roomId: 5 });
    Reservation.findByPk.mockResolvedValue(reservation);
    Room.findByPk.mockResolvedValue({ id: 5, status: 'occupied' });

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(Room.update).toHaveBeenCalledWith(
      { status: 'available' },
      { where: { id: 5 } }
    );
  });

  it('no actualiza la habitación si su estado es available o cleaning', async () => {
    const reservation = mockReservation({ status: 'pending', roomId: 5 });
    Reservation.findByPk.mockResolvedValue(reservation);
    Room.findByPk.mockResolvedValue({ id: 5, status: 'available' }); // ya libre

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(Room.update).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Ciclo de vida: crear → check-in → check-out
// ══════════════════════════════════════════════════════════════════════════════

describe('Ciclo de vida completo de una reservación', () => {
  it('flujo: pending → checked_in → checked_out con habitación en cleaning', async () => {
    // ── 1. CREAR ──────────────────────────────────────────────────────────────
    const created = mockReservation({ id: 42, status: 'pending' });
    Reservation.findOne.mockResolvedValue(null);
    Reservation.create.mockResolvedValue(created);
    Reservation.findByPk.mockResolvedValue(created);

    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send(validPayload);

    expect(createRes.status).toBe(201);

    // ── 2. CHECK-IN ───────────────────────────────────────────────────────────
    jest.clearAllMocks();
    const pendingReservation = mockReservation({ id: 42, status: 'pending' });
    const afterCheckIn = mockReservation({ id: 42, status: 'checked_in' });
    Reservation.findByPk
      .mockResolvedValueOnce(pendingReservation)   // primera llamada (encontrar reserva)
      .mockResolvedValueOnce(afterCheckIn);        // segunda llamada (devolver full)
    Room.update.mockResolvedValue([1]);

    const checkInRes = await request(app)
      .patch('/api/reservations/42/check-in')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(checkInRes.status).toBe(200);
    expect(pendingReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'checked_in' })
    );
    expect(Room.update).toHaveBeenCalledWith(
      { status: 'occupied' },
      { where: { id: pendingReservation.roomId } }
    );

    // ── 3. CHECK-OUT ──────────────────────────────────────────────────────────
    jest.clearAllMocks();
    const checkedInReservation = mockReservation({
      id: 42,
      status: 'checked_in',
      payments: [{ amount: '450.00', paymentType: 'payment' }],
      extraCharges: [],
    });
    const afterCheckOut = mockReservation({ id: 42, status: 'checked_out' });
    Reservation.findByPk
      .mockResolvedValueOnce(checkedInReservation)
      .mockResolvedValueOnce(afterCheckOut);
    Room.update.mockResolvedValue([1]);
    Guest.increment.mockResolvedValue([1]);

    const checkOutRes = await request(app)
      .patch('/api/reservations/42/check-out')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(checkOutRes.status).toBe(200);
    expect(checkedInReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'checked_out' })
    );
    expect(Room.update).toHaveBeenCalledWith(
      { status: 'cleaning' },
      { where: { id: checkedInReservation.roomId } }
    );
    expect(checkOutRes.body).toHaveProperty('balance');
  });

  it('no permite check-in si la reservación ya fue cancelada', async () => {
    Reservation.findByPk.mockResolvedValue(
      mockReservation({ status: 'cancelled' })
    );

    const res = await request(app)
      .patch('/api/reservations/1/check-in')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pendientes o confirmadas/i);
  });

  it('no permite check-out si la reservación no tiene check-in', async () => {
    Reservation.findByPk.mockResolvedValue(
      mockReservation({ status: 'pending', payments: [], extraCharges: [] })
    );

    const res = await request(app)
      .patch('/api/reservations/1/check-out')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/con check-in/i);
  });

  it('flujo alternativo: pending → cancel (nunca llega a check-in)', async () => {
    const reservation = mockReservation({ status: 'pending', roomId: 5 });
    Reservation.findByPk.mockResolvedValue(reservation);
    Room.findByPk.mockResolvedValue({ id: 5, status: 'available' });

    const res = await request(app)
      .patch('/api/reservations/1/cancel')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(reservation.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Balance en check-out
// ══════════════════════════════════════════════════════════════════════════════

describe('Cálculo de balance en check-out', () => {
  it('balance = 0 cuando el pago cubre exactamente el total', async () => {
    const reservation = mockReservation({
      status: 'checked_in',
      totalAmount: '300.00',
      payments: [{ amount: '300.00', paymentType: 'payment' }],
      extraCharges: [],
    });
    Reservation.findByPk
      .mockResolvedValueOnce(reservation)
      .mockResolvedValueOnce(reservation);
    Room.update.mockResolvedValue([1]);
    Guest.increment.mockResolvedValue([1]);

    const res = await request(app)
      .patch('/api/reservations/1/check-out')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
  });

  it('balance positivo cuando hay cargos extra sin pagar', async () => {
    const reservation = mockReservation({
      status: 'checked_in',
      totalAmount: '300.00',
      payments: [{ amount: '300.00', paymentType: 'payment' }],
      extraCharges: [{ amount: '50.00' }], // cargo extra no pagado
    });
    Reservation.findByPk
      .mockResolvedValueOnce(reservation)
      .mockResolvedValueOnce(reservation);
    Room.update.mockResolvedValue([1]);
    Guest.increment.mockResolvedValue([1]);

    const res = await request(app)
      .patch('/api/reservations/1/check-out')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(50); // debe $50
  });

  it('balance negativo cuando hay un reembolso aplicado', async () => {
    const reservation = mockReservation({
      status: 'checked_in',
      totalAmount: '300.00',
      payments: [
        { amount: '400.00', paymentType: 'payment' },
        { amount: '50.00', paymentType: 'refund' }, // descuenta del total pagado
      ],
      extraCharges: [],
    });
    Reservation.findByPk
      .mockResolvedValueOnce(reservation)
      .mockResolvedValueOnce(reservation);
    Room.update.mockResolvedValue([1]);
    Guest.increment.mockResolvedValue([1]);

    const res = await request(app)
      .patch('/api/reservations/1/check-out')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(-50); // el hotel debe $50 al huésped
  });
});
