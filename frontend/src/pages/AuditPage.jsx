import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ShieldCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Convierte el objeto details en una cadena legible corta
function summarizeDetails(details) {
  if (!details || typeof details !== 'object') return '—';
  const KEY_LABELS = {
    roomId: 'Hab', guestId: 'Huésped', roomNumber: 'Hab', totalAmount: 'Total',
    checkInDate: 'Entrada', checkOutDate: 'Salida', date: 'Fecha',
    openingBalance: 'Apertura', closingBalance: 'Cierre',
    username: 'Usuario', role: 'Rol', fields: 'Campos',
    balance: 'Saldo', assignedTo: 'Asignado'
  };
  return Object.entries(details)
    .map(([k, v]) => {
      const label = KEY_LABELS[k] || k;
      const val = Array.isArray(v) ? v.join(', ') : v;
      return `${label}: ${val}`;
    })
    .join(' · ');
}

const ACTION_LABELS = {
  create: 'Crear',
  update: 'Actualizar',
  delete: 'Eliminar',
  check_in: 'Check-in',
  check_out: 'Check-out',
  cancel: 'Cancelar',
  activate: 'Activar',
  deactivate: 'Desactivar',
  login: 'Login'
};

const ACTION_COLORS = {
  create:     'bg-green-100 text-green-700',
  update:     'bg-blue-100 text-blue-700',
  delete:     'bg-red-100 text-red-700',
  check_in:   'bg-teal-100 text-teal-700',
  check_out:  'bg-purple-100 text-purple-700',
  cancel:     'bg-orange-100 text-orange-700',
  activate:   'bg-green-100 text-green-700',
  deactivate: 'bg-gray-100 text-gray-600',
  login:      'bg-indigo-100 text-indigo-700'
};

const ENTITY_LABELS = {
  reservation: 'Reservación',
  guest: 'Huésped',
  room: 'Habitación',
  user: 'Usuario',
  housekeeping: 'Limpieza'
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '' });
  const [detailsModal, setDetailsModal] = useState(null); // { details, action, entity }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
      if (filters.entity) params.set('entity', filters.entity);
      if (filters.action) params.set('action', filters.action);
      if (filters.from)   params.set('from', filters.from);
      if (filters.to)     params.set('to', filters.to);
      const data = await api.get(`/audit?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  function applyFilters(newFilters) {
    setFilters(newFilters);
    setPage(1);
  }

  function clearFilters() {
    setFilters({ entity: '', action: '', from: '', to: '' });
    setPage(1);
  }

  const hasFilters = filters.entity || filters.action || filters.from || filters.to;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Auditoría</h2>
        <p className="text-gray-500 text-sm mt-1">{total} registros encontrados</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entidad</label>
            <select
              value={filters.entity}
              onChange={e => applyFilters({ ...filters, entity: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
            >
              <option value="">Todas</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Acción</label>
            <select
              value={filters.action}
              onChange={e => applyFilters({ ...filters, action: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
            >
              <option value="">Todas</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={e => applyFilters({ ...filters, from: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={e => applyFilters({ ...filters, to: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
            />
          </div>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="mt-2 text-xs text-hotel-600 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No hay registros{hasFilters ? ' con estos filtros' : ''}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Fecha y hora</th>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                    <th className="px-4 py-3 font-medium">Entidad</th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Detalles</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('es', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {log.user?.fullName || log.user?.username || `#${log.userId}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </td>
                      <td className="px-4 py-3 text-gray-400">#{log.entityId}</td>
                      <td className="px-4 py-3">
                        {log.details ? (
                          <button
                            className="text-left"
                            onClick={() => setDetailsModal({ details: log.details, action: log.action, entity: log.entity })}
                          >
                            <div
                              className="text-xs text-gray-500 hover:text-hotel-600 transition-colors"
                              style={{ maxWidth: 220, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                            >
                              {summarizeDetails(log.details)}
                            </div>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {log.ipAddress || '—'}
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
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages} · {total} registros
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal detalles */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Detalles — {ACTION_LABELS[detailsModal.action] || detailsModal.action}{' '}
                <span className="text-gray-400 font-normal text-sm">
                  ({ENTITY_LABELS[detailsModal.entity] || detailsModal.entity})
                </span>
              </h3>
              <button onClick={() => setDetailsModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(detailsModal.details).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-400 font-mono text-xs w-32 flex-shrink-0 pt-0.5">{key}</span>
                  <span className="text-gray-900 font-medium break-all">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setDetailsModal(null)}
              className="mt-5 w-full border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
