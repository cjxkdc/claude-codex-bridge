# Claude Codex Bridge

让 Claude Code 和 Codex 一起讨论方案、找 bug、审查代码。

为 **Claude Code 和 ChatGPT 用户**做的工具。ChatGPT 这一侧通过 Codex 桌面应用或 CLI 使用。调用本机已登录的官方 `claude` 和 `codex`，使用现有订阅，无需 API key。

**Altman❤Dario**

## 安装

目前提供 **Windows x64** 一键安装包。

1. 先安装官方 Claude Code 和 Codex，并用各自的订阅账号登录 CLI。读取代码改动还需要 Git。
2. 从 [Releases](https://github.com/cjxkdc/claude-codex-bridge/releases) 下载以 `Setup.exe` 结尾的安装包，双击安装。也可以下载 ZIP，完整解压后运行 `agent-peer-bridge/Install.cmd`。
3. 安装完成后，重新打开 Codex 和 Claude Code 对话。

安装包自带运行环境，不用另装 Node 或 Python，也不需要管理员权限。安装时会备份配置，并给两边添加工具和讨论技能。

Claude 桌面版登录与 CLI 登录可能不同。如果提示未登录，按安装窗口的说明完成登录。安装包不包含 CLI 或订阅，目前未做代码签名。

## 怎么用

直接在对话里说就行。

在 **Codex** 中：

> 我需要 Debug 登录后白屏。你和 CC 讨论一下，最多 3 轮，确定方案后修复。

在 **Claude Code** 中：

> 请和 Codex 讨论这个实现方案，最多 3 轮。

也可以说“请 Claude 审核一下”“让 Codex 给个第二意见”，或者使用技能：

| 在哪里 | 技能 |
| --- | --- |
| Codex | `$claude-discuss` |
| Claude Code | `/codex-discuss` |

默认最多讨论 **3 轮**，可以指定 **1–20 轮**。一轮就是当前助手发言、另一方回复。到达上限会结束，也可以提前结束。

讨论结束后，当前助手会总结结论和分歧。你要求修复时，它会继续处理；只要求讨论时，它会给出建议。

## 让对方改代码

两个方向都支持。在请求里明确允许修改，并指出文件范围：

> 你和 CC 讨论这个 bug，允许 Claude 修改 src/auth.js，最多 3 轮。

> 你和 Codex 讨论这个 bug，允许 Codex 修改 src/auth.js，最多 3 轮。

对方可以创建或更新指定的文本文件。修改由 bridge 检查、备份后写回项目；遇到文件冲突会停止。对方不能删除文件或执行命令，检查和测试由当前助手完成。

## 选择模型和思考强度

可以直接写在请求里，两个方向都支持。

在 Codex 中：

> 和 CC 讨论这个 bug，Claude 用 opus，思考强度 high，最多 3 轮。

在 Claude Code 中：

> 和 Codex 讨论这个方案，Codex 用 gpt-6.1-sol，思考强度 xhigh，最多 3 轮。

没指定就使用 CLI 默认设置。后续轮次会沿用你的选择，也可以说“下一轮改用 sonnet，强度 medium”。

这些设置只影响被邀请的一方。当前窗口的模型在客户端里设置。可用模型和强度取决于你的账号及 CLI；不支持时会提示错误。

## 查看聊天记录

讨论会自动保存到安装目录下的 `reports/discussions/`，每次生成一份 Markdown 和一份 JSON。

直接说：

> 打开刚才的讨论记录。

记录包含双方发言、每轮设置和实际修改结果，不包含模型内部思考。记录保存在本机，重启后仍可查看；正在进行的讨论不能在重启后继续。

## 使用范围

- 默认只读；你明确允许修改时，对方可以通过 bridge 修改指定文件。当前助手也可以按你的要求修复代码。
- 讨论使用提供的文件、代码改动和上下文，不会自动传入整个仓库或完整聊天历史。这些材料会发送到对应的官方模型服务。
- 调用会使用各自的订阅额度。
- 更新客户端后如果找不到 CLI，重新运行安装程序。

## 从源码安装

需要 Node 20 及以上、Git，以及已登录的官方 Claude Code 和 Codex CLI。在项目目录运行：

```powershell
npm ci
./scripts/Install.ps1
npm test
```

接口参数、安装路径、打包和卸载方法见[详细说明](docs/TECHNICAL.md)。

[验证记录](docs/VALIDATION.md) · [第三方许可](THIRD_PARTY_NOTICES.md) · [MIT License](LICENSE)
