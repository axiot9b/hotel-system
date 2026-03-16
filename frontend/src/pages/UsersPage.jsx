import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Plus, X, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'accounting', label: 'Contabilidad' },
  { value: 'housekeeping', label: 'Limpieza' }
];

const EMPTY_FORM = { username: '', fullName: '', email: '', role: 'receptionist', password: '' };

const roleBadge = {
  admin:        'bg-red-100 text-red-700',
  manager:      'bg-purple-100 text-purple-700',
  receptionist: 'bg-blue-100 text-blue-700',
  accounting:   'bg-yellow-100 text-yellow-700',
  housekeeping: 'bg-green-100 text-green-700'
};

export default function UsersPage() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/users');
      setUsers(data);
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

  function openEdit(user) {
    setEditing(user);
    setForm({ username: user.username, fullName: user.fullName, email: user.email, role: user.role, password: '' });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      role: form.role
    };
    if (form.password) payload.password = form.password;
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
      } else {
        if (!form.password) { setError('La contraseña es requerida'); setSaving(false); return; }
        await api.post('/users', payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      await api.patch(`/users/${user.id}/toggle`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const active   = users.filter(u => u.isActive).length;
  const inactive = users.filter(u => !u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-gray-500 text-sm mt-1">{active} activos · {inactive} inactivos</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nuevo Usuario
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No hay usuarios</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                    <td className="px-4 py-3 text-gray-500">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-gray-400 hover:text-hotel-600 transition"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={`transition ${u.isActive ? 'text-green-500 hover:text-red-400' : 'text-gray-400 hover:text-green-500'}`}
                          title={u.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {u.isActive
                            ? <ToggleRight className="h-5 w-5" />
                            : <ToggleLeft className="h-5 w-5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    required
                    disabled={!!editing}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editing ? 'Nueva contraseña' : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                    placeholder={editing ? 'Dejar vacío para no cambiar' : ''}
                    minLength={6}
                    required={!editing}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
