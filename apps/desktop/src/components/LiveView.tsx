import { useEffect, useState } from 'react';
import { api, AI_BASE } from '../lib/api';

interface LiveViewProps {
  cameraId: string;
  onClose?: () => void;
}

export default function LiveView({ cameraId, onClose }: LiveViewProps) {
  const [camera, setCamera] = useState<any>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [streamError, setStreamError] = useState(false);

  useEffect(() => {
    setStreamReady(false);
    setStreamError(false);
    loadCamera();
  }, [cameraId]);

  async function loadCamera() {
    try {
      const data = await api.cameras.get(cameraId);
      setCamera(data);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${streamReady ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-sm font-medium">{camera?.name || cameraId}</span>
          <span className="text-xs text-gray-500">{camera?.status}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {streamReady && <span className="text-green-400">EN VIVO</span>}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="relative bg-black aspect-video flex items-center justify-center">
        {!streamError ? (
          <img
            src={`${AI_BASE}/sources/${cameraId}/stream`}
            alt={camera?.name || cameraId}
            className="max-w-full max-h-full"
            onLoad={() => setStreamReady(true)}
            onError={() => {
              setStreamError(true);
              setStreamReady(false);
            }}
          />
        ) : (
          <div className="text-center text-gray-600">
            <p className="text-4xl mb-2">📷</p>
            <p className="text-sm">Sin señal — iniciá la cámara para ver el video</p>
          </div>
        )}
      </div>
    </div>
  );
}
