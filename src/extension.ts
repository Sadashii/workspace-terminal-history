import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  command: string;
  timestamp: number;
  cwd?: string;
}

interface WorkspaceHistory {
  version: number;
  workspacePath: string;
  entries: HistoryEntry[];
  lastUpdated: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_VERSION = 1;

// ─── HistoryManager ──────────────────────────────────────────────────────────

class HistoryManager {
  private cache = new Map<string, WorkspaceHistory>();

  private getConfig() {
    return vscode.workspace.getConfiguration("workspaceHistory");
  }

  private getHistoryFilePath(workspaceRoot: string): string {
    const cfg = this.getConfig();
    const fileName = cfg.get<string>("historyFileName", ".terminal_history");
    const useVscodeFolder = cfg.get<boolean>("saveToVscodeFolder", false);

    if (useVscodeFolder) {
      const vscodePath = path.join(workspaceRoot, ".vscode");
      if (!fs.existsSync(vscodePath)) {
        fs.mkdirSync(vscodePath, { recursive: true });
      }
      return path.join(vscodePath, fileName + ".json");
    }

    return path.join(workspaceRoot, fileName + ".json");
  }

  load(workspaceRoot: string): WorkspaceHistory {
    if (this.cache.has(workspaceRoot)) {
      return this.cache.get(workspaceRoot)!;
    }

    const filePath = this.getHistoryFilePath(workspaceRoot);

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw) as WorkspaceHistory;
        if (data.version === HISTORY_VERSION && Array.isArray(data.entries)) {
          this.cache.set(workspaceRoot, data);
          return data;
        }
      } catch {
        // corrupted file – start fresh
      }
    }

    const fresh: WorkspaceHistory = {
      version: HISTORY_VERSION,
      workspacePath: workspaceRoot,
      entries: [],
      lastUpdated: Date.now(),
    };
    this.cache.set(workspaceRoot, fresh);
    return fresh;
  }

  save(workspaceRoot: string): void {
    const history = this.cache.get(workspaceRoot);
    if (!history) {
      return;
    }

    const filePath = this.getHistoryFilePath(workspaceRoot);
    history.lastUpdated = Date.now();

    try {
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
    } catch (err) {
      vscode.window.showWarningMessage(
        `Workspace History: Could not save history – ${err}`
      );
    }
  }

  addCommand(workspaceRoot: string, command: string, cwd?: string): boolean {
    const cfg = this.getConfig();
    const excludePatterns = cfg.get<string[]>("excludePatterns", []);
    const maxCommands = cfg.get<number>("maxCommands", 500);
    const dedupe = cfg.get<boolean>("deduplicateConsecutive", true);

    const trimmed = command.trim();
    if (!trimmed) {
      return false;
    }

    // Exclude check (exact match or prefix)
    if (excludePatterns.some((p) => trimmed === p || trimmed.startsWith(p + " "))) {
      return false;
    }

    const history = this.load(workspaceRoot);

    // Dedup consecutive identical commands
    if (dedupe && history.entries.length > 0) {
      const last = history.entries[history.entries.length - 1];
      if (last.command === trimmed) {
        return false;
      }
    }

    history.entries.push({
      command: trimmed,
      timestamp: Date.now(),
      cwd,
    });

    // Trim to max
    if (history.entries.length > maxCommands) {
      history.entries = history.entries.slice(history.entries.length - maxCommands);
    }

    this.save(workspaceRoot);
    return true;
  }

  getCommands(workspaceRoot: string): string[] {
    return this.load(workspaceRoot).entries.map((e) => e.command);
  }

  clearHistory(workspaceRoot: string): void {
    const history = this.load(workspaceRoot);
    history.entries = [];
    this.save(workspaceRoot);
  }

  getHistoryFilePath_public(workspaceRoot: string): string {
    return this.getHistoryFilePath(workspaceRoot);
  }

  invalidateCache(workspaceRoot: string): void {
    this.cache.delete(workspaceRoot);
  }
}

// ─── Shell injection helpers ──────────────────────────────────────────────────

type ShellType = "bash" | "zsh" | "fish" | "powershell" | "cmd" | "unknown";

