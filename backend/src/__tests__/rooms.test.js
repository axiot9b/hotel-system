const request = require('supertest');

jest.mock('../models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
  Guest: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
  Room: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
  RoomType: { findAll: jest.fn(), findByPk: jest.fn() },
  Reservation: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
  Payment: { findAll: jest.fn(), sum: jest.fn() },
  ExtraCharge: { findAll: jest.fn() },
  HousekeepingTask: { findAll: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { authenticate: jest.fn(), sync: jest.fn(), query: jest.fn() },
}));

const app = require('../app');
const { generateToken } = require('../config/auth');
const { Room } = require('../models');

const adminToken = generateToken({ id: 1, username: 'admin', role: 'admin' });
const managerToken = generateToken({ id: 2, username: 'manager', role: 'manager' });
const receptionToken = generateToken({ id: 3, username: 'recepcion', role: 'receptionist' });

const mockRoom = (overrides = {}) => ({
  id: 1,
  roomNumber: '101',
  floor: 1,
  status: 'available',
  isActive: true,
  roomTypeId: 1,
  update: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/rooms', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(401);
  });

  it('returns list of rooms', async () => {
    Room.findAll.mockResolvedValue([
      { id: 1, roomNumber: '101', status: 'available' },
      { id: 2, roomNumber: '102', status: 'occupied' },
    ]);

    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].roomNumber).toBe('101');
  });

  it('passes status filter to query', async () => {
    Room.findAll.mockResolvedValue([]);

    await request(app)
      .get('/api/rooms?status=available')
      .set('Authorization', `Bearer ${receptionToken}`);

    expect(Room.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'available' }),
      })
    );
  });
});

describe('GET /api/rooms/:id', () => {
  it('returns 404 for nonexistent room', async () => {
    Room.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/rooms/999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Habitación no encontrada');
  });

  it('returns room data', async () => {
    Room.findByPk.mockResolvedValue({ id: 1, roomNumber: '101', status: 'available' });

    const res = await request(app)
      .get('/api/rooms/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.roomNumber).toBe('101');
  });
});

describe('POST /api/rooms', () => {
  it('returns 403 for receptionist role', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ roomNumber: '201', roomTypeId: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when roomNumber is missing', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomTypeId: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when roomTypeId is not an integer', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomNumber: '201', roomTypeId: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('creates a room as admin', async () => {
    const created = { id: 5, roomNumber: '201', roomTypeId: 1, status: 'available' };
    Room.create.mockResolvedValue(created);
    Room.findByPk.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomNumber: '201', roomTypeId: 1, floor: 2 });

    expect(res.status).toBe(201);
    expect(res.body.roomNumber).toBe('201');
  });

  it('creates a room as manager', async () => {
    const created = { id: 6, roomNumber: '202', roomTypeId: 2, status: 'available' };
    Room.create.mockResolvedValue(created);
    Room.findByPk.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ roomNumber: '202', roomTypeId: 2 });

    expect(res.status).toBe(201);
  });

  it('returns 400 on duplicate room number', async () => {
    const err = new Error('unique constraint');
    err.name = 'SequelizeUniqueConstraintError';
    Room.create.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roomNumber: '101', roomTypeId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya existe/i);
  });
});

describe('PATCH /api/rooms/:id/status', () => {
  it('returns 404 for nonexistent room', async () => {
    Room.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/rooms/999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cleaning' });

    expect(res.status).toBe(404);
  });

  it('updates room status', async () => {
    const room = mockRoom();
    Room.findByPk.mockResolvedValue(room);

    const res = await request(app)
      .patch('/api/rooms/1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cleaning' });

    expect(res.status).toBe(200);
    expect(room.update).toHaveBeenCalledWith({ status: 'cleaning' });
  });

  it('accepts all valid status values', async () => {
    const statuses = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'];

    for (const status of statuses) {
      const room = mockRoom();
      Room.findByPk.mockResolvedValue(room);

      const res = await request(app)
        .patch('/api/rooms/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });

      expect(res.status).toBe(200);
    }
  });
});
