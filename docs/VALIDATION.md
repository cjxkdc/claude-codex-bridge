# Verification · v0.5.0

- 35 automated tests pass on Windows, including explicit edit authorization, immutable scope, protected paths, new files, full-batch validation, changed-file conflicts, junction/hard-link rejection, backups, write-failure rollback and preservation of external edits. MCP discovery advertises edit access in both directions; one-pass tools remain read-only.
- Real logged-in Claude Code 2.1.286 and Codex CLI 0.160.0 each completed an edit discussion through MCP using their CLI default model/effort. Each modified an isolated demo file and created a new note file; the bridge confirmed writes, backed up originals, and saved permissions and application results in Markdown/JSON records. The host messages were supplied by the demo script.
- The edited demo behavior was checked by the host: average([]) throws RangeError; average([1,2,3]) returns 2; average([5]) returns 5. The shipped demo source was not modified.

## Earlier v0.4.0 verification


- 25 automated tests pass on Windows without model/API calls. They cover MCP discovery on both peers, CLI model/effort arguments, inherited effort overrides, model ID validation, requested versus reported settings, per-round setting persistence/change/reset, transcript files, disk-write errors, read-only arguments, credential cleanup, path/input limits, timeout termination, round caps, early stopping, failure/expiry/concurrency behavior, and configuration/skill registration.
- Real logged-in Codex CLI single-pass review passed through both the direct adapter and the official MCP SDK client.
- Real Codex CLI two-round Debug discussion passed through MCP, preserving first-round reasoning, closing at exactly two attempts and leaving the source unchanged. The test host messages were supplied by the demo script, not a Claude model.
- Real subscription Claude CLI 2.1.286 and Codex CLI 0.160.0 discussion calls passed through MCP with explicit model/effort parameters: Claude `claude-opus-5-5` / `medium`, and Codex `gpt-6.1-sol` / `medium`. Requested settings were saved in both record formats and the demo source was unchanged. The verification host messages came from the demo script. CLI-reported model usage is stored only when provided; effective effort is not inferred.
- Node runtime for the Windows release is official 24.21.0 x64, verified against the pinned official SHA-256. Runtime/dependencies ship in the installer; user credentials, local configuration and private demo results do not.
- The self-extracting EXE was exercised in extraction-only mode. All 25 tests passed from the extracted runtime/package. The original v0.3.0 installer registration was also tested with Windows PowerShell 5.1 against a fresh temporary user profile using the real official CLIs; both MCP registrations and both skill files were created without changing the real user profile.

Installed clients and MCP loading vary by host version. Restart both conversations after installation; authenticate each official CLI with its subscription before running model demos.
