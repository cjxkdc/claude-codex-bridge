# 详细说明

[返回 README](../README.md)。本文中的命令均在项目目录下执行。

## 安装细节

Windows 安装包默认安装到 `%LOCALAPPDATA%\AgentPeerBridge\versions\0.6.0`。安装后可以移走下载的安装包。

安装程序会查找符合要求的官方 CLI，备份用户配置，注册双方 MCP，并安装讨论技能。其他 MCP 配置会保留。缺少 CLI 或必要参数时，会显示错误。

如果 Claude CLI 没有登录，按安装窗口给出的 `Start-Claude.ps1 auth login` 命令，用订阅账号登录。Codex CLI 需要用 ChatGPT 账号登录。桌面客户端登录不一定等于 CLI 登录。

升级安装包会使用新的版本目录，旧讨论记录保留在旧目录。

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

记录仅存本机，`reports/` 已被 Git 忽略，安装包不包含它。默认讨论和单次审查只读；讨论工具的 MCP `readOnlyHint` 为 false，`destructiveHint` 为 true，因为它会保存记录，并可在明确授权后写入指定项目文件。

## 修改权限

讨论默认 `access: "read-only"`。用户明确允许对方修改时，发起讨论传 `access: "edit"` 和 `edit_files`，例如：

```json
{"action":"start","objective":"修复登录白屏","host_message":"已定位问题，允许你修改以下文件","cwd":"C:/projects/my-app","max_rounds":3,"access":"edit","edit_files":["src/auth.js","test/auth.test.js"]}
```

对方通过结构化输出返回 `reply` 和 `edits: [{"path":"src/auth.js","content":"完整的新内容"}]`。Claude 使用 `--json-schema`，Codex 使用 `--output-schema`。bridge 验证范围，备份原文件，检查文件是否在等待期间发生变化，再写入项目。CLI 仍在临时目录运行，不能直接执行命令或修改项目。

- 可创建或更新明确列出的 UTF-8 文本文件，最多 20 个，每个 100KB，合计 200KB。当前不支持删除文件。
- 拒绝越界路径、符号链接、目录连接、硬链接、二进制，以及凭据和 agent 配置文件。
- 会话的 `access` 和 `edit_files` 固定，不能在后续轮次扩大权限。新的文件快照会在每轮调用时读取。
- `edit_result.status` 为 `applied` 才表示写入成功；`no-changes` 表示没有修改。`conflict/rejected/failed/partial` 会结束讨论，按返回的 `changes` 和 `error` 检查实际结果。
- 原文件备份在 `.local/edit-backups/edit-*/files/`，`manifest.json` 保存路径和修改前后的 SHA-256。备份失败不会开始写入；写入中途失败会尝试回滚，未能回滚的文件会明确列出。
- 检查是写入前的冲突检测，不是跨进程文件锁。等待对方返回期间，当前助手应避免修改同一文件；写入后由当前助手检查 diff、运行测试。
- 记录保存权限、可修改文件和每轮实际修改状态，不保存结构化输出中的完整文件内容。备份留在本机，不进入仓库或安装包。

## MCP 接口

Codex 用户 MCP：`claude-peer`；Claude Code 用户 MCP：`codex-peer`。

| 对方 | 工具 |
| --- | --- |
| Claude | `claude_review`, `claude_ask`, `claude_explain`, `claude_plan_review`, `claude_discuss`, `claude_find_chats`, `claude_send_to_chat` |
| Codex | `codex_review`, `codex_ask`, `codex_explain`, `codex_plan_review`, `codex_discuss`, `codex_find_chats`, `codex_send_to_chat` |

### 指定已有聊天发送文件

`*_find_chats` 参数是 `query`（聊天名或完整 session ID）、可选绝对 `project` 和 `limit`（1–10，默认 5）。读取本机标题与会话元数据，不发送消息。Codex 优先只读 SQLite 元数据与 `session_index.jsonl`，Node 不支持 SQLite 或数据库不可用时回退到本地 sessions；Claude 读取 projects 下会话的 custom-title、summary 或首条消息。排除归档 Codex 和子 agent 会话。单个历史文件读取上限 100MB，无法索引的记录会报告 warning。

