---
name: claude-discuss
description: Discuss implementation, design or debugging with locally logged-in Claude Code through agent-peer-bridge, with a user-specified round limit. Use when asked to discuss with CC or Claude, including joint debugging and second opinions.
---

Use `claude_discuss` from MCP server `claude-peer`. The current Codex conversation is the host; only Claude CLI is launched. For one-pass review use `claude_review`.

When the user specifies Claude's model or reasoning effort, send model/effort as actual tool parameters, not just prompt text. Accept CLI aliases (opus, sonnet, haiku) or exact model IDs. Map explicit “Opus 5.5” to claude-opus-5-5 and “Sonnet 5.5” to claude-sonnet-5-5. Map 低/中/高/超高/最大 to low/medium/high/xhigh/max. Omit unspecified settings to keep CLI defaults. These parameters select Claude; the current Codex conversation keeps its host settings. Continue the same session without resending parameters unless the user requests a change; to reset an option send auto/default. State the requested selection in your response, using returned peer_options/requested; reported_models contains names only when the CLI reports them. Do not present requested settings as independently confirmed effective settings. Account/model restrictions can reject or limit a selection; report the error rather than silently choosing another model.

Start once with objective, cwd, relevant relative files/logs and your initial reasoning in host_message. max_rounds equals the user's x, defaults to 3 and supports 1..20. One round is a host contribution plus a peer response. Continue the SAME session_id, responding to actual peer arguments and supplying new evidence. Finish early when useful. Never restart a closed session to evade the limit.

For Debug, distinguish hypotheses from proven causes and validate them between rounds. For building, discuss interfaces and tradeoffs. The peer receives snapshots and cannot run commands or edit files. You perform implementation/testing only within the user's request. Summarize agreement, disagreements, evidence and next actions here; continue authorized work afterward.

Stop on peer-error and explain the returned login/timeout requirement. AGENT_PEER_DEPTH=1 blocks peer tools. If MCP is unavailable, restart after installing agent-peer-bridge; do not bypass protections with a raw CLI.

Discussion calls automatically save each round under the bridge's reports/discussions directory. When record.save_status is saved, include a clickable link to record.markdown_path in the final response; record.json_path contains the structured transcript. If saving failed, report record.error and do not claim a file was saved. On request, show the returned transcript verbatim with speaker and round labels. Records contain the exchanged messages, not internal reasoning or the entire host conversation. Old files survive MCP restarts; active sessions do not.