function detectShell(terminal: vscode.Terminal): ShellType {
  const name = terminal.name.toLowerCase();
  const shellPath =
    (terminal.creationOptions as vscode.TerminalOptions).shellPath ?? "";
  const combined = (name + " " + shellPath).toLowerCase();

  if (combined.includes("powershell") || combined.includes("pwsh")) {
    return "powershell";
  }
  if (combined.includes("cmd") || combined.includes("command prompt")) {
    return "cmd";
  }
  if (combined.includes("fish")) {
    return "fish";
  }
  if (combined.includes("zsh")) {
    return "zsh";
  }
  if (
    combined.includes("bash") ||
    combined.includes("git bash") ||
    combined.includes("wsl")
  ) {
    return "bash";
  }

  // Fall back to OS default guess
  if (os.platform() === "win32") {
    return "powershell";
  }
  return "bash"; // macOS / Linux default
}

/**
 * Build the shell commands needed to inject history entries so arrow-key recall
 * works natively in the shell.
 */
function buildHistoryInjectionScript(
  commands: string[],
  shell: ShellType
): string | null {
  if (commands.length === 0) {
    return null;
  }

  // Only send the most recent N entries to avoid flooding the terminal on open
  const INJECT_LIMIT = 100;
  const recent = commands.slice(-INJECT_LIMIT);

  switch (shell) {
    case "bash":
    case "zsh": {
      // `history -s` appends to the in-memory history list
      const lines = recent
        .map((cmd) => `history -s ${shellQuote(cmd, "bash")}`)
        .join("\n");
      return lines;
    }

    case "fish": {
      // fish history is file-based; we write entries via `builtin history`
      const lines = recent
        .map((cmd) => `builtin history merge; echo ${shellQuote(cmd, "fish")} | builtin history merge`)
        .join("\n");
      // Simpler: just use `history merge` after appending via fish_history
      // Actually the cleanest fish approach is to send each as a history command
      const fishLines = recent
        .map((cmd) => `builtin history append ${shellQuote(cmd, "fish")}`)
        .join("; ");
      return fishLines;
    }

    case "powershell": {
      // Add-History accepts HistoryInfo objects; easier via [Microsoft.PowerShell.Commands.HistoryInfo]
      // Simplest cross-version approach: build an array and add all at once
      const entries = recent
        .map(
          (cmd) =>
            `[Microsoft.PowerShell.Commands.HistoryInfo]@{CommandLine=${psQuote(cmd)};ExecutionStatus='Completed';StartExecutionTime=[DateTime]::Now;EndExecutionTime=[DateTime]::Now}`
        )
        .join(",`\n  ");
      return `@(\n  ${entries}\n) | Add-History`;
    }

    case "cmd":
    case "unknown":
    default:
      return null; // cmd.exe has no scriptable history injection
  }
}

