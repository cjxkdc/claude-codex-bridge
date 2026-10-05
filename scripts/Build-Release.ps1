param([string]$RuntimeZip,[string]$OutputDirectory,[switch]$MakeExe)
$ErrorActionPreference='Stop'
$bridgeRoot=Split-Path $PSScriptRoot -Parent
$package=Get-Content (Join-Path $bridgeRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (!$OutputDirectory) {$OutputDirectory=Join-Path $bridgeRoot 'dist'}
$buildRoot=Join-Path ([IO.Path]::GetTempPath()) ('apb-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $buildRoot,$OutputDirectory | Out-Null
if (!$RuntimeZip) {
  $RuntimeZip=Join-Path $buildRoot 'node-v24.21.0-win-x64.zip'
  Invoke-WebRequest 'https://nodejs.org/download/release/v24.21.0/node-v24.21.0-win-x64.zip' -OutFile $RuntimeZip -UseBasicParsing
}
$expected='158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
if ((Get-FileHash -LiteralPath $RuntimeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {throw 'Official Node runtime checksum mismatch'}
$runtimeRoot=Join-Path $buildRoot 'runtime'
Expand-Archive -LiteralPath $RuntimeZip -DestinationPath $runtimeRoot
$stage=Join-Path $buildRoot 'agent-peer-bridge'
New-Item -ItemType Directory -Force $stage,(Join-Path $stage 'vendor/node'),(Join-Path $stage 'demo') | Out-Null
foreach ($name in @('src','scripts','skills','examples','test','docs','installer','node_modules','package.json','package-lock.json','README.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','Install.cmd')) {
  Copy-Item -LiteralPath (Join-Path $bridgeRoot $name) -Destination $stage -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $bridgeRoot 'demo/bug.js') -Destination (Join-Path $stage 'demo/bug.js')
foreach ($name in @('node.exe','LICENSE')) {Copy-Item -LiteralPath (Join-Path $runtimeRoot "node-v24.21.0-win-x64/$name") -Destination (Join-Path $stage 'vendor/node')}
$archive=Join-Path $OutputDirectory "agent-peer-bridge-v$($package.version)-windows-x64.zip"
Compress-Archive -LiteralPath $stage -DestinationPath $archive -Force -CompressionLevel Optimal
$artifacts=@($archive)
if ($MakeExe) {
  $compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
  if (!(Test-Path $compiler)) {throw 'Windows .NET Framework compiler unavailable; ZIP is available'}
  $exe=Join-Path $OutputDirectory "agent-peer-bridge-v$($package.version)-windows-x64-Setup.exe"
  $compilerArgs=@('/nologo','/target:winexe','/platform:x64',('/out:'+$exe),('/resource:'+$archive+',payload.zip'),'/reference:System.Windows.Forms.dll','/reference:System.IO.Compression.FileSystem.dll',(Join-Path $bridgeRoot 'installer/Bootstrap.cs'))
  & $compiler @compilerArgs
  if ($LASTEXITCODE -ne 0 -or !(Test-Path $exe)) {throw 'EXE compilation failed; ZIP is available'}
  $artifacts+=$exe
}
$lines=@()
foreach ($file in $artifacts) {$lines+=((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+[IO.Path]::GetFileName($file))}
[IO.File]::WriteAllLines((Join-Path $OutputDirectory 'SHA256SUMS.txt'),$lines)
Write-Host 'Built:'
$artifacts | ForEach-Object {Write-Host $_}

