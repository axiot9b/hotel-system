import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ArrowLeft, User, Star, Phone, Mail, MapPin, FileText } from 'lucide-react';

const statusConfig = {
  pending:     { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { label: 'Confirmada', color: 'bg-blue-100 text-blue-700' },
  checked_in:  { label: 'Hospedado',  color: 'bg-green-100 text-green-700' },
  checked_out: { label: 'Check-out',  color: 'bg-gray-100 text-gray-600' },
  cancelled:   { label: 'Cancelada',  color: 'bg-red-100 text-red-700' },
  no_show:     { label: 'No show',    color: 'bg-orange-100 text-orange-700' }
};

const idTypeLabels = { dni: 'DNI', passport: 'Pasaporte', license: 'Licencia', other: 'Otro' };

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function GuestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/guests/${id}`)
      .then(setGuest)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>;
  if (!guest)  return <div className="text-red-500">Huésped no encontrado</div>;

  const { stats, recentReservations } = guest;
  const fmt = (n) => Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/guests')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
        <ArrowLeft className="h-4 w-4" /> Volver a huéspedes
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-hotel-100 rounded-full flex items-center justify-center text-hotel-700 text-xl font-bold flex-shrink-0">
            {guest.firstName?.charAt(0)}{guest.lastName?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">{guest.firstName} {guest.lastName}</h2>
              {guest.isFrequent && (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  <Star className="h-3 w-3 fill-amber-500" /> Huésped frecuente
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
              {guest.idNumber && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {idTypeLabels[guest.idType] || guest.idType}: {guest.idNumber}
                </span>
              )}
              {guest.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {guest.phone}
                </span>
              )}
              {guest.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {guest.email}
                </span>
              )}
              {(guest.country || guest.city) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[guest.city, guest.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            {guest.notes && (
              <p className="mt-2 text-sm text-gray-400 italic">"{guest.notes}"</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Estadías" value={stats.totalStays} sub="reservaciones completadas" />
        <StatCard label="Noches totales" value={stats.totalNights} sub={`Prom. ${stats.avgNights} noches`} />
        <StatCard label="LTV" value={`$${fmt(stats.ltv)}`} sub="valor de vida del cliente" />
        <StatCard
          label="Tipo"
          value={guest.isFrequent ? 'Frecuente' : stats.totalStays >= 3 ? 'Recurrente' : 'Nuevo'}
          sub={stats.totalStays >= 3 ? 'Cliente leal' : ''}
        />
      </div>

      {/* Recent reservations */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Historial de reservaciones</h3>
        {recentReservations.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin reservaciones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">ID</th>
                  <th className="pb-2 font-medium">Habitación</th>
                  <th className="pb-2 font-medium">Entrada</th>
                  <th className="pb-2 font-medium">Salida</th>
                  <th className="pb-2 font-medium">Noches</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentReservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2.5 text-gray-400">#{r.id}</td>
                    <td className="py-2.5 font-medium">
                      {r.room ? `#${r.room.roomNumber}` : '—'}
                    </td>
                    <td className="py-2.5 text-gray-600">{r.checkInDate}</td>
                    <td className="py-2.5 text-gray-600">{r.checkOutDate}</td>
                    <td className="py-2.5 text-gray-600">{r.nights}</td>
                    <td className="py-2.5 font-medium">${parseFloat(r.totalAmount).toLocaleString()}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[r.status]?.color}`}>
                        {statusConfig[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => navigate(`/reservations/${r.id}`)}
                        className="flex items-center gap-1 text-hotel-600 hover:underline text-xs"
                      >
                        <FileText className="h-3.5 w-3.5" /> Ver
                      </button>
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
