; Build through scripts/build-tts-helper.ps1 -Installer.
#ifndef AppIdentifier
  #define AppIdentifier "DungeonExtensionTtsHelper"
#endif
#ifndef HostName
  #define HostName "dungeon_extension.tts_helper"
#endif
#ifndef OutputName
  #define OutputName "DungeonExtension-TTS-Helper-Setup-windows-x64"
#endif

[Setup]
AppId={#AppIdentifier}
AppName=Dungeon Extension TTS Helper
AppVersion={#HelperVersion}
AppPublisher=Dungeon Extension
DefaultDirName={localappdata}\Programs\DungeonExtension\TtsHelper
DisableDirPage=yes
DisableWelcomePage=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
SetupIconFile={#PackageDir}\helper.ico
UninstallDisplayIcon={app}\helper.ico
OutputDir={#OutputDir}
OutputBaseFilename={#OutputName}
Compression=lzma2
SolidCompression=yes
CloseApplications=no
RestartApplications=no
LicenseFile={#PackageDir}\licenses\DUNGEON-EXTENSION-LICENSE.txt
UninstallDisplayName=Dungeon Extension TTS Helper
VersionInfoDescription=Dungeon Extension TTS Helper Setup
VersionInfoVersion={#HelperVersion}

[Messages]
WelcomeLabel2=This installs the optional Firefox narration helper for your Windows account.%n%nSpeech is generated on your computer. No Node or .NET installation is needed.%n%nFirefox starts the helper when needed and stops it after the last reader disconnects.
FinishedLabel=The TTS helper is ready.%n%nReload the Firefox extension, refresh AI Dungeon, and enable Accelerated TTS. If narration was already running, turn TTS off and on.%n%nBoth stable and beta editions are supported.

[Files]
Source: "{#PackageDir}\DungeonTtsHelper.exe"; DestDir: "{app}\versions\{#PackageId}"; Flags: onlyifdoesntexist
Source: "{#PackageDir}\web\*"; DestDir: "{app}\versions\{#PackageId}\web"; Flags: recursesubdirs createallsubdirs onlyifdoesntexist
Source: "{#PackageDir}\licenses\*"; DestDir: "{app}\versions\{#PackageId}\licenses"; Flags: recursesubdirs createallsubdirs onlyifdoesntexist
Source: "{#PackageDir}\helper.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PackageDir}\README.md"; DestDir: "{app}"; Flags: ignoreversion
; A tracked file ensures uninstall removes the generated manifest too.
Source: "{#SourcePath}\host-template.json"; DestDir: "{app}\versions\{#PackageId}"; DestName: "host.json"; Flags: ignoreversion; AfterInstall: WriteHostManifest

[Registry]
Root: HKCU; Subkey: "Software\Mozilla\NativeMessagingHosts\{#HostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\versions\{#PackageId}\host.json"

[Code]
procedure WriteHostManifest;
var
  ExePath, Manifest: String;
begin
  ExePath := ExpandConstant('{app}\versions\{#PackageId}\DungeonTtsHelper.exe');
  StringChangeEx(ExePath, '\', '\\', True);
  StringChangeEx(ExePath, '"', '\"', True);
  Manifest := '{"name":"{#HostName}","description":"Dungeon Extension Firefox TTS Helper",' +
    '"path":"' + ExePath + '","type":"stdio",' +
    '"allowed_extensions":["dungeon-extension-v2@oratorian","dungeon-extension-betas@oratorian"]}';
  if not SaveStringToFile(ExpandConstant('{app}\versions\{#PackageId}\host.json'), UTF8Encode(Manifest), False) then
    RaiseException('Could not register the TTS helper manifest.');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Registered, OwnedPrefix: String;
begin
  if CurUninstallStep = usUninstall then begin
    OwnedPrefix := Lowercase(ExpandConstant('{app}\versions\'));
    if RegQueryStringValue(HKCU, 'Software\Mozilla\NativeMessagingHosts\{#HostName}', '', Registered) then
      if Pos(OwnedPrefix, Lowercase(Registered)) = 1 then begin
        RegDeleteValue(HKCU, 'Software\Mozilla\NativeMessagingHosts\{#HostName}', '');
        RegDeleteKeyIfEmpty(HKCU, 'Software\Mozilla\NativeMessagingHosts\{#HostName}');
      end;
  end;
end;
