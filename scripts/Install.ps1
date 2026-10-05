param([string]$ClaudePath,[string]$CodexPath,[string]$NodePath,[switch]$SkipRegister,[string]$ProfileRoot)
$ErrorActionPreference='Stop'
$bridgeRoot=Split-Path $PSScriptRoot -Parent
if (!$ProfileRoot) {$ProfileRoot=[Environment]::GetFolderPath('UserProfile')}
if (!$ProfileRoot) {$ProfileRoot=$env:USERPROFILE}
if (!$ProfileRoot) {throw 'Run in your normal Windows session: user profile unavailable.'}
$env:USERPROFILE=$ProfileRoot
$env:HOME=$ProfileRoot
if (!$env:CODEX_HOME) {$env:CODEX_HOME=Join-Path $ProfileRoot '.codex'}
function Find-NativeExe($Name,$Candidates,$HelpArgs,$RequiredFlags) {
  $options=@()
  foreach ($pattern in $Candidates) {$options+=@(Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | ForEach-Object FullName)}
  $found=Get-Command $Name -ErrorAction SilentlyContinue
  if ($found) {$options+=$found.Source}
  foreach ($candidate in ($options | Select-Object -Unique)) {
    if ([IO.Path]::GetExtension($candidate) -ne '.exe') {continue}
    $help=(& $candidate @HelpArgs 2>$null | Out-String)
    $valid=$LASTEXITCODE -eq 0
    foreach ($flag in $RequiredFlags) {if (!$help.Contains($flag)) {$valid=$false}}
    if ($valid) {return $candidate}
  }
  throw "$Name native CLI with required safety flags not found. Install/update the official CLI or provide its explicit path."
}
if (!$NodePath) {
  foreach ($candidate in @((Join-Path $bridgeRoot 'vendor/node/node.exe'),"$ProfileRoot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe",(Get-Command node -ErrorAction SilentlyContinue).Source)) {
    if (!$candidate -or !(Test-Path -LiteralPath $candidate)) {continue}
    $v=& $candidate --version
    if ($LASTEXITCODE -eq 0 -and [int]($v.TrimStart('v').Split('.')[0]) -ge 20) {$NodePath=$candidate;break}
  }
}
if (!$NodePath) {throw 'Node >=20 required. Download the Windows one-click release, which includes Node.'}
if (!$CodexPath) {$CodexPath=Find-NativeExe 'codex' @("$ProfileRoot/AppData/Local/OpenAI/Codex/bin/*/codex.exe","$ProfileRoot/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe","$ProfileRoot/.local/bin/codex.exe") @('exec','--help') @('--ignore-user-config','--ignore-rules')}
if (!$ClaudePath) {$ClaudePath=Find-NativeExe 'claude' @("$ProfileRoot/.local/bin/claude.exe","$ProfileRoot/AppData/Local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/claude-code/*/*/claude.exe") @('--help') @('--safe-mode','--restricted','--strict-mcp-config')}
foreach ($exe in @($NodePath,$CodexPath,$ClaudePath)) {if (!(Test-Path -LiteralPath $exe)) {throw "Executable missing: $exe"}}
if ([int]((& $NodePath --version).TrimStart('v').Split('.')[0]) -lt 20) {throw 'Node >=20 required'}
New-Item -ItemType Directory -Force (Join-Path $bridgeRoot '.local') | Out-Null
$cfg=@{claude=$ClaudePath;codex=$CodexPath;node=$NodePath;profile=$ProfileRoot;codex_home=$env:CODEX_HOME}
$utf8=New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $bridgeRoot '.local/config.json'),($cfg | ConvertTo-Json),$utf8)
if (!(Test-Path (Join-Path $bridgeRoot 'node_modules/@modelcontextprotocol/sdk'))) {
  Push-Location $bridgeRoot
  try {npm ci --cache (Join-Path $bridgeRoot '.local/npm-cache');if ($LASTEXITCODE) {throw 'Dependency installation failed'}} finally {Pop-Location}
}
if (!$SkipRegister) {
  & $NodePath (Join-Path $bridgeRoot 'scripts/register.mjs')
  if ($LASTEXITCODE) {throw 'MCP/skill registration failed'}
}
& $NodePath (Join-Path $bridgeRoot 'src/cli.mjs') doctor
if ($LASTEXITCODE) {throw 'CLI diagnostics failed'}
Write-Host 'Installed. Restart Codex/Claude sessions. Claude CLI login is separate from Desktop login.'
