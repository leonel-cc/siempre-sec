import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';
import { EmptyOrganization, PageHeader } from '../components/AppShell';
import { canAdminister, useOrganizations } from '../organizations/OrganizationProvider';
import { PhoneChallenge } from '../types';

export function PhoneVerificationPage() {
  const { selected } = useOrganizations();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setChallenge(null);
    setCode('');
    setMessage(null);
  }, [selected?.organizationId]);

  if (!selected) return <><PageHeader eyebrow="Canal de alertas" title="Verificar teléfono" description="Confirme el número que recibirá notificaciones críticas." /><EmptyOrganization /></>;
  const allowed = canAdminister(selected.role);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!allowed) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.post<PhoneChallenge>('/v1/phone-verification/request', {
        organizationId: selected.organizationId,
        phone: phone.trim(),
      });
      setChallenge(response);
      setMessage({ kind: 'success', text: 'Código solicitado. Revise el teléfono indicado.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo solicitar el código.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge || !allowed) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post<{ verified: true; recipientId: string }>('/v1/phone-verification/confirm', {
        organizationId: selected.organizationId,
        challengeId: challenge.challengeId,
        code,
      });
      setChallenge(null);
      setCode('');
      setMessage({ kind: 'success', text: 'Teléfono verificado. Las alertas críticas usarán este destino.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo verificar el código.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Canal de alertas" title="Verificar teléfono" description="Confirme el número que recibirá notificaciones críticas." />
      <div className="phone-layout">
        <section className="panel phone-panel">
          <div className="channel-badge"><span>WA</span><div><b>WhatsApp</b><small>Canal de autenticación</small></div><i /></div>
          {!allowed && <div className="notice warning">Esta acción requiere el rol Propietario o Administrador.</div>}
          {message && <div className={`notice ${message.kind}`}>{message.text}</div>}
          {!challenge ? (
            <form onSubmit={(event) => void requestCode(event)}>
              <label htmlFor="phone">Teléfono con código de país</label>
              <input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+52 55 1234 5678" maxLength={40} required disabled={!allowed} />
              <p className="field-help">Solo se conservará el número normalizado necesario para entregar alertas.</p>
              <button className="button primary" disabled={!allowed || busy || !phone.trim()}>{busy ? 'Solicitando…' : 'Enviar código de verificación'}</button>
            </form>
          ) : (
            <form onSubmit={(event) => void confirmCode(event)}>
              <label htmlFor="verification-code">Código de seis dígitos</label>
              <input
                className="code-input six"
                id="verification-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                pattern="\d{6}"
                required
              />
              {challenge.developmentCode && (
                <div className="development-code"><span>Solo desarrollo</span><b>{challenge.developmentCode}</b></div>
              )}
              <p className="field-help">Válido hasta {new Date(challenge.expiresAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.</p>
              <div className="button-row">
                <button type="button" className="button secondary" onClick={() => setChallenge(null)}>Cambiar número</button>
                <button className="button primary" disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Confirmar teléfono'}</button>
              </div>
            </form>
          )}
        </section>
        <aside className="privacy-card"><span>LOCAL / CLOUD</span><h2>Alertas precisas.<br />Evidencia privada.</h2><p>El canal cloud transporta metadatos y notificaciones. Las grabaciones permanecen bajo custodia de su instalación.</p><i>02</i></aside>
      </div>
    </>
  );
}
