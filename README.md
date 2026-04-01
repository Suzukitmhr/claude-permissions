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
- **hooks/** — ツール実行時のセキュリティチェックと通知
  - `check-version.js` — 更新通知（SessionStart）
  - `block-sensitive-files.js` — 機密ファイルアクセスブロック（Read）
  - `block-sensitive-bash.js` — 機密ファイルに関連する Bash コマンドブロック（Bash）
  - `notify.js` — 確認待ち・実行完了の通知（Notification / Stop）

## 通知設定

`hooks/notify.js` は以下の優先順位で通知を送ります。

| 優先度 | 環境変数 | 通知方法 |
|--------|----------|---------|
| 1 | `CLAUDE_CODE_SLACK_BOT_TOKEN` | Slack Bot（Block Kit形式のリッチ通知） |
| 2 | `CLAUDE_CODE_SLACK_WEBHOOK_URL` | Slack Incoming Webhook（シンプルテキスト） |
| 3 | なし | Windows バルーン通知 |

### Slack Bot を使う場合

1. [Slack API](https://api.slack.com/apps) でアプリを作成し、`chat:write` / `im:write` / `channels:read` スコープを付与
2. Bot Token (`xoxb-...`) を取得
3. 環境変数を設定：

```powershell
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_BOT_TOKEN', 'xoxb-...', 'User')
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_DEFAULT_CHANNEL', '#your-channel', 'User')
```

DM で受け取る場合はチャンネルに `@U12345678`（Slack のユーザー ID）を指定します。

### Slack Webhook を使う場合

```powershell
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/...', 'User')
```

通知エラーは `~/.claude/notify_error.log` に記録されます。
