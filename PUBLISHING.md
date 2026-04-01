# Publishing to the VS Code Marketplace

Follow these steps to publish **Workspace Terminal History** under your own publisher account.

---

## 1 · Create a publisher account

1. Go to [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Sign in with a Microsoft account (or create one — it's free)
3. Click **Create Publisher**
4. Choose a publisher ID (e.g. `johndoe` — this is permanent and appears in the extension ID)

---

## 2 · Update `package.json`

Open `package.json` and replace both placeholder values:

```json
"publisher": "YOUR-PUBLISHER-ID",
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR-USERNAME/workspace-terminal-history"
},
"bugs": {
  "url": "https://github.com/YOUR-USERNAME/workspace-terminal-history/issues"
},
"homepage": "https://github.com/YOUR-USERNAME/workspace-terminal-history#readme"
```

The extension's unique Marketplace ID will be `YOUR-PUBLISHER-ID.workspace-terminal-history`.

---

## 3 · Create a Personal Access Token (PAT)

1. Go to [https://dev.azure.com](https://dev.azure.com) → your organisation → **User Settings → Personal Access Tokens**
2. Click **New Token**
   - Name: `vsce-publish` (or anything)
   - Organization: **All accessible organizations**
   - Expiration: your choice (1 year recommended)
   - Scopes → **Custom defined** → tick **Marketplace → Manage**
3. Copy the token — you won't see it again

---

## 4 · Install `vsce`

```bash
npm install -g @vscode/vsce
```

---

## 5 · (Optional) Push to GitHub first

A public repository is not required but strongly recommended — it builds trust and lets users file issues.

```bash
git init
git add .
git commit -m "chore: initial release v1.0.0"
git remote add origin https://github.com/YOUR-USERNAME/workspace-terminal-history.git
git push -u origin main
```

---

## 6 · Log in and publish

```bash
# Log in once with your PAT
vsce login YOUR-PUBLISHER-ID

# Compile & package, then publish in one step
npm run compile
vsce publish
```

Or publish a specific version bump:

```bash
vsce publish patch   # 1.0.0 → 1.0.1
vsce publish minor   # 1.0.0 → 1.1.0
vsce publish major   # 1.0.0 → 2.0.0
```

The command will:
1. Run `npm run vscode:prepublish` (compiles TypeScript)
2. Bundle everything listed in `.vscodeignore` exclusions
3. Upload to the Marketplace

Your extension will be live within a few minutes at:
`https://marketplace.visualstudio.com/items?itemName=YOUR-PUBLISHER-ID.workspace-terminal-history`

---

## 7 · Verify

- Visit the Marketplace URL above
- In VS Code: `Ctrl+Shift+X` → search `Workspace Terminal History`

---

## Future updates

1. Edit the code
2. Bump `"version"` in `package.json` and add an entry to `CHANGELOG.md`
3. Run `vsce publish` again

---

## Building a `.vsix` without publishing

```bash
vsce package
# → workspace-terminal-history-1.0.0.vsix
```

Share the `.vsix` file directly. Recipients install it via:
**Extensions panel → `⋯` → Install from VSIX…**
