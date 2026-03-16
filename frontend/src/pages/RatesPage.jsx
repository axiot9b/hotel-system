import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fmt = n => Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function today() { return new Date().toISOString().split('T')[0]; }
function daysAhead(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]; }

function isActive(rate) {
  const t = today();
  return rate.startDate <= t && rate.endDate >= t;
}

export default function RatesPage() {
  const { user } = useAuth();
  const canEdit = ['admin', 'manager'].includes(user?.role);

  const [rates, setRates]         = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null); // rate being edited
  const [form, setForm]           = useState({ roomTypeId: '', name: '', startDate: today(), endDate: daysAhead(30), ratePerNight: '', description: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/room-rates'),
      api.get('/room-types')
    ]).then(([r, rt]) => {
      setRates(r);
      setRoomTypes(rt);
    }).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ roomTypeId: roomTypes[0]?.id || '', name: '', startDate: today(), endDate: daysAhead(30), ratePerNight: '', description: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(rate) {
    setEditing(rate);
    setForm({
      roomTypeId:   rate.roomTypeId,
      name:         rate.name,
      startDate:    rate.startDate,
      endDate:      rate.endDate,
      ratePerNight: rate.ratePerNight,
      description:  rate.description || ''
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const updated = await api.put(`/room-rates/${editing.id}`, form);
        setRates(rates.map(r => r.id === editing.id ? updated : r));
      } else {
        const created = await api.post('/room-rates', form);
        setRates([...rates, created]);
      }
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rate) {
    if (!window.confirm(`¿Eliminar tarifa "${rate.name}"?`)) return;
    try {
      await api.delete(`/room-rates/${rate.id}`);
      setRates(rates.filter(r => r.id !== rate.id));
    } catch (err) {
      alert(err.message);
    }
  }

  // Group by room type
  const byType = {};
  rates.forEach(r => {
    const key = r.roomType?.name || r.roomTypeId;
    if (!byType[key]) byType[key] = [];
    byType[key].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tarifas por Temporada</h2>
          <p className="text-gray-500 text-sm mt-1">
            Define precios especiales por tipo de habitación y período. Se auto-rellenan en nuevas reservaciones.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Nueva tarifa
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : rates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Tag className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No hay tarifas configuradas</p>
          <p className="text-sm text-gray-400 mt-1">Crea tarifas de temporada alta, baja o especiales.</p>
          {canEdit && (
            <button onClick={openCreate} className="mt-4 text-hotel-600 text-sm hover:underline font-medium">
              + Crear primera tarifa
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byType).map(([typeName, typeRates]) => (
            <div key={typeName} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <BedDoubleIcon />
                <span className="font-semibold text-gray-800">{typeName}</span>
                <span className="text-xs text-gray-400">({typeRates.length} tarifa{typeRates.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {typeRates.sort((a, b) => a.startDate.localeCompare(b.startDate)).map(rate => {
                  const active = isActive(rate);
                  return (
                    <div key={rate.id} className={`flex items-center gap-4 px-5 py-3.5 ${active ? 'bg-hotel-50/40' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{rate.name}</span>
                          {active && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Activa</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rate.startDate} → {rate.endDate}
                          {rate.description && <span className="ml-2 text-gray-400">· {rate.description}</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-900">${fmt(rate.ratePerNight)}</p>
                        <p className="text-xs text-gray-400">/ noche</p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 ml-2">
                          <button onClick={() => openEdit(rate)} className="p-1.5 text-gray-400 hover:text-hotel-600 hover:bg-hotel-50 rounded-lg transition">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(rate)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editing ? 'Editar tarifa' : 'Nueva tarifa'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
                <select
                  value={form.roomTypeId}
                  onChange={e => setForm({ ...form, roomTypeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name} (base: ${fmt(rt.basePrice)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la temporada</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  placeholder="Ej: Temporada alta 2026, Navidad, Semana Santa..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa por noche</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.ratePerNight}
                    onChange={e => setForm({ ...form, ratePerNight: e.target.value })}
                    className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  placeholder="Incluye desayuno, tarifa especial grupos, etc."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border rounded-lg py-2.5 text-sm hover:bg-gray-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-hotel-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50 transition">
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear tarifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function BedDoubleIcon() {
  return (
    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  );
}
