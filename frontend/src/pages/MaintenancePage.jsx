import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Wrench, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_LABELS    = { repair: 'Reparación', inspection: 'Inspección', preventive: 'Preventivo', cleaning: 'Limpieza' };
const STATUS_LABELS  = { open: 'Abierto', in_progress: 'En progreso', closed: 'Cerrado' };
const PRIORITY_LABELS= { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };

const STATUS_COLORS  = {
  open:        'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  closed:      'bg-green-100 text-green-700'
};
const PRIORITY_COLORS= {
  low:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700 font-bold'
};

const PAGE_SIZE = 30;

export default function MaintenancePage() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate]     = useState(false);
  const [showUpdate, setShowUpdate]     = useState(null); // log object
  const [rooms, setRooms]       = useState([]);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm]         = useState({ roomId: '', type: 'repair', priority: 'normal', description: '', blockStartDate: today, blockEndDate: '', singleDay: false });
  const [updateForm, setUpdateForm] = useState({ status: '', resolution: '', cost: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get(`/maintenance?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/rooms?limit=200')
      .then(d => setRooms(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...form };
      if (payload.singleDay && payload.blockStartDate) {
        const d = new Date(payload.blockStartDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        payload.blockEndDate = d.toISOString().split('T')[0];
      }
      delete payload.singleDay;
      await api.post('/maintenance', payload);
      setShowCreate(false);
      setForm({ roomId: '', type: 'repair', priority: 'normal', description: '', blockStartDate: today, blockEndDate: '', singleDay: false });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { status: updateForm.status };
      if (updateForm.resolution) payload.resolution = updateForm.resolution;
      if (updateForm.cost)       payload.cost       = parseFloat(updateForm.cost);
      await api.patch(`/maintenance/${showUpdate.id}`, payload);
      setShowUpdate(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openUpdate(log) {
    setUpdateForm({ status: log.status, resolution: log.resolution || '', cost: log.cost || '' });
    setError('');
    setShowUpdate(log);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mantenimiento</h2>
          <p className="text-gray-500 text-sm mt-1">{total} registros encontrados</p>
        </div>
        <button
          onClick={() => { setError(''); setShowCreate(true); }}
          className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Nuevo registro
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Estado:</span>
        {[{ v: '', l: 'Todos' }, { v: 'open', l: 'Abiertos' }, { v: 'in_progress', l: 'En progreso' }, { v: 'closed', l: 'Cerrados' }].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => { setStatusFilter(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${statusFilter === v ? 'bg-hotel-600 text-white border-hotel-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Sin registros de mantenimiento</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Habitación</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Prioridad</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Bloqueo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Costo</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('es')}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        #{log.room?.roomNumber}
                        <span className="text-gray-400 ml-1 text-xs">P{log.room?.floor}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[log.type] || log.type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[log.priority]}`}>
                          {PRIORITY_LABELS[log.priority] || log.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div style={{ maxWidth: 240, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {log.description}
                        </div>
                        {log.resolution && (
                          <div className="text-xs text-green-600 mt-0.5" style={{ maxWidth: 240, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            ✓ {log.resolution}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {log.blockStartDate
                          ? log.blockStartDate === log.blockEndDate || !log.blockEndDate
                            ? <span className="flex items-center gap-1">🔒 {log.blockStartDate}</span>
                            : <span className="flex items-center gap-1">🔒 {log.blockStartDate} → {log.blockEndDate}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[log.status]}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {log.cost ? `$${parseFloat(log.cost).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.status !== 'closed' && (
                          <button
                            onClick={() => openUpdate(log)}
                            className="text-hotel-600 hover:underline text-xs"
                          >
                            Actualizar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nuevo registro */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Nuevo registro de mantenimiento</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Habitación *</label>
                <select value={form.roomId} onChange={e => setForm({ ...form, roomId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Seleccionar...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>#{r.roomNumber} — Piso {r.floor}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción *</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} required />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Bloquear habitación en calendario</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                    <input type="checkbox" checked={form.singleDay}
                      onChange={e => setForm({ ...form, singleDay: e.target.checked, blockEndDate: '' })}
                      className="rounded" />
                    Solo un día
                  </label>
                </div>
                <div className={`grid gap-3 ${form.singleDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{form.singleDay ? 'Fecha' : 'Desde'}</label>
                    <input type="date" value={form.blockStartDate}
                      onChange={e => setForm({ ...form, blockStartDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  {!form.singleDay && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                      <input type="date" value={form.blockEndDate}
                        min={form.blockStartDate}
                        onChange={e => setForm({ ...form, blockEndDate: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">Opcional — aparecerá bloqueada en el calendario hasta que se cierre el mantenimiento</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal actualizar estado */}
      {showUpdate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Actualizar estado</h3>
              <button onClick={() => setShowUpdate(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4 bg-gray-50 rounded-lg p-3">{showUpdate.description}</p>
            <form onSubmit={handleUpdate} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select value={updateForm.status} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" required>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Resolución</label>
                <textarea value={updateForm.resolution} onChange={e => setUpdateForm({ ...updateForm, resolution: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
                  placeholder="Descripción de la solución aplicada..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Costo ($)</label>
                <input type="number" step="0.01" value={updateForm.cost} onChange={e => setUpdateForm({ ...updateForm, cost: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUpdate(null)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
