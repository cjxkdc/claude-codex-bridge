$cfg=Get-Content (Join-Path (Split-Path $PSScriptRoot -Parent) '.local/config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& $cfg.claude @args
