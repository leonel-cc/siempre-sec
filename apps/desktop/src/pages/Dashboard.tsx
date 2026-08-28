import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import { onEvent } from '../lib/websocket';
import { Spinner, CardSkeleton } from '../components/Loading';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-900/50 text-red-400 border-red-800',
  HIGH: 'bg-orange-900/50 text-orange-400 border-orange-800',
  MEDIUM: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  LOW: 'bg-blue-900/50 text-blue-400 border-blue-800',
};

const THREAT_LEVELS: Record<string, { label: string; color: string; bg: string }> = {
  SAFE: { label: 'SEGURO', color: 'text-green-400', bg: 'bg-green-900/50' },
  SUSPICIOUS: { label: 'SOSPECHOSO', color: 'text-yellow-400', bg: 'bg-yellow-900/50' },
  HIGH: { label: 'ALTO RIESGO', color: 'text-orange-400', bg: 'bg-orange-900/50' },
  CRITICAL: { label: 'CRITICO', color: 'text-red-400', bg: 'bg-red-900/50' },
};

const getFilename = (p?: string) => (p ? p.split(/[/\\]/).pop() || '' : '');

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);
  const [threatLevels, setThreatLevels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    const unsub = onEvent('security.alert', (alert: any) => {
      setRealtimeAlerts(prev => [alert, ...prev].slice(0, 10));
      if (alert.camera_id) {
        const severity = alert.severity || 'MEDIUM';
        setThreatLevels(prev => {
          const current = prev[alert.camera_id] || 'SAFE';
          const priority: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, SAFE: 0 };
          if ((priority[severity] || 0) > (priority[current] || 0)) {
            return { ...prev, [alert.camera_id]: severity };
          }
          return prev;
        });
      }
    });
    return unsub;
  }, []);

  async function loadData() {
    try {
      const [h, e, c] = await Promise.allSettled([
        api.system.health(), api.events.list(20), api.cameras.list(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (e.status === 'fulfilled') setEvents(e.value);
      if (c.status === 'fulfilled') setCameras(c.value);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const online = cameras.filter(c => c.status === 'ONLINE').length;
  const offline = cameras.filter(c => c.status === 'OFFLINE' || c.status === 'ERROR').length;
  const newEvents = events.filter(e => e.status === 'NEW').length;
  const alerts = events.filter(e => ['WEAPON_DETECTED', 'FACE_COVERED'].includes(e.event_type || e.eventType)).length;

  const criticalAlerts = realtimeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const overallThreat = criticalAlerts > 0 ? 'CRITICAL' :
    realtimeAlerts.some(a => a.severity === 'HIGH') ? 'HIGH' :
    realtimeAlerts.some(a => a.severity === 'MEDIUM') ? 'SUSPICIOUS' : 'SAFE';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-800">
            <Spinner size="sm" />
            <span className="text-sm text-gray-500">Verificando amenazas...</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${SEVERITY_COLORS[overallThreat] || SEVERITY_COLORS.LOW}`}>
          <span className={`w-2 h-2 rounded-full ${overallThreat === 'CRITICAL' ? 'bg-red-500 animate-pulse' : overallThreat === 'HIGH' ? 'bg-orange-500' : overallThreat === 'SUSPICIOUS' ? 'bg-yellow-500' : 'bg-green-500'}`} />
          <span className="text-sm font-semibold">{THREAT_LEVELS[overallThreat]?.label || 'SEGURO'}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Camaras Online" value={online} icon="camera" color="text-green-400" />
        <StatCard title="Camaras Offline" value={offline} icon="camera" color="text-red-400" />
        <StatCard title="Eventos Nuevos" value={newEvents} icon="bell" color="text-yellow-400" />
        <StatCard title="Alertas Activas" value={alerts} icon="alert" color="text-red-500" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Estado del Sistema</h2>
            <div className="grid grid-cols-2 gap-2">
              <StatusRow label="Backend API" status={health?.backend?.status || 'CHECKING'} />
              <StatusRow label="AI Service" status={health?.ai_service?.status || 'CHECKING'}
                subtitle={health?.ai_service?.models_loaded ? 'Models loaded' : undefined} />
              <StatusRow label="MediaMTX" status={health?.mediamtx?.status || 'CHECKING'} />
              <StatusRow label="Base de Datos" status={health?.database?.status || 'CHECKING'} />
            </div>
            {health?.system && (
              <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-500">CPU:</span> <span className="text-gray-300">{health.system.cpu_usage_percent?.toFixed(1)}%</span></div>
                <div><span className="text-gray-500">RAM:</span> <span className="text-gray-300">{health.system.memory_usage_percent?.toFixed(1)}%</span></div>
                <div><span className="text-gray-500">Disco:</span> <span className="text-gray-300">{health.system.disk_usage_percent?.toFixed(1)}%</span></div>
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Camaras con Threat Level</h2>
            <div className="space-y-2">
              {cameras.filter(c => c.status === 'ONLINE').map(cam => {
                const level = threatLevels[cam.id] || 'SAFE';
                const tl = THREAT_LEVELS[level] || THREAT_LEVELS.SAFE;
                return (
                  <div key={cam.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{cam.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tl.bg} ${tl.color}`}>
                      {tl.label}
                    </span>
                  </div>
                );
              })}
              {cameras.filter(c => c.status === 'ONLINE').length === 0 && (
                <p className="text-gray-600 text-sm">No hay camaras online</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Eventos Recientes</h2>
            <div className="space-y-1.5">
              {events.length === 0 ? (
                <p className="text-gray-600 text-sm">No hay eventos</p>
              ) : events.slice(0, 8).map(event => (
                <div key={event.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      event.status === 'NEW' ? 'bg-yellow-500' : 'bg-gray-600'
                    }`} />
                    <span className="text-gray-300">{event.event_type || event.eventType}</span>
                    <span className="text-gray-600 text-xs">{event.camera?.name || ''}</span>
                  </div>
                  <span className="text-gray-600 text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-red-950/30 rounded-xl border border-red-900/50 p-4">
            <h2 className="text-sm font-semibold text-red-400 mb-3">Alertas en Tiempo Real</h2>
            {realtimeAlerts.length === 0 ? (
              <p className="text-gray-600 text-sm">Sin alertas recientes</p>
            ) : (
              <div className="space-y-2">
                {realtimeAlerts.map((alert, i) => {
                  const sev = alert.severity || 'MEDIUM';
                  const sevColor = SEVERITY_COLORS[sev] || SEVERITY_COLORS.MEDIUM;
                  const isExpanded = expandedAlert === i;
                  const snapshotFile = getFilename(alert.snapshot_path);
                  const videoFile = getFilename(alert.video_path);
                  return (
                    <div
                      key={i}
                      onClick={() => setExpandedAlert(isExpanded ? null : i)}
                      className={`rounded-lg p-3 text-xs border cursor-pointer hover:brightness-110 transition ${sevColor}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{alert.rule_name || 'Alerta'}</p>
                        <span className="text-[10px] font-mono opacity-60">{isExpanded ? '▾' : '▸'} {sev}</span>
                      </div>

                      {isExpanded ? (
                        <div className="mt-2 space-y-2">
                          {snapshotFile && (
                            <img
                              src={`${API_BASE}/evidence/${snapshotFile}`}
                              alt={`Snapshot ${alert.camera_name || alert.camera_id || ''}`}
                              className="w-full rounded border border-white/10"
                            />
                          )}
                          {videoFile && (
                            <video
                              src={`${API_BASE}/evidence/${videoFile}`}
                              controls
                              className="w-full rounded border border-white/10"
                            />
                          )}
                          <p className="opacity-80">
                            Camara: {alert.camera_name || alert.camera_id}
                          </p>
                          <p className="opacity-60 font-mono text-[10px]">
                            {new Date(alert.timestamp || Date.now()).toLocaleString()}
                          </p>
                          {alert.identity && alert.identity !== 'unknown' && (
                            <p className="opacity-70">Identificado: {alert.identity}</p>
                          )}
                        </div>
                      ) : (
                        <p className="opacity-70 mt-0.5">
                          {alert.camera_name || alert.camera_id} - {new Date(alert.timestamp || Date.now()).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Camaras</h2>
            <div className="space-y-1.5">
              {cameras.length === 0 ? (
                <p className="text-gray-600 text-sm">Sin camaras</p>
              ) : cameras.map(cam => {
                const level = threatLevels[cam.id];
                const tl = level ? THREAT_LEVELS[level] : null;
                return (
                  <div key={cam.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">{cam.name}</span>
                      {tl && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tl.bg} ${tl.color}`}>
                          {tl.label}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      cam.status === 'ONLINE' ? 'bg-green-900/50 text-green-400' :
                      cam.status === 'CONNECTING' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>{cam.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, status, subtitle }: { label: string; status: string; subtitle?: string }) {
  const isOnline = status === 'ONLINE';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-xs text-gray-600">{subtitle}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isOnline ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
        }`}>{status}</span>
      </div>
    </div>
  );
}
