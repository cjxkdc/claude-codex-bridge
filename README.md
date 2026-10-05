# Agent Peer Bridge

Claude Code ↔ Codex CLI 本地双向讨论与审查工具。调用本机已登录的官方 CLI，使用现有订阅；不要求 Anthropic/OpenAI API key。支持实现方案、Debug、多轮讨论、review、ask、explain 与 plan-review。

## Windows 一键安装

从 [Releases](https://github.com/cjxkdc/agent-peer-bridge/releases) 下载：

- `agent-peer-bridge-v0.4.0-windows-x64-Setup.exe`：双击安装。
- 或下载 ZIP，完整解压后双击 `agent-peer-bridge/Install.cmd`。

内置官方 Node 24.21.0 和运行依赖，无需额外安装 Node/Python，不需要管理员权限。安装目录为 `%LOCALAPPDATA%\AgentPeerBridge\versions\0.4.0`，可以移走下载的安装包。CLI/订阅不包含在安装包内：需要已经安装官方 Codex、Claude Code 或带原生 CLI 的桌面客户端；默认收集 Git diff 还需要 Git。当前只提供 Windows x64 包；安装程序未做代码签名，使用 Windows 内置 .NET Framework。

安装会：发现符合安全参数要求的官方 CLI，备份用户配置、注册双方 MCP、安装讨论技能。保留其他 MCP 项目。安装失败会显示具体缺失的 CLI/参数，不偷偷使用 API key。

完成后重开 Codex/Claude Code 会话。Claude 桌面登录可能不等于 CLI 登录；若报未登录，按安装窗口给出的 `Start-Claude.ps1 auth login` 命令，用现有订阅完成 OAuth。Codex 也必须用 ChatGPT 登录。用户交互登录无法由安装包代办。

## 怎么用

在 Codex 输入：

> 我需要 Debug 登录后白屏。你和 CC 讨论一下，最大讨论轮数 3，确定方案后修复。

或用 `$claude-discuss` 技能。

在 Claude Code 输入：

> 请和 Codex 讨论这个实现方案，最多 3 轮。

或用 `/codex-discuss` 技能。**Codex 使用 `$claude-discuss`，不要把它当成 `/claude-discuss` 内置斜杠命令。** 也可直接说“请 Claude 审核一下”“让 Codex 给第二意见”。

一轮 = 当前对话的 host 提出或回应观点 + peer CLI 回复。当前 Codex/Claude 是参与者，bridge 只启动另一方；不会额外启动一个同名模型冒充当前对话。默认 3 轮，支持 1–20 轮，到达上限由程序强制关闭，也可提前结束。每轮传递之前的讨论；host 可在用户授权内补充日志、验证假设、运行测试或实施修复，再回应 peer。

讨论结束返回共识、分歧、证据与下一步。peer 永远只读；用户已要求实现/Debug 时，当前 host 继续完成授权工作。只要求讨论时返回方案。

## 在对话里选择模型和思考强度

在 Codex 里说：

> 你和 CC 讨论这个 bug，Claude 用 Opus 5.5，思考强度 high，最多 3 轮。

在 Claude Code 里说：

> 你和 Codex 讨论这个方案，Codex 用 gpt-6.1-sol，思考强度 xhigh，最多 3 轮。

模型和强度会通过 CLI 参数传入，不只是写在 prompt 里。Claude 接受 `opus`、`sonnet`、`haiku` 等 CLI 别名或完整模型 ID，例如 `claude-opus-5-5`；Codex 使用其账户可用的 CLI 模型 ID。Claude 强度支持 `low/medium/high/xhigh/max`；Codex 参数接受 `none/minimal/low/medium/high/xhigh/max/ultra`，具体可用档位仍取决于模型、账户和 CLI。模型不可用或参数被拒绝时返回错误，bridge 不自行改用其他模型。官方说明：[Claude 参数](https://code.claude.com/docs/en/cli-reference)、[Codex 配置](https://learn.chatgpt.com/docs/config-file/config-reference)。

没指定就沿用 CLI 默认。同一讨论后续轮次沿用已选设置；你明确说“下一轮改用 Sonnet，medium”时，可以在同一个 session 上修改，轮数上限不变。传 `model: "default"` 或 `effort: "auto"` 可重置对应选项，省略另一项则保留它。

参数控制被调用的 peer；当前聊天窗口的 host 模型和强度由其界面设置决定。聊天记录显示每轮的**请求参数**，Claude JSON 若提供 `modelUsage`，也保存其报告的使用模型名称。CLI 可能受组织策略、模型限制或自身回退规则影响；工具不把请求强度标成已经独立验证的实际强度。显式指定 Claude 强度时会移除子进程继承的 `CLAUDE_CODE_EFFORT_LEVEL`，避免其覆盖本次 `--effort`。

## 在哪里看聊天记录

从 v0.3.1 起，每轮自动保存到 **bridge 安装目录下的 `reports/discussions/`**。每个讨论一个 `日期_会话ID.md` 和一个同名 `.json`：Markdown 按轮次显示双方实际发言，JSON 可供程序读取。记录在等待 peer 回复前、收到回复后、发生错误或提前结束时更新，结束后 host 会给出 Markdown 路径。文件不会随一小时会话过期或 MCP 重启而删除；活动会话仍不能在重启后继续。升级安装包会使用新的版本目录，旧记录保留在旧版本目录。

也可在对话里说：“把刚才的讨论记录完整展示出来”“打开这次讨论的 Markdown 记录”。工具返回中的 `transcript` 可直接查看；`record.markdown_path` 和 `record.json_path` 是文件路径。`record.save_status` 若为 `failed`，会返回具体错误，host 应说明没有成功保存。

记录包含 **host 实际发给 peer 的发言及 peer 返回的正文**，不包含模型内部思考、整个主对话或完整文件/context 快照。单条 peer 回复超过 20,000 字符会截断并标记；达到长度限制即关闭讨论。历史版本未落盘的会话不能凭空恢复；若仍能取到工具返回中的 transcript，可手动另存。

记录仅存本机，`reports/` 已被 Git 忽略，安装包不包含它。peer 仍只读；讨论工具的 MCP `readOnlyHint` 为 false，是因为 bridge 会写自身的记录文件。

## MCP 接口

Codex 用户 MCP：`claude-peer`；Claude Code 用户 MCP：`codex-peer`。

| 对方 | 工具 |
| --- | --- |
| Claude | `claude_review`, `claude_ask`, `claude_explain`, `claude_plan_review`, `claude_discuss` |
| Codex | `codex_review`, `codex_ask`, `codex_explain`, `codex_plan_review`, `codex_discuss` |

单次工具参数：绝对 `cwd`，相对 `files`，`request`，`context`，`include_diff`，`timeout_ms`，可选 `model`、`effort`。默认收集 tracked staged/unstaged diff；未跟踪文件必须列入 `files`。不会自动传整个仓库或聊天历史。

讨论首次调用：

```json
{"action":"start","objective":"Debug 登录后白屏","host_message":"我的初步判断与证据……","max_rounds":3,"cwd":"C:/projects/my-app","files":["src/auth.js"],"context":"报错与复现步骤","model":"claude-opus-5-5","effort":"high"}
```

继续同一讨论：

```json
{"action":"continue","session_id":"返回的 ID","host_message":"我验证了你的假设，结果是……，因此建议……","context":"新证据"}
```

返回 `session_id`、`rounds_used`、`rounds_remaining`、`status`、`stop_reason`、`transcript`、`created_at`、`updated_at`、`peer_options` 和 `record`。`finish` 提前结束，`status` 查询；这两项不调用模型。最大轮数和 cwd 不可修改；错误调用占一次尝试并关闭，不自动重试。不能重开会话绕过用户指定的 x。

活动会话在 MCP 进程内存保存，一小时无活动过期；重启服务会失去活动会话，但已保存的记录仍在本机。最多 32 个会话，每个服务进程只允许一次 peer 请求进行中。默认 peer 超时 180 秒，上限 300 秒；安装器设置 Codex MCP 超时 360 秒。

## 只读与认证边界

- host 收集指定文件/diff，peer 在临时空目录接收快照。最多 20 个文件，每文件 100KB，合计 200KB；拒绝越界路径、二进制和常见凭据文件。不是通用脱敏系统，勿把秘密放进 context 或源码。材料会发送到对应官方模型服务。
- Claude：`--print --tools "" --safe-mode --restricted --strict-mcp-config`，无命令/文件/MCP 工具。避免会跳过订阅 OAuth 的 `--bare`。
- Codex：`exec --ignore-user-config --ignore-rules --sandbox read-only --ephemeral --json`，禁用 shell、执行工具、hooks、plugins、apps、browser、computer use、multi-agent，强制 ChatGPT 登录。
- 清理常见 API key/第三方 provider 环境变量；Claude 预检只接受订阅 OAuth。额度仍受各自订阅限制。
- 子进程继承 `AGENT_PEER_DEPTH=1`；嵌套 bridge 调用被拒绝。多轮讨论由授权 host 显式推进，不靠 agent 互相递归调用。
- 快照审查不能自动探索未提供的调用链；不代表已经运行测试。CLI 自身可能刷新登录、缓存或日志，但不修改用户工作树。输出上限 2MB，Windows 超时终止对应进程树。

## 从源码安装与开发

需要 Node >=20、Git、足够新的官方原生 Claude/Codex CLI：

```powershell
npm ci
./scripts/Install.ps1
npm test
```

可提供 `-ClaudePath`、`-CodexPath`、`-NodePath`；`-SkipRegister` 只生成本机配置。`.local/`、凭据、运行结果和依赖不进入 Git。更新桌面客户端后若带版本号的 CLI 路径消失，重新运行安装器。

```powershell
./scripts/Demo.ps1 -Peer codex
./scripts/Demo.ps1 -Peer claude
$cfg = Get-Content .local/config.json -Raw -Encoding UTF8 | ConvertFrom-Json
& $cfg.node scripts/Discussion-Demo.mjs codex
& $cfg.node scripts/Discussion-Demo.mjs claude
```

构建安装包：

```powershell
./scripts/Build-Release.ps1 -MakeExe
```

构建脚本下载并校验官方固定版本 Node ZIP，打包依赖，生成 EXE、ZIP、`SHA256SUMS.txt`。自动测试及 Release 打包的 GitHub Actions 配置保留在 `examples/github-workflows/`。当前 GitHub 登录缺少 workflow 权限，因此没有启用远程自动工作流；具备权限后可复制到 `.github/workflows/`。安装包已通过本机验证，由维护者上传 Release。

```text
src/bridge.mjs       单跳 CLI adapter、输入保护、超时
src/discussion.mjs   多轮会话与预算
src/records.mjs      Markdown/JSON 讨论记录
src/models.mjs       peer 模型/强度参数与校验
src/server.mjs       官方 MCP SDK stdio server
scripts/            安装、注册、打包、demo
skills/             Codex/Claude Code 讨论入口
examples/           手动 MCP 配置、项目说明示例
```

同一个 `invoke` 和 MCP 接口可供未来 Hermes adapter 使用；当前版本不安装 Hermes，也不提供自动递归编排。

卸载 MCP：`codex mcp remove claude-peer`；Claude CLI 执行 `mcp remove codex-peer --scope user`。若不再使用，也可删除用户 skills 目录中的 `claude-discuss` / `codex-discuss`。卸载先关闭相关会话；安装目录可保留。

## 验证与官方资料

[验证记录](docs/VALIDATION.md)。真实 Codex CLI 单次审查和两轮 Debug 讨论已通过；双方 CLI 通过 MCP 指定模型/强度的讨论也已验证，并保存了记录。验证 host 发言由演示脚本提供。自动测试不需要任何账户/API key。

[Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) · [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) · [Claude CLI](https://code.claude.com/docs/en/cli-reference) · [Claude MCP](https://code.claude.com/docs/en/mcp) · [第三方许可](THIRD_PARTY_NOTICES.md)

MIT License。
