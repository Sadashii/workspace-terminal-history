# Workspace Terminal History

> **Note:** This extension is explicitly **vibe coded**! 🚀

Saves your terminal command history **per workspace folder**. When you switch to a different project, your up/down arrow keys recall commands from your last session in that specific project — no more hunting through global shell history or losing the commands you frequently run in different workspaces.

## Features

- ✨ **True Native Arrow-Key Recall:** Seamlessly pushes previous commands to your shell's up/down arrow memory buffer implicitly.
- 📂 **Workspace Isolation:** Maintains an independent `.terminal_history.json` isolated from global bash/powershell histories ensuring zero command contamination between projects.
- 🚀 **Silent Temporary Script Injection:** Avoids messy terminal text-flooding when booting new sessions by mapping commands into compact, zero-trace temporary loader files.
- 🏎️ **QuickPick UI Support:** If you prefer browsing, rapidly search, replay, and run past commands through a native fuzzy-search command palette overlay.
- 🛡️ **Highly Configurable:** Limit max size, enforce smart deduplication of consecutive commands, and blacklist specific noise patterns (like `ls`, `cd`, `pwd`).
- 🤖 **VS Code Shell Integration:** Extracts commands natively via the VSCode 1.93+ Shell Integration API directly from the execution prompt, not just keystroke listeners.

## How It Works (The Magic)

1. **Passive Tracking**: As you work and execute commands, the VS Code `onDidEndTerminalShellExecution` API reliably captures terminal activity.
2. **Robust Persistence**: Captured commands are synced neatly into a `.terminal_history.json` file kept in your immediate workspace directory or nested `.vscode/` setup.
3. **Silent Injection on Startup**: Whenever you open a fresh terminal, the extension writes down all your prior commands into an invisible, native shell-specific temp script (e.g., heavily optimized `.ps1`, `.sh`, or `.fish` payloads).
4. **Integration execution**: The terminal executes that tiny file to silently inject all older contents directly into your shell session's buffer (relying on memory loading mechanics like `PSConsoleReadLine::AddToHistory` or `history -r`), and instantly destroys the file.
5. **Instant Recall**: From the moment the terminal stabilizes, your up/down arrows work out of the box with your repo-specific commands.

## Requirements

- **VS Code 1.93+** (for the native Shell Integration API that captures commands reliably)
- Shell integration must be enabled (it is by default). If you disabled it, add this to your `settings.json`:

```json
"terminal.integrated.shellIntegration.enabled": true
```

## Supported Shells

| Shell | Silent History Loading Mechanism | Auto-capture |
|---|---|---|
| bash | ✅ `history -s` mapping from `.sh` payload | ✅ |
| zsh | ✅ `history -s` mapping from `.sh` payload | ✅ |
| fish | ✅ `history merge` mapping from `.fish` payload | ✅ |
| PowerShell | ✅ `PSConsoleReadLine::AddToHistory` mapping via `.ps1` | ✅ |
| cmd.exe | ❌ (no native arrow key API injection available) | ✅ saved, not injected |

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and search:

- **Workspace History: Show Command History** — browse & replay any past command through QuickPick
- **Workspace History: Clear History for This Workspace** — wipe the saved history from disk memory
- **Workspace History: Open History File** — inspect the raw `.terminal_history.json` file in your editor

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `workspaceHistory.injectOnTerminalOpen` | `true` | Automatically inject up/down arrow command histories invisibly when booting a terminal. |
| `workspaceHistory.maxCommands` | `500` | Max commands stored per workspace |
| `workspaceHistory.excludePatterns` | `["ls","ll","clear",…]` | Commands to never capture or save |
| `workspaceHistory.historyFileName` | `.terminal_history` | File name (normally saved as `.terminal_history.json`) |
| `workspaceHistory.saveToVscodeFolder` | `false` | Save inside `.vscode/` instead of polluting root |
| `workspaceHistory.deduplicateConsecutive` | `true` | Skip duplicating identical consecutive commands |
| `workspaceHistory.showStatusBar` | `true` | Show command count in the bottom status bar element |

## Git Tip

Simply add the history file to `.gitignore` to prevent tracking it publicly:

```gitignore
.terminal_history.json
```

Or you can choose to commit it — it's pure JSON, which actually functions as an amazing zero-effort "getting started" command cheat-sheet for onboarding new repo devs!

## Installing from source

```bash
cd workspace-history-extension
npm install
npm run compile
# Press F5 in VS Code to launch the Extension Development Host to test
```

To build a installable `.vsix` package:

```bash
npm install -g @vscode/vsce
vsce package
# Outputs workspace-terminal-history-1.0.x.vsix
```

Install it easily:

```
Extensions panel → ⋯ (menu) → Install from VSIX…
```
