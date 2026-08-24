@echo off
title Building Security AI Installer

:: Set paths
set "SOURCES=%~dp0..\apps\desktop\release\win-unpacked"
set "OUTPUT=%~dp0..\apps\desktop\release\Security AI Setup 0.1.0.exe"
set "STAGING=%~dp0staging"
set "IEXPRESS=%SystemRoot%\System32\iexpress.exe"

:: Verify source exists
if not exist "%SOURCES%\Security AI.exe" (
    echo ERROR: win-unpacked not found at %SOURCES%
    echo Run the build first: cd apps\desktop ^&^& npx electron-builder --win dir --x64
    pause
    exit /b 1
)

echo Creating staging directory...
if exist "%STAGING%" rmdir /s /q "%STAGING%"
mkdir "%STAGING%"
mkdir "%STAGING%\files"

echo Copying application files...
xcopy "%SOURCES%\*" "%STAGING%\files\" /E /I /Y /Q

echo Copying installer script...
copy "%~dp0install.bat" "%STAGING%\files\install.bat" /Y

echo Creating SED file...
(
echo [Version]
echo Class=IEXPRESS
echo SEDVersion=3
echo [Options]
echo PackagePurpose=Install
echo ShowInstallProgramWindow=1
echo HideExtractAnimation=0
echo UseLongFileName=1
echo InsideCompression=1
echo OutsideCompression=0
echo SetupProgress=Yes
echo SetupTitle=Security AI v0.1.0
echo SetupText=Installing Security AI - Intelligent Video Surveillance...
echo BrowseTitle=Select installation folder
echo FinishedTitle=Installation Complete!
echo FinishedText=Security AI has been installed successfully.
echo You can launch it from the Desktop or Start Menu shortcut.
echo [Files]
echo files\*.*
echo [EXTRACT]
echo files
echo [INSTALL]
echo files\install.bat
echo [SHOWWINDOW]
echo SW_SHOW
echo [FINISH]
echo files\install.bat
) > "%STAGING%\installer.sed"

echo Building installer with IExpress...
"%IEXPRESS%" /N "%STAGING%\installer.sed"

if exist "%OUTPUT%" (
    echo.
    echo ========================================
    echo   Installer created successfully!
    echo ========================================
    echo   %OUTPUT%
    echo.
    for %%A in ("%OUTPUT%") do echo   Size: %%~zA bytes
) else (
    echo ERROR: Installer creation failed.
)

echo Cleaning up...
rmdir /s /q "%STAGING%"
pause
