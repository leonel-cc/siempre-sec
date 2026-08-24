# Security AI - Installer Script
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"
$AppName = "Security AI"
$Version = "0.1.0"
$InstallDir = "$env:ProgramFiles\$AppName"
$UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Security AI - Installer v$Version" -ForegroundColor Cyan
Write-Host "  Intelligent Video Surveillance" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This installer must be run as Administrator." -ForegroundColor Red
    Write-Host "Right-click -> Run as administrator" -ForegroundColor Yellow
    pause
    exit 1
}

# Stop existing instance if running
$existingProcess = Get-Process -Name "Security AI" -ErrorAction SilentlyContinue
if ($existingProcess) {
    Write-Host "Stopping existing Security AI instance..." -ForegroundColor Yellow
    Stop-Process -Name "Security AI" -Force
    Start-Sleep -Seconds 2
}

# Remove old installation
if (Test-Path $InstallDir) {
    Write-Host "Removing previous installation..." -ForegroundColor Yellow
    Remove-Item -Path $InstallDir -Recurse -Force
}

# Copy files
Write-Host "Installing to $InstallDir..." -ForegroundColor Green
$SourceDir = Join-Path $PSScriptRoot "win-unpacked"

if (-not (Test-Path $SourceDir)) {
    Write-Host "ERROR: win-unpacked directory not found next to installer." -ForegroundColor Red
    Write-Host "Expected: $SourceDir" -ForegroundColor Yellow
    pause
    exit 1
}

Copy-Item -Path $SourceDir -Destination $InstallDir -Recurse -Force
Write-Host "  Files copied successfully" -ForegroundColor Green

# Create Start Menu shortcuts
$StartMenuDir = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\$AppName"
New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut("$StartMenuDir\$AppName.lnk")
$Shortcut.TargetPath = "$InstallDir\Security AI.exe"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Save()

$UninstallShortcut = $WScriptShell.CreateShortcut("$StartMenuDir\Uninstall.lnk")
$UninstallShortcut.TargetPath = "$InstallDir\Uninstall.exe"
$UninstallShortcut.Save()

# Create Desktop shortcut
$DesktopShortcut = $WScriptShell.CreateShortcut("$env:USERPROFILE\Desktop\$AppName.lnk")
$DesktopShortcut.TargetPath = "$InstallDir\Security AI.exe"
$DesktopShortcut.WorkingDirectory = $InstallDir
$DesktopShortcut.Save()

Write-Host "  Shortcuts created" -ForegroundColor Green

# Create uninstaller
$UninstallScript = @"
`$AppName = "$AppName"
`$InstallDir = "$InstallDir"
`$StartMenuDir = "$StartMenuDir"

Write-Host "Uninstalling Security AI..." -ForegroundColor Yellow
Stop-Process -Name "Security AI" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item -Path `$InstallDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path `$StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "`$env:USERPROFILE\Desktop\$AppName.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "`$env:TEMP\security-ai-uninstall.ps1" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName" -Force -ErrorAction SilentlyContinue
Write-Host "Security AI has been uninstalled." -ForegroundColor Green
pause
"@

Set-Content -Path "$InstallDir\Uninstall.ps1" -Value $UninstallScript

# Create Uninstall.exe (batch wrapper)
$UninstallBat = @"
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0Uninstall.ps1"
"@
Set-Content -Path "$InstallDir\Uninstall.exe" -Value $UninstallBat

# Registry entries
New-Item -Path $UninstallKey -Force | Out-Null
Set-ItemProperty -Path $UninstallKey -Name "DisplayName" -Value "$AppName"
Set-ItemProperty -Path $UninstallKey -Name "DisplayVersion" -Value $Version
Set-ItemProperty -Path $UninstallKey -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $UninstallKey -Name "UninstallString" -Value "powershell -ExecutionPolicy Bypass -File `"$InstallDir\Uninstall.ps1`""
Set-ItemProperty -Path $UninstallKey -Name "Publisher" -Value "Security AI"
Set-ItemProperty -Path $UninstallKey -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $UninstallKey -Name "NoRepair" -Value 1 -Type DWord

Write-Host "  Registry entries created" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now launch Security AI from:" -ForegroundColor White
Write-Host "  - Desktop shortcut" -ForegroundColor White
Write-Host "  - Start Menu -> Security AI" -ForegroundColor White
Write-Host "  - $InstallDir\Security AI.exe" -ForegroundColor White
Write-Host ""

$launch = Read-Host "Launch Security AI now? (Y/n)"
if ($launch -ne "n" -and $launch -ne "N") {
    Start-Process "$InstallDir\Security AI.exe"
}
