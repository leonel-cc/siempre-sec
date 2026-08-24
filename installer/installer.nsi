; Security AI - NSIS Installer Script
; Custom script with larger stack for 1.3GB+ apps

!include "MUI2.nsh"

Name "Security AI"
OutFile "Security AI Setup 0.1.0.exe"
InstallDir "$PROGRAMFILES\Security AI"
InstallDirRegKey HKLM "Software\SecurityAI" "InstallDir"

RequestExecutionLevel admin

!define MUI_ABORTWARNING
!define MUI_ICON ""

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"

  ; Copy all files from win-unpacked
  File /r "release\win-unpacked\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry keys for Add/Remove Programs
  WriteRegStr HKLM "Software\SecurityAI" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" \
    "DisplayName" "Security AI - Intelligent Video Surveillance"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" \
    "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI" \
    "NoRepair" 1

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\Security AI"
  CreateShortCut "$SMPROGRAMS\Security AI\Security AI.lnk" "$INSTDIR\Security AI.exe"
  CreateShortCut "$SMPROGRAMS\Security AI\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Create Desktop shortcut
  CreateShortCut "$DESKTOP\Security AI.lnk" "$INSTDIR\Security AI.exe"
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"

  Delete "$SMPROGRAMS\Security AI\Security AI.lnk"
  Delete "$SMPROGRAMS\Security AI\Uninstall.lnk"
  RMDir "$SMPROGRAMS\Security AI"
  Delete "$DESKTOP\Security AI.lnk"

  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\SecurityAI"
  DeleteRegKey HKLM "Software\SecurityAI"
SectionEnd
