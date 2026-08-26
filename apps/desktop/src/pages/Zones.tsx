import { useEffect, useState } from 'react';
import { api, AI_BASE } from '../lib/api';
import PolygonEditor from '../components/PolygonEditor';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function Zones() {
  const [zones, setZones] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [z, c] = await Promise.all([api.zones.list(), api.cameras.list()]);
      setZones(z);
      setCameras(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleZoneCreated(zone: any) {
    if (!selectedCamera) return;
    try {
      await api.zones.create({
        camera_id: selectedCamera,
        name: zone.name,
        polygon: zone.polygon,
        type: zone.type,
      });
      loadData();
    } catch (e) { console.error(e); }
  }

  async function deleteZone(id: string) {
    try { await api.zones.remove(id); loadData(); }
    catch (e) { console.error(e); }
  }

  const typeLabel: Record<string, { label: string; color: string }> = {
    MONITORED: { label: 'Monitoreada', color: 'bg-blue-900/50 text-blue-400' },
    RESTRICTED: { label: 'Restringida', color: 'bg-red-900/50 text-red-400' },
    IGNORE: { label: 'Ignorar', color: 'bg-gray-800 text-gray-500' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zonas de Vigilancia</h1>
        <button onClick={() => setShowEditor(!showEditor)}
          className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">
          {showEditor ? 'Cerrar Editor' : '+ Crear Zona'}
        </button>
      </div>

      {showEditor && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Cámara:</label>
            <select value={selectedCamera || ''} onChange={e => setSelectedCamera(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm">
              <option value="">Seleccionar cámara</option>
              {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedCamera && (
            <PolygonEditor
              imageUrl={`${AI_BASE}/sources/${selectedCamera}/stream`}
              width={1280} height={720}
              onZoneCreated={handleZoneCreated}
            />
          )}
          {!selectedCamera && (
            <p className="text-sm text-gray-500">Selecciona una cámara para dibujar zonas</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">🗺️</p>
          <p>No hay zonas configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{zone.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${typeLabel[zone.type]?.color || ''}`}>
                  {typeLabel[zone.type]?.label || zone.type}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {zone.polygon?.length || 0} puntos
              </p>
              <button onClick={() => deleteZone(zone.id)}
                className="mt-2 text-xs text-red-400 hover:text-red-300">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
