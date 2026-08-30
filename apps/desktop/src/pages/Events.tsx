import { startTransition, useEffect, useState } from 'react';
import { CardSkeleton } from '../components/Loading';
import { api, API_BASE } from '../lib/api';
import { onEvent } from '../lib/websocket';

type EventFilter = 'ALL' | 'NEW' | 'REVIEWED' | 'DISMISSED';

interface SecurityEvent {
  id: string;
  eventType?: string;
  event_type?: string;
  timestamp: string;
  confidence: number;
  status: string;
  camera?: { name?: string };
  snapshotPath?: string;
  snapshot_path?: string;
  videoPath?: string;
  video_path?: string;
}

const getFilename = (filePath?: string) =>
  filePath ? filePath.split(/[/\\]/).pop() || '' : '';

const getType = (event: SecurityEvent) => event.eventType || event.event_type || 'EVENT';
const getSnapshot = (event: SecurityEvent) => event.snapshotPath || event.snapshot_path;
const getVideo = (event: SecurityEvent) => event.videoPath || event.video_path;

const EVENT_LABELS: Record<string, string> = {
  WEAPON_DETECTED: 'Arma o cuchillo',
  FACE_COVERED: 'Rostro cubierto',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  REVIEWED: 'Revisado',
  DISMISSED: 'Descartado',
};

const FILTERS: Array<{ value: EventFilter; label: string }> = [
  { value: 'ALL', label: 'Activos' },
  { value: 'NEW', label: 'Nuevos' },
  { value: 'REVIEWED', label: 'Revisados' },
  { value: 'DISMISSED', label: 'Descartados' },
];

