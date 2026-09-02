import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { canAdminister, useOrganizations } from '../organizations/OrganizationProvider';
import { PhoneRecipient } from '../types';

type Message = { kind: 'success' | 'error'; text: string };

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusDetails(recipient: PhoneRecipient): { className: string; label: string } {
  if (recipient.requiresReverification) {
    return { className: 'pending', label: 'Requiere reverificación local' };
  }
  return recipient.enabled
    ? { className: 'active', label: 'Activo' }
    : { className: 'disabled', label: 'Desactivado' };
}

export function PhoneVerificationPage() {
  const { selected } = useOrganizations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recipients, setRecipients] = useState<PhoneRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [reload, setReload] = useState(0);
  const allowed = canAdminister(selected?.role);
  const installationFilter = searchParams.get('installationId');

  useEffect(() => {
    setRecipients([]);
    setLoadError(null);
    setMessage(null);
    setLoading(false);
    if (!selected || !allowed) return;

    let active = true;
    setLoading(true);
    api.get<PhoneRecipient[]>(`/v1/organizations/${selected.organizationId}/whatsapp-recipients`)
      .then((result) => { if (active) setRecipients(result); })
      .catch((error: unknown) => {
        if (active) setLoadError(messageFrom(error, 'No se pudieron cargar los contactos de WhatsApp.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected?.organizationId, allowed, reload]);

  const setRecipientEnabled = async (recipient: PhoneRecipient) => {
    if (!selected || !allowed) return;
    setChangingId(recipient.id);
    setMessage(null);
    try {
      const action = recipient.enabled ? 'deactivate' : 'activate';
      const updated = await api.post<PhoneRecipient>(
        `/v1/organizations/${selected.organizationId}/whatsapp-recipients/${recipient.id}/${action}`,
      );
      setRecipients((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setMessage({
        kind: 'success',
        text: updated.enabled ? 'Contacto activado para recibir alertas.' : 'Contacto desactivado.',
      });
    } catch (error) {
      setMessage({ kind: 'error', text: messageFrom(error, 'No se pudo cambiar el estado del contacto.') });
    } finally {
      setChangingId(null);
    }
  };

  const removeRecipient = async (recipient: PhoneRecipient) => {
    if (!selected || !allowed || !window.confirm(`¿Eliminar a ${recipient.contactName} (${recipient.phoneMask})? Esta acción no se puede deshacer.`)) return;

    setChangingId(recipient.id);
    setMessage(null);
    try {
      await api.delete(
        `/v1/organizations/${selected.organizationId}/whatsapp-recipients/${recipient.id}`,
      );
      setRecipients((current) => current.filter((item) => item.id !== recipient.id));
      setMessage({ kind: 'success', text: 'Contacto de alerta eliminado.' });
    } catch (error) {
      setMessage({ kind: 'error', text: messageFrom(error, 'No se pudo eliminar el contacto.') });
    } finally {
      setChangingId(null);
    }
  };

  if (!selected) return <><PageHeader eyebrow="Canal de alertas" title="Contactos WhatsApp" description="Administre los contactos de alerta de las instalaciones de su organización." /><EmptyOrganization /></>;

  if (!allowed) return (
    <>
      <PageHeader eyebrow="Canal de alertas" title="Contactos WhatsApp" description="Administre los contactos de alerta de las instalaciones de su organización." />
      <div className="notice warning" role="status">La consulta y administración de contactos requiere el rol Propietario o Administrador.</div>
    </>
  );

  const visibleRecipients = installationFilter
    ? recipients.filter((recipient) => recipient.installationId === installationFilter)
    : recipients;

  const installations = Array.from(
    visibleRecipients.reduce((groups, recipient) => {
      const current = groups.get(recipient.installationId) ?? [];
      current.push(recipient);
      groups.set(recipient.installationId, current);
      return groups;
    }, new Map<string, PhoneRecipient[]>()),
  );

  return (
    <>
      <PageHeader
        eyebrow="Canal de alertas"
        title="Contactos WhatsApp"
        description={`Administre los contactos de alerta de las instalaciones de ${selected.organization.name}.`}
      />

      {message && <div className={`notice ${message.kind}`} role="status">{message.text}</div>}
      {installationFilter && (
        <div className="context-filter">
          <span>Mostrando contactos de la instalación <b>{installationFilter}</b></span>
          <button onClick={() => setSearchParams({})}>Ver todas</button>
        </div>
      )}

      <div className="phone-management-layout">
        <section className="panel recipient-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Instalaciones</p><h2>Contactos de alerta</h2></div>
            <span>{visibleRecipients.length} {visibleRecipients.length === 1 ? 'contacto' : 'contactos'}</span>
          </div>

          {loadError && (
            <div className="recipient-load-error">
              <div className="notice error" role="alert">{loadError}</div>
              <button className="button secondary" onClick={() => setReload((value) => value + 1)}>Reintentar</button>
            </div>
          )}

          {loading ? (
            <div className="skeleton-list"><i /><i /><i /></div>
          ) : !loadError && visibleRecipients.length === 0 ? (
            <div className="inline-empty recipient-empty"><span>⌁</span><p>No hay contactos de alerta.<br />Las altas y verificaciones se realizan desde la app instalada.</p></div>
          ) : !loadError && (
            <div className="recipient-list">
              {installations.map(([installationId, installationRecipients]) => (
                <section className="installation-recipients" key={installationId}>
                  <header>
                    <div><h3>{installationRecipients[0].installationName?.trim() || 'Instalación sin nombre'}</h3><small>ID {installationId}</small></div>
                    <span>{installationRecipients.length} {installationRecipients.length === 1 ? 'contacto' : 'contactos'}</span>
                  </header>
                  {installationRecipients.map((recipient) => {
                    const status = statusDetails(recipient);
                    const changing = changingId === recipient.id;
                    return (
                      <article className="recipient-row" key={recipient.id}>
                        <div className="recipient-icon">WA</div>
                        <div className="recipient-identity">
                          <strong>{recipient.contactName}</strong>
                          <small>{recipient.phoneMask}</small>
                        </div>
                        <span className={`recipient-status ${status.className}`}><i />{status.label}</span>
                        <div className="recipient-actions">
                          <button className="button secondary" disabled={changing || recipient.requiresReverification} onClick={() => void setRecipientEnabled(recipient)}>
                            {recipient.enabled ? 'Desactivar' : 'Activar'}
                          </button>
                          <button className="recipient-delete" disabled={changing} onClick={() => void removeRecipient(recipient)} aria-label={`Eliminar a ${recipient.contactName}`}>
                            Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </section>

        <aside className="panel recipient-guide">
          <div className="channel-badge"><span>WA</span><div><b>Gestión desde la instalación</b><small>Alta y verificación local</small></div><i /></div>
          <h2>Los contactos se registran en la app instalada</h2>
          <p>Use la aplicación de cada instalación para dar de alta el contacto y verificar su número de WhatsApp. Una vez verificado, aparecerá automáticamente aquí para que el administrador pueda activarlo, desactivarlo o eliminarlo.</p>
          <small className="security-note">VERIFICACIÓN LOCAL / ADMINISTRACIÓN CLOUD</small>
        </aside>
      </div>
    </>
  );
}
