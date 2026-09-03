import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function Settings() {
  const [config, setConfig] = useState<Record<string, Record<string, any>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudEnrollmentStatus>({ state: 'UNENROLLED' });
  const [cloudUrl, setCloudUrl] = useState('https://');
  const [installationName, setInstallationName] = useState('Security AI');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopPreferences | null>(null);

  useEffect(() => {
    api.settings.getAll().then(setConfig).catch(console.error);
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;
    electronAPI.cloudEnrollment.status().then(status => {
      setCloudStatus(status);
      if (status.cloudUrl) setCloudUrl(status.cloudUrl);
    }).catch(console.error);
    electronAPI.getDesktopPreferences()
      .then(setDesktopPreferences)
      .catch(console.error);
  }, []);

  async function requestEnrollment() {
    if (!window.electronAPI) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      setCloudStatus(await window.electronAPI.cloudEnrollment.request(cloudUrl, installationName));
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudBusy(false);
    }
  }

  async function finishEnrollment() {
    if (!window.electronAPI) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      const status = await window.electronAPI.cloudEnrollment.exchange();
      setCloudStatus(status);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudBusy(false);
    }
  }

  async function clearEnrollment() {
    if (!window.electronAPI) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      setCloudStatus(await window.electronAPI.cloudEnrollment.clear());
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : String(error));
    } finally {
      setCloudBusy(false);
    }
  }

  function updateSection(section: string, key: string, value: any) {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      };
    });
    setSaved(false);
  }

  async function updateDesktopPreference(
    key: keyof DesktopPreferences,
    value: boolean,
  ) {
    if (!window.electronAPI) return;
    setDesktopPreferences(prev => prev ? { ...prev, [key]: value } : prev);
    try {
      const updated = await window.electronAPI.setDesktopPreferences({ [key]: value });
      setDesktopPreferences(updated);
    } catch (error) {
      console.error('Failed to save desktop preference:', error);
      const current = await window.electronAPI.getDesktopPreferences();
      setDesktopPreferences(current);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      for (const [section, values] of Object.entries(config)) {
        await api.settings.updateSection(section, values);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <div className="grid grid-cols-2 gap-6">
          {[1,2,3,4,5].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="flex items-center justify-center gap-3 py-4">
          <Spinner size="md" />
          <span className="text-sm text-gray-500">Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-security-600 hover:bg-security-500 text-white'
          } ${saving ? 'opacity-50' : ''}`}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SettingsSection title="🤖 Detección IA">
          <SettingInput label="Modelo YOLO" value={config.ai.yolo_model}
            onChange={v => updateSection('ai', 'yolo_model', v)} />
          <SettingRange label="Umbral de confianza" value={config.ai.confidence_threshold}
            min={0.1} max={1} step={0.05}
            onChange={v => updateSection('ai', 'confidence_threshold', v)} />
          <SettingRange label="FPS de inferencia" value={config.ai.inference_fps}
            min={1} max={30} step={1}
            onChange={v => updateSection('ai', 'inference_fps', v)} />
          <SettingRange label="Umbral facial" value={config.ai.face_threshold}
            min={0.1} max={1} step={0.05}
            onChange={v => updateSection('ai', 'face_threshold', v)} />
          <SettingRange label="Sensibilidad movimiento" value={config.ai.motion_sensitivity}
            min={0.1} max={1} step={0.05}
            onChange={v => updateSection('ai', 'motion_sensitivity', v)} />
          <SettingToggle label="Marcar personas en verde" checked={config.ai.show_people_overlay}
            onChange={v => updateSection('ai', 'show_people_overlay', v)} />
        </SettingsSection>

        <SettingsSection title="🔔 Alertas">
          <SettingInput label="Cooldown (s)" value={config.alerts.cooldown_seconds} type="number"
            onChange={v => updateSection('alerts', 'cooldown_seconds', parseInt(v) || 60)} />
          <SettingInput label="Video pre-evento (s)" value={config.alerts.pre_event_seconds} type="number"
            onChange={v => updateSection('alerts', 'pre_event_seconds', parseInt(v) || 15)} />
          <SettingInput label="Video post-evento (s)" value={config.alerts.post_event_seconds} type="number"
            onChange={v => updateSection('alerts', 'post_event_seconds', parseInt(v) || 15)} />
        </SettingsSection>

        {desktopPreferences && (
          <SettingsSection title="Aplicación de escritorio">
            <SettingToggle label="Iniciar automáticamente con Windows"
              checked={desktopPreferences.startWithWindows}
              onChange={v => updateDesktopPreference('startWithWindows', v)} />
            <SettingToggle label="Continuar monitoreando al cerrar la ventana"
              checked={desktopPreferences.keepRunningInBackground}
              onChange={v => updateDesktopPreference('keepRunningInBackground', v)} />
            <SettingToggle label="Evitar que la PC se suspenda durante el monitoreo"
              checked={desktopPreferences.preventSleep}
              onChange={v => updateDesktopPreference('preventSleep', v)} />
            <p className="text-xs text-gray-500">
              La pantalla puede apagarse. Para detener todos los servicios usa
              &quot;Salir completamente&quot; desde el icono de la bandeja.
            </p>
          </SettingsSection>
        )}

        <SettingsSection title="💾 Almacenamiento">
          <SettingInput label="Máximo en disco (GB)" value={config.storage.max_storage_gb} type="number"
            onChange={v => updateSection('storage', 'max_storage_gb', parseInt(v) || 50)} />
          <SettingInput label="Retención (días)" value={config.storage.retention_days} type="number"
            onChange={v => updateSection('storage', 'retention_days', parseInt(v) || 30)} />
        </SettingsSection>

        <SettingsSection title="Nube y acceso remoto">
          {cloudStatus.state === 'UNENROLLED' && <>
            <SettingInput label="URL del servicio" value={cloudUrl}
              placeholder="https://api.security-ai.example"
              onChange={setCloudUrl} />
            <SettingInput label="Nombre de instalación" value={installationName}
              onChange={setInstallationName} />
            <button onClick={requestEnrollment} disabled={cloudBusy}
              className="w-full rounded bg-security-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {cloudBusy ? 'Conectando...' : 'Vincular instalación'}
            </button>
          </>}
          {cloudStatus.state === 'PENDING' && <div className="space-y-3">
            <p className="text-sm text-gray-400">Inicia sesión en el portal y aprueba este código:</p>
            <div className="rounded-lg border border-security-500/40 bg-security-950 px-4 py-3 text-center font-mono text-2xl tracking-widest text-security-300">
              {cloudStatus.userCode}
            </div>
            <button onClick={finishEnrollment} disabled={cloudBusy}
              className="w-full rounded bg-security-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {cloudBusy ? 'Verificando...' : 'Ya aprobé el código'}
            </button>
          </div>}
          {cloudStatus.state === 'ENROLLED' && <div className="space-y-3">
            <div className="rounded-lg border border-green-800 bg-green-950/30 px-3 py-2 text-sm text-green-300">
              Instalación vinculada y sincronización activa
            </div>
            <p className="break-all text-xs text-gray-500">{cloudStatus.installationId}</p>
            <button onClick={clearEnrollment}
              className="w-full rounded border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/40">
              Desvincular instalación
            </button>
          </div>}
          {cloudError && <p className="text-sm text-red-400">{cloudError}</p>}
        </SettingsSection>

        <SettingsSection title="📷 Cámaras">
          <SettingInput label="Intervalo reconexión (ms)" value={config.cameras.reconnect_interval_ms} type="number"
            onChange={v => updateSection('cameras', 'reconnect_interval_ms', parseInt(v) || 5000)} />
          <SettingInput label="Máx. intentos reconexión" value={config.cameras.max_reconnect_attempts} type="number"
            onChange={v => updateSection('cameras', 'max_reconnect_attempts', parseInt(v) || 10)} />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingInput({ label, value, type = 'text', placeholder, onChange }: {
  label: string; value: string | number; type?: string; placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-gray-400 whitespace-nowrap">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-right w-40 focus:outline-none focus:border-security-500" />
    </div>
  );
}

function SettingRange({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-gray-400 whitespace-nowrap">{label}</label>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-32 accent-security-500" />
        <span className="text-sm text-gray-300 w-10 text-right">{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-400">{label}</label>
      <button onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-security-600' : 'bg-gray-700'}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
