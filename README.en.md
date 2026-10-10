# Claude Codex Bridge

[简体中文](README.md) | English

Let Claude Code and Codex talk to each other: discuss a design, debug together, or get a second-opinion code review from the other model.

Built for people who use **both Claude Code and ChatGPT**. The ChatGPT side connects through the Codex desktop app or CLI. The bridge drives the official `claude` and `codex` CLIs that are already logged in on your machine, so it runs on your existing subscriptions. No API keys.

**Altman❤Dario**

## What it does

- **Bounded discussions.** Ask either assistant to discuss a problem with the other for 1–20 rounds (default 3). One round is one message from the current assistant and one reply from the other. The discussion stops at the limit or earlier, and the current assistant summarizes agreement, disagreements and next steps.
- **One-shot review.** `review`, `ask`, `explain` and `plan-review` send a read-only snapshot of the files and diff you choose to the other model.
- **Send files to an existing chat.** "Send src/auth.js to my Claude chat called *login bug*." Chats are found by name, with confirmation when the match is ambiguous.
- **Optional edits.** When you explicitly allow it, the other model may create or update a fixed list of files. The bridge validates, backs up and applies the changes; the other model never gets a shell.
- **Model and effort per call.** For example "Claude uses opus with high effort" or "Codex uses gpt-6.1-sol with xhigh effort".
- **Saved records.** Every discussion is saved locally as Markdown and JSON.

Works in both directions: Claude Code can call Codex, and Codex can call Claude Code.

## Install

A one-click installer is currently available for **Windows x64**.

1. Install the official Claude Code and Codex, and log in to each CLI with your subscription. Git is needed if you want diffs included.
2. Download the file ending in `Setup.exe` from [Releases](https://github.com/cjxkdc/claude-codex-bridge/releases) and run it. Alternatively, download the ZIP, extract it and run `agent-peer-bridge/Install.cmd`.
3. Restart your Codex and Claude Code conversations.

The installer bundles its own Node runtime and does not need administrator rights. It backs up your configuration, then registers the MCP servers and skills on both sides.

The Claude desktop login and the Claude CLI login can differ. If you are told the CLI is not logged in, follow the instructions shown by the installer. The installer does not include either CLI or any subscription. It is not code-signed yet, so Windows SmartScreen may warn on first run.

## Usage

Just ask in plain language.

In **Codex**:

> The page goes blank after login. Discuss it with CC for up to 3 rounds, agree on a fix, then fix it.

In **Claude Code**:

> Discuss this implementation plan with Codex, at most 3 rounds.

You can also say "ask Claude to review this" or "get a second opinion from Codex", or use the skills:

| Where | Skills |
| --- | --- |
| Codex | `$claude-discuss`, `$claude-chat` |
| Claude Code | `/codex-discuss`, `/codex-chat` |

### Allowing the other side to edit

State it explicitly and name the files:

> Discuss this bug with Codex, allow Codex to modify src/auth.js, at most 3 rounds.

The bridge checks every proposed change, backs up the original and stops on conflicts. The other model cannot delete files or run commands; the current assistant does the testing.

### Discussion records

Records are written to `reports/discussions/` in the install directory, one Markdown file and one JSON file per discussion. They contain both sides' messages, the settings used each round and the actual edit results, but not the models' internal reasoning. Say "open the discussion record" to get the path.

## Scope and privacy

- Read-only by default. Edits happen only on files you name, when you allow it.
- Only the files, diffs and context you choose are sent, not the whole repository or chat history. That material goes to the respective official model service.
- Calls count against each subscription's usage limits.
- Only local Claude Code and Codex sessions are supported, not claude.ai or chatgpt.com web chats.

## Install from source

Requires Node 20+ (22.5+ recommended), Git and logged-in official Claude Code and Codex CLIs. In the project directory:

```powershell
npm ci
./scripts/Install.ps1
npm test
```

Tool parameters, install paths, packaging and uninstall steps are in the [technical notes](docs/TECHNICAL.md) (Chinese).

[Validation](docs/VALIDATION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [MIT License](LICENSE)
