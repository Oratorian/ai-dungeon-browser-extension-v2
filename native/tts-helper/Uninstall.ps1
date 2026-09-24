$ErrorActionPreference = 'Stop'
$localRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('LocalApplicationData'))
$expected = [IO.Path]::GetFullPath((Join-Path $localRoot 'DungeonExtension\TtsHelper'))
$registry = 'HKCU:\Software\Mozilla\NativeMessagingHosts\dungeon_extension.tts_helper'
if (Test-Path -LiteralPath $registry) {
    $registered = (Get-Item -LiteralPath $registry).GetValue('')
    if (!$registered -or !([IO.Path]::GetFullPath($registered).StartsWith($expected + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))) {
        throw 'The registered helper is outside this installation. Nothing was removed.'
    }
    Remove-Item -LiteralPath $registry
}
if (Test-Path -LiteralPath $expected) {
    $resolved = (Resolve-Path -LiteralPath $expected).Path
    if ($resolved -ne $expected -or !$resolved.StartsWith($localRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Unexpected installation path. Nothing was deleted.'
    }
    $items = @(Get-Item -LiteralPath $expected) + @(Get-ChildItem -LiteralPath $expected -Recurse -Force)
    if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {
        throw 'Installation contains a link. Remove it manually; automatic deletion stopped.'
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Host 'TTS helper removed. Browser-cached voice models have not been deleted.'
