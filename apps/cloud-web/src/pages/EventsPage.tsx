import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { useOrganizations } from '../organizations/OrganizationProvider';
import { CloudEvent } from '../types';

function eventLabel(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return 'Sin metadatos adicionales';
  return entries.map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' · ');
}

export function EventsPage() {
  const { selected } = useOrganizations();
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEvents([]);
    setError(null);
    if (!selected) return;
    let active = true;
    setLoading(true);
    api.get<CloudEvent[]>(`/v1/organizations/${selected.organizationId}/events`)
      .then((result) => { if (active) setEvents(result); })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los eventos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected?.organizationId]);

  if (!selected) return <><PageHeader eyebrow="Bitácora cloud" title="Eventos" description="Metadatos recientes enviados por sus instalaciones." /><EmptyOrganization /></>;

  return (
    <>
      <PageHeader eyebrow="Bitácora cloud" title="Eventos" description="Metadatos recientes enviados por sus instalaciones." />
      <div className="evidence-banner"><span>▣</span><div><b>La evidencia permanece local</b><p>Este portal muestra metadatos operativos. Las grabaciones no se almacenan ni se transfieren con esta consulta.</p></div></div>
      {error && <div className="notice error" role="alert">{error}</div>}
      <section className="panel events-panel">
        <div className="panel-heading"><div><p className="eyebrow">Últimos registros</p><h2>Actividad detectada</h2></div><span>Máx. 100</span></div>
        {loading ? <div className="skeleton-list"><i /><i /><i /></div> : events.length === 0 ? (
          <div className="inline-empty"><span>00</span><p>No hay eventos recientes para esta organización.</p></div>
        ) : (
          <div className="event-list">
            {events.map((event) => {
              const date = new Date(event.occurredAt);
              return (
                <article key={event.id}>
                  <time dateTime={event.occurredAt}><b>{date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</b><small>{date.toLocaleDateString('es', { day: '2-digit', month: 'short' })}</small></time>
                  <span className={`event-marker ${event.eventType.includes('WEAPON') ? 'critical' : ''}`} />
                  <div className="event-detail"><h3>{eventLabel(event.eventType)}</h3><p>{formatMetadata(event.metadata)}</p><small>Cámara: {event.cloudCameraId ?? 'No asociada'} · Evento local: {event.localEventId}</small></div>
                  <span className="metadata-only">METADATOS</span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
