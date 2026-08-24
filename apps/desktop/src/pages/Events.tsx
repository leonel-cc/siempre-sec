import { useEffect, useState } from 'react';
import { api, BACKEND_URL } from '../lib/api';
import { Spinner, CardSkeleton } from '../components/Loading';

const getFilename = (p?: string) => p ? p.split(/[/\\]/).pop() || '' : '';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    try {
      const data = await api.events.list(200);
      setEvents(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function markReviewed(id: string) {
    await api.events.updateStatus(id, 'REVIEWED');
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'REVIEWED' } : e));
  }

  async function dismissEvent(id: string) {
    await api.events.updateStatus(id, 'DISMISSED');
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'DISMISSED' } : e));
  }

  const filtered = events.filter(e => {
    if (filter === 'ALL') return true;
    if (filter === 'NEW') return e.status === 'NEW';
    if (filter === 'ALERTS') return ['SECURITY_ALERT', 'RESTRICTED_ZONE', 'UNKNOWN_PERSON'].includes(e.event_type);
    return true;
  });

  const eventIcon = (type: string) => {
    const icons: Record<string, string> = {
      MOTION: '👁️', PERSON_DETECTED: '🚶', UNKNOWN_PERSON: '❓',
      KNOWN_PERSON: '✅', RESTRICTED_ZONE: '🚨', VEHICLE_DETECTED: '🚗', SECURITY_ALERT: '🛡️',
    };
    return icons[type] || '📌';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <div className="flex gap-1">
          {['ALL', 'NEW', 'ALERTS'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs ${filter === f ? 'bg-security-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{eventIcon(selectedEvent.event_type)} Detalle del Evento</h2>
            <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white text-sm">✕ Cerrar</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Tipo:</span> {selectedEvent.event_type}</div>
            <div><span className="text-gray-500">Cámara:</span> {selectedEvent.camera?.name || 'N/A'}</div>
            <div><span className="text-gray-500">Hora:</span> {new Date(selectedEvent.timestamp).toLocaleString()}</div>
            <div><span className="text-gray-500">Confianza:</span> {(selectedEvent.confidence * 100).toFixed(1)}%</div>
            <div><span className="text-gray-500">Estado:</span> {selectedEvent.status}</div>
            {selectedEvent.snapshot_path && (
              <div className="col-span-3">
                <span className="text-gray-500">Snapshot:</span>
                <div className="mt-2 bg-black rounded overflow-hidden max-w-md">
                  <img src={`${BACKEND_URL}/evidence/${getFilename(selectedEvent.snapshot_path)}`} alt="snapshot" className="w-full" />
                </div>
              </div>
            )}
            {selectedEvent.video_path && (
              <div className="col-span-3">
                <span className="text-gray-500">Video:</span>
                <video controls className="mt-2 rounded max-w-md">
                  <source src={`${BACKEND_URL}/evidence/${getFilename(selectedEvent.video_path)}`} />
                </video>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            {selectedEvent.status === 'NEW' && (
              <button onClick={() => markReviewed(selectedEvent.id)} className="px-3 py-1.5 bg-green-900/50 text-green-400 rounded text-xs hover:bg-green-900/70">
                Marcar revisado
              </button>
            )}
            <button onClick={() => dismissEvent(selectedEvent.id)} className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded text-xs hover:bg-gray-700">
              Descartar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">🔔</p>
          <p>No hay eventos {filter !== 'ALL' ? `con filtro ${filter}` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => (
            <div key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`bg-gray-900 rounded-lg border p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors ${
                event.status === 'NEW' ? 'border-yellow-900/50' : 'border-gray-800'
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{eventIcon(event.event_type)}</span>
                <div>
                  <p className="text-sm font-medium">{event.event_type}</p>
                  <p className="text-xs text-gray-500">{event.camera?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleString()}</p>
                <p className="text-xs text-gray-500">{(event.confidence * 100).toFixed(1)}%</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                event.status === 'NEW' ? 'bg-yellow-900/50 text-yellow-400' :
                event.status === 'REVIEWED' ? 'bg-green-900/50 text-green-400' :
                'bg-gray-800 text-gray-500'
              }`}>{event.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
