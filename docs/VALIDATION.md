# Verification · v0.3.0

- 15 automated tests pass on Windows without model/API calls. They cover MCP initialize/tool discovery/error handling, read-only CLI arguments, environment credential cleanup, path/input limits, timeout termination, discussion transcript continuity, round caps, early stopping, failure/expiry/concurrency behavior, and configuration/skill registration.
- Real logged-in Codex CLI single-pass review passed through both the direct adapter and the official MCP SDK client.
- Real Codex CLI two-round Debug discussion passed through MCP, preserving first-round reasoning, closing at exactly two attempts and leaving the source unchanged. The test host messages were supplied by the demo script, not a Claude model.
- Claude CLI 2.1.286 was discovered in the official Desktop distribution. Its real model review/discussion has not passed because the tested CLI subscription login was absent. Missing login returns a clear error and stops without automatic retries.
- Node runtime for the Windows release is official 24.21.0 x64, verified against the pinned official SHA-256. Runtime/dependencies ship in the installer; user credentials, local configuration and private demo results do not.
- The self-extracting EXE was exercised in extraction-only mode. All 15 tests passed from the extracted runtime/package. Its installer was then run by Windows PowerShell 5.1 against a fresh temporary user profile using the real official CLIs; both MCP registrations and both skill files were created successfully without changing the real user profile.

Installed clients and MCP loading vary by host version. Restart both conversations after installation; authenticate each official CLI with its subscription before running model demos.
