# Changelog

All notable changes to **Workspace Terminal History** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] – 2026-04-01

### Added
- Per-workspace terminal history saved to `.terminal_history.json` in the workspace root
- Arrow-key recall via silent history injection on terminal open (bash, zsh, fish, PowerShell)
- Automatic command capture using the VS Code Shell Integration API (VS Code 1.93+)
- Quick-pick command browser (`Workspace History: Show Command History`)
- Status bar item showing saved command count for the active workspace
- `Workspace History: Clear History for This Workspace` command
- `Workspace History: Open History File` command to inspect the raw JSON
- Configurable max command count, exclude patterns, file name, and storage location
- Option to save history inside `.vscode/` folder instead of workspace root
- Consecutive-duplicate deduplication
- Multi-root workspace support (history scoped to the workspace folder of the active file)
