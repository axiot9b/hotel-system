import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

const fmt = (n) =>
  Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methodLabels  = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };
const typeLabels    = { deposit: 'Anticipo', payment: 'Pago', refund: 'Reembolso' };
const chargeLabels  = { service: 'Servicio', minibar: 'Minibar', damage: 'Daño', late_checkout: 'Salida tardía', other: 'Otro' };
const statusLabels  = {
  pending: 'Pendiente', confirmed: 'Confirmada',
  checked_in: 'Hospedado', checked_out: 'Check-out',
  cancelled: 'Cancelada', no_show: 'No show'
};

export default function InvoicePage() {
  const { id } = useParams();
  const [res, setRes]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reservations/${id}`)
      .then(setRes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400">Cargando factura...</div>
  );
  if (!res) return (
    <div className="flex items-center justify-center h-screen text-red-500">Reservación no encontrada</div>
  );

  const totalCharges = parseFloat(res.totalAmount)
    + (res.extraCharges?.reduce((s, c) => s + parseFloat(c.amount), 0) || 0);
  const totalPaid = res.payments?.reduce(
    (s, p) => p.paymentType === 'refund' ? s - parseFloat(p.amount) : s + parseFloat(p.amount), 0
  ) || 0;
  const balance = totalCharges - totalPaid;
  const issueDate = new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <>
      {/* Print action bar — hidden on print */}
      <div className="print:hidden bg-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-gray-300 hover:text-white text-sm"
          >
            ← Volver
          </button>
          <span className="text-gray-500">|</span>
          <span className="text-sm text-gray-300">Factura / Reservación #{res.id}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100"
        >
          🖨 Imprimir
        </button>
      </div>

      {/* Invoice body */}
      <div className="max-w-2xl mx-auto p-8 print:p-6 print:max-w-none font-sans text-gray-900">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
          <div>
            <h1 className="text-3xl font-bold text-hotel-700 print:text-gray-900">Hotel System</h1>
            <p className="text-gray-500 text-sm mt-1">Sistema de Gestión Hotelera</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-700">FACTURA</p>
            <p className="text-sm text-gray-500 mt-1">N° <span className="font-semibold text-gray-800">{String(res.id).padStart(6, '0')}</span></p>
            <p className="text-sm text-gray-500">Fecha: {issueDate}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
              res.status === 'checked_out' ? 'bg-gray-100 text-gray-700'
                : res.status === 'checked_in' ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {statusLabels[res.status] || res.status}
            </span>
          </div>
        </div>

        {/* Billing info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Huésped</p>
            <p className="font-semibold text-lg">{res.guest?.firstName} {res.guest?.lastName}</p>
            {res.guest?.idNumber && <p className="text-sm text-gray-500">Doc: {res.guest.idNumber}</p>}
            {res.guest?.phone    && <p className="text-sm text-gray-500">Tel: {res.guest.phone}</p>}
            {res.guest?.email    && <p className="text-sm text-gray-500">{res.guest.email}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Detalle de estadía</p>
            <p className="text-sm"><span className="text-gray-500">Habitación:</span> <span className="font-medium">#{res.room?.roomNumber} — {res.room?.roomType?.name}</span></p>
            <p className="text-sm"><span className="text-gray-500">Piso:</span> <span className="font-medium">{res.room?.floor}</span></p>
            <p className="text-sm"><span className="text-gray-500">Entrada:</span> <span className="font-medium">{res.checkInDate}</span></p>
            <p className="text-sm"><span className="text-gray-500">Salida:</span> <span className="font-medium">{res.checkOutDate}</span></p>
            <p className="text-sm"><span className="text-gray-500">Duración:</span> <span className="font-medium">{res.nights} noches</span></p>
            <p className="text-sm"><span className="text-gray-500">Huéspedes:</span> <span className="font-medium">{res.adults} adultos{res.children > 0 ? `, ${res.children} niños` : ''}</span></p>
          </div>
        </div>

        {/* Charges table */}
        <table className="w-full mb-4 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-semibold text-gray-700">Descripción</th>
              <th className="text-right py-2 font-semibold text-gray-700 w-28">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2.5">
                <p className="font-medium">Hospedaje — {res.room?.roomType?.name}</p>
                <p className="text-xs text-gray-400">{res.nights} noches × ${fmt(res.ratePerNight)} / noche</p>
              </td>
              <td className="py-2.5 text-right font-medium">${fmt(res.totalAmount)}</td>
            </tr>
            {res.extraCharges?.map(c => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2.5">
                  <p className="font-medium">{c.description}</p>
                  <p className="text-xs text-gray-400">{chargeLabels[c.category] || c.category} · {new Date(c.createdAt).toLocaleDateString()}</p>
                </td>
                <td className="py-2.5 text-right">${fmt(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="py-3 font-bold text-gray-900 pl-2">Total Cargos</td>
              <td className="py-3 text-right font-bold text-gray-900">${fmt(totalCharges)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payments */}
        {res.payments?.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pagos recibidos</p>
            <table className="w-full text-sm">
              <tbody>
                {res.payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-gray-600">{typeLabels[p.paymentType]} — {methodLabels[p.paymentMethod]}</td>
                    {p.reference && <td className="py-2 text-gray-400 text-xs">Ref: {p.reference}</td>}
                    <td className={`py-2 text-right font-medium ${p.paymentType === 'refund' ? 'text-red-600' : 'text-green-700'}`}>
                      {p.paymentType === 'refund' ? '-' : ''}${fmt(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Balance summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total cargos:</span>
            <span className="font-medium">${fmt(totalCharges)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total pagado:</span>
            <span className="font-medium text-green-700">${fmt(totalPaid)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-bold text-base">Saldo pendiente:</span>
            <span className={`font-bold text-base ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${fmt(Math.abs(balance))} {balance < 0 ? '(a favor del huésped)' : ''}
            </span>
          </div>
        </div>

        {/* Notes */}
        {res.notes && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-gray-600">
            <span className="font-medium">Notas: </span>{res.notes}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>Gracias por su preferencia · Hotel System</p>
          <p className="mt-1">Documento generado el {issueDate}</p>
        </div>

        {/* Signature area — only on print */}
        <div className="hidden print:flex justify-between mt-16 pt-4">
          <div className="text-center w-40">
            <div className="border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-500">Firma recepción</p>
            </div>
          </div>
          <div className="text-center w-40">
            <div className="border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-500">Firma huésped</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
