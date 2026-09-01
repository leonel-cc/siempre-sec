import { FormEvent, useState } from 'react';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { canAdminister, useOrganizations } from '../organizations/OrganizationProvider';

export function EnrollmentPage() {
  const { selected } = useOrganizations();
  const [userCode, setUserCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  if (!selected) return <><PageHeader eyebrow="Despliegue" title="Vincular instalación" description="Autorice un equipo local mediante su código temporal." /><EmptyOrganization /></>;
  const allowed = canAdminister(selected.role);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!allowed) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.post<{ approved: true }>('/v1/enrollment/approve', {
        userCode: userCode.trim().toUpperCase(),
        organizationId: selected.organizationId,
      });
      setUserCode('');
      setMessage({ kind: 'success', text: 'Instalación aprobada. El equipo ya puede completar la vinculación.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo aprobar la instalación.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Despliegue" title="Vincular instalación" description="Autorice un equipo local mediante su código temporal." />
      <div className="workflow-grid">
        <section className="panel workflow-panel">
          <div className="step-index">01</div>
          <p className="eyebrow">Código del equipo</p>
          <h2>Aprobar conexión</h2>
          <p>Ingrese el código mostrado en la aplicación de escritorio. El código expira y solo puede utilizarse una vez.</p>
          {!allowed && <div className="notice warning">Esta acción requiere el rol Propietario o Administrador.</div>}
          {message && <div className={`notice ${message.kind}`}>{message.text}</div>}
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="user-code">Código de usuario</label>
            <input
              className="code-input"
              id="user-code"
              value={userCode}
              onChange={(event) => setUserCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
              placeholder="AB12CD34"
              minLength={8}
              maxLength={12}
              autoComplete="one-time-code"
              required
              disabled={!allowed}
            />
            <label>Organización de destino</label>
            <div className="locked-value"><span>{selected.organization.name}</span><small>Destino seleccionado</small></div>
            <button className="button primary" disabled={!allowed || submitting || userCode.length < 8}>{submitting ? 'Aprobando…' : 'Aprobar instalación'}</button>
          </form>
        </section>
        <aside className="process-guide">
          <p className="eyebrow">Flujo seguro</p>
          <ol>
            <li><span>1</span><div><b>Inicie el equipo</b><p>La instalación genera un código temporal sin exponer credenciales.</p></div></li>
            <li><span>2</span><div><b>Confirme el destino</b><p>Verifique la organización activa antes de aprobar.</p></div></li>
            <li><span>3</span><div><b>Espere la vinculación</b><p>El equipo intercambia el código y sincroniza sus cámaras.</p></div></li>
          </ol>
        </aside>
      </div>
    </>
  );
}
