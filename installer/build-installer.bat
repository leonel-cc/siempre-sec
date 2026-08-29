@echo off
setlocal enabledelayedexpansion
title Building Security AI Installer

:: ============================================================
:: Security AI - Full Installer Build Orchestrator
::
:: Produces a single Inno Setup installer containing:
::   - Electron desktop app (UI + supervisor)
::   - NestJS backend (standalone, runs via Electron as Node)
::   - Python AI service frozen with PyInstaller
::   - MediaMTX + FFmpeg portable binaries
::
:: Output: apps\desktop\release\"Security AI Setup 0.1.0.exe"
::
:: Prerequisites: Node.js 20+, Python 3.11+, Inno Setup 6,
::                and internet access.
:: ============================================================

set "ROOT=%~dp0.."
set "DESKTOP=%ROOT%\apps\desktop"
set "RELEASE_DIR=%DESKTOP%\release"

echo.
echo ========================================
echo   Security AI - Installer Build
echo ========================================
echo.

:: ---- 1. Verify prerequisites -------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found on PATH. Install Node.js 20+ first.
    pause & exit /b 1
)

py -3.11 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_OK=1"
py -3.12 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_OK=1"

if not defined PYTHON_OK (
    where python >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Python 3.11/3.12 not found. Install it from python.org
        echo        and enable the py launcher.
        pause & exit /b 1
    )
)
echo Prerequisites OK ^(Node found, Python found^).

if not defined INNO_SETUP_COMPILER (
    if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "INNO_SETUP_COMPILER=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
)
if not defined INNO_SETUP_COMPILER (
    if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "INNO_SETUP_COMPILER=%ProgramFiles%\Inno Setup 6\ISCC.exe"
)
if not defined INNO_SETUP_COMPILER (
    if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "INNO_SETUP_COMPILER=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
)
if not exist "%INNO_SETUP_COMPILER%" (
    echo ERROR: Inno Setup 6 not found. Install JRSoftware.InnoSetup with winget
    echo        or set INNO_SETUP_COMPILER to the full ISCC.exe path.
    pause & exit /b 1
)

:: Select the AI runtime unless the caller explicitly chose a variant.
if not defined AI_BUNDLE_GPU (
    where nvidia-smi >nul 2>&1
    if errorlevel 1 (
        set "AI_BUNDLE_GPU=false"
    ) else (
        set "AI_BUNDLE_GPU=true"
    )
)
if /I "%AI_BUNDLE_GPU%"=="true" (
    echo AI bundle: NVIDIA CUDA ^(automatic CPU fallback included^).
) else (
    echo AI bundle: CPU.
)

:: ---- 2. Install workspace dependencies ----------------------------------
echo.
echo [1/3] Installing dependencies...
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause & exit /b 1
)

:: ---- 3. Build the full bundle -------------------------------------------
:: (shared -> backend standalone -> PyInstaller AI freeze -> binaries -> vite)
echo.
echo [2/3] Building bundle (backend + AI service + binaries + UI)...
cd /d "%DESKTOP%"
call node scripts/build-bundle.js
if errorlevel 1 (
    echo ERROR: Bundle build failed.
    pause & exit /b 1
)

:: ---- 4. Package Electron directory, then build the large-payload installer
echo.
echo [3/3] Packaging Windows installer...
call npx electron-builder --win --x64 --dir
if errorlevel 1 (
    echo ERROR: electron-builder failed.
    pause & exit /b 1
)
del /q "%RELEASE_DIR%\Security AI Setup 0.1.0.exe" >nul 2>&1
"%INNO_SETUP_COMPILER%" "%ROOT%\installer\security-ai.iss"
if errorlevel 1 (
    echo ERROR: Inno Setup compiler failed.
    pause & exit /b 1
)

:: ---- Done ----------------------------------------------------------------
set "INSTALLER_EXE=%RELEASE_DIR%\Security AI Setup 0.1.0.exe"
echo.
if exist "%INSTALLER_EXE%" (
    echo ========================================
    echo   Installer created successfully!
    echo ========================================
    echo   %INSTALLER_EXE%
    for %%A in ("%INSTALLER_EXE%") do echo   Size: %%~zA bytes
) else (
    echo Installer finished. Look for the setup exe in:
    echo   %RELEASE_DIR%
)
echo.
pause
