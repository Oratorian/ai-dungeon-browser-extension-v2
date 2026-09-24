$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
    $env:DOTNET_CLI_HOME = Join-Path $repo '.output\dotnet-home'
    $env:DOTNET_NOLOGO = '1'
    $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
    node scripts/tts-firefox-prototype.mjs --build-only --engine-only
    if ($LASTEXITCODE -ne 0) { throw 'Engine build failed.' }
    $package = Join-Path $repo '.output\tts-helper\windows-x64'
    dotnet publish native/tts-helper/DungeonTtsHelper.csproj -c Release -r win-x64 --self-contained true -o $package
    if ($LASTEXITCODE -ne 0) { throw 'Native helper build failed.' }
    $web = Join-Path $package 'web'
    # Remove only the verified generated web directory to avoid shipping old assets.
    if (Test-Path -LiteralPath $web) {
        $resolved = (Resolve-Path -LiteralPath $web).Path
        if ($resolved -ne [IO.Path]::GetFullPath($web) -or !$resolved.StartsWith([IO.Path]::GetFullPath((Join-Path $repo '.output')) + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Unexpected build output path.'
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $repo '.output\tts-firefox-prototype') -Destination $web -Recurse
    foreach ($file in @('Install.ps1', 'Install.cmd', 'Uninstall.ps1', 'Uninstall.cmd', 'README.md')) {
        Copy-Item -LiteralPath (Join-Path $repo "native\tts-helper\$file") -Destination $package -Force
    }
    $zip = Join-Path $repo '.output\DungeonExtension-TTS-Helper-windows-x64.zip'
    Compress-Archive -Path (Join-Path $package '*') -DestinationPath $zip -Force
    Write-Host "Package: $zip"
} finally { Pop-Location }
