# claude-permissions

Claude Code の権限設定とセキュリティフックを管理しています。

## インストール

### Windows

ワンライナーで直接インストール（リポジトリが public である必要があります）：

```powershell
irm https://github.com/Suzukitmhr/claude-permissions/raw/main/install.ps1 | iex
```

または、ローカルでクローンしてから実行：

```powershell
git clone https://github.com/Suzukitmhr/claude-permissions.git
cd claude-permissions
.\install.ps1
```

### Linux / macOS

ワンライナーで直接インストール（リポジトリが public である必要があります）：

```bash
curl -fsSL https://raw.githubusercontent.com/Suzukitmhr/claude-permissions/main/install.sh | bash
```

または、ローカルでクローンしてから実行：

```bash
git clone https://github.com/Suzukitmhr/claude-permissions.git
cd claude-permissions
./install.sh
```

## 機能

- **settings.json** — Claude Code の設定（モデル、環境変数、権限ルール）
- **hooks/** — ツール実行時のセキュリティチェック
  - `check-version.js` — 更新通知（SessionStart）
  - `block-sensitive-files.js` — 機密ファイルアクセスブロック（Read）
  - `block-sensitive-bash.js` — 機密ファイルに関連する Bash コマンドブロック（Bash）
