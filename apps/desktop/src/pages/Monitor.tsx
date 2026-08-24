import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
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
  const [fpsMap, setFpsMap] = useState<Record<string, number>>({});
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const intervals = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    loadCameras();
    return () => {
      intervals.current.forEach(id => clearInterval(id));
      intervals.current.clear();
    };
  }, []);

  useEffect(() => {
    intervals.current.forEach(id => clearInterval(id));
    intervals.current.clear();
    selected.forEach(camId => startStream(camId));
  }, [selected]);

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

  function startStream(cameraId: string) {
    let count = 0;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/cameras/${cameraId}/snapshot`, { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (data) {
            const canvas = canvasRefs.current.get(cameraId);
            if (canvas) {
              const img = new Image();
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0);
              };
              img.src = `data:image/jpeg;base64,${data}`;
            }
          }
        }
        count++;
        if (count % 5 === 0) {
          setFpsMap(prev => ({ ...prev, [cameraId]: 2 }));
        }
      } catch (e) {
        // silent
      }
    }, 500);
    intervals.current.set(cameraId, interval);
  }

  function toggleCamera(cameraId: string) {
    setSelected(prev => {
      if (prev.includes(cameraId)) return prev.filter(id => id !== cameraId);
      return [...prev, cameraId];
    });
  }

  function getCameraName(cameraId: string) {
    return cameras.find(c => c.id === cameraId)?.name || cameraId;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Monitoreo en Vivo</h1>
        <div className="flex items-center gap-2 text-gray-500">
          <Spinner size="sm" />
          <span className="text-sm">Cargando cámaras...</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 aspect-video animate-pulse" />
          ))}
        </div>
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">{fpsMap[camId] || 0} FPS</span>
                <button
                  onClick={() => toggleCamera(camId)}
                  className="text-gray-500 hover:text-red-400 text-[10px]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <canvas
                ref={el => {
                  if (el) canvasRefs.current.set(camId, el);
                }}
                className="max-w-full max-h-full"
              />
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
