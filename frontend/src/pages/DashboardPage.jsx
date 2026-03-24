import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BedDouble, Users, CalendarDays, DollarSign,
  TrendingUp, ArrowRight, LogIn, LogOut, Phone, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function TodayList({ title, icon: Icon, iconColor, items, emptyMsg, actionLabel, actionColor, onAction, navigate }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-1.5 rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto text-sm font-bold text-gray-700">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {items.map(r => (
            <div key={r.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition"
              onClick={() => navigate(`/reservations/${r.id}`)}
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                {r.guest?.firstName?.charAt(0)}{r.guest?.lastName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {r.guest?.firstName} {r.guest?.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  Hab. {r.room?.roomNumber}
                  {r.room?.roomType?.name ? ` · ${r.room.roomType.name}` : ''}
                </p>
              </div>
              {r.guest?.phone && (
                <a href={`tel:${r.guest.phone}`} onClick={e => e.stopPropagation()}
                  className="text-gray-400 hover:text-hotel-600 p-1 rounded flex-shrink-0">
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={e => { e.stopPropagation(); onAction(r); }}
                className={`text-xs text-white px-2.5 py-1 rounded-lg font-medium transition flex-shrink-0 ${actionColor}`}
              >
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtitle }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700'
};

const SOURCE_CONFIG = {
  direct:      { label: 'Directo',       color: '#16a34a' },
  booking:     { label: 'Booking.com',   color: '#1d4ed8' },
  airbnb:      { label: 'Airbnb',        color: '#e11d48' },
  expedia:     { label: 'Expedia',       color: '#d97706' },
  trivago:     { label: 'Trivago',       color: '#7c3aed' },
  hotelscom:   { label: 'Hotels.com',    color: '#dc2626' },
  despegar:    { label: 'Despegar',      color: '#0891b2' },
  tripadvisor: { label: 'TripAdvisor',   color: '#059669' },
  agency:      { label: 'Agencia',       color: '#9333ea' },
  phone:       { label: 'Teléfono',      color: '#ea580c' },
  walk_in:     { label: 'Walk-in',       color: '#0d9488' },
  other:       { label: 'Otro',          color: '#6b7280' },
};

function SourceChart({ stats }) {
  if (!stats || stats.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Sin datos de los últimos 90 días</p>;
  }
  const total = stats.reduce((s, r) => s + parseInt(r.count), 0);
  return (
    <div className="space-y-2.5">
      {stats.map(row => {
        const cfg = SOURCE_CONFIG[row.source] || SOURCE_CONFIG.other;
        const pct = total > 0 ? Math.round((parseInt(row.count) / total) * 100) : 0;
        return (
          <div key={row.source} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs text-gray-600 truncate">{cfg.label}</span>
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: cfg.color }}
              >
                {pct >= 12 && <span className="text-[10px] font-bold text-white">{pct}%</span>}
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{row.count}</span>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 pt-1">Total: {total} reservaciones · últimos 90 días</p>
    </div>
  );
}

const statusLabels = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  checked_in: 'Hospedado',
  checked_out: 'Salió',
  cancelled: 'Cancelada'
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Cargando dashboard...</div>;
  }

  if (!data) {
    return <div className="text-red-500">Error al cargar datos</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Vista general del hotel en tiempo real</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Ocupación"
          value={`${data.rooms.occupancyRate}%`}
          color="bg-hotel-600"
          subtitle={`${data.rooms.byStatus?.occupied || 0} de ${data.rooms.total} habitaciones`}
        />
        <StatCard
          icon={DollarSign}
          label="Ingresos hoy"
          value={`$${data.today.income.toLocaleString()}`}
          color="bg-emerald-500"
        />
        <StatCard
          icon={CalendarDays}
          label="Check-ins hoy"
          value={data.today.checkIns}
          color="bg-amber-500"
          subtitle={`${data.today.checkOuts} check-outs`}
        />
        <StatCard
          icon={Users}
          label="Huéspedes activos"
          value={data.activeGuests}
          color="bg-purple-500"
          subtitle={`${data.upcomingReservations} reservas próximas`}
        />
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">ADR — Tarifa diaria promedio</p>
              <p className="text-2xl font-bold mt-1">${(data.kpis?.adr || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-400 mt-1">Ingreso / noches vendidas (mes actual)</p>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">RevPAR — Ingreso por habitación disponible</p>
              <p className="text-2xl font-bold mt-1">${(data.kpis?.revpar || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-400 mt-1">Ingreso / (habitaciones × días, mes actual)</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Room status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Estado de Habitaciones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'available', label: 'Disponibles', color: 'bg-green-500' },
            { key: 'occupied', label: 'Ocupadas', color: 'bg-red-500' },
            { key: 'reserved', label: 'Reservadas', color: 'bg-blue-500' },
            { key: 'cleaning', label: 'Limpieza', color: 'bg-yellow-500' },
            { key: 'maintenance', label: 'Mantenimiento', color: 'bg-gray-500' }
          ].map(item => (
            <div key={item.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <div>
                <p className="text-lg font-bold">{data.rooms.byStatus?.[item.key] || 0}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Today: Arrivals + Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TodayList
          title="Llegadas de hoy"
          icon={LogIn}
          iconColor="bg-amber-500"
          items={data.todayArrivals || []}
          emptyMsg="No hay llegadas hoy"
          actionLabel="Check-in"
          actionColor="bg-hotel-600 hover:bg-hotel-700"
          onAction={r => navigate(`/reservations/${r.id}`)}
          navigate={navigate}
        />
        <TodayList
          title="Salidas de hoy"
          icon={LogOut}
          iconColor="bg-purple-500"
          items={data.todayDepartures || []}
          emptyMsg="No hay salidas hoy"
          actionLabel="Check-out"
          actionColor="bg-purple-600 hover:bg-purple-700"
          onAction={r => navigate(`/reservations/${r.id}`)}
          navigate={navigate}
        />
      </div>

      {/* Source distribution chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Canal de Origen de Reservaciones</h3>
        <SourceChart stats={data.sourceStats} />
      </div>

      {/* Recent reservations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Reservaciones Recientes</h3>
          <button
            onClick={() => navigate('/reservations')}
            className="text-hotel-600 text-sm hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {data.recentReservations.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay reservaciones recientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Huésped</th>
                  <th className="pb-2 font-medium">Habitación</th>
                  <th className="pb-2 font-medium">Entrada</th>
                  <th className="pb-2 font-medium">Salida</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentReservations.map(r => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/reservations/${r.id}`)}
                  >
                    <td className="py-2.5 font-medium">
                      {r.guest?.firstName} {r.guest?.lastName}
                    </td>
                    <td className="py-2.5">
                      {r.room?.roomNumber}
                      <span className="text-gray-400 ml-1">({r.room?.roomType?.name})</span>
                    </td>
                    <td className="py-2.5">{r.checkInDate}</td>
                    <td className="py-2.5">{r.checkOutDate}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                        {statusLabels[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
