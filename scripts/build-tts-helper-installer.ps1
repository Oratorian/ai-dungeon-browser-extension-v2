param([string]$IsccPath = $env:ISCC_PATH, [switch]$TestPackage)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$package = Join-Path $repo '.output\tts-helper\windows-x64'
if (!(Test-Path -LiteralPath (Join-Path $package 'DungeonTtsHelper.exe'))) { throw 'Build the helper package first.' }
if (!$IsccPath) {
    $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($command) { $IsccPath = $command.Source }
    else { $IsccPath = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe' }
}
if (!(Test-Path -LiteralPath $IsccPath)) { throw 'Install Inno Setup 6.7 or newer, or pass -IsccPath / set ISCC_PATH to ISCC.exe.' }

# Use existing extension artwork in the native Windows setup and Installed apps entry.
$iconStream = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($iconStream)
try {
    $sizes = @(16, 32, 128)
    $images = @($sizes | ForEach-Object { ,([IO.File]::ReadAllBytes((Join-Path $repo "public\icon\$_.png"))) })
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $writer.Write([byte]$sizes[$i]); $writer.Write([byte]$sizes[$i]); $writer.Write([uint16]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
    [IO.File]::WriteAllBytes((Join-Path $package 'helper.ico'), $iconStream.ToArray())
} finally { $writer.Dispose(); $iconStream.Dispose() }

function Get-ContentHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '') }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}
$hashes = @(Get-ContentHash (Join-Path $package 'DungeonTtsHelper.exe'))
foreach ($folder in @('web', 'licenses')) {
    $hashes += Get-ChildItem -LiteralPath (Join-Path $package $folder) -Recurse -File | Sort-Object FullName |
        ForEach-Object { $_.FullName.Substring($package.Length); Get-ContentHash $_.FullName }
}
$sha = [Security.Cryptography.SHA256]::Create()
try { $packageId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($hashes -join ''))))).Replace('-', '').Substring(0, 16) }
finally { $sha.Dispose() }
[xml]$project = Get-Content -LiteralPath (Join-Path $repo 'native\tts-helper\DungeonTtsHelper.csproj')
$defines = @("/DPackageDir=$package", "/DPackageId=$packageId", "/DHelperVersion=$($project.Project.PropertyGroup.Version)", "/DOutputDir=$(Join-Path $repo '.output')")
if ($TestPackage) {
    $defines += '/DAppIdentifier=DungeonExtensionTtsHelperInstallerTest', '/DHostName=dungeon_extension.tts_helper_installer_test', '/DOutputName=TtsHelper-Installer-Test'
}
& $IsccPath @defines (Join-Path $repo 'native\tts-helper\setup.iss')
if ($LASTEXITCODE -ne 0) { throw 'TTS helper installer compilation failed.' }
