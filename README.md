# Workspace Terminal History

Saves your terminal command history **per workspace folder**. When you switch to a different project, arrow keys recall commands from your last session in that project — no more hunting through global shell history.

## How it works

| What happens | When |
|---|---|
| New terminal opens | History from this workspace is silently injected → ↑ / ↓ work immediately |
| You run a command | It's saved to `.terminal_history.json` in your workspace root |
| You switch projects | The next terminal loads *that* project's history |

## Requirements

- **VS Code 1.93+** (for the Shell Integration API that captures commands)
- Shell integration must be enabled (it is by default). If you disabled it, add this to your settings:

```json
"terminal.integrated.shellIntegration.enabled": true
```

## Shell support

| Shell | History injection | Auto-capture |
|---|---|---|
| bash | ✅ `history -s` | ✅ |
| zsh | ✅ `history -s` | ✅ |
| fish | ✅ `builtin history append` | ✅ |
| PowerShell | ✅ `Add-History` | ✅ |
| cmd.exe | ❌ (no API) | ✅ saved, not injected |

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and search:

- **Workspace History: Show Command History** — browse & replay any past command
- **Workspace History: Clear History for This Workspace** — wipe the saved history
- **Workspace History: Open History File** — inspect the raw JSON file

## Settings

| Setting | Default | Description |
|---|---|---|
| `workspaceHistory.maxCommands` | `500` | Max commands stored per workspace |
| `workspaceHistory.excludePatterns` | `["ls","ll","clear",…]` | Commands to never save |
| `workspaceHistory.historyFileName` | `.terminal_history` | File name (saved as `.terminal_history.json`) |
| `workspaceHistory.saveToVscodeFolder` | `false` | Save inside `.vscode/` instead of root |
| `workspaceHistory.deduplicateConsecutive` | `true` | Skip identical consecutive commands |
| `workspaceHistory.showStatusBar` | `true` | Show command count in the status bar |

## Git tip

Add the history file to `.gitignore` if you don't want to commit it:

```
.terminal_history.json
```

Or commit it — it's just JSON, and sharing it can be useful for onboarding teammates!

## Installing from source

```bash
cd workspace-history-extension
npm install
npm run compile
# Then press F5 in VS Code to launch the Extension Development Host
```

To build a `.vsix` package:

```bash
npm install -g @vscode/vsce
vsce package
# → workspace-terminal-history-1.0.0.vsix
```

Install the `.vsix`:

```
Extensions panel → ⋯ menu → Install from VSIX…
```