function statusClasses(status: string) {
  if (status === 'NEW') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (status === 'REVIEWED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  return 'border-slate-700 bg-slate-800 text-slate-400';
}

export default function Events() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('ALL');
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadEvents();
    return onEvent('event.created', async (created: { id?: string }) => {
      if (!created.id) return;
      try {
        const event = await api.events.get(created.id) as SecurityEvent;
        startTransition(() => {
          setEvents(current => [event, ...current.filter(item => item.id !== event.id)]);
          setSelectedId(current => current || event.id);
        });
      } catch (eventError) {
        console.error(eventError);
      }
    });
  }, []);

  async function loadEvents() {
    try {
      const data = await api.events.list(200) as SecurityEvent[];
      setEvents(data);
      setSelectedId(current => current || data[0]?.id || null);
    } catch (loadError) {
      console.error(loadError);
      setError('No se pudieron cargar los eventos.');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'REVIEWED' | 'DISMISSED') {
    setActionId(id);
    setError('');
    try {
      await api.events.updateStatus(id, status);
      setEvents(current => current.map(event =>
        event.id === id ? { ...event, status } : event));
      if (status === 'DISMISSED' && filter === 'ALL') {
        const next = filteredEvents.find(event => event.id !== id);
        if (selectedId === id) setSelectedId(next?.id || null);
      }
    } catch (statusError) {
      console.error(statusError);
      setError('No se pudo actualizar el evento.');
    } finally {
      setActionId(null);
    }
  }

  async function deleteEvent(id: string) {
    setActionId(id);
    setError('');
    try {
      await api.events.remove(id);
      const visibleWithoutDeleted = filteredEvents.filter(event => event.id !== id);
      setEvents(current => current.filter(event => event.id !== id));
      if (selectedId === id) setSelectedId(visibleWithoutDeleted[0]?.id || null);
      setConfirmDeleteId(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError('No se pudo eliminar el evento.');
    } finally {
      setActionId(null);
    }
  }

  const filteredEvents = events.filter(event =>
    filter === 'ALL' ? event.status !== 'DISMISSED' : event.status === filter);
  const selectedEvent = events.find(event => event.id === selectedId) || null;

  const filterCount = (value: EventFilter) =>
    value === 'ALL'
      ? events.filter(event => event.status !== 'DISMISSED').length
      : events.filter(event => event.status === value).length;

  function changeFilter(value: EventFilter) {
    setFilter(value);
    const visible = value === 'ALL'
      ? events.filter(event => event.status !== 'DISMISSED')
      : events.filter(event => event.status === value);
    if (!visible.some(event => event.id === selectedId)) {
      setSelectedId(visible[0]?.id || null);
    }
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-security-400">
            <span className="h-px w-8 bg-security-500/70" />
            Historial de seguridad
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Eventos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revisa evidencia, clasifica incidentes y elimina registros desde un solo lugar.
          </p>
        </div>

        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1">
          {FILTERS.map(item => (
            <button
              key={item.value}
              onClick={() => changeFilter(item.value)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                filter === item.value
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
            >
              {item.label}
              <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                filter === item.value ? 'bg-white/10 text-slate-200' : 'bg-slate-900 text-slate-600'
              }`}>
                {filterCount(item.value)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300/70 hover:text-white">Cerrar</button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.45fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Registro</h2>
              <p className="text-xs text-slate-600">Selecciona un evento para inspeccionarlo</p>
            </div>
            <span className="font-mono text-xs text-slate-500">{filteredEvents.length}</span>
          </div>

          <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3, 4, 5].map(item => <CardSkeleton key={item} />)}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center px-8 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-xl text-slate-600">0</div>
                <p className="font-medium text-slate-300">Sin eventos</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">No hay registros que coincidan con este filtro.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredEvents.map(event => {
                  const type = getType(event);
                  const snapshot = getFilename(getSnapshot(event));
                  const selected = selectedId === event.id;
                  const isWeapon = type === 'WEAPON_DETECTED';
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedId(event.id);
                        setConfirmDeleteId(null);
                      }}
                      className={`group grid w-full grid-cols-[68px_minmax(0,1fr)] gap-3 rounded-xl border p-2.5 text-left transition-all ${
                        selected
                          ? 'border-security-500/45 bg-security-500/10 shadow-lg shadow-security-950/20'
                          : 'border-transparent hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="relative h-16 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                        {snapshot ? (
                          <img
                            src={`${API_BASE}/evidence/${snapshot}`}
                            alt=""
                            className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-700">SIN IMG</div>
                        )}
                        <span className={`absolute left-1.5 top-1.5 h-2 w-2 rounded-full ${
                          isWeapon ? 'bg-red-500' : 'bg-orange-400'
                        } shadow-[0_0_8px_currentColor]`} />
                      </div>

                      <div className="min-w-0 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {EVENT_LABELS[type] || type}
                          </p>
                          <span className="shrink-0 font-mono text-[10px] text-slate-600">
                            {(Number(event.confidence || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{event.camera?.name || 'Cámara desconocida'}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${statusClasses(event.status)}`}>
                            {STATUS_LABELS[event.status] || event.status}
                          </span>
                          <time className="truncate text-[10px] text-slate-600">
                            {new Date(event.timestamp).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="lg:sticky lg:top-4">
          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              busy={actionId === selectedEvent.id}
              confirmingDelete={confirmDeleteId === selectedEvent.id}
              onReview={() => void updateStatus(selectedEvent.id, 'REVIEWED')}
              onDismiss={() => void updateStatus(selectedEvent.id, 'DISMISSED')}
              onAskDelete={() => setConfirmDeleteId(selectedEvent.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onDelete={() => void deleteEvent(selectedEvent.id)}
            />
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-8 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 font-mono text-xl text-security-400">EV</div>
              <h2 className="text-lg font-medium text-slate-200">Selecciona un evento</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                La evidencia, el estado y las acciones aparecerán aquí sin ocultar el resto del historial.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EventDetail({
  event,
  busy,
  confirmingDelete,
  onReview,
  onDismiss,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  event: SecurityEvent;
  busy: boolean;
  confirmingDelete: boolean;
  onReview: () => void;
  onDismiss: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const type = getType(event);
  const snapshot = getFilename(getSnapshot(event));
  const video = getFilename(getVideo(event));
  const isWeapon = type === 'WEAPON_DETECTED';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-semibold ${
            isWeapon
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-orange-500/30 bg-orange-500/10 text-orange-300'
          }`}>
            !
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-600">Detalle del evento</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{EVENT_LABELS[type] || type}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {event.camera?.name || 'Cámara desconocida'} · {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <span className={`self-start rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusClasses(event.status)}`}>
          {STATUS_LABELS[event.status] || event.status}
        </span>
      </div>

      <div className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Confianza" value={`${(Number(event.confidence || 0) * 100).toFixed(1)}%`} />
          <Metric label="Cámara" value={event.camera?.name || 'N/A'} />
          <Metric label="Estado" value={STATUS_LABELS[event.status] || event.status} />
        </div>

        <div className="space-y-3">
          {snapshot && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-2">
                <span className="text-xs font-medium text-slate-400">Captura</span>
                <span className="font-mono text-[10px] text-slate-700">JPG</span>
              </div>
              <img
                key={event.id}
                src={`${API_BASE}/evidence/${snapshot}`}
                alt={`Evidencia de ${EVENT_LABELS[type] || type}`}
                className="max-h-[420px] w-full object-contain"
              />
            </div>
          )}

          {video && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3 py-2">
                <span className="text-xs font-medium text-slate-400">Secuencia del incidente</span>
                <span className="font-mono text-[10px] text-slate-700">MP4</span>
              </div>
              <video key={event.id} controls preload="metadata" className="max-h-[420px] w-full">
                <source src={`${API_BASE}/evidence/${video}`} type="video/mp4" />
              </video>
            </div>
          )}

          {!snapshot && !video && (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-600">
              Este evento no tiene evidencia multimedia.
            </div>
          )}
        </div>

        {confirmingDelete ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-red-200">¿Eliminar este evento?</p>
              <p className="mt-0.5 text-xs text-red-300/60">El registro desaparecerá del historial.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onCancelDelete} disabled={busy} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white">
                Cancelar
              </button>
              <button onClick={onDelete} disabled={busy} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {busy ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
            {event.status !== 'REVIEWED' && (
              <button onClick={onReview} disabled={busy} className="rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
                Marcar revisado
              </button>
            )}
            {event.status !== 'DISMISSED' && (
              <button onClick={onDismiss} disabled={busy} className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50">
                Descartar
              </button>
            )}
            <button onClick={onAskDelete} disabled={busy} className="ml-auto rounded-lg px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50">
              Eliminar evento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-300">{value}</p>
    </div>
  );
}
