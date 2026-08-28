from collections import deque
import time
from typing import Dict, List

import config


DEFAULT_RULES = [
    {
        'id': 'weapon_detected',
        'code': 'WEAPON_DETECTED',
        'name': 'Arma o cuchillo detectado',
        'enabled': True,
        'severity': 'CRITICAL',
        'actions': ['CREATE_ALERT', 'SEND_NOTIFICATION'],
        'confirmations': config.WEAPON_CONFIRMATIONS,
        'window': config.WEAPON_CONFIRMATION_WINDOW,
    },
    {
        'id': 'face_covered',
        'code': 'FACE_COVERED',
        'name': 'Rostro cubierto detectado',
        'enabled': True,
        'severity': 'HIGH',
        'actions': ['CREATE_ALERT', 'SEND_NOTIFICATION'],
        'confirmations': config.FACE_COVER_CONFIRMATIONS,
        'window': config.FACE_COVER_CONFIRMATION_WINDOW,
    },
]


class RuleEngine:
    """Confirms threats over time and emits once per active incident."""

    def __init__(self, tracker=None):
        self.rules: List[Dict] = []
        self._states: Dict[str, Dict] = {}

    def load_default_rules(self):
        self.rules = [dict(rule) for rule in DEFAULT_RULES]
        self._states.clear()
        print(f"Loaded {len(self.rules)} security rules")

    def load_rules(self, rules: List[Dict]):
        configured = {rule.get('id') or rule.get('code'): rule for rule in rules}
        updated = []
        for default in DEFAULT_RULES:
            rule = dict(default)
            incoming = configured.get(default['id']) or configured.get(default['code'])
            if incoming:
                rule['enabled'] = bool(incoming.get('enabled', True))
            updated.append(rule)
        self.rules = updated
        self._states.clear()

    def evaluate(self, camera_id: str, detections: List[Dict]) -> List[Dict]:
        observations = self._collect_observations(detections)
        alerts = []

        for rule in self.rules:
            rule_id = rule['id']
            if not rule.get('enabled', True):
                self._clear_rule_states(camera_id, rule_id)
                continue

            rule_observations = observations.get(rule_id, {})
            existing = [
                key for key in self._states
                if key.startswith(f"{camera_id}:{rule_id}:")
            ]
            keys = set(existing) | {
                f"{camera_id}:{rule_id}:{subtype}"
                for subtype in rule_observations
            }

            for key in keys:
                subtype = key.rsplit(':', 1)[-1]
                observation = rule_observations.get(subtype)
                state = self._states.setdefault(key, {
                    'history': deque(maxlen=rule['window']),
                    'active': False,
                    'misses': 0,
                    'last_alert_at': 0.0,
                })
                state['history'].append(observation is not None)

                if observation is None:
                    state['misses'] += 1
                    if state['misses'] >= config.THREAT_CLEAR_OBSERVATIONS:
                        state['active'] = False
                        state['history'].clear()
                    continue

                state['misses'] = 0
                detection = observation['detection']
                if state['active']:
                    self._mark_confirmed(detection, rule_id, observation['evidence'])
                    continue

                history = state['history']
                if len(history) < rule['confirmations'] or sum(history) < rule['confirmations']:
                    continue

                state['active'] = True
                evidence = observation['evidence']
                self._mark_confirmed(detection, rule_id, evidence)
                now = time.monotonic()
                if now - state['last_alert_at'] < config.THREAT_MIN_REARM_SECONDS:
                    continue
                state['last_alert_at'] = now
                alerts.append({
                    'event_type': rule['code'],
                    'rule_id': rule_id,
                    'rule_name': rule['name'],
                    'severity': rule['severity'],
                    'detection': detection,
                    'tracking_id': detection.get('tracking_id'),
                    'actions': rule['actions'],
                    'evidence': evidence,
                    'confirmation_count': sum(history),
                    'confirmation_window': len(history),
                })

        return alerts

    def _collect_observations(self, detections: List[Dict]) -> Dict[str, Dict]:
        observations = {'weapon_detected': {}, 'face_covered': {}}
        for detection in detections:
            weapon = detection.get('weapon')
            if weapon:
                subtype = weapon['class']
                current = observations['weapon_detected'].get(subtype)
                if current is None or weapon['confidence'] > current['evidence']['confidence']:
                    observations['weapon_detected'][subtype] = {
                        'detection': detection,
                        'evidence': weapon,
                    }

            face_cover = detection.get('face_cover')
            if face_cover:
                current = observations['face_covered'].get('covered')
                if current is None or face_cover['confidence'] > current['evidence']['confidence']:
                    observations['face_covered']['covered'] = {
                        'detection': detection,
                        'evidence': face_cover,
                    }
        return observations

    @staticmethod
    def _mark_confirmed(detection: Dict, rule_id: str, evidence: Dict):
        confirmed = detection.setdefault('confirmed_threats', {})
        confirmed[rule_id] = evidence

    def _clear_rule_states(self, camera_id: str, rule_id: str):
        prefix = f"{camera_id}:{rule_id}:"
        for key in [key for key in self._states if key.startswith(prefix)]:
            del self._states[key]

    def clear_camera(self, camera_id: str):
        prefix = f"{camera_id}:"
        for key in [key for key in self._states if key.startswith(prefix)]:
            del self._states[key]
