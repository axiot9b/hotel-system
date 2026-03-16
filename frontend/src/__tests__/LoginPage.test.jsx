import { describe, it, expect, vi, beforeEach, act } from 'vitest';
import { render, screen, waitFor, act as rtlAct } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the login form', () => {
    renderLogin();

    expect(screen.getByPlaceholderText('Ingrese su usuario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ingrese su contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  it('shows hotel system heading', () => {
    renderLogin();

    expect(screen.getByText('Hotel System')).toBeInTheDocument();
  });

  it('navigates to / on successful login', async () => {
    mockLogin.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' });
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('Ingrese su usuario'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Ingrese su contraseña'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('Ingrese su usuario'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Ingrese su contraseña'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() =>
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
    );
  });

  it('shows generic error when login throws without message', async () => {
    mockLogin.mockRejectedValue({});
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('Ingrese su usuario'), 'x');
    await userEvent.type(screen.getByPlaceholderText('Ingrese su contraseña'), 'y');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() =>
      expect(screen.getByText('Error al iniciar sesión')).toBeInTheDocument()
    );
  });

  it('disables button while loading', async () => {
    let resolve;
    mockLogin.mockReturnValue(new Promise(r => { resolve = r; }));
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('Ingrese su usuario'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Ingrese su contraseña'), 'admin123');

    const button = screen.getByRole('button', { name: 'Iniciar Sesión' });
    await userEvent.click(button);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ingresando...' })).toBeDisabled()
    );

    await rtlAct(async () => {
      resolve({ id: 1 });
    });
  });
});