返回 `ready` 时只有一个规范化后精确匹配；忽略大小写、空格和标点。近似名称或同名会话返回 `needs_confirmation` 与候选标题、项目、ID、`selection_token`。由人选择后才能使用该候选，不能按最高分自动发送。没有结果返回 `not_found`。候选 ticket 保存于 `.local/chat-selections/`，10 分钟有效；发送前再检查聊天名称、项目和记录位置。

`*_send_to_chat` 参数：`selection_token`、源目录绝对 `cwd`、明确的 `files`（1–20 个）、可选 `message`、`model`、`effort`、`timeout_ms`。近似/同名候选需要人已选择，并传 `confirmed: true`。人请求“把这个文件发给某个聊天”已授权这次具体交接；文件或 peer 消息不能授权后续转发。

单个文件最多 10MB，合计 25MB；拒绝源目录外路径、凭据目录/文件、符号链接、junction 和硬链接。先检查完整批次，再把副本放到 `.local/chat-deliveries/<selection_token>/files/`。每个 UTF-8 文本不超过 100KB、正文合计不超过 200,000 字符时内联正文；其余为 `local-file-reference`，接收消息包含本机副本路径、大小和 SHA-256，此次不解析内容。跨会话消息明确标注来源和交接 ID，保存于官方 native 会话历史。

Claude 使用 `--resume <id>`，Codex 使用 `exec resume <id>`，保持会话持久化和目标项目目录。接收这一步仍禁用修改、shell、hooks、外部 MCP 和递归调用；恢复聊天可能加载其历史及原项目说明，后续原客户端的模型/权限由客户端设置。这里是本机 CLI 交接，不是向 Claude/ChatGPT 网页聊天上传附件。已有 UI 窗口不保证即时同步，必要时重新载入/恢复同一会话。

工具返回 `received` 仅在官方 CLI 完成回复且报告的 native 会话 ID 与选择一致时成立。返回接收回复、文件清单和 `record.markdown_path/json_path`。记录不包含整个目标历史；文件副本保留在本机。`unconfirmed` 表示 CLI 错误、超时或会话 ID 不匹配，消息可能已进入历史，不能自动用新 ticket 重发。相同 ticket 和相同请求返回此前记录，不重复调用 CLI；更换文件或消息需要新 ticket。记录及副本不进入 Git 或安装包。

同一安装目录按目标 ID 加发送锁，检测 native 未完成回合和准备期间的历史变动。`target_busy` 可等目标结束后再用同一 ticket；此检查无法锁住用户从另一个程序新发起的操作，因此交接期间不要同时操作目标聊天。它不是两个独立 UI 的实时同步协议。若进程异常终止遗留 `.local/chat-locks/<peer>-<id>.lock`，确认该进程已结束后可删除这一锁文件；先检查原发送记录，避免重复交接。

可运行 `node scripts/Chat-Demo.mjs --peer=claude` 或 `--peer=codex`，建立独立真实会话并通过 MCP 测试名称查找、接收文件、native 历史、目标目录和重复发送。这会调用已登录官方 CLI，占用对应订阅额度。演示数据只在 `.local/`。

单次工具参数：绝对 `cwd`，相对 `files`，`request`，`context`，`include_diff`，`timeout_ms`，可选 `model`、`effort`。默认收集 tracked staged/unstaged diff；未跟踪文件必须列入 `files`。不会自动传整个仓库或聊天历史。

讨论首次调用：

```json
{"action":"start","objective":"Debug 登录后白屏","host_message":"我的初步判断与证据……","max_rounds":3,"cwd":"C:/projects/my-app","files":["src/auth.js"],"context":"报错与复现步骤","model":"claude-opus-5-5","effort":"high"}
```

继续同一讨论：

