# claude-permissions

Claude Code と Codex CLI の設定ファイル群を管理しています。

## インストール

### Claude Code

#### Windows

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

#### Linux / macOS

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

### Codex CLI

#### Windows

ワンライナーで直接インストール：

```powershell
irm https://github.com/Suzukitmhr/claude-permissions/raw/main/codex/install.ps1 | iex
```

または、ローカルでクローンしてから実行：

```powershell
git clone https://github.com/Suzukitmhr/claude-permissions.git
cd claude-permissions\codex
.\install.ps1
```

#### Linux / macOS

ワンライナーで直接インストール：

```bash
curl -fsSL https://raw.githubusercontent.com/Suzukitmhr/claude-permissions/main/codex/install.sh | bash
```

または、ローカルでクローンしてから実行：

```bash
git clone https://github.com/Suzukitmhr/claude-permissions.git
cd claude-permissions/codex
./install.sh
```

## 機能

- `settings.json` — Claude Code の設定（モデル、環境変数、権限ルール）。`allow` は **standard** プロファイル相当
- `profiles/full.json` — standard に上乗せする allow 差分（ローカル git 操作・開発ツール）
- `apply-profile.js` — インストール時に選択プロファイルの allow を `settings.json` にマージ
- `hooks/` — Claude Code のセキュリティチェックと通知
- `codex/config.toml.template` — Codex CLI の既定設定テンプレート
- `codex/AGENTS.md` — Codex CLI のグローバル既定ガイド
- `codex/hooks.json` — Codex CLI の Bash 用 `PreToolUse` フック定義
- `codex/hooks/` — Codex CLI の Bash セキュリティフックと通知スクリプト
- `codex/rules/default.rules` — Codex CLI の sandbox 外コマンド抑止ルール
- `codex/install.*` / `codex/verify.*` — Codex CLI 用のインストール・検証スクリプト

## 権限プロファイル

Claude Code のインストール時に、自動許可（`allow`）の範囲を 2 つのプロファイルから選べます。
どちらを選んでも、`deny` 側の安全網（機密ファイル・破壊的コマンド・外部ネットワークツールのブロック）は変わりません。

| プロファイル | 自動許可される内容 |
|--------------|--------------------|
| **standard**（既定） | `Read` / `Edit` / `Write`（機密ファイルは deny で除外）＋ 読み取り系 Bash（`git status`/`diff`/`log`/`show`/`branch`、`ls`/`cat`/`grep`/`find`/`head`/`tail` など状態を変えないコマンド） |
| **full** | standard ＋ ローカル git 操作（`add`/`commit`/`checkout`/`switch`/`stash`/`fetch`/`pull`/`merge`/`tag` など）＋ 開発ツール（`node`/`npm`/`npx`/`yarn`/`pnpm`/`dotnet`/`python`/`go`/`cargo`/`make` など） |

`git push` / `git reset` / `git rebase` / `sudo` / `rm -rf` / `curl` / `wget` は full でも `deny` のままブロックされます。

### プロファイルの選択方法

インストーラはこの優先順位でプロファイルを決定します。

1. 環境変数 `CLAUDE_PERMISSIONS_PROFILE`（`standard` または `full`）
2. 対話プロンプト（端末が対話可能な場合に表示）
3. 既定値 `standard`（ワンライナーなど非対話時）

環境変数で明示する例：

```powershell
$env:CLAUDE_PERMISSIONS_PROFILE = 'full'; irm https://github.com/Suzukitmhr/claude-permissions/raw/main/install.ps1 | iex
```

```bash
CLAUDE_PERMISSIONS_PROFILE=full bash -c "$(curl -fsSL https://raw.githubusercontent.com/Suzukitmhr/claude-permissions/main/install.sh)"
```

インストール後にプロファイルを切り替えるには、`apply-profile.js` を直接実行します（クローン済みディレクトリ内で）。

```bash
node apply-profile.js full      # full の allow を ~/.claude/settings.json にマージ
```

> standard へ戻す場合は `install` を再実行して `settings.json` を上書きしてください（`apply-profile.js standard` は何も追加しません）。

## Codex CLI の方針

- 既定値は `workspace-write + approval_policy=untrusted + web_search=disabled`
- `CLAUDE.md` を Codex 側でも読むため、`project_doc_fallback_filenames = ["CLAUDE.md"]` を設定
- Bash コマンドは `.env`、AWS 認証情報、秘密鍵、証明書、`git push`、`git reset`、`git rebase`、`sudo`、`curl`、`wget`、`rm -rf` をフックでブロック
- sandbox 外コマンドは `rules/default.rules` でも抑止

## Codex CLI の制約

- Codex の hooks は現状 Windows では無効
- Codex の Bash フックでは、Claude Code のように `Read` / `Write` を同じ粒度では遮断できない
- そのため Codex 版は `config.toml`、`AGENTS.md`、rules、Bash hook の組み合わせで安全側に寄せています

## 検証

Claude Code:

```powershell
.\verify.ps1
```

```bash
./verify.sh
```

Codex CLI:

```powershell
.\codex\verify.ps1
```

```bash
./codex/verify.sh
```

## 通知設定

Claude Code の `hooks/notify.js` は以下の優先順位で通知を送ります。

| 優先度 | 環境変数 | 通知方法 |
|--------|----------|---------|
| 1 | `CLAUDE_CODE_SLACK_BOT_TOKEN` | Slack Bot（Block Kit形式のリッチ通知） |
| 2 | `CLAUDE_CODE_SLACK_WEBHOOK_URL` | Slack Incoming Webhook（シンプルテキスト） |
| 3 | なし | Windows バルーン通知 |

Codex CLI の `codex/hooks/notify.js` は `CODEX_SLACK_BOT_TOKEN` / `CODEX_SLACK_DEFAULT_CHANNEL` / `CODEX_SLACK_WEBHOOK_URL` を優先し、未設定時は `CLAUDE_CODE_*` を fallback 参照します。

### Slack Bot を使う場合

1. [Slack API](https://api.slack.com/apps) でアプリを作成し、`chat:write` / `im:write` / `channels:read` スコープを付与
2. Bot Token (`xoxb-...`) を取得
3. 環境変数を設定：

```powershell
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_BOT_TOKEN', 'xoxb-...', 'User')
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_DEFAULT_CHANNEL', '#your-channel', 'User')
[System.Environment]::SetEnvironmentVariable('CODEX_SLACK_BOT_TOKEN', 'xoxb-...', 'User')
[System.Environment]::SetEnvironmentVariable('CODEX_SLACK_DEFAULT_CHANNEL', '#your-channel', 'User')
```

DM で受け取る場合はチャンネルに `@U12345678`（Slack のユーザー ID）を指定します。

### Slack Webhook を使う場合

```powershell
[System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/...', 'User')
[System.Environment]::SetEnvironmentVariable('CODEX_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/...', 'User')
```

通知エラーは Claude Code 側は `~/.claude/notify_error.log`、Codex CLI 側は `~/.codex/notify_error.log` に記録されます。
