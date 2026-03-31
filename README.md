# claude-permissions

Claude Code の権限設定とセキュリティフックを管理しています。

## インストール

### Windows

```powershell
irm https://github.com/Suzukitmhr/claude-permissions/raw/main/install.ps1 | iex
```

または、ローカルでクローンしてから実行：

```powershell
.\install.ps1
```

### Linux / macOS

```bash
curl -fsSL https://github.com/Suzukitmhr/claude-permissions/raw/main/install.sh | bash
```

または、ローカルでクローンしてから実行：

```bash
./install.sh
```

## 機能

- **settings.json** — Claude Code の設定（モデル、環境変数、権限ルール）
- **hooks/** — ツール実行時のセキュリティチェック
  - `check-version.js` — 更新通知（SessionStart）
  - `block-sensitive-files.js` — 機密ファイルアクセスブロック（Read）
  - `block-sensitive-bash.js` — 機密ファイルに関連する Bash コマンドブロック（Bash）
