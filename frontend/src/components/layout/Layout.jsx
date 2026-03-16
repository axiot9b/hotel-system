import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import {
  LayoutDashboard, BedDouble, Users, CalendarDays,
  LogOut, Building2, Menu, Sparkles, Settings,
  ShieldCheck, Banknote, TrendingUp, Calendar, Wrench, Tag
} from 'lucide-react';
import GlobalSearch from '../GlobalSearch';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard',      path: '/',             icon: LayoutDashboard, roles: null,                          badge: null },
  { name: 'Habitaciones',   path: '/rooms',         icon: BedDouble,       roles: null,                          badge: null },
  { name: 'Huéspedes',      path: '/guests',        icon: Users,           roles: null,                          badge: null },
  { name: 'Reservaciones',  path: '/reservations',  icon: CalendarDays,    roles: null,                          badge: 'reservations' },
  { name: 'Calendario',     path: '/calendar',      icon: Calendar,        roles: null,                          badge: null },
  { name: 'Housekeeping',   path: '/housekeeping',  icon: Sparkles,        roles: null,                          badge: 'housekeeping' },
  // ── Finanzas ──
  { name: 'Caja Diaria',    path: '/daily-cash',    icon: Banknote,        roles: ['admin', 'manager', 'accounting'], badge: null },
  { name: 'Finanzas',       path: '/finance',       icon: TrendingUp,      roles: ['admin', 'manager', 'accounting'], badge: null },
  // ── Config ──
  { name: 'Mantenimiento', path: '/maintenance',   icon: Wrench,          roles: null,                          badge: null },
  { name: 'Tarifas',        path: '/rates',         icon: Tag,             roles: ['admin', 'manager'],           badge: null },
  { name: 'Tipos de hab.',  path: '/room-types',    icon: Settings,        roles: ['admin', 'manager'],           badge: null },
  { name: 'Usuarios',       path: '/users',         icon: Users,           roles: ['admin'],                     badge: null },
  { name: 'Auditoría',      path: '/audit',         icon: ShieldCheck,     roles: ['admin', 'manager'],           badge: null },
];

// Which path groups act as dividers
const DIVIDERS_BEFORE = new Set(['/daily-cash', '/maintenance']);

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notifs = useNotifications();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const roleLabels = {
    admin: 'Administrador',
    manager: 'Gerente',
    receptionist: 'Recepcionista',
    accounting: 'Contabilidad',
    housekeeping: 'Limpieza'
  };

  const visibleNav = navigation.filter(item =>
    !item.roles || (user?.role && item.roles.includes(user.role))
  );

  function getBadgeCount(badgeKey) {
    if (!badgeKey) return 0;
    if (badgeKey === 'reservations') return notifs.checkInsToday + notifs.checkOutsToday;
    if (badgeKey === 'housekeeping') return notifs.pendingTasks;
    return 0;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-hotel-900 text-white flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-hotel-700">
          <Building2 className="h-7 w-7 text-hotel-300" />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">Hotel System</h1>
            <p className="text-hotel-400 text-xs">Gestión Hotelera</p>
          </div>
          {/* Global alert dot */}
          {notifs.totalAlerts > 0 && (
            <span className="w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
              {notifs.totalAlerts > 9 ? '9+' : notifs.totalAlerts}
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const badgeCount = getBadgeCount(item.badge);
            return (
              <div key={item.path}>
                {DIVIDERS_BEFORE.has(item.path) && (
                  <div className="border-t border-hotel-700 my-2" />
                )}
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                    ${isActive
                      ? 'bg-hotel-700 text-white'
                      : 'text-hotel-300 hover:bg-hotel-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  <Badge count={badgeCount} />
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Cash status indicator */}
        {['admin', 'manager', 'accounting'].includes(user?.role) && (
          <div className={`mx-3 mb-2 px-3 py-2 rounded-lg text-xs ${
            notifs.cashOpen ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
          }`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${notifs.cashOpen ? 'bg-green-400' : 'bg-red-400'}`} />
            Caja: {notifs.cashOpen ? 'Abierta' : 'Cerrada'}
          </div>
        )}

        <div className="px-4 py-4 border-t border-hotel-700">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-hotel-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName}</p>
              <p className="text-xs text-hotel-400">{roleLabels[user?.role] || user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-hotel-300 hover:text-white hover:bg-hotel-800 rounded-lg transition"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 relative lg:hidden">
            <Menu className="h-6 w-6" />
            {notifs.totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                {notifs.totalAlerts > 9 ? '9+' : notifs.totalAlerts}
              </span>
            )}
          </button>
          <h1 className="font-semibold text-gray-900 lg:hidden">Hotel System</h1>
          <div className="flex-1" />
          <GlobalSearch />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
