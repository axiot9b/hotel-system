import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BedDouble, Plus, X, Edit2 } from 'lucide-react';

const statusConfig = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  occupied: { label: 'Ocupada', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  reserved: { label: 'Reservada', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  cleaning: { label: 'Limpieza', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  maintenance: { label: 'Mantenimiento', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-500' }
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [form, setForm] = useState({ roomNumber: '', roomTypeId: '', floor: 1, features: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function loadData() {
    setLoading(true);
    try {
      const [roomsData, typesData] = await Promise.all([
        api.get(`/rooms${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/room-types')
      ]);
      setRooms(roomsData);
      setRoomTypes(typesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditRoom(null);
    setForm({ roomNumber: '', roomTypeId: roomTypes[0]?.id || '', floor: 1, features: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(room) {
    setEditRoom(room);
    setForm({
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      floor: room.floor,
      features: room.features || ''
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editRoom) {
        await api.put(`/rooms/${editRoom.id}`, form);
      } else {
        await api.post('/rooms', { ...form, roomTypeId: parseInt(form.roomTypeId), floor: parseInt(form.floor) });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(roomId, status) {
    try {
      await api.patch(`/rooms/${roomId}/status`, { status });
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Habitaciones</h2>
          <p className="text-gray-500 text-sm mt-1">{rooms.length} habitaciones</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nueva Habitación
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!filterStatus ? 'bg-hotel-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          Todas
        </button>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterStatus === key ? 'bg-hotel-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Grid de habitaciones */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay habitaciones</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rooms.map(room => {
            const sc = statusConfig[room.status];
            return (
              <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5 text-hotel-600" />
                    <span className="font-bold text-lg">{room.roomNumber}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>

                <div className="text-sm text-gray-500 space-y-1 mb-3">
                  <p>{room.roomType?.name} — Piso {room.floor}</p>
                  <p className="font-medium text-gray-900">${parseFloat(room.roomType?.basePrice || 0).toLocaleString()} / noche</p>
                  <p>Capacidad: {room.roomType?.maxOccupancy} personas</p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openEdit(room)}
                    className="text-xs text-gray-500 hover:text-hotel-600 flex items-center gap-1"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <div className="flex-1" />
                  {room.status === 'cleaning' && (
                    <button
                      onClick={() => changeStatus(room.id, 'available')}
                      className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100"
                    >
                      Marcar disponible
                    </button>
                  )}
                  {room.status === 'available' && (
                    <button
                      onClick={() => changeStatus(room.id, 'maintenance')}
                      className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
                    >
                      Mantenimiento
                    </button>
                  )}
                  {room.status === 'maintenance' && (
                    <button
                      onClick={() => changeStatus(room.id, 'available')}
                      className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100"
                    >
                      Habilitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editRoom ? 'Editar' : 'Nueva'} Habitación</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input
                  type="text"
                  value={form.roomNumber}
                  onChange={e => setForm({ ...form, roomNumber: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={form.roomTypeId}
                  onChange={e => setForm({ ...form, roomTypeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name} (${t.basePrice})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                <input
                  type="number"
                  value={form.floor}
                  onChange={e => setForm({ ...form, floor: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Características</label>
                <textarea
                  value={form.features}
                  onChange={e => setForm({ ...form, features: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  rows={2}
                  placeholder="WiFi, TV, Minibar..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
