$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
$installRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DungeonExtension\TtsHelper'
$exe = Join-Path $packageRoot 'DungeonTtsHelper.exe'
if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath (Join-Path $packageRoot 'web\engine.html'))) {
    throw 'Extract the complete TTS helper ZIP before running Install.cmd.'
}
# A package-content identifier keeps updates separate from any running helper.
$hashes = @((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash)
$hashes += Get-ChildItem -LiteralPath (Join-Path $packageRoot 'web') -File -Recurse |
    Sort-Object FullName | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
$sha = [Security.Cryptography.SHA256]::Create()
try { $packageId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($hashes -join ''))))).Replace('-', '').Substring(0, 16) }
finally { $sha.Dispose() }
$destination = Join-Path $installRoot $packageId
if (!(Test-Path -LiteralPath (Join-Path $destination 'installed.json'))) {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $destination 'DungeonTtsHelper.exe') -Force
    Copy-Item -LiteralPath (Join-Path $packageRoot 'web') -Destination $destination -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $packageRoot 'licenses') -Destination $destination -Recurse -Force
    $manifest = @{
        name = 'dungeon_extension.tts_helper'
        description = 'Dungeon Extension Firefox TTS Helper'
        path = Join-Path $destination 'DungeonTtsHelper.exe'
        type = 'stdio'
        allowed_extensions = @('dungeon-extension-v2@oratorian', 'dungeon-extension-betas@oratorian')
    }
    [IO.File]::WriteAllText((Join-Path $destination 'installed.json'), ($manifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
}
$registry = 'HKCU:\Software\Mozilla\NativeMessagingHosts\dungeon_extension.tts_helper'
New-Item -Path $registry -Force | Out-Null
Set-Item -LiteralPath $registry -Value (Join-Path $destination 'installed.json')
Write-Host 'TTS helper installed for your Windows account.'
Write-Host 'Reload the Firefox extension, refresh AI Dungeon, and enable Accelerated TTS.'
Write-Host 'If an older engine is running, turn TTS off and on to restart it.'
