const request = require('supertest');
const bcrypt = require('bcryptjs');

// Mock models before requiring app
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
const { User } = require('../models');

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'admin123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when user does not exist', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'noexiste', password: 'password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  it('returns 401 when password is wrong', async () => {
    const hash = await bcrypt.hash('correctpassword', 10);
    User.findOne.mockResolvedValue({
      id: 1, username: 'admin', role: 'admin',
      passwordHash: hash,
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  it('returns token and user data on valid credentials', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    User.findOne.mockResolvedValue({
      id: 1,
      username: 'admin',
      fullName: 'Administrador',
      email: 'admin@hotel.com',
      role: 'admin',
      passwordHash: hash,
      lastLogin: null,
      save: jest.fn(),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      username: 'admin',
      role: 'admin',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(res.status).toBe(401);
  });

  it('returns user data with valid token', async () => {
    const token = generateToken({ id: 1, username: 'admin', role: 'admin' });
    User.findByPk.mockResolvedValue({
      id: 1, username: 'admin', fullName: 'Administrador',
      email: 'admin@hotel.com', role: 'admin',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');
  });

  it('returns 404 when token is valid but user not found', async () => {
    const token = generateToken({ id: 99, username: 'ghost', role: 'admin' });
    User.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
