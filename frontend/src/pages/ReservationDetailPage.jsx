import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  ArrowLeft, User, BedDouble, Calendar, DollarSign,
  LogIn, LogOut, XCircle, Plus, FileText
} from 'lucide-react';

const statusConfig = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700' },
  checked_in: { label: 'Hospedado', color: 'bg-green-100 text-green-700' },
  checked_out: { label: 'Check-out', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_show: { label: 'No show', color: 'bg-orange-100 text-orange-700' }
};

export default function ReservationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'cash', paymentType: 'payment', reference: '', notes: '' });
  const [showCharge, setShowCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: '', amount: '', category: 'service' });
  const [timePrompt, setTimePrompt] = useState(null); // { action, title, message, feeDesc, fee, category }
  const CHECKIN_HOUR  = 14; // 14:00 standard check-in
  const CHECKOUT_HOUR = 12; // 12:00 standard check-out
  const EARLY_FEE     = 20;
  const LATE_FEE      = 30;

  useEffect(() => { loadReservation(); }, [id]);

  async function loadReservation() {
    setLoading(true);
    try {
      const data = await api.get(`/reservations/${id}`);
      setRes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function doAction(action) {
    setActionLoading(action);
    try {
      await api.patch(`/reservations/${id}/${action}`);
      loadReservation();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  }

  function requestAction(action) {
    const now = new Date();
    const hour = now.getHours();
    const timeStr = `${String(hour).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayStr = now.toISOString().split('T')[0];

    if (action === 'check-in' && res.checkInDate === todayStr && hour < CHECKIN_HOUR) {
      setTimePrompt({
        action,
        title: 'Early check-in',
        message: `La hora actual es ${timeStr}. El check-in estándar es a las ${CHECKIN_HOUR}:00.`,
        feeDesc: 'Cargo por early check-in',
        fee: EARLY_FEE,
        category: 'other'
      });
      return;
    }
    if (action === 'check-out' && res.checkOutDate === todayStr && hour >= CHECKOUT_HOUR) {
      setTimePrompt({
        action,
        title: 'Late check-out',
        message: `La hora actual es ${timeStr}. El check-out estándar es a las ${CHECKOUT_HOUR}:00.`,
        feeDesc: 'Cargo por late check-out',
        fee: LATE_FEE,
        category: 'late_checkout'
      });
      return;
    }
    doAction(action);
  }

  async function confirmTimePrompt(addFee) {
    const prompt = timePrompt;
    setTimePrompt(null);
    if (addFee) {
      try {
        await api.post(`/reservations/${id}/charges`, {
          description: prompt.feeDesc,
          amount: prompt.fee,
          category: prompt.category
        });
      } catch (err) {
        alert('Error al agregar cargo: ' + err.message);
        return;
      }
    }
    doAction(prompt.action);
  }

  async function submitPayment(e) {
    e.preventDefault();
    try {
      await api.post(`/reservations/${id}/payments`, {
        ...payForm,
        amount: parseFloat(payForm.amount)
      });
      setShowPayment(false);
      setPayForm({ amount: '', paymentMethod: 'cash', paymentType: 'payment', reference: '', notes: '' });
      loadReservation();
    } catch (err) {
      alert(err.message);
    }
  }

  async function submitCharge(e) {
    e.preventDefault();
    try {
      await api.post(`/reservations/${id}/charges`, {
        ...chargeForm,
        amount: parseFloat(chargeForm.amount)
      });
      setShowCharge(false);
      setChargeForm({ description: '', amount: '', category: 'service' });
      loadReservation();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>;
  if (!res) return <div className="text-red-500">Reservación no encontrada</div>;

  const totalCharges = parseFloat(res.totalAmount) + (res.extraCharges?.reduce((s, c) => s + parseFloat(c.amount), 0) || 0);
  const totalPaid = res.payments?.reduce((s, p) => p.paymentType === 'refund' ? s - parseFloat(p.amount) : s + parseFloat(p.amount), 0) || 0;
  const balance = totalCharges - totalPaid;

  const methodLabels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate('/reservations')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
        <ArrowLeft className="h-4 w-4" /> Volver a reservaciones
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reservación #{res.id}</h2>
          <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[res.status]?.color}`}>
            {statusConfig[res.status]?.label}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 flex-wrap">
          {['pending', 'confirmed'].includes(res.status) && (
            <button
              onClick={() => requestAction('check-in')}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" /> Check-in
            </button>
          )}
          {res.status === 'checked_in' && (
            <button
              onClick={() => requestAction('check-out')}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" /> Check-out
            </button>
          )}
          {!['checked_out', 'cancelled'].includes(res.status) && (
            <button
              onClick={() => doAction('cancel')}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Cancelar
            </button>
          )}
          <a
            href={`/invoice/${res.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <FileText className="h-4 w-4" /> Factura
          </a>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Huésped</h3>
          <div className="text-sm space-y-1 text-gray-600">
            <p className="font-medium text-gray-900">{res.guest?.firstName} {res.guest?.lastName}</p>
            <p>{res.guest?.phone || '-'}</p>
            <p>{res.guest?.email || '-'}</p>
            <p>Doc: {res.guest?.idNumber || '-'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><BedDouble className="h-4 w-4" /> Habitación</h3>
          <div className="text-sm space-y-1 text-gray-600">
            <p className="font-medium text-gray-900">#{res.room?.roomNumber} — {res.room?.roomType?.name}</p>
            <p>Piso {res.room?.floor}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Estancia</h3>
          <div className="text-sm space-y-1 text-gray-600">
            <p>Entrada: <span className="font-medium text-gray-900">{res.checkInDate}</span></p>
            <p>Salida: <span className="font-medium text-gray-900">{res.checkOutDate}</span></p>
            <p>{res.nights} noches — {res.adults} adultos, {res.children} niños</p>
            {res.source && res.source !== 'direct' && (
              <p>Canal: <span className="font-medium text-gray-900">{{
                booking: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia',
                trivago: 'Trivago', hotelscom: 'Hotels.com', despegar: 'Despegar',
                tripadvisor: 'TripAdvisor', agency: 'Agencia de viajes',
                phone: 'Teléfono', walk_in: 'Walk-in', other: 'Otro'
              }[res.source] || res.source}</span></p>
            )}
            {res.notes && <p className="italic mt-2">"{res.notes}"</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financiero</h3>
          <div className="text-sm space-y-1">
            <p className="text-gray-600">Tarifa: ${parseFloat(res.ratePerNight).toLocaleString()} /noche × {res.nights} noches</p>
            {res.discountType && (
              <p className="text-green-700">
                Descuento {res.discountType === 'percent' ? `${parseFloat(res.discountValue)}%` : `$${parseFloat(res.discountValue).toLocaleString()} fijo`}
                {res.discountReason && ` — ${res.discountReason}`}
              </p>
            )}
            <p className="text-gray-600">Hospedaje: ${parseFloat(res.totalAmount).toLocaleString()}</p>
            <p className="text-gray-600">Cargos extra: ${(totalCharges - parseFloat(res.totalAmount)).toLocaleString()}</p>
            <p className="text-gray-600">Pagado: ${totalPaid.toLocaleString()}</p>
            <div className="pt-2 border-t mt-2">
              <p className={`font-bold text-lg ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Balance: ${balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Pagos</h3>
          {!['checked_out', 'cancelled'].includes(res.status) && (
            <button onClick={() => setShowPayment(true)} className="flex items-center gap-1 text-sm text-hotel-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Registrar Pago
            </button>
          )}
        </div>
        {res.payments?.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin pagos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Fecha</th><th className="pb-2">Tipo</th><th className="pb-2">Método</th><th className="pb-2">Monto</th><th className="pb-2">Ref.</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {res.payments?.map(p => (
                <tr key={p.id}>
                  <td className="py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{p.paymentType === 'deposit' ? 'Abono' : p.paymentType === 'refund' ? 'Reembolso' : 'Pago'}</td>
                  <td className="py-2">{methodLabels[p.paymentMethod]}</td>
                  <td className={`py-2 font-medium ${p.paymentType === 'refund' ? 'text-red-600' : ''}`}>
                    {p.paymentType === 'refund' ? '-' : ''}${parseFloat(p.amount).toLocaleString()}
                  </td>
                  <td className="py-2 text-gray-400">{p.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cargos extra */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Cargos Extra</h3>
          {res.status === 'checked_in' && (
            <button onClick={() => setShowCharge(true)} className="flex items-center gap-1 text-sm text-hotel-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Agregar Cargo
            </button>
          )}
        </div>
        {res.extraCharges?.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin cargos extra</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Fecha</th><th className="pb-2">Descripción</th><th className="pb-2">Categoría</th><th className="pb-2">Monto</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {res.extraCharges?.map(c => (
                <tr key={c.id}>
                  <td className="py-2">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{c.description}</td>
                  <td className="py-2 capitalize">{c.category}</td>
                  <td className="py-2 font-medium">${parseFloat(c.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal pago */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-lg mb-4">Registrar Pago</h3>
            <form onSubmit={submitPayment} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Monto</label>
                <input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium mb-1">Método</label>
                  <select value={payForm.paymentMethod} onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="cash">Efectivo</option><option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option><option value="other">Otro</option>
                  </select></div>
                <div><label className="block text-sm font-medium mb-1">Tipo</label>
                  <select value={payForm.paymentType} onChange={e => setPayForm({ ...payForm, paymentType: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="deposit">Abono</option><option value="payment">Pago completo</option>
                    <option value="refund">Reembolso</option>
                  </select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Referencia</label>
                <input type="text" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="# transacción, recibo, etc." /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayment(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal early/late fee */}
      {timePrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-lg mb-2">{timePrompt.title}</h3>
            <p className="text-sm text-gray-600 mb-1">{timePrompt.message}</p>
            <p className="text-sm text-gray-600 mb-4">
              ¿Desea agregar un cargo de <span className="font-bold">${timePrompt.fee}</span> por {timePrompt.feeDesc.toLowerCase()}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmTimePrompt(false)}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Sin cargo
              </button>
              <button
                onClick={() => confirmTimePrompt(true)}
                className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700"
              >
                Agregar ${timePrompt.fee}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cargo extra */}
      {showCharge && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-lg mb-4">Agregar Cargo Extra</h3>
            <form onSubmit={submitCharge} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Descripción</label>
                <input type="text" value={chargeForm.description} onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium mb-1">Monto</label>
                  <input type="number" step="0.01" value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" required /></div>
                <div><label className="block text-sm font-medium mb-1">Categoría</label>
                  <select value={chargeForm.category} onChange={e => setChargeForm({ ...chargeForm, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="service">Servicio</option><option value="minibar">Minibar</option>
                    <option value="damage">Daño</option><option value="late_checkout">Salida tardía</option>
                    <option value="other">Otro</option>
                  </select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCharge(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-hotel-600 text-white rounded-lg py-2 text-sm hover:bg-hotel-700">Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
