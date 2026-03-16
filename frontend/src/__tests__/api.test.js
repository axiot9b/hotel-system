import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../services/api';

describe('api service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
    // Prevent jsdom navigation error
    delete window.location;
    window.location = { href: '' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends GET with Content-Type json header', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rooms: [] }),
    });

    await api.get('/rooms');

    expect(fetch).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('includes Authorization header when token exists in localStorage', async () => {
    localStorage.setItem('token', 'mi-token-secreto');
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await api.get('/rooms');

    expect(fetch).toHaveBeenCalledWith(
      '/api/rooms',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mi-token-secreto' }),
      })
    );
  });

  it('does NOT include Authorization header when no token', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await api.get('/rooms');

    const callArgs = fetch.mock.calls[0][1];
    expect(callArgs.headers).not.toHaveProperty('Authorization');
  });

  it('sends POST with body as JSON', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 1 }),
    });

    await api.post('/auth/login', { username: 'admin', password: 'admin123' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      })
    );
  });

  it('sends PATCH with method and body', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await api.patch('/rooms/1/status', { status: 'cleaning' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/rooms/1/status',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('sends DELETE request', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await api.delete('/reservations/1');

    expect(fetch).toHaveBeenCalledWith(
      '/api/reservations/1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('throws with error message on non-ok response', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Datos inválidos' }),
    });

    await expect(api.post('/rooms', {})).rejects.toThrow('Datos inválidos');
  });

  it('on 401 clears token from localStorage and throws', async () => {
    localStorage.setItem('token', 'token-expirado');
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    await expect(api.get('/rooms')).rejects.toThrow('Sesión expirada');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
