@echo off
title Security AI Installer
echo.
echo ========================================
echo   Security AI v0.1.0 Installer
echo   Intelligent Video Surveillance
echo ========================================
echo.

:: Check admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run as Administrator.
    echo Right-click install.bat and select "Run as administrator"
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\Security AI"
set "SOURCE_DIR=%~dp0"

echo Source: %SOURCE_DIR%
echo Install to: %INSTALL_DIR%
echo.

:: Stop existing instance
echo Stopping existing instance...
taskkill /f /im "Security AI.exe" >nul 2>&1
taskkill /f /im "security-ai-service.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1
timeout /t 3 /nobreak >nul

:: Create install dir
echo Creating installation directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy all files recursively (except install.bat and uninstall.bat)
echo Copying application files (this may take a moment)...
xcopy "%SOURCE_DIR%*" "%INSTALL_DIR%\" /E /I /Y /Q /EXCLUDE:%SOURCE_DIR%exclude.txt
del "%INSTALL_DIR%\install.bat" >nul 2>&1
del "%INSTALL_DIR%\uninstall.bat" >nul 2>&1
del "%INSTALL_DIR%\exclude.txt" >nul 2>&1
del "%INSTALL_DIR%\README.txt" >nul 2>&1

:: Create uninstaller
(
echo @echo off
echo title Security AI - Uninstaller
echo echo.
echo echo Uninstalling Security AI...
echo taskkill /f /im "Security AI.exe" ^>nul 2^>^&1
echo taskkill /f /im "security-ai-service.exe" ^>nul 2^>^&1
echo taskkill /f /im "node.exe" ^>nul 2^>^&1
echo timeout /t 2 /nobreak ^>nul
echo if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"
echo if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Security AI" rmdir /s /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Security AI"
echo del "%USERPROFILE%\Desktop\Security AI.lnk" ^>nul 2^>^&1
echo reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /f ^>nul 2^>^&1
echo echo Security AI has been uninstalled.
echo pause
) > "%INSTALL_DIR%\Uninstall.exe"

:: Create shortcuts
echo Creating shortcuts...
powershell -Command "$d=[System.IO.Path]::GetFolderPath('CommonPrograms'); $p=Join-Path $d 'Security AI'; if(!(Test-Path $p)){New-Item -ItemType Directory -Path $p -Force|Out-Null}; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path $p 'Security AI.lnk')); $s.TargetPath='%INSTALL_DIR%\Security AI.exe'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Save()"
powershell -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path ([System.Environment]::GetFolderPath('Desktop')) 'Security AI.lnk')); $s.TargetPath='%INSTALL_DIR%\Security AI.exe'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Save()"

:: Registry entries for Add/Remove Programs
echo Registering in Add/Remove Programs...
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v DisplayName /t REG_SZ /d "Security AI" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v DisplayVersion /t REG_SZ /d "0.1.0" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v InstallLocation /t REG_SZ /d "%INSTALL_DIR%" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v UninstallString /t REG_SZ /d "%INSTALL_DIR%\Uninstall.exe" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v Publisher /t REG_SZ /d "Security AI" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v NoModify /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" /v NoRepair /t REG_DWORD /d 1 /f >nul 2>&1

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo   Installed to: %INSTALL_DIR%
echo   Desktop shortcut: Created
echo   Start Menu: Created
echo   Add/Remove Programs: Registered
echo.

set /p LAUNCH="Launch Security AI now? (Y/n): "
if /i not "%LAUNCH%"=="n" (
    start "" "%INSTALL_DIR%\Security AI.exe"
)
