import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Alerts() {
  const [cloudStatus, setCloudStatus] = useState<CloudEnrollmentStatus>({ state: 'UNENROLLED' });
  const [recipients, setRecipients] = useState<PhoneRecipientView[]>([]);
  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCodes, setVerificationCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      setError('La gestión de alertas sólo está disponible en la aplicación de escritorio.');
      setLoading(false);
      return;
    }
    electronAPI.cloudEnrollment.status()
      .then(async status => {
        setCloudStatus(status);
        if (status.state === 'ENROLLED') {
          setRecipients(await electronAPI.phoneRecipients.list());
        }
      })
      .catch(reason => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function requestCode() {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;
    void run(async () => {
      setRecipients(await electronAPI.phoneRecipients.requestVerification(contactName, phoneNumber));
      setContactName('');
      setPhoneNumber('');
      setMessage('Código generado. Revise WhatsApp o el código de desarrollo mostrado abajo.');
    });
  }

  function confirmCode(challengeId: string) {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;
    void run(async () => {
      setRecipients(await electronAPI.phoneRecipients.confirmVerification(
        challengeId,
        verificationCodes[challengeId] ?? '',
      ));
      setVerificationCodes(current => {
        const next = { ...current };
        delete next[challengeId];
        return next;
      });
      setMessage('Contacto verificado y habilitado para recibir alertas.');
    });
  }

  function setEnabled(recipientId: string, enabled: boolean) {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;
    void run(async () => {
      setRecipients(await electronAPI.phoneRecipients.setEnabled(recipientId, enabled));
      setMessage(enabled ? 'Contacto activado.' : 'Contacto desactivado.');
    });
  }

  function sendTest(recipientId: string) {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;
    void run(async () => {
      await electronAPI.phoneRecipients.sendTest(recipientId);
      setMessage('Meta aceptó la alerta de prueba. Revise el WhatsApp del contacto.');
    });
  }

  function remove(recipient: PhoneRecipientView) {
    const electronAPI = window.electronAPI;
    if (!electronAPI || !recipient.recipientId
      || !window.confirm(`¿Eliminar a ${recipient.contactName} (${recipient.phoneMask})?`)) return;
    void run(async () => {
      setRecipients(await electronAPI.phoneRecipients.delete(recipient.recipientId!));
      setMessage('Contacto eliminado.');
    });
  }

  const verified = recipients.filter(recipient => recipient.state === 'verified');
  const pending = recipients.filter(recipient => recipient.state === 'pending');

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-security-400">Canal WhatsApp</p>
        <h1 className="text-2xl font-bold">Alertas y destinatarios</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
          Registre personas, verifique sus teléfonos y pruebe la entrega antes de una emergencia real.
        </p>
      </header>

      {error && <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}
      {message && <div className="rounded-lg border border-green-900 bg-green-950/30 px-4 py-3 text-sm text-green-300">{message}</div>}

      {loading ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">Cargando destinatarios...</div>
      ) : cloudStatus.state !== 'ENROLLED' ? (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-6">
          <h2 className="font-semibold text-amber-300">La instalación todavía no está vinculada</h2>
          <p className="mt-2 text-sm text-gray-400">Vincúlela con Cloud antes de registrar destinatarios.</p>
          <Link to="/settings" className="mt-4 inline-block rounded bg-security-600 px-4 py-2 text-sm font-medium text-white hover:bg-security-500">
            Ir a Configuración
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-widest text-gray-500">Nueva persona</p><h2 className="mt-1 text-lg font-semibold">Registrar teléfono</h2></div>
              <span className="rounded-full bg-green-950 px-3 py-1 text-xs text-green-400">Cloud activo</span>
            </div>
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs text-gray-400">Nombre</span><input value={contactName} maxLength={100} onChange={event => setContactName(event.target.value)} placeholder="Ej. Guardia de turno" className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm focus:border-security-500 focus:outline-none" /></label>
              <label className="block"><span className="mb-1 block text-xs text-gray-400">WhatsApp con código de país</span><input type="tel" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') requestCode(); }} placeholder="+541112345678" className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 font-mono text-sm focus:border-security-500 focus:outline-none" /></label>
              <button onClick={requestCode} disabled={busy || !contactName.trim() || !phoneNumber.trim()} className="w-full rounded-lg bg-security-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-security-500 disabled:opacity-50">
                {busy ? 'Procesando...' : 'Registrar y verificar'}
              </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-500">El número completo queda cifrado localmente. Cloud conserva únicamente su máscara y huella de validación.</p>
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-gray-500">Personas registradas</p><h2 className="mt-1 text-lg font-semibold">Destinatarios</h2></div><span className="text-sm text-gray-500">{verified.length} activos/verificados</span></div>

            {pending.map(recipient => (
              <article key={recipient.challengeId} className="mb-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4">
                <div className="flex items-start justify-between"><div><strong className="text-sm">{recipient.contactName}</strong><p className="mt-1 font-mono text-xs text-gray-400">{recipient.phoneMask}</p></div><span className="text-xs text-amber-400">Verificación pendiente</span></div>
                {recipient.developmentCode && <p className="mt-3 rounded bg-gray-950 px-3 py-2 text-xs text-amber-300">Código de demo: <b className="font-mono text-base tracking-widest">{recipient.developmentCode}</b></p>}
                <div className="mt-3 flex gap-2"><input inputMode="numeric" maxLength={6} value={verificationCodes[recipient.challengeId!] ?? ''} onChange={event => setVerificationCodes(current => ({ ...current, [recipient.challengeId!]: event.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="Código de 6 dígitos" className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-security-500 focus:outline-none" /><button onClick={() => confirmCode(recipient.challengeId!)} disabled={busy || (verificationCodes[recipient.challengeId!] ?? '').length !== 6} className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Confirmar</button></div>
              </article>
            ))}

            {verified.length === 0 && pending.length === 0 && <div className="rounded-lg border border-dashed border-gray-700 px-4 py-8 text-center text-sm text-gray-500">Todavía no hay personas registradas.</div>}

            <div className="space-y-3">
              {verified.map(recipient => (
                <article key={recipient.recipientId} className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{recipient.contactName}</strong><p className="mt-1 font-mono text-xs text-gray-400">{recipient.phoneMask}</p><p className={`mt-1 text-xs ${recipient.requiresReverification ? 'text-amber-400' : recipient.enabled ? 'text-green-400' : 'text-gray-500'}`}>{recipient.requiresReverification ? 'Requiere reverificación' : recipient.enabled ? 'Recibe alertas' : 'Desactivado'}</p></div><button onClick={() => setEnabled(recipient.recipientId!, !recipient.enabled)} disabled={busy || recipient.requiresReverification} className="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40">{recipient.enabled ? 'Desactivar' : 'Activar'}</button></div>
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-800 pt-3"><button onClick={() => sendTest(recipient.recipientId!)} disabled={busy || !recipient.enabled || recipient.requiresReverification} className="rounded bg-security-700 px-3 py-2 text-xs font-semibold text-white hover:bg-security-600 disabled:opacity-40">Enviar alerta de prueba</button><button onClick={() => remove(recipient)} disabled={busy} className="px-2 py-2 text-xs text-red-400 hover:text-red-300 disabled:opacity-40">Eliminar</button></div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
