# Third-party components

Windows releases bundle the official Node.js 24.21.0 Windows x64 runtime. Its full license is included at `vendor/node/LICENSE`. Source: https://nodejs.org/download/release/v24.21.0/ . The build verifies the official ZIP SHA-256.

Dependencies are installed from `package-lock.json`. MCP SDK, Zod and transitive dependencies retain their licenses under `node_modules`. These dependencies are included to avoid requiring a separate npm install.

Claude Code and Codex executables, credentials, subscriptions and tokens are not redistributed. Install those official clients separately and authenticate with your own subscriptions.
