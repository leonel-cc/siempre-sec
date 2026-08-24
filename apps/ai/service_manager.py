#!/usr/bin/env python3
"""
Security AI - Service Manager
Runs all backend services as background processes.
Suitable for 24/7 operation on a mini PC.

Usage:
    python service_manager.py start     # Start all services
    python service_manager.py stop      # Stop all services
    python service_manager.py status    # Check service status
    python service_manager.py health    # Health check
"""

import subprocess
import sys
import os
import time
import signal
import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / 'data'
LOGS_DIR = BASE_DIR / 'logs'
EVIDENCE_DIR = BASE_DIR / 'evidence'

for d in [DATA_DIR, LOGS_DIR, EVIDENCE_DIR]:
    d.mkdir(exist_ok=True)


class ServiceManager:
    def __init__(self):
        self.processes = {}
        self.pid_file = DATA_DIR / 'services.json'

    def start_backend(self):
        print("Starting Backend (NestJS)...")
        log = open(LOGS_DIR / 'backend.log', 'a')
        proc = subprocess.Popen(
            ['node', 'dist/main.js'],
            cwd=str(BASE_DIR / 'apps' / 'backend'),
            stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
        self.processes['backend'] = proc
        print(f"  Backend PID: {proc.pid}")
        return proc

    def start_ai_service(self):
        print("Starting AI Service (Python)...")
        log = open(LOGS_DIR / 'ai_service.log', 'a')
        proc = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'main:app',
             '--host', '0.0.0.0', '--port', '5000'],
            cwd=str(BASE_DIR / 'apps' / 'ai'),
            stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
        )
        self.processes['ai_service'] = proc
        print(f"  AI Service PID: {proc.pid}")
        return proc

    def start_mediamtx(self):
        print("Starting MediaMTX...")
        config = BASE_DIR / 'services' / 'media' / 'mediamtx.yml'
        if not config.exists():
            print("  MediaMTX config not found, skipping")
            return None
        log = open(LOGS_DIR / 'mediamtx.log', 'a')
        try:
            proc = subprocess.Popen(
                ['mediamtx', str(config)],
                stdout=log, stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
            )
            self.processes['mediamtx'] = proc
            print(f"  MediaMTX PID: {proc.pid}")
            return proc
        except FileNotFoundError:
            print("  MediaMTX not found in PATH, skipping")
            return None

    def start_all(self):
        print("=" * 50)
        print("Security AI - Starting All Services")
        print("=" * 50)

        self.start_backend()
        time.sleep(2)
        self.start_ai_service()
        time.sleep(1)
        self.start_mediamtx()

        self._save_pids()

        print("\n" + "=" * 50)
        print("All services started!")
        print(f"  Backend:  http://localhost:3000")
        print(f"  AI:       http://localhost:5000")
        print(f"  MediaMTX: rtsp://localhost:8554")
        print("=" * 50)

        try:
            while True:
                time.sleep(10)
                self._check_health()
        except KeyboardInterrupt:
            self.stop_all()

    def stop_all(self):
        print("\nStopping all services...")
        for name, proc in self.processes.items():
            if proc and proc.poll() is None:
                print(f"  Stopping {name} (PID: {proc.pid})...")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        self.processes.clear()
        self._clear_pids()
        print("All services stopped")

    def status(self):
        print("Service Status:")
        for name in ['backend', 'ai_service', 'mediamtx']:
            proc = self.processes.get(name)
            if proc:
                status = "RUNNING" if proc.poll() is None else "STOPPED"
                print(f"  {name}: {status} (PID: {proc.pid})")
            else:
                print(f"  {name}: NOT STARTED")

    def _check_health(self):
        import urllib.request
        try:
            req = urllib.request.urlopen('http://localhost:3000/api/system/health', timeout=5)
            data = json.loads(req.read())
            for service in ['backend', 'ai_service']:
                status = data.get(service, {}).get('status', 'UNKNOWN')
                if status != 'ONLINE':
                    print(f"  WARNING: {service} is {status}")
        except Exception:
            pass

    def _save_pids(self):
        pids = {name: proc.pid for name, proc in self.processes.items() if proc}
        self.pid_file.write_text(json.dumps(pids))

    def _clear_pids(self):
        if self.pid_file.exists():
            self.pid_file.unlink()


def main():
    if len(sys.argv) < 2:
        print("Usage: python service_manager.py [start|stop|status]")
        sys.exit(1)

    manager = ServiceManager()
    command = sys.argv[1]

    if command == 'start':
        manager.start_all()
    elif command == 'stop':
        manager.stop_all()
    elif command == 'status':
        manager.status()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == '__main__':
    main()
