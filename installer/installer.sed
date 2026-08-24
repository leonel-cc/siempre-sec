[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=Install
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompression=1
OutsideCompression=0
RebootMode=N
InstallPrompt=Do you want to install Security AI?
DisplayLicense=
FinishMessage=Security AI has been installed successfully.
TargetName=Security AI Setup 0.1.0.exe
FriendlyName=Security AI Installer
AppLaunched=install.bat
PostInstallCmd=install.bat
AdminQuietInstCmd=
UserQuietInstCmd=
Copyright=
[Files]
staging\files
[EXTRACT]
staging\files
[INSTALL]
staging\files\install.bat
[SHOWWINDOW]
SW_SHOW
[FINISH]
staging\files\install.bat
