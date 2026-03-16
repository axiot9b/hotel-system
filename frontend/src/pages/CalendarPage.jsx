import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ChevronLeft, ChevronRight, Calendar, X, Phone, Mail, ExternalLink, Loader2, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL_W = 56;
const ROW_H  = 44;
const LEFT_W = 140;

const STATUS_STYLES = {
  pending:     { bg: 'bg-yellow-200 border-yellow-400',  text: 'text-yellow-900' },
  confirmed:   { bg: 'bg-blue-200 border-blue-400',      text: 'text-blue-900'   },
  checked_in:  { bg: 'bg-green-200 border-green-500',    text: 'text-green-900'  },
  checked_out: { bg: 'bg-gray-200 border-gray-400',      text: 'text-gray-700'   }
};
const ROOM_STATUS_BG = {
  available:   'bg-white',
  occupied:    'bg-green-50',
  reserved:    'bg-blue-50',
  cleaning:    'bg-amber-50',
  maintenance: 'bg-red-50'
};
const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  checked_in:  'Hospedado',
  checked_out: 'Check-out'
};
const WEEKDAYS  = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                   'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDate(str) { return new Date(str + 'T00:00:00'); }
function toStr(d)    { return d.toISOString().split('T')[0]; }
function addDays(str, n) {
  const d = toDate(str); d.setDate(d.getDate() + n); return toStr(d);
}
function todayStr() { return toStr(new Date()); }
function generateDays(from, to) {
  const days = []; let cur = toDate(from); const end = toDate(to);
  while (cur <= end) { days.push(toStr(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}
function dayDiff(from, date) {
  return Math.round((toDate(date) - toDate(from)) / 86400000);
}
function fmt(n) {
  return Number(n || 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canBlock = ['admin', 'manager', 'receptionist'].includes(user?.role);

  const [from, setFrom] = useState(() => addDays(todayStr(), -1));
  const [span, setSpan] = useState(14);
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Tooltip state: { resId, room }
  const [tooltip, setTooltip]         = useState(null);
  const [tooltipData, setTooltipData] = useState(null); // { loading, data }

  // Block modal
  const [blockModal, setBlockModal] = useState(null); // { roomId, startDate } pre-filled
  const [blockForm, setBlockForm]   = useState({ roomId: '', startDate: '', endDate: '', reason: '' });
  const [blockSaving, setBlockSaving] = useState(false);

  // Drag ghost: { resId, roomId, newStartIdx, nights, valid }
  const [dragGhost, setDragGhost] = useState(null);
  const dragRef = useRef(null); // { resId, roomId, nights, barStartIdx, mouseStartX, hasMoved, origCheckIn, origCheckOut }

  const to   = useMemo(() => addDays(from, span - 1), [from, span]);
  const days = useMemo(() => generateDays(from, to),  [from, to]);
  const today = todayStr();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/calendar?from=${from}&to=${to}`);
      setRooms(d.rooms);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Global drag handlers
  useEffect(() => {
    function onMouseMove(e) {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const deltaX = e.clientX - drag.mouseStartX;
      if (Math.abs(deltaX) > 4) drag.hasMoved = true;
      const deltaDays  = Math.round(deltaX / CELL_W);
      const newStartIdx = drag.barStartIdx + deltaDays;
      setDragGhost({
        resId:       drag.resId,
        roomId:      drag.roomId,
        newStartIdx,
        nights:      drag.nights,
        valid:       newStartIdx >= 0 && newStartIdx + drag.nights <= days.length + 14
      });
    }

    async function onMouseUp(e) {
      if (!dragRef.current) return;
      const drag = dragRef.current;
      const moved = drag.hasMoved;
      dragRef.current = null;
      setDragGhost(null);
      if (!moved) return;

      const deltaDays = Math.round((e.clientX - drag.mouseStartX) / CELL_W);
      if (deltaDays === 0) return;

      const newCheckIn  = addDays(drag.origCheckIn,  deltaDays);
      const newCheckOut = addDays(drag.origCheckOut, deltaDays);
      if (newCheckIn < addDays(todayStr(), -365)) return; // sanity guard

      try {
        await api.patch(`/reservations/${drag.resId}/dates`, {
          checkInDate:  newCheckIn,
          checkOutDate: newCheckOut
        });
        load();
      } catch (err) {
        alert('No se pudo mover la reservación: ' + err.message);
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [load]);

  // Tooltip click handler (fetch full reservation)
  function handleResClick(res, room, e) {
    e.stopPropagation();
    if (dragRef.current?.hasMoved) return;
    setTooltip({ resId: res.id, room });
    setTooltipData({ loading: true, data: null });
    api.get(`/reservations/${res.id}`)
      .then(data => setTooltipData({ loading: false, data }))
      .catch(()  => setTooltipData({ loading: false, data: null }));
  }

  function handleBarMouseDown(e, res, room, startIdx) {
    if (dragRef.current) return;
    e.preventDefault();
    const nights = dayDiff(res.checkInDate, res.checkOutDate);
    dragRef.current = {
      resId:        res.id,
      roomId:       room.id,
      nights,
      barStartIdx:  startIdx,
      mouseStartX:  e.clientX,
      hasMoved:     false,
      origCheckIn:  res.checkInDate,
      origCheckOut: res.checkOutDate
    };
  }

  // Group rooms by floor
  const byFloor = useMemo(() => {
    const map = {};
    rooms.forEach(r => {
      const fl = r.floor ?? 1;
      if (!map[fl]) map[fl] = [];
      map[fl].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b));
  }, [rooms]);

  const monthSegments = useMemo(() => {
    const segs = [];
    days.forEach((d, i) => {
      const dt = toDate(d);
      const label = `${MONTHS_ES[dt.getMonth()]} ${dt.getFullYear()}`;
      if (!segs.length || segs[segs.length - 1].label !== label) segs.push({ label, start: i, count: 1 });
      else segs[segs.length - 1].count++;
    });
    return segs;
  }, [days]);

  // Scroll to today on load
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const idx = days.indexOf(today);
      if (idx > 1) scrollRef.current.scrollLeft = Math.max(0, (idx - 1) * CELL_W);
    }
  }, [loading]);

  return (
    <div className="space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendario de Disponibilidad</h2>
          <p className="text-gray-500 text-sm mt-0.5">{rooms.length} habitaciones · arrastra para mover reservaciones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {[7, 14, 21, 30].map(n => (
              <button key={n} onClick={() => setSpan(n)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition ${span === n ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {n}d
              </button>
            ))}
          </div>
          <button onClick={() => setFrom(addDays(today, -1))}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Calendar className="h-3.5 w-3.5" /> Hoy
          </button>
          <button onClick={() => setFrom(f => addDays(f, -span))} className="p-1.5 border rounded-lg text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setFrom(f => addDays(f,  span))} className="p-1.5 border rounded-lg text-gray-600 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs items-center">
        {Object.entries(STATUS_STYLES).map(([status, { bg, text }]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3.5 h-3.5 rounded border ${bg}`} />
            <span className="text-gray-500">{STATUS_LABELS[status]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded border bg-gray-300 border-gray-400" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)' }} />
          <span className="text-gray-500">Bloqueada</span>
        </div>
        {canBlock && (
          <button
            onClick={() => { setBlockForm({ roomId: '', startDate: today, endDate: addDays(today, 1), reason: '' }); setBlockModal(true); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-400 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Lock className="h-3.5 w-3.5" /> Bloquear habitación
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex">
            {/* ── Fixed left column ── */}
            <div className="flex-shrink-0 border-r border-gray-200 z-20" style={{ width: LEFT_W }}>
              <div className="h-8  border-b border-gray-200 bg-gray-50" />
              <div className="h-10 border-b border-gray-200 bg-gray-50 flex items-center px-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Habitación</span>
              </div>
              {byFloor.map(([floor, floorRooms]) => (
                <div key={floor}>
                  <div className="bg-gray-50 border-b border-gray-200 flex items-center px-3" style={{ height: 24 }}>
                    <span className="text-xs font-semibold text-gray-400">Piso {floor}</span>
                  </div>
                  {floorRooms.map(room => (
                    <div key={room.id} style={{ height: ROW_H }}
                      className={`flex items-center px-3 border-b border-gray-100 ${ROOM_STATUS_BG[room.status] || 'bg-white'}`}>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">#{room.roomNumber}</p>
                        <p className="text-[11px] text-gray-400 truncate" style={{ maxWidth: LEFT_W - 16 }}>
                          {room.roomType?.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* ── Scrollable area ── */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              {/* Month header */}
              <div className="flex h-8 bg-gray-50 border-b border-gray-200 sticky top-0 z-10"
                style={{ minWidth: days.length * CELL_W }}>
                {monthSegments.map(seg => (
                  <div key={seg.label + seg.start}
                    className="flex items-center justify-center text-xs font-semibold text-gray-500 border-r border-gray-200"
                    style={{ width: seg.count * CELL_W, minWidth: seg.count * CELL_W }}>
                    {seg.label}
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className="flex h-10 border-b border-gray-200 bg-gray-50 sticky top-8 z-10"
                style={{ minWidth: days.length * CELL_W }}>
                {days.map(d => {
                  const dt = toDate(d);
                  const isToday   = d === today;
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  return (
                    <div key={d} style={{ width: CELL_W, minWidth: CELL_W }}
                      className={`flex flex-col items-center justify-center border-r border-gray-200 text-xs flex-shrink-0 ${
                        isToday ? 'bg-hotel-600 text-white' : isWeekend ? 'text-red-400' : 'text-gray-600'
                      }`}>
                      <span className="font-semibold">{dt.getDate()}</span>
                      <span className={`text-[10px] ${isToday ? 'text-hotel-200' : 'text-gray-400'}`}>
                        {WEEKDAYS[dt.getDay()]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Room rows */}
              <div style={{ minWidth: days.length * CELL_W }}>
                {byFloor.map(([floor, floorRooms]) => (
                  <div key={floor}>
                    <div className="bg-gray-50 border-b border-gray-200" style={{ height: 24, minWidth: days.length * CELL_W }} />
                    {floorRooms.map(room => (
                      <div key={room.id}
                        className={`relative border-b border-gray-100 ${ROOM_STATUS_BG[room.status] || 'bg-white'}`}
                        style={{ height: ROW_H, minWidth: days.length * CELL_W }}>

                        {/* Grid cells (clickable to create) */}
                        {days.map((d, i) => {
                          const isToday   = d === today;
                          const dt = toDate(d);
                          const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                          return (
                            <div key={d}
                              style={{ left: i * CELL_W, width: CELL_W, height: ROW_H }}
                              className={`absolute top-0 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors ${
                                isToday ? 'bg-hotel-50/30' : isWeekend ? 'bg-gray-50/60' : ''
                              }`}
                              onClick={() => navigate(`/reservations?roomId=${room.id}&checkInDate=${d}`)}
                            />
                          );
                        })}

                        {/* Room block bars */}
                        {(room.blocks || []).map(block => {
                          const startIdx = Math.max(0, dayDiff(from, block.startDate));
                          const endIdx   = Math.min(days.length, dayDiff(from, block.endDate));
                          if (endIdx <= startIdx) return null;
                          const bw = (endIdx - startIdx) * CELL_W - 4;
                          const bl = startIdx * CELL_W + 2;
                          return (
                            <div
                              key={`block-${block.id}`}
                              style={{ position: 'absolute', left: bl, width: Math.max(bw, 20), height: ROW_H - 10, top: 5, zIndex: 2, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)' }}
                              className="rounded border border-gray-400 bg-gray-300 flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-95 transition"
                              onClick={e => {
                                e.stopPropagation();
                                if (canBlock && window.confirm(`¿Eliminar bloqueo "${block.reason}"?`)) {
                                  api.delete(`/room-blocks/${block.id}`).then(load).catch(err => alert(err.message));
                                }
                              }}
                              title={`${block.reason} · ${block.startDate} → ${block.endDate}${canBlock ? '\nClic para eliminar' : ''}`}
                            >
                              <span className="text-xs font-medium text-gray-700 truncate whitespace-nowrap pointer-events-none">
                                {bw > 60 ? `🔒 ${block.reason}` : '🔒'}
                              </span>
                            </div>
                          );
                        })}

                        {/* Reservation bars */}
                        {(room.reservations || []).map(res => {
                          const startIdx = Math.max(0, dayDiff(from, res.checkInDate));
                          const endIdx   = Math.min(days.length, dayDiff(from, res.checkOutDate));
                          if (endIdx <= startIdx) return null;

                          const nights    = endIdx - startIdx;
                          const barWidth  = nights * CELL_W - 4;
                          const barLeft   = startIdx * CELL_W + 2;
                          const style     = STATUS_STYLES[res.status] || STATUS_STYLES.pending;
                          const guestName = res.guest
                            ? `${res.guest.firstName} ${res.guest.lastName}`
                            : `#${res.id}`;

                          // Ghost rendering: original bar fades, ghost moves
                          const isDragging = dragGhost?.resId === res.id;
                          const ghostStartIdx = isDragging ? dragGhost.newStartIdx : null;
                          const ghostLeft = ghostStartIdx !== null ? ghostStartIdx * CELL_W + 2 : null;
                          const ghostWidth = isDragging ? (dragGhost.nights * CELL_W - 4) : barWidth;

                          return (
                            <div key={res.id}>
                              {/* Original bar (fades when dragging) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: barLeft,
                                  width: Math.max(barWidth, 20),
                                  height: ROW_H - 10,
                                  top: 5,
                                  zIndex: isDragging ? 1 : 2,
                                  opacity: isDragging ? 0.35 : 1,
                                  cursor: isDragging ? 'grabbing' : 'grab',
                                  transition: isDragging ? 'none' : 'opacity 0.15s'
                                }}
                                className={`rounded border ${style.bg} ${style.text} flex items-center px-2 overflow-hidden`}
                                onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, res, room, startIdx); }}
                                onClick={e => { if (!dragRef.current?.hasMoved) handleResClick(res, room, e); }}
                              >
                                <span className="text-xs font-medium truncate whitespace-nowrap pointer-events-none">
                                  {barWidth > 60 ? guestName : res.guest?.firstName || '#' + res.id}
                                </span>
                              </div>

                              {/* Ghost bar (shows target position while dragging) */}
                              {isDragging && ghostLeft !== null && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: ghostLeft,
                                    width: Math.max(ghostWidth, 20),
                                    height: ROW_H - 10,
                                    top: 5,
                                    zIndex: 10,
                                    pointerEvents: 'none',
                                    transition: 'none'
                                  }}
                                  className={`rounded border-2 border-dashed ${
                                    dragGhost.valid
                                      ? 'border-hotel-500 bg-hotel-100/70 text-hotel-800'
                                      : 'border-red-500 bg-red-100/70 text-red-800'
                                  } flex items-center px-2 overflow-hidden`}
                                >
                                  <span className="text-xs font-medium truncate whitespace-nowrap">
                                    {ghostWidth > 60 ? guestName : res.guest?.firstName || '#' + res.id}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block creation modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold">Bloquear habitación</h3>
              </div>
              <button onClick={() => setBlockModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              setBlockSaving(true);
              try {
                await api.post('/room-blocks', { ...blockForm, roomId: parseInt(blockForm.roomId) });
                setBlockModal(false);
                load();
              } catch (err) { alert(err.message); }
              finally { setBlockSaving(false); }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habitación</label>
                <select value={blockForm.roomId} onChange={e => setBlockForm({ ...blockForm, roomId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" required>
                  <option value="">Seleccionar...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>#{r.roomNumber} — {r.roomType?.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                  <input type="date" value={blockForm.startDate} onChange={e => setBlockForm({ ...blockForm, startDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                  <input type="date" value={blockForm.endDate} min={blockForm.startDate} onChange={e => setBlockForm({ ...blockForm, endDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input type="text" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-hotel-500 outline-none"
                  placeholder="Mantenimiento, VIP, fumigación..." required />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setBlockModal(false)}
                  className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={blockSaving}
                  className="flex-1 bg-gray-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {blockSaving ? 'Bloqueando...' : 'Bloquear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rich tooltip modal */}
      {tooltip && (
        <ReservationTooltip
          room={tooltip.room}
          tooltipData={tooltipData}
          onClose={() => { setTooltip(null); setTooltipData(null); }}
          onNavigate={() => { navigate(`/reservations/${tooltip.resId}`); setTooltip(null); setTooltipData(null); }}
        />
      )}
    </div>
  );
}

// ── Rich Reservation Tooltip ───────────────────────────────────────────────────
function ReservationTooltip({ room, tooltipData, onClose, onNavigate }) {
  const res = tooltipData?.data;
  const loading = tooltipData?.loading;

  const totalCharges = res
    ? parseFloat(res.totalAmount) + (res.extraCharges?.reduce((s, c) => s + parseFloat(c.amount), 0) || 0)
    : 0;
  const totalPaid = res?.payments?.reduce((s, p) =>
    p.paymentType === 'refund' ? s - parseFloat(p.amount) : s + parseFloat(p.amount), 0) || 0;
  const balance = totalCharges - totalPaid;

  const payStatus = !res ? '' :
    totalPaid <= 0           ? 'Sin pagar'   :
    totalPaid >= totalCharges ? 'Pagado'      : 'Pago parcial';
  const payStatusColor = !res ? '' :
    totalPaid <= 0           ? 'text-red-600'    :
    totalPaid >= totalCharges ? 'text-green-600'  : 'text-yellow-600';

  const guestName = res?.guest
    ? `${res.guest.firstName} ${res.guest.lastName}`
    : room ? `Hab. #${room.roomNumber}` : '...';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md pointer-events-auto">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="w-9 h-9 rounded-full bg-hotel-100 flex items-center justify-center text-hotel-700 font-bold text-sm flex-shrink-0">
              {guestName.charAt(0)}
            </div>
            <p className="font-semibold text-gray-900 flex-1">{guestName}</p>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
            </div>
          ) : !res ? (
            <div className="py-8 text-center text-gray-400 text-sm">Error al cargar datos</div>
          ) : (
            <>
              {/* Two-column grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-5 py-4 text-sm">
                <InfoRow label="Llegada"   value={res.checkInDate} />
                <InfoRow label="Teléfono"  value={res.guest?.phone} icon={Phone} />
                <InfoRow label="Salida"    value={res.checkOutDate} />
                <InfoRow label="Email"     value={res.guest?.email} icon={Mail} />
                <InfoRow label="Noches"    value={res.nights} />
                <InfoRow label="Habitación" value={`#${room?.roomNumber} — ${room?.roomType?.name || ''}`} />
                <InfoRow label="Huéspedes" value={`${res.adults} adultos${res.children > 0 ? `, ${res.children} niños` : ''}`} />
                <InfoRow label="Estado"    value={STATUS_LABELS[res.status] || res.status} />
                <InfoRow label="Total"     value={`$${fmt(totalCharges)}`} />
                <InfoRow label="Estatus pago"
                  value={<span className={payStatusColor + ' font-medium'}>{payStatus}</span>} />
                <InfoRow label="Pagado"    value={`$${fmt(totalPaid)}`} />
                <InfoRow label="Pendiente"
                  value={<span className={balance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>${fmt(balance)}</span>} />
                {res.notes && (
                  <div className="col-span-2 border-t border-gray-100 pt-2 mt-1">
                    <span className="text-gray-400 text-xs">Nota: </span>
                    <span className="text-gray-700 text-xs italic">{res.notes}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-4 border-t border-gray-100 pt-3 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  <span>ID: {res.id}</span>
                  <span className="ml-3">Creado: {new Date(res.createdAt).toLocaleDateString('es')}</span>
                </div>
                <button
                  onClick={onNavigate}
                  className="flex items-center gap-1.5 text-sm text-hotel-600 hover:text-hotel-700 font-medium"
                >
                  Ver detalle <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, icon: Icon }) {
  if (!value && value !== 0) return <div><span className="text-gray-400 text-xs">{label}: —</span></div>;
  return (
    <div className="flex items-start gap-1 min-w-0">
      {Icon && <Icon className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <span className="text-gray-400 text-xs">{label}: </span>
        <span className="text-gray-800 text-xs font-medium">{value}</span>
      </div>
    </div>
  );
}