function shellQuote(cmd: string, shell: "bash" | "fish"): string {
  // Wrap in single quotes, escape any existing single quotes
  const escaped = cmd.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

function psQuote(cmd: string): string {
  const escaped = cmd.replace(/'/g, "''");
  return `'${escaped}'`;
}

// ─── Extension activation ─────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const manager = new HistoryManager();
  let statusBar: vscode.StatusBarItem | undefined;

  // ── Status bar ──
  const cfg = vscode.workspace.getConfiguration("workspaceHistory");
  if (cfg.get<boolean>("showStatusBar", true)) {
    statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBar.command = "workspaceHistory.showHistory";
    statusBar.tooltip = "Workspace Terminal History – click to browse";
    context.subscriptions.push(statusBar);
  }

  function updateStatusBar(workspaceRoot?: string) {
    if (!statusBar) {
      return;
    }
    if (!workspaceRoot) {
      statusBar.hide();
      return;
    }
    const count = manager.getCommands(workspaceRoot).length;
    statusBar.text = `$(history) ${count} cmds`;
    statusBar.show();
  }

  function getActiveWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    // If only one folder, use it. Otherwise try to match the active file.
    if (folders.length === 1) {
      return folders[0].uri.fsPath;
    }
    const activeFile = vscode.window.activeTextEditor?.document.uri;
    if (activeFile) {
      const folder = vscode.workspace.getWorkspaceFolder(activeFile);
      if (folder) {
        return folder.uri.fsPath;
      }
    }
    return folders[0].uri.fsPath;
  }

  // ── Inject history when a new terminal opens ──
  async function injectHistoryIntoTerminal(
    terminal: vscode.Terminal,
    workspaceRoot: string
  ) {
    const commands = manager.getCommands(workspaceRoot);
    if (commands.length === 0) {
      return;
    }

    const shell = detectShell(terminal);
    const script = buildHistoryInjectionScript(commands, shell);
    if (!script) {
      return;
    }

    // Small delay to let the shell initialise (source .bashrc etc.)
    await new Promise((r) => setTimeout(r, 800));

    // Send silently – wrap so it doesn't appear in the prompt output
    if (shell === "bash" || shell === "zsh") {
      // Execute in a subshell redirect so nothing shows in the prompt
      terminal.sendText(
        `{ ${script.replace(/\n/g, "; ")}; } 2>/dev/null`,
        true
      );
    } else if (shell === "fish") {
      terminal.sendText(script, true);
    } else if (shell === "powershell") {
      terminal.sendText(script, true);
    }
  }

  // ── Listen for terminals being opened ──
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(async (terminal) => {
      const root = getActiveWorkspaceRoot();
      if (!root) {
        return;
      }
      await injectHistoryIntoTerminal(terminal, root);
      updateStatusBar(root);
    })
  );

  // ── Capture executed commands via Shell Integration API ──
  // This API became stable in VS Code 1.93
  if ("onDidEndTerminalShellExecution" in vscode.window) {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution(
        (event) => {
          const root = getActiveWorkspaceRoot();
          if (!root) {
            return;
          }
          const command = event.execution.commandLine?.value?.trim();
          if (!command) {
            return;
          }
          const cwdStr = event.execution.cwd?.fsPath;
          const added = manager.addCommand(root, command, cwdStr);
          if (added) {
            updateStatusBar(root);
          }
        }
      )
    );
  } else {
    // Fallback message for older VS Code versions
    vscode.window.showInformationMessage(
      "Workspace Terminal History: Shell integration requires VS Code 1.93+. " +
        "History injection on open is active, but automatic capture of new commands is unavailable. " +
        "Please enable terminal shell integration in your settings."
    );
  }

  // ── Re-inject when switching workspace folders (multi-root) ──
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBar(getActiveWorkspaceRoot());
    })
  );

  // ── Command: Show history in quick-pick ──
  context.subscriptions.push(
    vscode.commands.registerCommand("workspaceHistory.showHistory", async () => {
      const root = getActiveWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage("No workspace folder is open.");
        return;
      }

      const commands = manager.getCommands(root).slice().reverse(); // newest first
      if (commands.length === 0) {
        vscode.window.showInformationMessage(
          "No history yet for this workspace."
        );
        return;
      }

      const items = commands.map((cmd, i) => ({
        label: cmd,
        description: `#${commands.length - i}`,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a command to send to the active terminal",
        matchOnDescription: true,
      });

      if (selected) {
        const terminal =
          vscode.window.activeTerminal ??
          vscode.window.createTerminal({ name: "Workspace History" });
        terminal.show();
        terminal.sendText(selected.label, false); // false = don't press Enter, let user review
      }
    })
  );

  // ── Command: Clear history ──
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "workspaceHistory.clearHistory",
      async () => {
        const root = getActiveWorkspaceRoot();
        if (!root) {
          vscode.window.showWarningMessage("No workspace folder is open.");
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Clear all terminal history for ${path.basename(root)}?`,
          { modal: true },
          "Clear"
        );

        if (confirm === "Clear") {
          manager.clearHistory(root);
          manager.invalidateCache(root);
          updateStatusBar(root);
          vscode.window.showInformationMessage("Terminal history cleared.");
        }
      }
    )
  );

  // ── Command: Open history file ──
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "workspaceHistory.openHistoryFile",
      async () => {
        const root = getActiveWorkspaceRoot();
        if (!root) {
          vscode.window.showWarningMessage("No workspace folder is open.");
          return;
        }

        const filePath = manager.getHistoryFilePath_public(root);
        if (!fs.existsSync(filePath)) {
          vscode.window.showInformationMessage(
            "No history file exists yet. Run some terminal commands first."
          );
          return;
        }

        const doc = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(doc);
      }
    )
  );

  // ── Initial status bar update ──
  updateStatusBar(getActiveWorkspaceRoot());

  // ── Inject into any already-open terminals ──
  vscode.window.terminals.forEach(async (terminal) => {
    const root = getActiveWorkspaceRoot();
    if (root) {
      await injectHistoryIntoTerminal(terminal, root);
    }
  });
}

export function deactivate() {}
