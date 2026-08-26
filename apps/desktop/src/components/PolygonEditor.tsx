import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, ZoneType } from '@security-ai/shared';

interface PolygonEditorProps {
  imageUrl?: string;
  width: number;
  height: number;
  existingZones?: ZoneData[];
  onZoneCreated?: (zone: ZoneData) => void;
  onZoneDeleted?: (zoneId: string) => void;
}

export interface ZoneData {
  id?: string;
  name: string;
  polygon: Point[];
  type: ZoneType;
}

export default function PolygonEditor({
  imageUrl,
  width,
  height,
  existingZones = [],
  onZoneCreated,
  onZoneDeleted,
}: PolygonEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [zones, setZones] = useState<ZoneData[]>(existingZones);
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>(ZoneType.MONITORED);
  const [isPlacing, setIsPlacing] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    zones.forEach((zone) => {
      drawZone(ctx, zone, false);
    });

    if (currentPoints.length > 0) {
      drawZone(ctx, { name: '', polygon: currentPoints, type: zoneType }, true);
    }
  }, [zones, currentPoints, zoneType, width, height]);

  useEffect(() => { redraw(); }, [redraw]);

  function drawZone(ctx: CanvasRenderingContext2D, zone: ZoneData, isTemp: boolean) {
    if (zone.polygon.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(zone.polygon[0].x, zone.polygon[0].y);
    zone.polygon.forEach((p, i) => {
      if (i > 0) ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();

    const colors: Record<string, { fill: string; stroke: string }> = {
      MONITORED: { fill: 'rgba(59,130,246,0.2)', stroke: '#3b82f6' },
      RESTRICTED: { fill: 'rgba(239,68,68,0.2)', stroke: '#ef4444' },
      IGNORE: { fill: 'rgba(107,114,128,0.2)', stroke: '#6b7280' },
    };
    const c = colors[zone.type] || colors.MONITORED;

    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = isTemp ? '#fff' : c.stroke;
    ctx.lineWidth = isTemp ? 2 : 1;
    ctx.stroke();

    if (zone.name && !isTemp) {
      const centerX = zone.polygon.reduce((s, p) => s + p.x, 0) / zone.polygon.length;
      const centerY = zone.polygon.reduce((s, p) => s + p.y, 0) / zone.polygon.length;
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, centerX, centerY);
    }
  }

  function getCanvasPoint(e: React.MouseEvent): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  function handleClick(e: React.MouseEvent) {
    if (!isPlacing) return;
    const point = getCanvasPoint(e);
    setCurrentPoints((prev) => [...prev, point]);
  }

  function handleDoubleClick() {
    if (!isPlacing || currentPoints.length < 3) return;
    const newZone: ZoneData = {
      name: zoneName || `Zona ${zones.length + 1}`,
      polygon: currentPoints,
      type: zoneType,
    };
    setZones((prev) => [...prev, newZone]);
    setCurrentPoints([]);
    setIsPlacing(false);
    setZoneName('');
    onZoneCreated?.(newZone);
  }

  function deleteZone(index: number) {
    const zone = zones[index];
    setZones((prev) => prev.filter((_, i) => i !== index));
    if (zone.id) onZoneDeleted?.(zone.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="Nombre de zona"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
        />
        <select
          value={zoneType}
          onChange={(e) => setZoneType(e.target.value as ZoneType)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
        >
          <option value={ZoneType.MONITORED}>Monitoreada</option>
          <option value={ZoneType.RESTRICTED}>Restringida</option>
          <option value={ZoneType.IGNORE}>Ignorar</option>
        </select>
        <button
          onClick={() => setIsPlacing(!isPlacing)}
          className={`px-3 py-1.5 rounded text-sm ${
            isPlacing ? 'bg-red-600 hover:bg-red-700' : 'bg-security-600 hover:bg-security-700'
          }`}
        >
          {isPlacing ? 'Cancelar' : 'Dibujar Zona'}
        </button>
        {isPlacing && (
          <span className="text-xs text-gray-400">
            Click para agregar puntos ({currentPoints.length}). Doble-click para cerrar.
          </span>
        )}
      </div>

      <div className="relative border border-gray-700 rounded overflow-hidden">
        {imageUrl && (
          <img
            src={imageUrl}
            className="absolute inset-0 w-full h-full object-contain"
            alt="Vista de cámara"
          />
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="relative w-full cursor-crosshair"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      {zones.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Zonas creadas:</p>
          {zones.map((zone, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  zone.type === 'RESTRICTED' ? 'bg-red-500' :
                  zone.type === 'MONITORED' ? 'bg-blue-500' : 'bg-gray-500'
                }`} />
                <span>{zone.name}</span>
                <span className="text-xs text-gray-500">{zone.type}</span>
              </div>
              <button onClick={() => deleteZone(i)} className="text-red-400 hover:text-red-300 text-xs">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
