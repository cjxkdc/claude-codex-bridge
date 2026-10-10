param([string]$InstallRoot,[switch]$SkipRegister)
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$package=Get-Content (Join-Path $sourceRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (!$InstallRoot) {
  $localAppData=[Environment]::GetFolderPath('LocalApplicationData')
  if (!$localAppData) {throw 'Local app data folder unavailable'}
  $InstallRoot=Join-Path $localAppData 'AgentPeerBridge'
}
$base=[IO.Path]::GetFullPath($InstallRoot)
$target=[IO.Path]::GetFullPath((Join-Path $base ("versions/"+$package.version)))
if (!$target.StartsWith($base.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Installation path escapes its root'}
New-Item -ItemType Directory -Force $target | Out-Null
foreach ($name in @('src','scripts','skills','examples','demo','test','docs','installer','vendor','node_modules','package.json','package-lock.json','README.md','README.en.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md')) {
  $item=Join-Path $sourceRoot $name
  if (Test-Path -LiteralPath $item) {Copy-Item -LiteralPath $item -Destination $target -Recurse -Force}
}
$params=@{}
if ($SkipRegister) {$params.SkipRegister=$true}
& (Join-Path $target 'scripts/Install.ps1') @params
if (!$?) {throw 'Bridge configuration failed'}
Write-Host "Installed to $target"
Write-Host 'Codex: $claude-discuss or natural language. Claude Code: /codex-discuss.'
Write-Host "If Claude CLI is not logged in: & '$target/scripts/Start-Claude.ps1' auth login"
