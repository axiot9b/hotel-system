import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Sparkles, Plus, X, CheckCircle, Clock, Loader2, BedDouble } from 'lucide-react';

const taskTypeLabels = {
  cleaning: 'Limpieza',
  deep_cleaning: 'Limpieza profunda',
  inspection: 'Inspección',
  restock: 'Reposición'
};

const statusConfig = {
  pending:     { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  in_progress: { label: 'En progreso',  color: 'bg-blue-100 text-blue-700',    icon: Loader2 },
  completed:   { label: 'Completada',   color: 'bg-green-100 text-green-700',  icon: CheckCircle }
};

export default function HousekeepingPage() {
  const [tasks, setTasks]               = useState([]);
  const [cleaningRooms, setCleaningRooms] = useState([]);
  const [staff, setStaff]               = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [form, setForm] = useState({ roomId: '', assignedTo: '', taskType: 'cleaning', notes: '' });

  useEffect(() => { loadAll(); }, [filterStatus]);

  async function loadAll() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const [tasksData, roomsData, usersData] = await Promise.all([
        api.get(`/housekeeping?${params}`),
        api.get('/housekeeping/rooms-cleaning'),
        api.get('/users').catch(() => [])
      ]);
      setTasks(tasksData);
      setCleaningRooms(roomsData);
      setStaff(usersData.filter ? usersData.filter(u => ['housekeeping', 'admin', 'manager'].includes(u.role)) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(taskId, newStatus) {
    try {
      await api.patch(`/housekeeping/${taskId}`, { status: newStatus });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  }

  async function assignStaff(taskId, userId) {
    try {
      await api.patch(`/housekeeping/${taskId}`, { assignedTo: userId || null });
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/housekeeping', {
        roomId: parseInt(form.roomId),
        assignedTo: form.assignedTo ? parseInt(form.assignedTo) : null,
        taskType: form.taskType,
        notes: form.notes || null
      });
      setShowModal(false);
      setForm({ roomId: '', assignedTo: '', taskType: 'cleaning', notes: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(id) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await api.delete(`/housekeeping/${id}`);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  }

  const pending     = tasks.filter(t => t.status === 'pending').length;
  const inProgress  = tasks.filter(t => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Housekeeping</h2>
          <p className="text-gray-500 text-sm mt-1">
            {cleaningRooms.length} hab. en limpieza · {pending} pendientes · {inProgress} en progreso
          </p>
        </div>
        <button
          onClick={() => { setError(''); setShowModal(true); }}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nueva Tarea
        </button>
      </div>

      {/* Habitaciones esperando limpieza */}
      {cleaningRooms.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
            <BedDouble className="h-4 w-4" />
            Habitaciones en estado "limpieza" sin tarea asignada disponible:
          </p>
          <div className="flex flex-wrap gap-2">
            {cleaningRooms.map(r => (
              <button
                key={r.id}
                onClick={() => { setForm(f => ({ ...f, roomId: String(r.id) })); setShowModal(true); }}
                className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
              >
                #{r.roomNumber} — {r.roomType?.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'Todas'], ['pending', 'Pendientes'], ['in_progress', 'En progreso'], ['completed', 'Completadas']].map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterStatus === val ? 'bg-hotel-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No hay tareas{filterStatus ? ' con este filtro' : ''}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Habitación</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Asignado a</th>
                  <th className="px-4 py-3 font-medium">Notas</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map(t => {
                  const cfg = statusConfig[t.status];
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        #{t.room?.roomNumber}
                        <span className="text-gray-400 ml-1 text-xs">({t.room?.roomType?.name})</span>
                        <div className="text-xs text-gray-400">Piso {t.room?.floor}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{taskTypeLabels[t.taskType]}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.assignedTo || ''}
                          onChange={e => assignStaff(t.id, e.target.value)}
                          className="border rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-hotel-500 outline-none"
                        >
                          <option value="">Sin asignar</option>
                          {staff.map(u => (
                            <option key={u.id} value={u.id}>{u.fullName}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate">
                        {t.notes || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {t.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(t.id, 'in_progress')}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Iniciar
                            </button>
                          )}
                          {t.status === 'in_progress' && (
                            <button
                              onClick={() => updateStatus(t.id, 'completed')}
                              className="text-xs text-green-600 hover:underline font-medium"
                            >
                              Completar
                            </button>
                          )}
                          {t.status === 'completed' && (
                            <span className="text-xs text-gray-400">
                              {t.completedAt ? new Date(t.completedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '✓'}
                            </span>
                          )}
                          <button
                            onClick={() => deleteTask(t.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva tarea */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Nueva Tarea</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habitación *</label>
                <select
                  value={form.roomId}
                  onChange={e => setForm({ ...form, roomId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {cleaningRooms.map(r => (
                    <option key={r.id} value={r.id}>#{r.roomNumber} — {r.roomType?.name} (Piso {r.floor})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.taskType}
                    onChange={e => setForm({ ...form, taskType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  >
                    {Object.entries(taskTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                  <select
                    value={form.assignedTo}
                    onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {staff.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  rows={2}
                  placeholder="Instrucciones especiales..."
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-hotel-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
