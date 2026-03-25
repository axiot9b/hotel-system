import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { TrendingUp, AlertCircle, BarChart2, Download, BookOpen, Printer } from 'lucide-react';
import { exportCSV } from '../utils/exportCSV';

const fmt = (n) =>
  Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { id: 'income',      label: 'Ingresos',            icon: TrendingUp  },
  { id: 'receivables', label: 'Cuentas por cobrar',  icon: AlertCircle },
  { id: 'occupancy',   label: 'Ocupación',            icon: BarChart2   },
  { id: 'monthly',     label: 'Cierre mensual',       icon: BookOpen    }
];

function firstDay() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]; }
function daysAhead(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]; }

// ── Income tab ────────────────────────────────────────────────────────────────
function IncomeTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom]       = useState(firstDay());
  const [to, setTo]           = useState(today());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/income?from=${from}&to=${to}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const maxDay = data?.byDay.length
    ? Math.max(...data.byDay.map(d => parseFloat(d.net || 0)))
    : 0;

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
        </div>
        {[
          { label: 'Hoy',      fn: () => { setFrom(today()); setTo(today()); } },
          { label: 'Este mes', fn: () => { setFrom(firstDay()); setTo(today()); } },
          { label: '30 días',  fn: () => { setFrom(daysAgo(29)); setTo(today()); } }
        ].map(q => (
          <button key={q.label} onClick={q.fn}
            className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {q.label}
          </button>
        ))}
        {data && (
          <button
            onClick={() => exportCSV(
              `ingresos_${from}_${to}`,
              ['Fecha', 'Ingreso neto'],
              data.byDay.map(d => [d.day, d.net])
            )}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Calculando...</div>
      ) : !s ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SCard label="Ingresos brutos" value={`$${fmt(s.gross_income)}`} color="hotel" />
            <SCard label="Reembolsos"      value={`-$${fmt(s.refunds)}`}     color="red" />
            <SCard label="Ingreso neto"    value={`$${fmt(s.net_income)}`}   color="green" big />
            <SCard label="Transacciones"   value={s.transactions_count}      />
          </div>

          {/* By method */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h4 className="font-medium text-gray-700 mb-3">Por método de pago</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Efectivo',       val: s.cash },
                { label: 'Tarjeta',        val: s.card },
                { label: 'Transferencia',  val: s.transfer },
                { label: 'Otro',           val: s.other }
              ].map(({ label, val }) => {
                const pct = parseFloat(s.gross_income) > 0
                  ? Math.round(parseFloat(val) * 100 / parseFloat(s.gross_income))
                  : 0;
                return (
                  <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="font-bold text-gray-900">${fmt(val)}</p>
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full">
                      <div className="h-1.5 bg-hotel-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By room type */}
          {data.byRoomType.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h4 className="font-medium text-gray-700 mb-3">Por tipo de habitación</h4>
              <div className="space-y-2">
                {data.byRoomType.map(r => {
                  const pct = parseFloat(s.net_income) > 0
                    ? Math.round(parseFloat(r.net) * 100 / parseFloat(s.net_income))
                    : 0;
                  return (
                    <div key={r.room_type} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-32 truncate">{r.room_type}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full">
                        <div className="h-3 bg-hotel-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-24 text-right">${fmt(r.net)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily table */}
          {data.byDay.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h4 className="font-medium text-gray-700">Detalle diario</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Ingreso neto</th>
                      <th className="px-4 py-3 font-medium w-48">Barra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byDay.map(d => {
                      const pct = maxDay > 0 ? (parseFloat(d.net) / maxDay) * 100 : 0;
                      return (
                        <tr key={d.day} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">{d.day}</td>
                          <td className="px-4 py-2.5 font-medium">${fmt(d.net)}</td>
                          <td className="px-4 py-2.5">
                            <div className="h-2 bg-gray-100 rounded-full">
                              <div className="h-2 bg-hotel-500 rounded-full" style={{ width: `${pct}%` }} />
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
        </>
      )}
    </div>
  );
}

// ── Receivables tab ───────────────────────────────────────────────────────────
function ReceivablesTab() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/finance/receivables')
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + parseFloat(r.balance || 0), 0);

  const statusLabel = {
    pending:    'Pendiente',
    confirmed:  'Confirmada',
    checked_in: 'Hospedado',
    checked_out:'Check-out'
  };
  const statusColor = {
    pending:    'bg-yellow-100 text-yellow-700',
    confirmed:  'bg-blue-100 text-blue-700',
    checked_in: 'bg-green-100 text-green-700',
    checked_out:'bg-gray-100 text-gray-600'
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-10 text-gray-400">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">Sin saldos pendientes</p>
          <p className="text-gray-400 text-sm">Todas las reservaciones están al día</p>
        </div>
      ) : (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">{rows.length} reservaciones con saldo pendiente</p>
              <p className="text-xs text-red-600 mt-0.5">Total por cobrar</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold text-red-700">${fmt(total)}</p>
              <button
                onClick={() => exportCSV(
                  'cuentas_por_cobrar',
                  ['ID', 'Huésped', 'Habitación', 'Estado', 'Entrada', 'Salida', 'Total', 'Pagado', 'Saldo'],
                  rows.map(r => [r.id, r.guest_name, r.room_number, r.status, r.check_in_date, r.check_out_date,
                    (parseFloat(r.total_amount) + parseFloat(r.total_extra)).toFixed(2), r.total_paid, r.balance])
                )}
                className="flex items-center gap-1.5 bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Huésped</th>
                    <th className="px-4 py-3 font-medium">Habitación</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Estadía</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Pagado</th>
                    <th className="px-4 py-3 font-medium text-right">Saldo</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.guest_name}</p>
                        <p className="text-xs text-gray-400">{r.guest_phone || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">#{r.room_number}</p>
                        <p className="text-xs text-gray-400">{r.room_type_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.check_in_date} → {r.check_out_date}
                        <br />{r.nights} noches
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${fmt(parseFloat(r.total_amount) + parseFloat(r.total_extra))}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">${fmt(r.total_paid)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">${fmt(r.balance)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/reservations/${r.id}`)}
                          className="text-xs text-hotel-600 hover:underline font-medium"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Occupancy tab ─────────────────────────────────────────────────────────────
function OccupancyTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom]       = useState(daysAgo(29));
  const [to, setTo]           = useState(daysAhead(30));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/occupancy?from=${from}&to=${to}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const avgPct = data?.rows.length
    ? Math.round(data.rows.reduce((s, r) => s + parseFloat(r.pct || 0), 0) / data.rows.length)
    : 0;

  const maxOcc = data?.rows.length
    ? Math.max(...data.rows.map(r => parseFloat(r.occupied || 0)))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" />
        </div>
        {[
          { label: 'Últimos 30', fn: () => { setFrom(daysAgo(29)); setTo(today()); } },
          { label: '+30 días',   fn: () => { setFrom(today()); setTo(daysAhead(30)); } },
          { label: '60 días',    fn: () => { setFrom(daysAgo(29)); setTo(daysAhead(30)); } }
        ].map(q => (
          <button key={q.label} onClick={q.fn}
            className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {q.label}
          </button>
        ))}
        {data && (
          <button
            onClick={() => exportCSV(
              `ocupacion_${from}_${to}`,
              ['Fecha', 'Ocupadas', 'Total', 'Porcentaje'],
              data.rows.map(r => [r.day, r.occupied, r.total, r.pct + '%'])
            )}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Calculando...</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SCard label="Ocupación promedio" value={`${avgPct}%`} color="hotel" big />
            <SCard label="Total habitaciones"  value={data.rows[0]?.total || '—'} />
            <SCard label="Días analizados"     value={data.rows.length} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Ocupadas</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Ocupación</th>
                    <th className="px-4 py-3 font-medium w-40">Barra</th>
                    <th className="px-4 py-3 font-medium text-xs">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map(r => {
                    const isToday = r.day === today();
                    const isPast  = r.day < today();
                    const barPct  = maxOcc > 0 ? (parseFloat(r.occupied) / maxOcc) * 100 : 0;
                    const pct     = parseFloat(r.pct || 0);
                    return (
                      <tr key={r.day} className={`hover:bg-gray-50 ${isToday ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {r.day}
                          {isToday && <span className="ml-2 text-xs text-blue-500">Hoy</span>}
                        </td>
                        <td className="px-4 py-2.5">{r.occupied}</td>
                        <td className="px-4 py-2.5 text-gray-400">{r.total}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-medium ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="h-2 bg-gray-100 rounded-full">
                            <div
                              className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {isPast ? 'Histórico' : isToday ? 'Actual' : 'Proyección'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function SCard({ label, value, color, big }) {
  const colors = {
    hotel: 'bg-hotel-600 text-white',
    green: 'bg-green-600 text-white',
    red:   'bg-red-50 text-red-700'
  };
  const cls = colors[color] || 'bg-white text-gray-900';
  const border = color ? '' : 'border border-gray-100';
  return (
    <div className={`rounded-xl shadow-sm p-4 ${cls} ${border}`}>
      <p className={`text-xs font-medium mb-1 ${color ? 'opacity-80' : 'text-gray-500'}`}>{label}</p>
      <p className={`font-bold ${big ? 'text-2xl' : 'text-xl'}`}>{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab] = useState('income');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Finanzas</h2>
        <p className="text-gray-500 text-sm mt-1">Reportes financieros y análisis de ocupación</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'income'      && <IncomeTab />}
      {tab === 'receivables' && <ReceivablesTab />}
      {tab === 'occupancy'   && <OccupancyTab />}
      {tab === 'monthly'     && <MonthlyTab />}
    </div>
  );
}

// ── Monthly Accounting Report ──────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SOURCE_LABELS = {
  direct: 'Directo', phone: 'Teléfono', walk_in: 'Walk-in',
  booking: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia',
  agency: 'Agencia', other: 'Otro'
};
const METHOD_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' };

function MonthlyTab() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/monthly?year=${year}&month=${month}`);
      setData(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function exportMonthly() {
    if (!data) return;
    const rows = [
      ['REPORTE MENSUAL', `${MONTHS_ES[month - 1]} ${year}`, '', ''],
      ['', '', '', ''],
      ['INGRESOS', '', '', ''],
      ['Ingreso bruto', '', '', '$' + fmt(data.income?.gross_income)],
      ['Reembolsos', '', '', '-$' + fmt(data.income?.refunds)],
      ['Ingreso neto', '', '', '$' + fmt(data.income?.net_income)],
      [`ITBMS (${Math.round(taxRate * 100)}%)`, '', '', '$' + fmt(itbms)],
      ['', '', '', ''],
      ['POR MÉTODO DE PAGO', '', '', ''],
      ...data.byMethod.map(m => [METHOD_LABELS[m.payment_method] || m.payment_method, '', m.count + ' transacciones', '$' + fmt(m.gross)]),
      ['', '', '', ''],
      ['POR TIPO DE HABITACIÓN', '', '', ''],
      ...data.byRoomType.map(r => [r.room_type, r.reservations + ' reserv.', r.nights_sold + ' noches', '$' + fmt(r.revenue)]),
      ['', '', '', ''],
      ['RESUMEN', '', '', ''],
      ['Reservas nuevas', data.newReservations?.total_created, '', '$' + fmt(data.newReservations?.total_value)],
      ['Reservas canceladas', data.newReservations?.cancelled, '', ''],
      ['Ocupación promedio', data.occupancy?.avg_occupancy_pct + '%', '', ''],
      ['Cuentas por cobrar', data.receivables?.count + ' reservas', '', '$' + fmt(data.receivables?.total)],
    ];
    exportCSV(`cierre_${year}_${String(month).padStart(2, '0')}`,
      ['Concepto', 'Detalle', 'Adicional', 'Monto'], rows);
  }

  const inc = data?.income;
  const taxRate = data?.taxRate ?? 0.10;
  const itbms = parseFloat(inc?.net_income || 0) * taxRate;
  const totalMethods = data?.byMethod.reduce((s, m) => s + parseFloat(m.gross || 0), 0) || 1;

  return (
    <div className="space-y-6">
      {/* Selector de mes */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none">
            {MONTHS_ES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-hotel-500 outline-none">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {data && (
          <div className="ml-auto flex gap-2">
            <button onClick={exportMonthly}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download className="h-4 w-4" /> CSV / Excel
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Calculando cierre...</div>
      ) : !data ? null : (
        <div className="space-y-5">
          {/* Resumen de ingresos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Ingresos — {MONTHS_ES[month - 1]} {year}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SCard label="Ingreso bruto"              value={`$${fmt(inc?.gross_income)}`} color="hotel" big />
              <SCard label="Reembolsos"                 value={`-$${fmt(inc?.refunds)}`}     color="red" />
              <SCard label="Ingreso neto"               value={`$${fmt(inc?.net_income)}`}   color="green" big />
              <SCard label={`ITBMS (${Math.round(taxRate * 100)}%)`} value={`$${fmt(itbms)}`} color="amber" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Por método de pago */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Por método de pago</h4>
              {data.byMethod.length === 0 ? (
                <p className="text-sm text-gray-400">Sin pagos este mes</p>
              ) : (
                <div className="space-y-3">
                  {data.byMethod.map(m => {
                    const pct = Math.round((parseFloat(m.gross || 0) / totalMethods) * 100);
                    return (
                      <div key={m.payment_method}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{METHOD_LABELS[m.payment_method] || m.payment_method}</span>
                          <span className="font-semibold">${fmt(m.gross)} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-hotel-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Por tipo de habitación */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Por tipo de habitación</h4>
              {data.byRoomType.length === 0 ? (
                <p className="text-sm text-gray-400">Sin check-outs este mes</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b">
                      <th className="pb-2 font-medium">Tipo</th>
                      <th className="pb-2 font-medium text-right">Reservas</th>
                      <th className="pb-2 font-medium text-right">Noches</th>
                      <th className="pb-2 font-medium text-right">Ingreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byRoomType.map(r => (
                      <tr key={r.room_type}>
                        <td className="py-2 text-gray-800">{r.room_type}</td>
                        <td className="py-2 text-right text-gray-600">{r.reservations}</td>
                        <td className="py-2 text-right text-gray-600">{r.nights_sold}</td>
                        <td className="py-2 text-right font-semibold">${fmt(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Resumen operativo */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Resumen operativo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{data.newReservations?.total_created || 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Reservas creadas</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{data.newReservations?.cancelled || 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cancelaciones</p>
              </div>
              <div className="text-center p-3 bg-hotel-50 rounded-lg">
                <p className="text-2xl font-bold text-hotel-700">{data.occupancy?.avg_occupancy_pct || 0}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Ocupación promedio</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-700">${fmt(data.receivables?.total)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Cuentas por cobrar</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
