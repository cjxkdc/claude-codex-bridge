# Changelog

## Unreleased

- Discussion records render each message as Markdown instead of plain-text code blocks, with headings demoted, raw HTML shown literally and unclosed fences closed so messages cannot break the record layout.
- Records open with the objective, a status summary in local time and the conclusion or final reply, followed by the rounds; long host messages are collapsed.
- Edit results list files with added/removed line counts and include a collapsible unified diff; the diff is also stored in edit_result.
- Bold text ending in CJK punctuation (`**结论。**然后`) renders correctly in CommonMark viewers.
- MCP tools return readable Markdown by default. Discussion turns return only the newest exchange plus session_id, status, record path and next action; action=status returns the full transcript. Pass format=json for the previous structured output.

## 0.6.0

- Send files to an existing named local Claude Code or Codex conversation in either direction, through new find_chats/send_to_chat MCP tools and chat-transfer skills.
- Match names without case/spacing/punctuation differences; require human selection for approximate or duplicate names, with expiring selection tickets and target revalidation.
- Copy user-selected files, attach small UTF-8 contents, retain binary/large files as local references, and resume the selected official CLI session using subscription login.
- Return the receiving agent's reply and durable receipts; preserve the target project, refuse detected active turns and recursive forwarding, and deduplicate repeated sends.
- Keep original discussion/review/edit behavior and update the Windows installer to include both new skills. Open native windows may require reloading external history.

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
