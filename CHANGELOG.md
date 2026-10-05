# Changelog

## 0.3.1

- Save discussion messages to local Markdown and JSON records before and after every peer attempt, including failures and early conclusions.
- Return record paths and save errors through MCP; guide both hosts to show the record after discussion.
- Keep records after session expiry/restart and exclude them from Git and installer payloads.

## 0.3.0

- Windows one-click EXE/ZIP installer with verified official Node runtime and bundled MCP dependencies.
- User-level MCP configuration and discussion skills for Codex and Claude Code.
- Node-driven CLI configuration avoids PowerShell native JSON quoting problems.
- GitHub CI and release packaging workflows; source and third-party license information.

## 0.2.0

- Bounded multi-round discussion for implementation, design and debugging.
- Session transcript, immutable round budget, early completion and recursion guard.

## 0.1.0

- Read-only local official CLI review, ask, explain and plan-review through MCP.
