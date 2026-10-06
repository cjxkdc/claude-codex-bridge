# Changelog

## 0.5.0

- Optional, explicitly authorized edit discussions in both directions; review/ask/explain/plan-review remain read-only.
- Apply peer-proposed create/update contents only to a fixed editable-file list after validation, backups and conflict checks. No peer shell access or deletion.
- Reject protected paths, link-based escapes and oversized/binary edits; attempt rollback on write failures and report retained changes.
- Record access, scope and per-round application results; update both discussion skills and Windows installer.


## 0.4.0

- Select the peer model and reasoning effort per discussion, review, ask, explain or plan-review in either direction.
- Remember discussion settings across rounds; explicit changes or resets affect subsequent rounds without extending the budget.
- Record each round's requested settings and Claude CLI model-usage names when reported; do not infer effective effort.
- Explicit Claude effort overrides an inherited effort environment variable while preserving subscription-only authentication and read-only protections.

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
