import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { onEvent } from '../lib/websocket';
import LiveView from '../components/LiveView';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function Cameras() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [scanningUsb, setScanningUsb] = useState(false);
  const [usbDevices, setUsbDevices] = useState<Array<{ index: number; name: string }>>([]);
  const [form, setForm] = useState({ name: '', host: '', port: 554, username: '', password: '', rtsp_url: '' });
  const [videoPath, setVideoPath] = useState('');
  const [testingVideo, setTestingVideo] = useState(false);
  const [videoMessage, setVideoMessage] = useState('');
  const [cameraThreats, setCameraThreats] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCameras();
    const unsub = onEvent('security.alert', (alert: any) => {
      if (alert.camera_id && alert.severity) {
        setCameraThreats(prev => {
          const current = prev[alert.camera_id] || 'SAFE';
          const priority: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, SAFE: 0 };
          if ((priority[alert.severity] || 0) > (priority[current] || 0)) {
            return { ...prev, [alert.camera_id]: alert.severity };
          }
          return prev;
        });
      }
    });
    return unsub;
  }, []);

  async function loadCameras() {
    try {
      const data = await api.cameras.list();
      setCameras(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function addCamera() {
    try {
      const isUsb = form.rtsp_url.startsWith('device://');
      await api.cameras.create({
        name: form.name,
        host: isUsb ? 'local' : form.host,
        port: isUsb ? 0 : form.port,
        username: form.username,
        password: form.password,
        rtsp_url: isUsb
          ? form.rtsp_url
          : form.rtsp_url || `rtsp://${form.host}:${form.port}/stream`,
        connection_type: isUsb ? 'WEBCAM' : 'RTSP',
      });
      setShowAddForm(false);
      setForm({ name: '', host: '', port: 554, username: '', password: '', rtsp_url: '' });
      loadCameras();
    } catch (e) { console.error(e); }
  }

  async function discover() {
    setDiscovering(true);
    try {
      const data = await api.cameras.discover();
      setDiscovered(data?.devices || []);
    } catch (e) { console.error(e); }
    finally { setDiscovering(false); }
  }

  async function scanUsb() {
    setScanningUsb(true);
    try {
      const data = await api.cameras.usbDevices();
      setUsbDevices(data?.devices || []);
    } catch (e) { console.error(e); }
    finally { setScanningUsb(false); }
  }

  function useUsbCamera(device: { index: number; name: string }) {
    setForm({
      name: device.name,
      host: 'local',
      port: 0,
      username: '',
      password: '',
      rtsp_url: `device://${device.index}`,
    });
    setUsbDevices([]);
    setShowAddForm(true);
  }

  async function startCamera(id: string) {
    try {
      await fetch(`http://localhost:3000/api/cameras/${id}/start`, { method: 'POST' });
      loadCameras();
    } catch (e) { console.error(e); }
  }

  async function stopCamera(id: string) {
    try {
      await fetch(`http://localhost:3000/api/cameras/${id}/stop`, { method: 'POST' });
      loadCameras();
    } catch (e) { console.error(e); }
  }

  async function deleteCamera(id: string) {
    try {
      await api.cameras.remove(id);
      if (selectedCamera === id) setSelectedCamera(null);
      loadCameras();
    } catch (e) { console.error(e); }
  }

  async function startTestVideo() {
    if (!videoPath.trim()) return;
    setTestingVideo(true);
    setVideoMessage('');
    try {
      const sourceId = 'test_video_' + Date.now();
      const res = await fetch('http://localhost:3000/api/cameras/start-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_id: sourceId, file_path: videoPath.trim(), loop: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setVideoMessage('Video procesándose. Mirá el Dashboard para ver detecciones.');
        loadCameras();
      } else {
        setVideoMessage(`Error: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setVideoMessage(`Error de conexión: ${e.message}`);
      console.error(e);
    }
    finally { setTestingVideo(false); }
  }

  async function pickVideoFile() {
    const path = await (window as any).electronAPI?.openFileDialog({
      filters: [{ name: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'webm', 'mov', 'flv'] }],
    });
    if (path) setVideoPath(path);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cámaras</h1>
        <div className="flex gap-2">
          <button onClick={scanUsb} disabled={scanningUsb}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm disabled:opacity-50">
            {scanningUsb ? 'Buscando...' : '📷 Cámaras USB'}
          </button>
          <button onClick={discover} disabled={discovering}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm disabled:opacity-50">
            {discovering ? 'Buscando...' : '🔍 Buscar (ONVIF)'}
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">
            + Agregar Cámara
          </button>
        </div>
      </div>

      {usbDevices.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Cámaras USB detectadas</h2>
          <div className="grid grid-cols-2 gap-3">
            {usbDevices.map((d) => (
              <div key={d.index} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-gray-500">Dispositivo {d.index}</p>
                </div>
                <button onClick={() => useUsbCamera(d)}
                  className="text-xs text-security-400 hover:text-security-300">
                  Usar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {discovered.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Cámaras encontradas (ONVIF)</h2>
          <div className="grid grid-cols-2 gap-3">
            {discovered.map((d, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{d.manufacturer} {d.model}</p>
                  <p className="text-xs text-gray-500">{d.ip}</p>
                </div>
                <button onClick={() => { setForm({ ...form, host: d.ip, name: d.model || d.ip }); setShowAddForm(true); setDiscovered([]); }}
                  className="text-xs text-security-400 hover:text-security-300">
                  Usar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400">Agregar Cámara</h2>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nombre" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.host} onChange={e => setForm({...form, host: e.target.value})} placeholder="IP / Host" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value) || 554})} placeholder="Puerto" type="number" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Usuario" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Password" type="password" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.rtsp_url} onChange={e => setForm({...form, rtsp_url: e.target.value})} placeholder="RTSP URL (opcional)" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={addCamera} className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-400">🎬 Probar con video local</h2>
        <p className="text-xs text-gray-500">Cargá un archivo de video con personas para probar la detección YOLO</p>
        <div className="flex gap-2">
          <input value={videoPath} onChange={e => setVideoPath(e.target.value)}
            placeholder="Seleccioná un archivo de video..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
          <button onClick={pickVideoFile}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
            📁 Examinar
          </button>
          <button onClick={startTestVideo} disabled={testingVideo || !videoPath.trim()}
            className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm disabled:opacity-50">
            {testingVideo ? 'Iniciando...' : '▶ Probar'}
          </button>
        </div>
        <p className="text-xs text-gray-600">Se reproduce en loop. El AI procesa cada frame buscando personas con YOLO.</p>
        {videoMessage && (
          <p className={`text-xs px-3 py-2 rounded ${videoMessage.startsWith('Error') ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
            {videoMessage}
          </p>
        )}
      </div>

      {selectedCamera && (
        <LiveView cameraId={selectedCamera} onClose={() => setSelectedCamera(null)} />
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📷</p>
          <p>No hay cámaras configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {cameras.map((camera) => {
            const threat = cameraThreats[camera.id];
            const threatColors: Record<string, string> = {
              CRITICAL: 'border-red-500/50 shadow-red-500/10',
              HIGH: 'border-orange-500/50 shadow-orange-500/10',
              MEDIUM: 'border-yellow-500/50',
            };
            const threatBadge: Record<string, string> = {
              CRITICAL: 'bg-red-900/50 text-red-400',
              HIGH: 'bg-orange-900/50 text-orange-400',
              MEDIUM: 'bg-yellow-900/50 text-yellow-400',
            };
            return (
              <div key={camera.id}
                className={`bg-gray-900 rounded-xl border p-4 cursor-pointer transition-colors ${
                  selectedCamera === camera.id ? 'border-security-500' :
                  threatColors[threat || ''] || 'border-gray-800 hover:border-gray-700'
                } ${threat ? 'shadow-lg' : ''}`}
                onClick={() => setSelectedCamera(camera.id)}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{camera.name}</h3>
                  <div className="flex items-center gap-2">
                    {threat && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${threatBadge[threat]}`}>
                        {threat}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      camera.status === 'ONLINE' ? 'bg-green-900/50 text-green-400' :
                      camera.status === 'CONNECTING' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>{camera.status}</span>
                  </div>
                </div>
              <p className="text-xs text-gray-500">
                {camera.connectionType === 'WEBCAM' ? camera.rtspUrl : `${camera.host}:${camera.port}`}
              </p>
              <p className="text-xs text-gray-600">{camera.connectionType}</p>
              <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
                {camera.status !== 'ONLINE' ? (
                  <button onClick={() => startCamera(camera.id)} className="text-xs text-green-400 hover:text-green-300">Iniciar</button>
                ) : (
                  <button onClick={() => stopCamera(camera.id)} className="text-xs text-yellow-400 hover:text-yellow-300">Detener</button>
                )}
                <button onClick={() => deleteCamera(camera.id)} className="text-xs text-red-400 hover:text-red-300 ml-2">Eliminar</button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
