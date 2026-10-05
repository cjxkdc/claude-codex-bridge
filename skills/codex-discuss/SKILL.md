---
name: codex-discuss
description: Discuss implementation, design or debugging with locally logged-in Codex CLI through agent-peer-bridge, with a user-specified round limit. Use when asked to discuss with Codex or obtain its second opinion.
---

Use `codex_discuss` from MCP server `codex-peer`. This Claude Code conversation is the host. For one-pass review use `codex_review`.

Start once with objective, absolute cwd, relevant relative files/logs and your initial diagnosis/proposal in host_message. max_rounds equals the user's x, defaults to 3 and supports 1..20. One round is a host contribution plus a Codex response. Read the actual reply, validate hypotheses, then continue the SAME session_id with revised reasoning and evidence. Finish early when appropriate. Stop at closed status or peer-error; never restart to evade x.

The peer receives snapshots, cannot edit the worktree or execute commands. Perform implementation/testing yourself only within the user's request. Summarize common ground, disagreements and next actions here, then continue authorized work. AGENT_PEER_DEPTH=1 blocks peer calls. Missing MCP requires restarting after installation; do not bypass protections with raw CLI invocation.

Discussion calls automatically save each round under the bridge's reports/discussions directory. When record.save_status is saved, include record.markdown_path in the final response so the user can open the record; record.json_path contains the structured transcript. If saving failed, report record.error and do not claim a file was saved. On request, show the returned transcript verbatim with speaker and round labels. Records contain the exchanged messages, not internal reasoning or the entire host conversation. Old files survive MCP restarts; active sessions do not.