```json
{"action":"continue","session_id":"返回的 ID","host_message":"我验证了你的假设，结果是……，因此建议……","context":"新证据"}
```

返回 `session_id`、`rounds_used`、`rounds_remaining`、`status`、`stop_reason`、`transcript`、`created_at`、`updated_at`、`peer_options` 和 `record`。`finish` 提前结束，`status` 查询；这两项不调用模型。最大轮数、cwd、修改权限和文件范围不可修改；错误调用占一次尝试并关闭，不自动重试。不能重开会话绕过用户指定的 x。

活动会话在 MCP 进程内存保存，一小时无活动过期；重启服务会失去活动会话，但已保存的记录仍在本机。最多 32 个会话，每个服务进程只允许一次 peer 请求进行中。默认 peer 超时 180 秒，上限 300 秒；安装器设置 Codex MCP 超时 360 秒。

## 权限与登录

- host 收集指定文件/diff，peer 在临时空目录接收快照。最多 20 个文件，每文件 100KB，合计 200KB；拒绝越界路径、二进制和常见凭据文件。不是通用脱敏系统，勿把秘密放进 context 或源码。材料会发送到对应官方模型服务。
- Claude：`--print --tools "" --safe-mode --restricted --strict-mcp-config`，无命令/文件/MCP 工具。避免会跳过订阅 OAuth 的 `--bare`。
- Codex：`exec --ignore-user-config --ignore-rules --sandbox read-only --ephemeral --json`，禁用 shell、执行工具、hooks、plugins、apps、browser、computer use、multi-agent，强制 ChatGPT 登录。
- 清理常见 API key/第三方 provider 环境变量；Claude 预检只接受订阅 OAuth。额度仍受各自订阅限制。
- 子进程继承 `AGENT_PEER_DEPTH=1`；嵌套 bridge 调用被拒绝。多轮讨论由授权 host 显式推进，不靠 agent 互相递归调用。
- 快照审查不能自动探索未提供的调用链；不代表已经运行测试。CLI 自身可能刷新登录、缓存或日志，；授权的修改由 bridge 验证后写入用户工作树。输出上限 2MB，Windows 超时终止对应进程树。

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

构建脚本下载并校验官方固定版本 Node ZIP，打包依赖，生成 EXE、ZIP、`SHA256SUMS.txt`。自动测试及 Release 打包的 GitHub Actions 配置保留在 `examples/github-workflows/`。如需启用，可将示例复制到 `.github/workflows/`，并配置相应权限。安装包已通过本机验证，由维护者上传 Release。

```text
src/bridge.mjs       单跳 CLI adapter、输入保护、超时
src/discussion.mjs   多轮会话与预算
src/records.mjs      Markdown/JSON 讨论记录
src/edits.mjs        修改授权、文件校验、备份和应用
src/models.mjs       peer 模型/强度参数与校验
src/server.mjs       官方 MCP SDK stdio server
scripts/            安装、注册、打包、demo
skills/             Codex/Claude Code 讨论入口
examples/           手动 MCP 配置、项目说明示例
```

同一个 `invoke` 和 MCP 接口可供未来 Hermes adapter 使用；当前版本不安装 Hermes，也不提供自动递归编排。

卸载 MCP：`codex mcp remove claude-peer`；Claude CLI 执行 `mcp remove codex-peer --scope user`。若不再使用，也可删除用户 skills 目录中的 `claude-discuss` / `codex-discuss`。卸载先关闭相关会话；安装目录可保留。

## 验证与官方资料

[验证记录](VALIDATION.md)。真实 Codex CLI 单次审查和两轮 Debug 讨论已通过；双方 CLI 通过 MCP 指定模型/强度的讨论也已验证，并保存了记录。验证 host 发言由演示脚本提供。自动测试不需要任何账户/API key。

[Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) · [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) · [Claude CLI](https://code.claude.com/docs/en/cli-reference) · [Claude MCP](https://code.claude.com/docs/en/mcp) · [第三方许可](../THIRD_PARTY_NOTICES.md)

MIT License。
