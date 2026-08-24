import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function Settings() {
  const [config, setConfig] = useState<Record<string, Record<string, any>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.settings.getAll().then(setConfig).catch(console.error);
  }, []);

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

      <div className="grid grid-cols-2 gap-6">
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
        </SettingsSection>

        <SettingsSection title="🔔 Alertas">
          <SettingInput label="Cooldown (s)" value={config.alerts.cooldown_seconds} type="number"
            onChange={v => updateSection('alerts', 'cooldown_seconds', parseInt(v) || 60)} />
          <SettingInput label="Video pre-evento (s)" value={config.alerts.pre_event_seconds} type="number"
            onChange={v => updateSection('alerts', 'pre_event_seconds', parseInt(v) || 15)} />
          <SettingInput label="Video post-evento (s)" value={config.alerts.post_event_seconds} type="number"
            onChange={v => updateSection('alerts', 'post_event_seconds', parseInt(v) || 15)} />
        </SettingsSection>

        <SettingsSection title="💾 Almacenamiento">
          <SettingInput label="Máximo en disco (GB)" value={config.storage.max_storage_gb} type="number"
            onChange={v => updateSection('storage', 'max_storage_gb', parseInt(v) || 50)} />
          <SettingInput label="Retención (días)" value={config.storage.retention_days} type="number"
            onChange={v => updateSection('storage', 'retention_days', parseInt(v) || 30)} />
        </SettingsSection>

        <SettingsSection title="📱 WhatsApp">
          <SettingToggle label="Habilitado" checked={config.whatsapp.enabled}
            onChange={v => updateSection('whatsapp', 'enabled', v)} />
          <SettingInput label="API Token" value={config.whatsapp.api_token} type="password"
            placeholder="Tu token de WhatsApp Business API"
            onChange={v => updateSection('whatsapp', 'api_token', v)} />
          <SettingInput label="Phone Number ID" value={config.whatsapp.phone_number_id}
            placeholder="ID del número de teléfono"
            onChange={v => updateSection('whatsapp', 'phone_number_id', v)} />
          <SettingInput label="Número destinatario" value={config.whatsapp.recipient_number}
            placeholder="+5491155551234"
            onChange={v => updateSection('whatsapp', 'recipient_number', v)} />
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
