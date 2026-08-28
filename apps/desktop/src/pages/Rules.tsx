import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CardSkeleton } from '../components/Loading';

const RULE_DETAILS: Record<string, { color: string; badge: string; confirmation: string }> = {
  WEAPON_DETECTED: {
    color: 'border-red-900/60',
    badge: 'CRITICA',
    confirmation: '3 detecciones en una ventana de 5 cuadros',
  },
  FACE_COVERED: {
    color: 'border-orange-900/60',
    badge: 'ALTA',
    confirmation: '5 detecciones en una ventana de 8 cuadros',
  },
};

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    try {
      setRules(await api.rules.list());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(rule: any) {
    setSaving(rule.id);
    try {
      const updated = await api.rules.update(rule.id, { enabled: !rule.enabled });
      setRules(current => current.map(item => item.id === rule.id ? updated : item));
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reglas de Alerta</h1>
        <p className="text-sm text-gray-500 mt-1">
          La aplicacion solo alerta por armas, cuchillos o rostros cubiertos confirmados.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rules.map(rule => {
            const detail = RULE_DETAILS[rule.code] || RULE_DETAILS.FACE_COVERED;
            return (
              <div key={rule.id} className={`bg-gray-900 rounded-xl border p-5 ${detail.color}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{rule.name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                        {detail.badge}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{rule.description}</p>
                    <p className="text-xs text-gray-600 mt-3">Confirmacion: {detail.confirmation}</p>
                    <p className="text-xs text-gray-600 mt-1">Rearme: 10 segundos sin amenaza y minimo 60 segundos entre alertas iguales</p>
                  </div>
                  <button
                    onClick={() => toggleRule(rule)}
                    disabled={saving === rule.id}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
                      rule.enabled
                        ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70'
                        : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                    } disabled:opacity-50`}
                  >
                    {saving === rule.id ? 'Guardando...' : rule.enabled ? 'Activa' : 'Inactiva'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
