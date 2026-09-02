import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { canAdminister, useOrganizations } from '../organizations/OrganizationProvider';
import { Installation } from '../types';

const ONLINE_THRESHOLD_MS = 120_000;

function installationStatus(installation: Installation): { className: string; label: string } {
  if (installation.revokedAt) return { className: 'revoked', label: 'Revocada' };
  if (!installation.lastHeartbeatAt) return { className: 'pending', label: 'Pendiente' };
  const online = Date.now() - new Date(installation.lastHeartbeatAt).getTime() < ONLINE_THRESHOLD_MS;
  return online
    ? { className: 'online', label: 'En línea' }
    : { className: 'offline', label: 'Fuera de línea' };
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin heartbeat recibido';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

export function InstallationsPage() {
  const { selected } = useOrganizations();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = canAdminister(selected?.role);

  useEffect(() => {
    setInstallations([]);
    setError(null);
    setLoading(false);
    if (!selected || !allowed) return;

    let active = true;
    setLoading(true);
    api.get<Installation[]>(`/v1/organizations/${selected.organizationId}/installations`)
      .then((result) => { if (active) setInstallations(result); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar las instalaciones.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected?.organizationId, allowed]);

  if (!selected) return <><PageHeader eyebrow="Inventario cloud" title="Instalaciones" description="Supervise los equipos vinculados a su organización." /><EmptyOrganization /></>;

  return (
    <>
      <PageHeader
        eyebrow="Inventario cloud"
        title="Instalaciones"
        description={`Equipos vinculados a ${selected.organization.name}, incluidos los que todavía no tienen contactos de alerta.`}
        action={<Link className="button primary" to="/enrollment">Vincular instalación</Link>}
      />
      {!allowed ? (
        <div className="notice warning" role="status">La consulta de instalaciones requiere el rol Propietario o Administrador.</div>
      ) : (
        <section className="panel installations-panel">
          <div className="panel-heading"><div><p className="eyebrow">Equipos vinculados</p><h2>Estado operativo</h2></div><span>{installations.length} instalaciones</span></div>
          {error && <div className="installation-error"><div className="notice error" role="alert">{error}</div></div>}
          {loading ? (
            <div className="skeleton-list"><i /><i /><i /></div>
          ) : !error && installations.length === 0 ? (
            <div className="inline-empty"><span>◇</span><p>No hay instalaciones vinculadas a esta organización.</p></div>
          ) : !error && (
            <div className="installation-list">
              {installations.map((installation) => {
                const status = installationStatus(installation);
                const query = `?installationId=${encodeURIComponent(installation.id)}`;
                return (
                  <article className="installation-row" key={installation.id}>
                    <div className="installation-identity"><span>◇</span><div><h3>{installation.name}</h3><small>{installation.id}</small></div></div>
                    <div className="installation-field"><small>Plataforma</small><strong>{installation.platform}</strong></div>
                    <div className="installation-field"><small>Estado</small><span className={`installation-status ${status.className}`}><i />{status.label}</span></div>
                    <div className="installation-field heartbeat"><small>Último heartbeat</small><time dateTime={installation.lastHeartbeatAt ?? undefined}>{formatDate(installation.lastHeartbeatAt)}</time></div>
                    <div className="installation-links"><Link to={`/cameras${query}`}>Cámaras</Link><Link to={`/phone${query}`}>Contactos</Link></div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
