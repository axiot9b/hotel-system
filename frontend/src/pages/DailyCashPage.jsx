import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Banknote, Lock, Unlock, RefreshCw } from 'lucide-react';

const fmt = (n) =>
  Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = {
  open:   'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600'
};

export default function DailyCashPage() {
  const [today, setToday]       = useState(null);   // { cash, todayTotals }
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Modal open
  const [showOpen, setShowOpen]   = useState(false);
  const [openForm, setOpenForm]   = useState({ openingBalance: '', notes: '' });

  // Modal close
  const [showClose, setShowClose] = useState(false);
  const [closeForm, setCloseForm] = useState({ closingBalance: '', notes: '' });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [todayData, hist] = await Promise.all([
        api.get('/daily-cash/today'),
        api.get('/daily-cash')
      ]);
      setToday(todayData);
      setHistory(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/daily-cash/open', {
        openingBalance: parseFloat(openForm.openingBalance) || 0,
        notes: openForm.notes || null
      });
      setShowOpen(false);
      setOpenForm({ openingBalance: '', notes: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/daily-cash/${today.cash.id}/close`, {
        closingBalance: parseFloat(closeForm.closingBalance) || 0,
        notes: closeForm.notes || null
      });
      setShowClose(false);
      setCloseForm({ closingBalance: '', notes: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  const cash   = today?.cash;
  const totals = today?.todayTotals;
  const isOpen = cash?.status === 'open';
  const expectedClose = cash
    ? parseFloat(cash.openingBalance) + parseFloat(totals?.net_income || 0)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Caja Diaria</h2>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 text-gray-500 hover:text-gray-700 border rounded-lg">
            <RefreshCw className="h-4 w-4" />
          </button>
          {!cash && (
            <button
              onClick={() => { setError(''); setShowOpen(true); }}
              className="flex items-center gap-2 bg-hotel-600 text-white px-4 py-2 rounded-lg hover:bg-hotel-700 text-sm font-medium"
            >
              <Unlock className="h-4 w-4" /> Abrir Caja
            </button>
          )}
          {isOpen && (
            <button
              onClick={() => { setError(''); setCloseForm({ closingBalance: String(expectedClose?.toFixed(2) || ''), notes: '' }); setShowClose(true); }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <Lock className="h-4 w-4" /> Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {/* Estado actual */}
      {!cash ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Banknote className="h-10 w-10 text-amber-500 mx-auto mb-2" />
          <p className="text-amber-800 font-medium">La caja aún no ha sido abierta hoy</p>
          <p className="text-amber-600 text-sm mt-1">Haz clic en "Abrir Caja" para comenzar el día</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card label="Estado" value={isOpen ? 'Abierta' : 'Cerrada'} badge={statusBadge[cash.status]} />
          <Card label="Saldo apertura" value={`$${fmt(cash.openingBalance)}`} />
          <Card label="Ingresos del día" value={`$${fmt(totals?.net_income)}`} highlight />
          <Card label="Efectivo recibido" value={`$${fmt(totals?.cash)}`} />
        </div>
      )}

      {/* Desglose del día */}
      {cash && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Desglose de cobros de hoy</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Efectivo', value: totals?.cash },
              { label: 'Tarjeta', value: totals?.card },
              { label: 'Transferencia', value: totals?.transfer },
              { label: 'Reembolsos', value: totals?.refunds, red: true }
            ].map(({ label, value, red }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-xs mb-1">{label}</p>
                <p className={`font-bold text-lg ${red ? 'text-red-600' : 'text-gray-900'}`}>
                  {red && parseFloat(value || 0) > 0 ? '-' : ''}${fmt(value)}
                </p>
              </div>
            ))}
          </div>

          {isOpen && (
            <div className="mt-4 pt-4 border-t text-sm text-gray-600 flex justify-between">
              <span>Saldo apertura + ingresos (estimado cierre):</span>
              <span className="font-semibold text-gray-900">${fmt(expectedClose)}</span>
            </div>
          )}

          {!isOpen && cash.closingBalance != null && (
            <div className="mt-4 pt-4 border-t space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Saldo contado al cierre:</span>
                <span className="font-semibold">${fmt(cash.closingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Diferencia vs esperado:</span>
                <span className={`font-semibold ${parseFloat(cash.closingBalance) - expectedClose < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${fmt(parseFloat(cash.closingBalance) - expectedClose)}
                </span>
              </div>
              {cash.closer && (
                <p className="text-gray-400 text-xs mt-1">Cerrado por {cash.closer.fullName}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Historial de caja</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm p-5">Sin registros anteriores</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Apertura</th>
                  <th className="px-4 py-3 font-medium">Ingresos</th>
                  <th className="px-4 py-3 font-medium">Cierre contado</th>
                  <th className="px-4 py-3 font-medium">Abierto por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{h.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[h.status]}`}>
                        {h.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                    <td className="px-4 py-3">${fmt(h.openingBalance)}</td>
                    <td className="px-4 py-3 font-medium">${fmt(h.totalIncome)}</td>
                    <td className="px-4 py-3">{h.closingBalance != null ? `$${fmt(h.closingBalance)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{h.opener?.fullName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal abrir caja */}
      {showOpen && (
        <Modal title="Abrir Caja" onClose={() => setShowOpen(false)}>
          <form onSubmit={handleOpen} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial en caja ($)</label>
              <input
                type="number" min="0" step="0.01"
                value={openForm.openingBalance}
                onChange={e => setOpenForm({ ...openForm, openingBalance: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={openForm.notes}
                onChange={e => setOpenForm({ ...openForm, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                rows={2}
              />
            </div>
            <ModalButtons onCancel={() => setShowOpen(false)} saving={saving} label="Abrir Caja" />
          </form>
        </Modal>
      )}

      {/* Modal cerrar caja */}
      {showClose && (
        <Modal title="Cerrar Caja — Arqueo" onClose={() => setShowClose(false)}>
          <form onSubmit={handleClose} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>}
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <p>Ingresos registrados: <strong>${fmt(totals?.net_income)}</strong></p>
              <p>Saldo esperado: <strong>${fmt(expectedClose)}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo contado ($)</label>
              <input
                type="number" min="0" step="0.01"
                value={closeForm.closingBalance}
                onChange={e => setCloseForm({ ...closeForm, closingBalance: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={closeForm.notes}
                onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                rows={2}
              />
            </div>
            <ModalButtons onCancel={() => setShowClose(false)} saving={saving} label="Cerrar Caja" danger />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Card({ label, value, highlight, badge }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-hotel-600 text-white border-hotel-500' : 'bg-white border-gray-100'} shadow-sm`}>
      <p className={`text-xs font-medium mb-1 ${highlight ? 'text-hotel-200' : 'text-gray-500'}`}>{label}</p>
      {badge
        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>{value}</span>
        : <p className={`text-xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      }
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalButtons({ onCancel, saving, label, danger }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onCancel} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
      <button
        type="submit" disabled={saving}
        className={`flex-1 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-hotel-600 hover:bg-hotel-700'}`}
      >
        {saving ? 'Guardando...' : label}
      </button>
    </div>
  );
}
