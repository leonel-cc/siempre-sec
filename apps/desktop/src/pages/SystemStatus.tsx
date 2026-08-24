import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function SystemStatus() {
  const [health, setHealth] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadHealth() {
    try {
      const [h, s] = await Promise.allSettled([api.system.health(), fetch('http://localhost:3000/api/ai/stats').then(r => r.json())]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (s.status === 'fulfilled') setAiStats(s.value);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Estado del Sistema</h1>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3,4,5].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm text-gray-500">Verificando servicios...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Estado del Sistema</h1>

      <div className="grid grid-cols-3 gap-4">
        <ServiceCard name="Backend API" status={health?.backend?.status} icon="⚡" />
        <ServiceCard name="AI Service" status={health?.ai_service?.status}
          subtitle={health?.ai_service?.models_loaded ? 'Models loaded' : undefined} icon="🧠" />
        <ServiceCard name="MediaMTX" status={health?.mediamtx?.status} icon="📡" />
        <ServiceCard name="Base de Datos" status={health?.database?.status} icon="💾" />
        <ServiceCard name="WhatsApp"
          status={health?.whatsapp?.configured ? 'CONFIGURED' : 'NOT CONFIGURED'} icon="📱" />
      </div>

      {health?.system && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">Recursos del Sistema</h2>
          <div className="grid grid-cols-3 gap-6">
            <MetricBar label="CPU" value={health.system.cpu_usage_percent} icon="⚡" />
            <MetricBar label="RAM" value={health.system.memory_usage_percent} icon="💾" />
            <MetricBar label="Disco" value={health.system.disk_usage_percent} icon="💿" />
          </div>
        </div>
      )}

      {aiStats && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Estadísticas AI</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Frames procesados</p>
              <p className="text-lg font-bold text-security-400">{aiStats.total_frames_processed || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Detecciones</p>
              <p className="text-lg font-bold text-yellow-400">{aiStats.total_detections || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Alertas</p>
              <p className="text-lg font-bold text-red-400">{aiStats.total_alerts || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Uptime</p>
              <p className="text-lg font-bold text-green-400">
                {aiStats.uptime_seconds ? formatUptime(aiStats.uptime_seconds) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ name, status, subtitle, icon }: {
  name: string; status?: string; subtitle?: string; icon: string;
}) {
  const isOnline = status === 'ONLINE';
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-sm">{name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isOnline ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
        }`}>{status || 'UNKNOWN'}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
}

function MetricBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  const color = value > 80 ? 'bg-red-500' : value > 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-400 flex items-center gap-1"><span>{icon}</span> {label}</span>
        <span className="text-gray-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
