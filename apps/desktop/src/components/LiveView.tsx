import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface LiveViewProps {
  cameraId: string;
  onClose?: () => void;
}

export default function LiveView({ cameraId, onClose }: LiveViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<any>(null);
  const [detections, setDetections] = useState<any[]>([]);
  const [fps, setFps] = useState(0);
  const [motion, setMotion] = useState(false);
  const intervalRef = useRef<number>();

  useEffect(() => {
    loadCamera();
    startStreaming();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cameraId]);

  async function loadCamera() {
    try {
      const data = await api.cameras.get(cameraId);
      setCamera(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function startStreaming() {
    intervalRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/cameras/${cameraId}/snapshot`, { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          if (data && canvasRef.current) {
            const img = new Image();
            img.onload = () => {
              const canvas = canvasRef.current;
              if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0);
              }
            };
            img.src = `data:image/jpeg;base64,${data}`;
          }
        }
      } catch (e) {
        // Silent fail - AI service may not be running
      }
    }, 500);
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">{camera?.name || cameraId}</span>
          <span className="text-xs text-gray-500">{camera?.status}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {motion && <span className="text-red-400">MOTION</span>}
          <span>FPS: {fps}</span>
          <span>Detections: {detections.length}</span>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="relative bg-black aspect-video flex items-center justify-center">
        <canvas ref={canvasRef} className="max-w-full max-h-full" />
        {!camera && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <p className="text-4xl mb-2">📷</p>
              <p className="text-sm">Esperando conexión...</p>
            </div>
          </div>
        )}
        {detections.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex gap-1 flex-wrap">
            {detections.map((d, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                d.class === 'person' ? 'bg-green-900/80 text-green-300' :
                d.class === 'car' ? 'bg-blue-900/80 text-blue-300' :
                'bg-gray-800/80 text-gray-300'
              }`}>
                {d.class} {(d.confidence * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
