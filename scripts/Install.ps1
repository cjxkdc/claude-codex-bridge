param([string]$ClaudePath,[string]$CodexPath,[string]$NodePath,[switch]$SkipRegister,[string]$ProfileRoot)
$ErrorActionPreference='Stop'
$bridgeRoot=Split-Path $PSScriptRoot -Parent
if (!$ProfileRoot) {$ProfileRoot=[Environment]::GetFolderPath('UserProfile')}
if (!$ProfileRoot) {$ProfileRoot=$env:USERPROFILE}
if (!$ProfileRoot) {throw 'Run in your normal Windows session: user profile unavailable.'}
$env:USERPROFILE=$ProfileRoot
$env:HOME=$ProfileRoot
if (!$env:CODEX_HOME) {$env:CODEX_HOME=Join-Path $ProfileRoot '.codex'}
if (!$NodePath) {
  # Prefer Node that survives client updates: the bundled copy, then a system install, then the Codex runtime copy.
  foreach ($candidate in @((Join-Path $bridgeRoot 'vendor/node/node.exe'),(Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source,"$ProfileRoot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe")) {
    if (!$candidate -or !(Test-Path -LiteralPath $candidate)) {continue}
    $v=& $candidate --version
    if ($LASTEXITCODE -eq 0 -and [int]($v.TrimStart('v').Split('.')[0]) -ge 20) {$NodePath=$candidate;break}
  }
}
if (!$NodePath) {throw 'Node >=20 required. Download the Windows one-click release, which includes Node.'}
# CLI discovery, version checks and login checks live in src/locate.mjs, shared with the bridge at run time.
$locateArgs=@()
if ($ClaudePath) {$locateArgs+="--claude=$ClaudePath"}
if ($CodexPath) {$locateArgs+="--codex=$CodexPath"}
$report=(& $NodePath (Join-Path $bridgeRoot 'src/cli.mjs') locate @locateArgs | Out-String)
if ($LASTEXITCODE) {throw 'CLI discovery failed'}
$report=$report | ConvertFrom-Json
if (@($report.problems).Count) {throw (@($report.problems) -join "`n")}
$ClaudePath=$report.claude.path
$CodexPath=$report.codex.path
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
foreach ($action in @($report.actions)) {Write-Host "ACTION: $action"}
Write-Host 'Installed. Restart Codex/Claude sessions. Claude CLI login is separate from Desktop login.'
