import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '../services/api';

function TestConsumer() {
  const { user, login, logout, loading } = useAuth();
  return (
    <div>
      {loading && <span data-testid="loading">Cargando</span>}
      {user
        ? <span data-testid="user">{user.username}</span>
        : <span data-testid="no-user">Sin sesión</span>
      }
      <button onClick={() => login('admin', 'admin123')}>Entrar</button>
      <button onClick={logout}>Salir</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts without a user when localStorage is empty', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByTestId('no-user')).toBeInTheDocument();
  });

  it('restores session from localStorage on mount', async () => {
    const savedUser = { id: 1, username: 'admin', role: 'admin' };
    localStorage.setItem('token', 'token-guardado');
    localStorage.setItem('user', JSON.stringify(savedUser));
    api.get.mockResolvedValue(savedUser);

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByTestId('user')).toHaveTextContent('admin');
  });

  it('logs out when /auth/me returns error on mount', async () => {
    localStorage.setItem('token', 'token-invalido');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'admin' }));
    api.get.mockRejectedValue(new Error('Token inválido'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sets user and saves token on successful login', async () => {
    api.get.mockResolvedValue(null); // no hay sesión previa
    api.post.mockResolvedValue({
      token: 'nuevo-token',
      user: { id: 1, username: 'admin', role: 'admin' },
    });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    await userEvent.click(screen.getByText('Entrar'));

    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent('admin')
    );
    expect(localStorage.getItem('token')).toBe('nuevo-token');
    expect(api.post).toHaveBeenCalledWith('/auth/login', { username: 'admin', password: 'admin123' });
  });

  it('clears user and localStorage on logout', async () => {
    const savedUser = { id: 1, username: 'admin', role: 'admin' };
    localStorage.setItem('token', 'token-activo');
    localStorage.setItem('user', JSON.stringify(savedUser));
    api.get.mockResolvedValue(savedUser);

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

    await userEvent.click(screen.getByText('Salir'));

    expect(screen.getByTestId('no-user')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress expected error output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth debe usarse dentro de AuthProvider'
    );

    spy.mockRestore();
  });
});
