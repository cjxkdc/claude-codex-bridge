---
name: claude-discuss
description: Discuss implementation, design or debugging with locally logged-in Claude Code through agent-peer-bridge, with a user-specified round limit. Use when asked to discuss with CC or Claude, including joint debugging and second opinions.
---

Use `claude_discuss` from MCP server `claude-peer`. The current Codex conversation is the host; only Claude CLI is launched. For one-pass review use `claude_review`.

Start once with objective, cwd, relevant relative files/logs and your initial reasoning in host_message. max_rounds equals the user's x, defaults to 3 and supports 1..20. One round is a host contribution plus a peer response. Continue the SAME session_id, responding to actual peer arguments and supplying new evidence. Finish early when useful. Never restart a closed session to evade the limit.

For Debug, distinguish hypotheses from proven causes and validate them between rounds. For building, discuss interfaces and tradeoffs. The peer receives snapshots and cannot run commands or edit files. You perform implementation/testing only within the user's request. Summarize agreement, disagreements, evidence and next actions here; continue authorized work afterward.

Stop on peer-error and explain the returned login/timeout requirement. AGENT_PEER_DEPTH=1 blocks peer tools. If MCP is unavailable, restart after installing agent-peer-bridge; do not bypass protections with a raw CLI.
