param([string]$IsccPath = $env:ISCC_PATH)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath((Join-Path $repo '.output'))
# Include spaces and Unicode to exercise JSON path escaping and UTF-8 encoding.
$destination = [IO.Path]::GetFullPath((Join-Path $output ('installer-test caf' + [char]0xE9)))
if (!$destination.StartsWith($output + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test destination.' }
$testKey = 'HKCU:\Software\Mozilla\NativeMessagingHosts\dungeon_extension.tts_helper_installer_test'
$realKey = 'HKCU:\Software\Mozilla\NativeMessagingHosts\dungeon_extension.tts_helper'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DungeonExtensionTtsHelperInstallerTest_is1'
if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $testKey) -or (Test-Path -LiteralPath $uninstallKey)) {
    throw 'An earlier installer test exists. Inspect and uninstall it before retrying.'
}
$original = if (Test-Path -LiteralPath $realKey) { (Get-Item -LiteralPath $realKey).GetValue('') } else { $null }
& (Join-Path $PSScriptRoot 'build-tts-helper-installer.ps1') -IsccPath $IsccPath -TestPackage
$setup = Join-Path $output 'TtsHelper-Installer-Test.exe'
function Run-Setup {
    $process = Start-Process -FilePath $setup -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', ('/DIR="' + $destination + '"'), ('/LOG="' + (Join-Path $output 'installer-test.log') + '"')) -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Setup failed: $($process.ExitCode)" }
}
function Run-Uninstall {
    $uninstaller = Join-Path $destination 'unins000.exe'
    if (!(Test-Path -LiteralPath $uninstaller)) { throw 'Test uninstaller missing.' }
    $process = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Uninstall failed: $($process.ExitCode)" }
}
try {
    Run-Setup
    $manifestPath = (Get-Item -LiteralPath $testKey).GetValue('')
    if (!$manifestPath.StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Wrong registration path.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'dungeon_extension.tts_helper_installer_test' -or $manifest.type -ne 'stdio') { throw 'Invalid native manifest.' }
    if (($manifest.allowed_extensions -join ',') -ne 'dungeon-extension-v2@oratorian,dungeon-extension-betas@oratorian') { throw 'Missing extension IDs.' }
    if (!(Test-Path -LiteralPath $manifest.path)) { throw 'Registered executable is missing.' }
    $versionDir = Split-Path $manifest.path -Parent
    foreach ($asset in @('web\engine.html', 'web\runtime\ort-wasm-simd-threaded.wasm', 'licenses\DOTNET-LICENSE.txt')) {
        if (!(Test-Path -LiteralPath (Join-Path $versionDir $asset))) { throw "Missing asset: $asset" }
    }
    if (!(Get-ChildItem -LiteralPath (Join-Path $versionDir 'web\assets') -Filter 'engine-*.js')) { throw 'Engine JavaScript missing.' }
    if (!(Test-Path -LiteralPath $uninstallKey)) { throw 'Installed apps entry missing.' }
    Run-Setup
    if ((Get-Item -LiteralPath $testKey).GetValue('') -ne $manifestPath) { throw 'Reinstall changed registration unexpectedly.' }
    Run-Uninstall
    if ((Test-Path -LiteralPath $testKey) -or (Test-Path -LiteralPath $uninstallKey) -or (Test-Path -LiteralPath $manifest.path)) { throw 'Uninstall left registered components.' }

    Run-Setup
    $replacement = Join-Path $output 'external-helper-test-sentinel.json'
    Set-Item -LiteralPath $testKey -Value $replacement
    Run-Uninstall
    if ((Get-Item -LiteralPath $testKey).GetValue('') -ne $replacement) { throw 'Uninstall changed a replacement registration.' }
    Remove-Item -LiteralPath $testKey
    Write-Host 'PASS: install, UTF-8 manifest, engine assets, stable/beta IDs, Installed apps entry, reinstall, uninstall, and replacement registration preservation.'
} finally {
    # Only the separately identified test installation may be removed by this script.
    if (Test-Path -LiteralPath (Join-Path $destination 'unins000.exe')) { Run-Uninstall }
    $current = if (Test-Path -LiteralPath $realKey) { (Get-Item -LiteralPath $realKey).GetValue('') } else { $null }
    if ($current -ne $original) { throw 'The real helper registration changed during the test.' }
}
