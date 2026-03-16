import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BedDouble, Plus, X, Pencil, Check } from 'lucide-react';

const EMPTY_FORM = { name: '', description: '', basePrice: '', maxOccupancy: 2 };

export default function RoomTypesPage() {
  const [types, setTypes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState(null); // null = create, object = edit
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/room-types');
      setTypes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(type) {
    setEditing(type);
    setForm({
      name: type.name,
      description: type.description || '',
      basePrice: String(type.basePrice),
      maxOccupancy: type.maxOccupancy
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      basePrice: parseFloat(form.basePrice),
      maxOccupancy: parseInt(form.maxOccupancy)
    };
    try {
      if (editing) {
        await api.put(`/room-types/${editing.id}`, payload);
      } else {
        await api.post('/room-types', payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tipos de Habitación</h2>
          <p className="text-gray-500 text-sm mt-1">{types.length} tipos registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nuevo Tipo
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : types.length === 0 ? (
        <div className="text-center py-12">
          <BedDouble className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No hay tipos de habitación</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-hotel-600 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                </div>
                <button
                  onClick={() => openEdit(t)}
                  className="text-gray-400 hover:text-hotel-600 transition"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {t.description && (
                <p className="text-sm text-gray-500 mb-3">{t.description}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Precio base</span>
                <span className="font-semibold text-gray-900">
                  ${parseFloat(t.basePrice).toLocaleString('es', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-500">Ocupación máx.</span>
                <span className="font-medium text-gray-700">{t.maxOccupancy} personas</span>
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
              <h3 className="font-semibold text-lg">{editing ? 'Editar Tipo' : 'Nuevo Tipo'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                  placeholder="Ej: Suite Presidencial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  rows={2}
                  placeholder="Descripción opcional..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio base / noche *</label>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={e => setForm({ ...form, basePrice: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ocupación máx. *</label>
                  <input
                    type="number"
                    value={form.maxOccupancy}
                    onChange={e => setForm({ ...form, maxOccupancy: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" />
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear tipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
