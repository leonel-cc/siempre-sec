@echo off
title Security AI - Uninstaller
echo.
echo Uninstalling Security AI...
echo.

taskkill /f /im "Security AI.exe" >nul 2>&1
taskkill /f /im "security-ai-service.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

set "INSTALL_DIR=%ProgramFiles%\Security AI"

if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    echo Removed: %INSTALL_DIR%
)

if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Security AI" (
    rmdir /s /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Security AI"
    echo Removed Start Menu shortcuts
)

del "%USERPROFILE%\Desktop\Security AI.lnk" >nul 2>&1
echo Removed Desktop shortcut

reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /f >nul 2>&1
echo Removed registry entries

echo.
echo Security AI has been uninstalled.
pause
