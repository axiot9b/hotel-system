import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Plus, Search, X, CalendarDays, UserPlus, Loader2 } from 'lucide-react';

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700' },
  checked_in: { label: 'Hospedado', color: 'bg-green-100 text-green-700' },
  checked_out: { label: 'Salida', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'No show', color: 'bg-orange-100 text-orange-700' }
};

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut) - new Date(checkIn);
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal crear reserva
  const [showModal, setShowModal] = useState(false);
  const [guests, setGuests] = useState([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [form, setForm] = useState({
    guestId: '', roomId: '', checkInDate: '', checkOutDate: '',
    ratePerNight: '', adults: 1, children: 0, notes: '', source: 'direct',
    discountType: '', discountValue: '', discountReason: ''
  });
  const [seasonalRateName, setSeasonalRateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Crear huesped inline
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({
    firstName: '', lastName: '', idType: 'dni', idNumber: '', phone: '', email: ''
  });
  const [duplicateGuest, setDuplicateGuest] = useState(null);

  const guestSearchTimeout = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadReservations();
  }, [page, filterStatus, filterFrom, filterTo]);

  async function loadReservations() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterStatus) params.set('status', filterStatus);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const data = await api.get(`/reservations?${params}`);
      setReservations(data.reservations);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function openCreate() {
    setError('');
    setGuestSearch('');
    setGuests([]);
    setSelectedGuest(null);
    setShowNewGuest(false);
    setDuplicateGuest(null);
    setNewGuest({ firstName: '', lastName: '', idType: 'dni', idNumber: '', phone: '', email: '' });
    setForm({
      guestId: '', roomId: '', checkInDate: '', checkOutDate: '',
      ratePerNight: '', adults: 1, children: 0, notes: '', source: 'direct',
      discountType: '', discountValue: '', discountReason: ''
    });
    setSeasonalRateName('');
    try {
      const rData = await api.get('/rooms?status=available');
      setRooms(rData);
      setShowModal(true);
    } catch (err) {
      console.error(err);
    }
  }

  // Búsqueda de huéspedes en vivo con debounce (≥2 chars)
  const searchGuests = useCallback(async (q) => {
    if (q.length < 2) { setGuests([]); setGuestsLoading(false); return; }
    setGuestsLoading(true);
    try {
      const data = await api.get(`/guests?search=${encodeURIComponent(q)}&limit=10`);
      setGuests(data.guests);
    } catch {
      setGuests([]);
    } finally {
      setGuestsLoading(false);
    }
  }, []);

  function onGuestSearchChange(val) {
    setGuestSearch(val);
    setSelectedGuest(null);
    setForm(f => ({ ...f, guestId: '' }));
    clearTimeout(guestSearchTimeout.current);
    if (val.length < 2) { setGuests([]); return; }
    setGuestsLoading(true);
    guestSearchTimeout.current = setTimeout(() => searchGuests(val), 350);
  }

  function selectGuest(g) {
    setSelectedGuest(g);
    setForm(f => ({ ...f, guestId: String(g.id) }));
    setGuestSearch(`${g.lastName}, ${g.firstName}${g.idNumber ? ` (${g.idNumber})` : ''}`);
    setGuests([]);
  }

  async function handleCreateGuest(e) {
    e.preventDefault();
    setSavingGuest(true);
    setError('');
    setDuplicateGuest(null);
    try {
      const created = await api.post('/guests', newGuest);
      selectGuest(created);
      setShowNewGuest(false);
      setNewGuest({ firstName: '', lastName: '', idType: 'dni', idNumber: '', phone: '', email: '' });
    } catch (err) {
      if (err.status === 409 && err.data?.guest) {
        setDuplicateGuest(err.data.guest);
      } else {
        setError(err.message);
      }
    } finally {
      setSavingGuest(false);
    }
  }

  async function applySeasonalRate(roomId, checkInDate, rooms) {
    const room = rooms.find(r => r.id === parseInt(roomId));
    if (!room || !checkInDate) return room?.roomType?.basePrice || '';
    try {
      const res = await api.get(`/room-rates/for-date?roomTypeId=${room.roomTypeId}&date=${checkInDate}`);
      if (res.rate) {
        setSeasonalRateName(res.rate.name);
        return res.rate.ratePerNight;
      }
    } catch {}
    setSeasonalRateName('');
    return room?.roomType?.basePrice || '';
  }

  async function onRoomChange(roomId) {
    const room = rooms.find(r => r.id === parseInt(roomId));
    const rate = await applySeasonalRate(roomId, form.checkInDate, rooms);
    setForm(f => ({ ...f, roomId, ratePerNight: rate }));
  }

  async function onCheckInDateChange(date) {
    setForm(f => ({ ...f, checkInDate: date, checkOutDate: '' }));
    if (form.roomId && date) {
      const rate = await applySeasonalRate(form.roomId, date, rooms);
      setForm(f => ({ ...f, checkInDate: date, checkOutDate: '', ratePerNight: rate }));
    }
  }

  // Min date para checkOutDate = checkInDate + 1 día
  const minCheckOut = useMemo(() => {
    if (!form.checkInDate) return '';
    const d = new Date(form.checkInDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, [form.checkInDate]);

  const today = new Date().toISOString().split('T')[0];

  // Calculo automatico con descuento
  const nights = calcNights(form.checkInDate, form.checkOutDate);
  const baseTotal = nights * (parseFloat(form.ratePerNight) || 0);
  const discountAmt = form.discountType === 'percent'
    ? baseTotal * (parseFloat(form.discountValue) || 0) / 100
    : form.discountType === 'amount'
    ? (parseFloat(form.discountValue) || 0)
    : 0;
  const estimatedTotal = Math.max(0, baseTotal - discountAmt);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.guestId) {
      setError('Selecciona o registra un huésped antes de continuar');
      return;
    }
    if (nights <= 0) {
      setError('La fecha de salida debe ser posterior a la entrada');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/reservations', {
        ...form,
        guestId:       parseInt(form.guestId),
        roomId:        parseInt(form.roomId),
        ratePerNight:  parseFloat(form.ratePerNight),
        adults:        parseInt(form.adults),
        children:      parseInt(form.children),
        source:        form.source || 'direct',
        discountType:  form.discountType || null,
        discountValue: parseFloat(form.discountValue) || 0,
        discountReason: form.discountReason || null
      });
      setShowModal(false);
      navigate(`/reservations/${res.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setFilterStatus('');
    setFilterFrom('');
    setFilterTo('');
    setPage(1);
  }

  const hasFilters = filterStatus || filterFrom || filterTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reservaciones</h2>
          <p className="text-gray-500 text-sm mt-1">{total} reservaciones</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nueva Reserva
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => { setFilterStatus(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!filterStatus ? 'bg-hotel-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          Todas
        </button>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => { setFilterStatus(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterStatus === key ? 'bg-hotel-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Filtros por fecha */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Desde:</span>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Hasta:</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-red-500 hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No hay reservaciones{hasFilters ? ' con estos filtros' : ''}</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-hotel-600 text-sm mt-2 hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Huesped</th>
                  <th className="px-4 py-3 font-medium">Habitacion</th>
                  <th className="px-4 py-3 font-medium">Entrada</th>
                  <th className="px-4 py-3 font-medium">Salida</th>
                  <th className="px-4 py-3 font-medium">Noches</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pagado</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map(r => {
                  const paid = r.payments?.reduce((s, p) =>
                    p.paymentType === 'refund' ? s - parseFloat(p.amount) : s + parseFloat(p.amount), 0) || 0;
                  const totalWithExtras = parseFloat(r.totalAmount) +
                    (r.extraCharges?.reduce((s, c) => s + parseFloat(c.amount), 0) || 0);
                  const balance = totalWithExtras - paid;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/reservations/${r.id}`)}
                    >
                      <td className="px-4 py-3 text-gray-400">{r.id}</td>
                      <td className="px-4 py-3 font-medium">
                        {r.guest?.firstName} {r.guest?.lastName}
                      </td>
                      <td className="px-4 py-3">
                        {r.room?.roomNumber}
                        <span className="text-gray-400 ml-1 text-xs">({r.room?.roomType?.name})</span>
                      </td>
                      <td className="px-4 py-3">{r.checkInDate}</td>
                      <td className="px-4 py-3">{r.checkOutDate}</td>
                      <td className="px-4 py-3 text-center">{r.nights}</td>
                      <td className="px-4 py-3 font-medium">${parseFloat(r.totalAmount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          ${paid.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[r.status]?.color}`}>
                          {statusConfig[r.status]?.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginacion */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Pagina {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal nueva reserva */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Nueva Reservacion</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>
              )}

              {/* Huesped con busqueda en vivo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Huesped</label>
                  <button
                    type="button"
                    onClick={() => { setShowNewGuest(!showNewGuest); setDuplicateGuest(null); setError(''); }}
                    className="flex items-center gap-1 text-xs text-hotel-600 hover:text-hotel-800 font-medium"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {showNewGuest ? 'Seleccionar existente' : 'Nuevo huesped'}
                  </button>
                </div>

                {showNewGuest ? (
                  <form onSubmit={handleCreateGuest} className="border rounded-lg p-3 space-y-2 bg-hotel-50/50">
                    {/* Alerta de duplicado */}
                    {duplicateGuest && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        <p className="font-medium mb-1">Ya existe un huésped con ese documento:</p>
                        <p>{duplicateGuest.lastName}, {duplicateGuest.firstName} {duplicateGuest.phone ? `· ${duplicateGuest.phone}` : ''}</p>
                        <button
                          type="button"
                          onClick={() => { selectGuest(duplicateGuest); setShowNewGuest(false); setDuplicateGuest(null); }}
                          className="mt-1.5 text-hotel-600 underline font-medium"
                        >
                          Usar este huésped
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newGuest.firstName}
                        onChange={e => setNewGuest({ ...newGuest, firstName: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Nombre *"
                        required
                      />
                      <input
                        type="text"
                        value={newGuest.lastName}
                        onChange={e => setNewGuest({ ...newGuest, lastName: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Apellido *"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newGuest.idType}
                        onChange={e => setNewGuest({ ...newGuest, idType: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                      >
                        <option value="dni">DNI</option>
                        <option value="passport">Pasaporte</option>
                        <option value="license">Licencia</option>
                        <option value="other">Otro</option>
                      </select>
                      <input
                        type="text"
                        value={newGuest.idNumber}
                        onChange={e => { setNewGuest({ ...newGuest, idNumber: e.target.value }); setDuplicateGuest(null); }}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Nro. documento"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="tel"
                        value={newGuest.phone}
                        onChange={e => setNewGuest({ ...newGuest, phone: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Telefono"
                      />
                      <input
                        type="email"
                        value={newGuest.email}
                        onChange={e => setNewGuest({ ...newGuest, email: e.target.value })}
                        className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Email"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingGuest || !newGuest.firstName || !newGuest.lastName}
                      className="w-full bg-hotel-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50 transition"
                    >
                      {savingGuest ? 'Registrando...' : 'Registrar huesped y continuar'}
                    </button>
                  </form>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      {guestsLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />
                      )}
                      <input
                        type="text"
                        value={guestSearch}
                        onChange={e => onGuestSearchChange(e.target.value)}
                        className="w-full border rounded-lg pl-9 pr-9 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                        placeholder="Buscar por nombre, documento o teléfono..."
                        autoComplete="off"
                      />
                    </div>
                    {/* Dropdown de resultados */}
                    {guests.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
                        {guests.map(g => (
                          <li key={g.id}>
                            <button
                              type="button"
                              onClick={() => selectGuest(g)}
                              className="w-full text-left px-3 py-2 hover:bg-hotel-50 transition"
                            >
                              <span className="font-medium">{g.lastName}, {g.firstName}</span>
                              {g.idNumber && <span className="text-gray-400 ml-2 text-xs">{g.idNumber}</span>}
                              {g.phone && <span className="text-gray-400 ml-2 text-xs">{g.phone}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Sin resultados */}
                    {!guestsLoading && guestSearch.length >= 2 && guests.length === 0 && !selectedGuest && (
                      <p className="text-xs text-amber-600 mt-1">
                        No se encontró "{guestSearch}".{' '}
                        <button
                          type="button"
                          onClick={() => {
                            const parts = guestSearch.trim().split(' ');
                            setNewGuest(prev => ({ ...prev, firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' }));
                            setShowNewGuest(true);
                          }}
                          className="text-hotel-600 underline font-medium"
                        >
                          Crear nuevo huésped
                        </button>
                      </p>
                    )}
                    {/* Indicador: huésped seleccionado */}
                    {selectedGuest && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        ✓ {selectedGuest.firstName} {selectedGuest.lastName} seleccionado
                      </p>
                    )}
                    {/* Input oculto para requerir que se haya seleccionado un huésped */}
                    <input type="hidden" value={form.guestId} required />
                  </div>
                )}
              </div>

              {/* Habitacion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habitacion disponible</label>
                <select
                  value={form.roomId}
                  onChange={e => onRoomChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                >
                  <option value="">Seleccionar habitacion...</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      #{r.roomNumber} - {r.roomType?.name} — ${parseFloat(r.roomType?.basePrice).toLocaleString()}/noche (Piso {r.floor})
                    </option>
                  ))}
                </select>
                {rooms.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No hay habitaciones disponibles en este momento.</p>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha entrada</label>
                  <input
                    type="date"
                    value={form.checkInDate}
                    min={today}
                    onChange={e => onCheckInDateChange(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha salida</label>
                  <input
                    type="date"
                    value={form.checkOutDate}
                    min={minCheckOut || today}
                    onChange={e => setForm({ ...form, checkOutDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    disabled={!form.checkInDate}
                    required
                  />
                </div>
              </div>

              {/* Resumen automatico */}
              {nights > 0 && form.ratePerNight && (
                <div className="bg-hotel-50 rounded-lg p-3 text-sm space-y-1">
                  {seasonalRateName && (
                    <div className="flex items-center gap-1.5 text-xs text-hotel-700 font-medium mb-1">
                      <span className="bg-hotel-100 px-2 py-0.5 rounded-full">⭐ Tarifa temporada: {seasonalRateName}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>{nights} noches × ${parseFloat(form.ratePerNight).toLocaleString()}</span>
                    <span>${baseTotal.toLocaleString()}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Descuento {form.discountType === 'percent' ? `(${form.discountValue}%)` : 'fijo'}</span>
                      <span>-${discountAmt.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-hotel-800 border-t border-hotel-100 pt-1">
                    <span>Total</span>
                    <span>${estimatedTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Tarifa y personas */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa/noche</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.ratePerNight}
                    onChange={e => setForm({ ...form, ratePerNight: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adultos</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.adults}
                    onChange={e => setForm({ ...form, adults: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ninos</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.children}
                    onChange={e => setForm({ ...form, children: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  />
                </div>
              </div>

              {/* Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento <span className="text-gray-400 font-normal">(opcional)</span></label>
                <div className="flex gap-2">
                  <select
                    value={form.discountType}
                    onChange={e => setForm({ ...form, discountType: e.target.value, discountValue: '' })}
                    className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none w-36"
                  >
                    <option value="">Sin descuento</option>
                    <option value="percent">Porcentaje (%)</option>
                    <option value="amount">Monto fijo ($)</option>
                  </select>
                  {form.discountType && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={form.discountType === 'percent' ? 'ej: 10' : 'ej: 500'}
                      value={form.discountValue}
                      onChange={e => setForm({ ...form, discountValue: e.target.value })}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    />
                  )}
                </div>
                {form.discountType && (
                  <input
                    type="text"
                    placeholder="Motivo del descuento..."
                    value={form.discountReason}
                    onChange={e => setForm({ ...form, discountReason: e.target.value })}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  />
                )}
              </div>

              {/* Canal de origen + Notas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Canal de origen</label>
                  <select
                    value={form.source}
                    onChange={e => setForm({ ...form, source: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  >
                    <option value="direct">Directo</option>
                    <option value="phone">Teléfono</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="booking">Booking.com</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="expedia">Expedia</option>
                    <option value="agency">Agencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    rows={2}
                    placeholder="Peticiones especiales..."
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border rounded-lg py-2.5 text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-hotel-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Creando...' : `Crear Reserva${estimatedTotal > 0 ? ` — $${estimatedTotal.toLocaleString()}` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
