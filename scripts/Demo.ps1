param([ValidateSet('claude','codex')][string]$Peer='codex')
$bridgeRoot=Split-Path $PSScriptRoot -Parent
$cfg=Get-Content (Join-Path $bridgeRoot '.local/config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$env:USERPROFILE=[Environment]::GetFolderPath('UserProfile')
$env:HOME=$env:USERPROFILE
$env:CODEX_HOME=Join-Path $env:USERPROFILE '.codex'
$inputArgs=@{peer=$Peer;cwd=$bridgeRoot;files=@('demo/bug.js');include_diff=$false;request='请审核这段代码，指出边界条件问题。'} | ConvertTo-Json -Compress
& $cfg.node (Join-Path $bridgeRoot 'src/cli.mjs') call $inputArgs
