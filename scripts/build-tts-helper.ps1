param([switch]$Installer, [string]$IsccPath = $env:ISCC_PATH)
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
    $licenses = Join-Path $package 'licenses'
    New-Item -ItemType Directory -Path $licenses -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo 'LICENSE') -Destination (Join-Path $licenses 'DUNGEON-EXTENSION-LICENSE.txt') -Force
    Get-ChildItem -LiteralPath (Join-Path $repo 'public\licenses') -File | Copy-Item -Destination $licenses -Force
    Get-ChildItem -LiteralPath (Join-Path $repo 'native\tts-helper\licenses') -File | Copy-Item -Destination $licenses -Force
    [xml]$project = Get-Content -LiteralPath (Join-Path $repo 'native\tts-helper\DungeonTtsHelper.csproj')
    $runtimeVersion = $project.Project.PropertyGroup.RuntimeFrameworkVersion
    $assets = Get-Content -LiteralPath (Join-Path $repo 'native\tts-helper\obj\project.assets.json') -Raw | ConvertFrom-Json
    $runtimePackage = $assets.packageFolders.PSObject.Properties.Name | ForEach-Object {
        Join-Path $_ "microsoft.netcore.app.runtime.win-x64\$runtimeVersion"
    } | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'LICENSE.TXT') } | Select-Object -First 1
    if (!$runtimePackage) { throw 'Bundled .NET runtime license files were not found.' }
    Copy-Item -LiteralPath (Join-Path $runtimePackage 'LICENSE.TXT') -Destination (Join-Path $licenses 'DOTNET-LICENSE.txt') -Force
    Copy-Item -LiteralPath (Join-Path $runtimePackage 'THIRD-PARTY-NOTICES.TXT') -Destination (Join-Path $licenses 'DOTNET-THIRD-PARTY-NOTICES.txt') -Force
    foreach ($file in @('Install.ps1', 'Install.cmd', 'Uninstall.ps1', 'Uninstall.cmd', 'README.md')) {
        Copy-Item -LiteralPath (Join-Path $repo "native\tts-helper\$file") -Destination $package -Force
    }
    $zip = Join-Path $repo '.output\DungeonExtension-TTS-Helper-windows-x64.zip'
    Compress-Archive -Path (Join-Path $package '*') -DestinationPath $zip -Force
    Write-Host "Package: $zip"
    if ($Installer) {
        & (Join-Path $PSScriptRoot 'build-tts-helper-installer.ps1') -IsccPath $IsccPath
    }
} finally { Pop-Location }
