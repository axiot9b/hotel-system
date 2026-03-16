import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Search, X, Users, BedDouble, CalendarDays, Loader2 } from 'lucide-react';

const STATUS_LABELS = {
  pending: 'Pendiente', confirmed: 'Confirmada', checked_in: 'Hospedado',
  checked_out: 'Check-out', cancelled: 'Cancelada', no_show: 'No show'
};
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700', checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700', no_show: 'bg-orange-100 text-orange-700'
};
const ROOM_STATUS_COLORS = {
  available: 'text-green-600', occupied: 'text-red-600',
  reserved: 'text-blue-600', cleaning: 'text-amber-600', maintenance: 'text-gray-500'
};
const ROOM_STATUS_LABELS = {
  available: 'Disponible', occupied: 'Ocupada', reserved: 'Reservada',
  cleaning: 'Limpieza', maintenance: 'Mantenimiento'
};

export default function GlobalSearch() {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef  = useRef(null);
  const timeoutRef = useRef(null);
  const navigate  = useNavigate();

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setActiveIdx(-1);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function onInput(val) {
    setQuery(val);
    clearTimeout(timeoutRef.current);
    if (val.length < 2) { setResults(null); return; }
    setLoading(true);
    timeoutRef.current = setTimeout(() => search(val), 300);
  }

  // Build flat list of navigable results for keyboard nav
  const allItems = results ? [
    ...results.guests.map(g => ({ type: 'guest', data: g })),
    ...results.rooms.map(r => ({ type: 'room', data: r })),
    ...results.reservations.map(r => ({ type: 'reservation', data: r }))
  ] : [];

  function goTo(item) {
    setOpen(false);
    if (item.type === 'guest')       navigate(`/guests/${item.data.id}`);
    else if (item.type === 'room')   navigate(`/rooms`);
    else if (item.type === 'reservation') navigate(`/reservations/${item.data.id}`);
  }

  function onKeyDown(e) {
    if (!allItems.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) goTo(allItems[activeIdx]);
  }

  const total = results ? results.guests.length + results.rooms.length + results.reservations.length : 0;
  let flatIdx = 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        title="Búsqueda global (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline text-[10px] bg-white border border-gray-300 rounded px-1">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="fixed top-[10vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            {loading ? <Loader2 className="h-4 w-4 text-gray-400 animate-spin flex-shrink-0" />
                     : <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => onInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar huésped, habitación o reservación..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 && (
              <p className="text-xs text-gray-400 px-4 py-6 text-center">
                Escribe al menos 2 caracteres para buscar
              </p>
            )}

            {query.length >= 2 && !loading && total === 0 && (
              <p className="text-xs text-gray-400 px-4 py-6 text-center">
                Sin resultados para "{query}"
              </p>
            )}

            {results && (
              <>
                {/* Guests */}
                {results.guests.length > 0 && (
                  <Section icon={Users} label="Huéspedes">
                    {results.guests.map(g => {
                      const idx = flatIdx++;
                      return (
                        <ResultRow
                          key={`g${g.id}`}
                          active={activeIdx === idx}
                          onClick={() => goTo({ type: 'guest', data: g })}
                        >
                          <p className="text-sm font-medium text-gray-900">{g.last_name}, {g.first_name}</p>
                          <p className="text-xs text-gray-400">
                            {[g.id_number, g.phone, g.email].filter(Boolean).join(' · ')}
                          </p>
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}

                {/* Rooms */}
                {results.rooms.length > 0 && (
                  <Section icon={BedDouble} label="Habitaciones">
                    {results.rooms.map(r => {
                      const idx = flatIdx++;
                      return (
                        <ResultRow
                          key={`r${r.id}`}
                          active={activeIdx === idx}
                          onClick={() => goTo({ type: 'room', data: r })}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">#{r.room_number}</p>
                            <span className="text-xs text-gray-400">{r.type_name}</span>
                            <span className={`text-xs font-medium ${ROOM_STATUS_COLORS[r.status]}`}>
                              · {ROOM_STATUS_LABELS[r.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">Piso {r.floor}</p>
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}

                {/* Reservations */}
                {results.reservations.length > 0 && (
                  <Section icon={CalendarDays} label="Reservaciones">
                    {results.reservations.map(r => {
                      const idx = flatIdx++;
                      return (
                        <ResultRow
                          key={`res${r.id}`}
                          active={activeIdx === idx}
                          onClick={() => goTo({ type: 'reservation', data: r })}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">#{r.id} — {r.guest_name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Hab. {r.room_number} · {r.check_in_date} → {r.check_out_date}
                          </p>
                        </ResultRow>
                      );
                    })}
                  </Section>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 text-[10px] text-gray-400">
            <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">↑↓</kbd> navegar</span>
            <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">Enter</kbd> abrir</span>
            <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">Esc</kbd> cerrar</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 transition ${active ? 'bg-hotel-50' : 'hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
