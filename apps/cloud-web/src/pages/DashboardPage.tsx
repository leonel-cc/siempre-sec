import { FormEvent, useState } from 'react';
import { PageHeader } from '../components/AppShell';
import { roleLabel, useOrganizations } from '../organizations/OrganizationProvider';
import { config } from '../config';

export function DashboardPage() {
  const { memberships, selected, loading, error, select, create } = useOrganizations();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await create(name.trim());
      setName('');
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'No se pudo crear la organización.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Vista general" title="Centro de control" description="Organizaciones y accesos bajo una sola operación." />
      {(error || formError) && <div className="notice error" role="alert">{error ?? formError}</div>}

      <section className="metric-strip">
        <article><span>ORGANIZACIONES</span><strong>{memberships.length.toString().padStart(2, '0')}</strong><small>vinculadas a su identidad</small></article>
        <article><span>ORGANIZACIÓN ACTIVA</span><strong className="metric-name">{selected?.organization.name ?? 'Sin asignar'}</strong><small>{selected ? roleLabel(selected.role) : 'Cree la primera para comenzar'}</small></article>
        <article className="system-ok"><span>ESTADO DEL PORTAL</span><strong><i />{config.developmentAuth ? 'Desarrollo' : 'Protegido'}</strong><small>{config.developmentAuth ? 'Identidad local temporal' : 'Sesión y API autenticadas'}</small></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel organization-list">
          <div className="panel-heading"><div><p className="eyebrow">Acceso</p><h2>Sus organizaciones</h2></div><span>{memberships.length} total</span></div>
          {loading ? <div className="skeleton-list"><i /><i /><i /></div> : memberships.length === 0 ? (
            <div className="inline-empty"><span>01</span><p>Aún no hay organizaciones.<br />Cree la primera desde este portal.</p></div>
          ) : memberships.map((membership, index) => (
            <button
              className={`organization-row ${selected?.id === membership.id ? 'selected' : ''}`}
              key={membership.id}
              onClick={() => select(membership.organizationId)}
            >
              <span className="row-number">{String(index + 1).padStart(2, '0')}</span>
              <span><b>{membership.organization.name}</b><small>{membership.email}</small></span>
              <em>{roleLabel(membership.role)}</em><i>→</i>
            </button>
          ))}
        </section>

        <section className="panel create-panel">
          <p className="eyebrow">Nuevo perímetro</p>
          <h2>Crear organización</h2>
          <p>Agrupe instalaciones, cámaras y operadores en un espacio independiente.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="organization-name">Nombre de la organización</label>
            <input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej. Torre Norte" required />
            <button className="button primary" disabled={creating || !name.trim()}>{creating ? 'Creando…' : 'Crear organización'}</button>
          </form>
          <small className="security-note">Usted será asignado como propietario.</small>
        </section>
      </div>
    </>
  );
}
