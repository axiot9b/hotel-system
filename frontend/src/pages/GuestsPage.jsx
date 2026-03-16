import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Users, Plus, X, Search, Star } from 'lucide-react';

export default function GuestsPage() {
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGuest, setEditGuest] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', idType: 'dni', idNumber: '',
    email: '', phone: '', country: '', city: '', address: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef(null);

  useEffect(() => {
    loadGuests();
  }, [page, search]);

  async function loadGuests() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      const data = await api.get(`/guests?${params}`);
      setGuests(data.guests);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditGuest(null);
    setForm({ firstName: '', lastName: '', idType: 'dni', idNumber: '', email: '', phone: '', country: '', city: '', address: '', notes: '' });
    setError('');
    setShowModal(true);
  }

  function openEdit(guest) {
    setEditGuest(guest);
    setForm({
      firstName: guest.firstName, lastName: guest.lastName,
      idType: guest.idType || 'dni', idNumber: guest.idNumber || '',
      email: guest.email || '', phone: guest.phone || '',
      country: guest.country || '', city: guest.city || '',
      address: guest.address || '', notes: guest.notes || ''
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editGuest) {
        await api.put(`/guests/${editGuest.id}`, form);
      } else {
        await api.post('/guests', form);
      }
      setShowModal(false);
      loadGuests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSearch(val) {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      setSearch(val);
    }, 400);
  }

  const idTypeLabels = { dni: 'DNI', passport: 'Pasaporte', license: 'Licencia', other: 'Otro' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Huéspedes</h2>
          <p className="text-gray-500 text-sm mt-1">{total} huéspedes registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nuevo Huésped
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
          placeholder="Buscar por nombre, documento, teléfono o email..."
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : guests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No se encontraron huéspedes</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Origen</th>
                  <th className="px-4 py-3 font-medium">Estadías</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {guests.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/guests/${g.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{g.firstName} {g.lastName}</span>
                        {g.isFrequent && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {g.idNumber ? `${idTypeLabels[g.idType]} ${g.idNumber}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <div>{g.phone || '—'}</div>
                      <div className="text-xs">{g.email || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{g.country || '—'}{g.city ? `, ${g.city}` : ''}</td>
                    <td className="px-4 py-3 text-gray-500">{g.totalStays}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(g)} className="text-hotel-600 hover:underline text-xs">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-xs disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded text-xs disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editGuest ? 'Editar' : 'Nuevo'} Huésped</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo documento</label>
                  <select value={form.idType} onChange={e => setForm({ ...form, idType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none">
                    <option value="dni">DNI</option>
                    <option value="passport">Pasaporte</option>
                    <option value="license">Licencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input type="text" value={form.idNumber} onChange={e => setForm({ ...form, idNumber: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
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
