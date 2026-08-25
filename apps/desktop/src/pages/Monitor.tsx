import { useEffect, useState } from 'react';
import { api, AI_BASE } from '../lib/api';
import { Spinner } from '../components/Loading';

const LAYOUTS: Record<string, string> = {
  '2x2': 'grid-cols-2',
  '3x3': 'grid-cols-3',
  '2x3': 'grid-cols-3 grid-rows-2',
};

export default function Monitor() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [layout, setLayout] = useState('2x2');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCameras();
  }, []);

  async function loadCameras() {
    try {
      const data = await api.cameras.list();
      const online = data.filter((c: any) => c.status === 'ONLINE');
      setCameras(data);
      setSelected(online.slice(0, 4).map((c: any) => c.id));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function markReady(camId: string) {
    setReadyMap(prev => (prev[camId] ? prev : { ...prev, [camId]: true }));
  }

  function getCameraName(camId: string) {
    return cameras.find(c => c.id === camId)?.name || camId;
  }

  function toggleCamera(camId: string) {
    setSelected(prev => {
      if (prev.includes(camId)) return prev.filter(id => id !== camId);
      return [...prev, camId];
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const cols = LAYOUTS[layout] || 'grid-cols-2';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitoreo en Vivo</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {Object.keys(LAYOUTS).map(key => (
              <button
                key={key}
                onClick={() => setLayout(key)}
                className={`px-2 py-1 rounded text-xs transition ${
                  layout === key ? 'bg-security-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">{selected.length} cámaras</span>
        </div>
      </div>

      <div className={`grid ${cols} gap-3`}>
        {selected.map(camId => (
          <div key={camId} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium">{getCameraName(camId)}</span>
              </div>
              <button
                onClick={() => toggleCamera(camId)}
                className="text-gray-500 hover:text-red-400 text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <img
                src={`${AI_BASE}/sources/${camId}/stream`}
                alt={getCameraName(camId)}
                className="max-w-full max-h-full"
                onLoad={() => markReady(camId)}
              />
              {!readyMap[camId] && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                  Esperando señal...
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Agregar Cámara</h2>
        <div className="flex flex-wrap gap-2">
          {cameras.filter(c => !selected.includes(c.id)).map(cam => (
            <button
              key={cam.id}
              onClick={() => toggleCamera(cam.id)}
              className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition"
            >
              + {cam.name}
            </button>
          ))}
          {cameras.filter(c => !selected.includes(c.id)).length === 0 && (
            <p className="text-gray-600 text-xs">Todas las cámaras están en la cuadrícula</p>
          )}
        </div>
      </div>
    </div>

  );
}
