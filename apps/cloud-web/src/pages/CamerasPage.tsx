import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { LiveCameraViewer } from '../components/LiveCameraViewer';
import { useOrganizations } from '../organizations/OrganizationProvider';
import { Camera, ViewSession } from '../types';

interface ActiveView {
  camera: Camera;
  session: ViewSession;
}

function isOffline(camera: Camera): boolean {
  return !camera.enabled || camera.online === false || camera.status?.toLowerCase() === 'offline';
}

export function CamerasPage() {
  const { selected } = useOrganizations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const installationFilter = searchParams.get('installationId');
  const visibleCameras = installationFilter
    ? cameras.filter((camera) => camera.installationId === installationFilter)
    : cameras;

  useEffect(() => {
    setActiveView(null);
    setCameras([]);
    setError(null);
    if (!selected) return;
    let active = true;
    setLoading(true);
    api.get<Camera[]>(`/v1/organizations/${selected.organizationId}/cameras`)
      .then((result) => { if (active) setCameras(result); })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las cámaras.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected?.organizationId]);

  const openCamera = async (camera: Camera) => {
    if (!selected || isOffline(camera)) return;
    setOpeningId(camera.id);
    setError(null);
    setActiveView(null);
    try {
      const session = await api.post<ViewSession>(`/v1/organizations/${selected.organizationId}/cameras/${camera.id}/view-sessions`);
      setActiveView({ camera, session });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la vista remota.');
    } finally {
      setOpeningId(null);
    }
  };

  if (!selected) return <><PageHeader eyebrow="Video remoto" title="Cámaras" description="Abra sesiones temporales sin trasladar la custodia de la evidencia." /><EmptyOrganization /></>;

  return (
    <>
      <PageHeader
        eyebrow="Video remoto"
        title="Cámaras"
        description="Abra sesiones temporales sin trasladar la custodia de la evidencia."
        action={<div className="live-legend"><i /> Conexión bajo demanda</div>}
      />
      {error && <div className="notice error" role="alert">{error}</div>}
      {installationFilter && (
        <div className="context-filter">
          <span>Mostrando cámaras de la instalación <b>{installationFilter}</b></span>
          <button onClick={() => setSearchParams({})}>Ver todas</button>
        </div>
      )}
      {activeView && <LiveCameraViewer camera={activeView.camera} session={activeView.session} onClose={() => setActiveView(null)} />}
      <section className="camera-section">
        <div className="section-heading"><h2>Inventario sincronizado</h2><span>{visibleCameras.length} cámaras</span></div>
        {loading ? <div className="camera-grid"><div className="camera-skeleton" /><div className="camera-skeleton" /><div className="camera-skeleton" /></div> : visibleCameras.length === 0 ? (
          <section className="empty-state compact"><span className="empty-icon">◉</span><h2>Sin cámaras sincronizadas</h2><p>Vincule una instalación y espere su primera sincronización.</p></section>
        ) : (
          <div className="camera-grid">
            {visibleCameras.map((camera, index) => {
              const offline = isOffline(camera);
              return (
                <article className={`camera-card ${offline ? 'offline' : ''}`} key={camera.id}>
                  <div className="camera-preview">
                    <span className="camera-index">CAM {String(index + 1).padStart(2, '0')}</span>
                    <span className="lens"><i /><i /></span>
                    <span className={`camera-state ${offline ? 'offline' : 'ready'}`}><i />{offline ? 'Fuera de línea' : 'Disponible'}</span>
                  </div>
                  <div className="camera-info"><div><h3>{camera.displayName}</h3><p>Instalación · {camera.installationId}</p><p>ID local · {camera.localCameraId}</p></div><button onClick={() => void openCamera(camera)} disabled={offline || openingId === camera.id}>{openingId === camera.id ? '…' : 'Ver'}</button></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
