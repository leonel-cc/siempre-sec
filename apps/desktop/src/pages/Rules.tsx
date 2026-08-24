import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AlertAction, ConditionField, ConditionOperator, DayOfWeek } from '@security-ai/shared';
import { Spinner, CardSkeleton } from '../components/Loading';

export default function Rules() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', enabled: true, cooldown_seconds: 60,
    conditions: [{ field: ConditionField.OBJECT_CLASS, operator: ConditionOperator.EQUALS, value: 'person' }],
    actions: [AlertAction.CREATE_ALERT],
    schedule: { enabled: false, start_time: '23:00', end_time: '07:00', days: Object.values(DayOfWeek) },
  });

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    try { setRules(await api.rules.list()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createRule() {
    try {
      await api.rules.create(form);
      setShowForm(false);
      loadRules();
    } catch (e) { console.error(e); }
  }

  async function toggleRule(id: string, enabled: boolean) {
    try { await api.rules.update(id, { enabled: !enabled }); loadRules(); }
    catch (e) { console.error(e); }
  }

  async function deleteRule(id: string) {
    try { await api.rules.remove(id); loadRules(); }
    catch (e) { console.error(e); }
  }

  function addCondition() {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: ConditionField.OBJECT_CLASS, operator: ConditionOperator.EQUALS, value: 'person' }],
    }));
  }

  function removeCondition(index: number) {
    setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== index) }));
  }

  function updateCondition(index: number, field: string, value: any) {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === index ? { ...c, [field]: value } : c),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reglas de Alerta</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded-lg text-sm">
          {showForm ? 'Cancelar' : '+ Crear Regla'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Nombre de la regla" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              placeholder="Descripción" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 mb-2">CONDICIONES</h3>
            {form.conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select value={cond.field} onChange={e => updateCondition(i, 'field', e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs">
                  <option value={ConditionField.OBJECT_CLASS}>Clase de objeto</option>
                  <option value={ConditionField.IDENTITY}>Identidad</option>
                  <option value={ConditionField.ZONE_TYPE}>Tipo de zona</option>
                  <option value={ConditionField.PRESENCE_DURATION}>Duración presencia (s)</option>
                  <option value={ConditionField.CONFIDENCE}>Confianza</option>
                </select>
                <select value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs">
                  <option value={ConditionOperator.EQUALS}>igual a</option>
                  <option value={ConditionOperator.NOT_EQUALS}>no igual a</option>
                  <option value={ConditionOperator.GREATER_THAN}>mayor que</option>
                  <option value={ConditionOperator.LESS_THAN}>menor que</option>
                  <option value={ConditionOperator.IN}>en lista</option>
                </select>
                <input value={cond.value as string} onChange={e => updateCondition(i, 'value', e.target.value)}
                  placeholder="Valor" className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs w-32" />
                <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
              </div>
            ))}
            <button onClick={addCondition} className="text-xs text-security-400 hover:text-security-300">+ Agregar condición</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-2">ACCIONES</h3>
              <div className="space-y-1">
                {[AlertAction.CREATE_ALERT, AlertAction.SEND_NOTIFICATION, AlertAction.LOG_EVENT].map(action => (
                  <label key={action} className="flex items-center gap-2 text-xs text-gray-300">
                    <input type="checkbox" checked={form.actions.includes(action)}
                      onChange={e => {
                        setForm(prev => ({
                          ...prev,
                          actions: e.target.checked
                            ? [...prev.actions, action]
                            : prev.actions.filter(a => a !== action),
                        }));
                      }}
                      className="rounded" />
                    {action}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 mb-2">HORARIO</h3>
              <label className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <input type="checkbox" checked={form.schedule.enabled}
                  onChange={e => setForm(prev => ({ ...prev, schedule: { ...prev.schedule, enabled: e.target.checked } }))} />
                Limitar a horario
              </label>
              {form.schedule.enabled && (
                <div className="flex gap-2 items-center text-xs">
                  <input type="time" value={form.schedule.start_time}
                    onChange={e => setForm(prev => ({ ...prev, schedule: { ...prev.schedule, start_time: e.target.value } }))} />
                  <span className="text-gray-500">-</span>
                  <input type="time" value={form.schedule.end_time}
                    onChange={e => setForm(prev => ({ ...prev, schedule: { ...prev.schedule, end_time: e.target.value } }))} />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="text-xs text-gray-400">Cooldown (s):</label>
            <input type="number" value={form.cooldown_seconds}
              onChange={e => setForm({...form, cooldown_seconds: parseInt(e.target.value) || 60})}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-20" />
          </div>

          <button onClick={createRule} className="px-4 py-2 bg-security-600 hover:bg-security-700 rounded text-sm">
            Crear Regla
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">⚙️</p>
          <p>No hay reglas configuradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{rule.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{rule.description || 'Sin descripción'}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>Cooldown: {rule.cooldown_seconds}s</span>
                    <span>Prioridad: {rule.priority}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleRule(rule.id, rule.enabled)}
                    className={`text-xs px-3 py-1 rounded-full ${
                      rule.enabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                    {rule.enabled ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-400 hover:text-red-300">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
