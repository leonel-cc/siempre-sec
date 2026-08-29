# Security AI - Build del Instalador

## Resultado

Un solo `Security AI Setup 0.1.0.exe` (Inno Setup) que instala todo:

```
C:\Program Files\Security AI\
├── Security AI.exe              # UI Electron + supervisor de servicios
└── resources\
    ├── app.asar                 # UI compilada
    ├── backend\                 # NestJS standalone (dist + node_modules)
    ├── ai\                      # Servicio IA congelado con PyInstaller
    │   └── yolov8n.pt
    ├── mediamtx\                # RTSP server portable
    └── bin\                     # ffmpeg + ffprobe portables
```

Al abrir la app, el supervisor lanza backend (:3000), IA (:5000) y MediaMTX
(:8554) como procesos hijos y los mata al cerrar. Los datos del usuario viven
en `%APPDATA%\Security AI\` (BD SQLite y evidencias), así que la carpeta de
instalación queda limpia.

## Prerrequisitos de la máquina de build

- Node.js 20+
- Python 3.11 o 3.12 con el `py launcher` habilitado
- Inno Setup 6 (`winget install --id JRSoftware.InnoSetup`)
- Conexión a internet (descarga MediaMTX ~26 MB, FFmpeg ~100 MB,
  dependencias pip de IA ~2 GB en el primer build)

## Comandos

```bat
:: Opción 1: orquestador completo
installer\build-installer.bat

:: Opción 2: paso a paso desde la raíz
npm install
cd apps\desktop
node scripts\build-bundle.js          :: backend + IA + binarios + UI
npx electron-builder --win --x64 --dir :: crea win-unpacked
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" ..\..\installer\security-ai.iss
```

`build-installer.bat` detects `nvidia-smi` and builds the CUDA-capable AI service automatically. The same service falls back to CPU when CUDA cannot initialize.

To force a build variant:

```bat
set AI_BUNDLE_GPU=true
installer\build-installer.bat

set AI_BUNDLE_GPU=false
installer\build-installer.bat
```

Output final: `apps\desktop\release\Security AI Setup 0.1.0.exe`

## Notas de producción

- `signAndEditExecutable: false` está configurado porque no hay certificado de
  firma. Windows SmartScreen va a advertir a los usuarios ("editor sin
  verificar"). Para quitarlo hace falta un certificado de firma de código (OV
  o EV) y activar la firma en `apps/desktop/package.json > build > win`.
- Sin ícono propio se usa el ícono default de Electron; definir
  `build.win.icon` (mínimo 256x256 .ico) cuando exista branding.
- Si el cliente ya tiene algo escuchando en 3000/5000/8554/1935/8888, esos
  servicios no arrancan (el supervisor detecta puertos ocupados).
- Inno Setup se usa en lugar de NSIS porque el runtime CUDA supera el límite
  de memoria de `makensis.exe` de 32 bits. El resultado sigue siendo un único
  instalador offline.
