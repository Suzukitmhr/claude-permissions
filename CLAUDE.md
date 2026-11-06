# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 目的

このリポジトリは、Claude Codeの権限設定とセキュリティフックを管理しています。`install.ps1` / `install.sh` を使って他のプロジェクトにインストールし、設定とフックを対象プロジェクトの `.claude/` ディレクトリにコピーします。

## 進め方（GitHub Issue 駆動）

タスクは GitHub Issue を起点に進める。`gh` CLI を使う。

1. **着手前**: 対応する Issue があるか確認する（`gh issue list` / `gh issue view <番号>`）。無ければ、目的と完了条件を書いた Issue の作成をユーザに提案し、承認を得てから `gh issue create` で作る。
2. **ブランチ**: Issue 番号を含める（例: `feat/12-team-provider`、`fix/15-notify-error`）。
3. **作業中**: Issue の範囲だけを実装する。範囲外の気づきは実装せず、別 Issue として提案する。方針の変更や重要な判断は Issue にコメントで残す（`gh issue comment`）。
4. **コミット／PR**: メッセージや PR 本文に `Closes #<番号>` を入れ、マージ時に Issue が閉じるようにする。PR は `gh pr create` で作る。
5. **push**: `git push` は `settings.json` の `ask` に入っており、Claude が実行する（毎回ユーザの承認ダイアログで確認）。force push（`--force` / `-f` / `--force-with-lease`）は `deny`。

## アーキテクチャ

- **settings.json** — Claude Codeの設定ファイル:
  - `Read` と `Bash` ツール呼び出しに対するPreToolUseフック
  - 権限のallow/denyルール（機密ファイルアクセス、破壊的なgitコマンド、外部ネットワークツールをブロック）
  - `allow` は **standard** プロファイル相当（`Read`/`Edit`/`Write` ＋ 読み取り系Bash）。`deny` の安全網はここに一元管理する
  - `ask`（毎回確認）に `git push` を置く。force push は `deny`。main への直 push は GitHub のブランチ保護で防ぐ（権限ルールは前方一致のため最終防衛にしない）
  - モデルデフォルト設定（sonnet、常時思考モード無効）
  - Claude が自分の制限を緩められないよう、`~/.claude/settings.json` と `~/.claude/hooks/**` の `Edit` を deny する
- **profiles/full.json** — standardに上乗せする `permissions.allow` 差分のみを持つ（ローカルgit操作・開発ツール）。`deny` は持たない
- **apply-profile.js** — インストール時に呼ばれ、選択プロファイルの `allow` をインストール済み `~/.claude/settings.json` にマージする。standardは追記なし、fullは `profiles/full.json` の `allow` を重複除去してマージ。`deny` は一切変更しない。プロファイル決定は 引数 → `CLAUDE_PERMISSIONS_PROFILE` → 既定 `standard` の順
- **providers/bedrock.json・team.json** — 接続先ごとの差分（`claude --settings <file>` で上乗せできる形）。`bedrock.json` が Bedrock の `env`（モード・リージョン・モデルID）を一元管理する。`team.json` は Bedrock の `env` を打ち消す値（`CLAUDE_CODE_USE_BEDROCK=0`、モデル系は空文字）。どちらも `statusLine` を持つ。settings.json の `env` は持たない。`bedrock.json` の env にキーを追加したら `team.json` の打ち消しも追加すること。`~/.claude/providers/` に配布され、各自が `claude --settings ~/.claude/providers/<名前>.json` で一時的に切り替える（切替スクリプトは持たない）
- **apply-provider.js** — インストール時に呼ばれ、選択した接続先の `providers/<名前>.json` をインストール済み `~/.claude/settings.json` にマージする。bedrock は `env` と `statusLine`、team は `statusLine` のみ（`env` は反映しない）。決定は 引数 → `CLAUDE_PERMISSIONS_PROVIDER` → 既定 `bedrock` の順
- **hooks/** — ツール実行前に動作するNode.jsフックスクリプト:
  - `block-sensitive-files.js` — `.env`、`appsettings.{Staging|Production|Development}.json`、SSH鍵（`id_rsa`、`id_ed25519`）への `Read` アクセスをブロック。stdinからJSON形式でツール入力を読み取り、終了コード2でブロックを通知。
  - `block-sensitive-bash.js` — 機密ファイルを参照する `Bash` コマンドをブロック（同じパターン）。同じstdin JSON / 終了コード2の規約。
  - `statusline.js` — 引数が `team` のときだけ `Team` と表示し、`bedrock` のときは何も表示しない。`providers/*.json` の `statusLine` から呼ばれる。
  - `notify.js` — 確認待ち（`Notification`）・実行完了（`Stop`）をデスクトップ通知またはSlackで通知。優先順位: `CLAUDE_CODE_SLACK_BOT_TOKEN`（Bot API）→ `CLAUDE_CODE_SLACK_WEBHOOK_URL`（Webhook）→ Windowsバルーン。終了コードは常に0。

## フックの規約

フックはstdinからJSON形式でツール入力を受け取ります。終了コード 0 = 許可、終了コード 2 = ブロック（Claudeに通知）。エラーメッセージはstderrに出力します。

## ブロック対象ファイルの追加

ユーザから読み込み対象外にしたいファイルパターンを指示された場合、以下の**2箇所**を更新すること:

### 1. hooks/patterns.js（主要定義）

`SENSITIVE_FILE_RULES` 配列に1エントリを追加する:

```js
{ label: 'ファイル名パターン',
  filePattern: /対応する正規表現$/,      // ファイルパス末尾一致
  bashPattern: /対応する正規表現(\s|$)/ }, // Bashコマンド部分一致
```

- `filePattern` はパス末尾を `$` でアンカーする
- `bashPattern` はコマンド文字列中の出現をマッチするため `$` を省略するか `(\s|$)` を付ける

### 2. settings.json（二次防衛層）

`permissions.deny` 配列に対応する glob エントリを追加する。
`allow` で `Edit(**)` を広く許可しているため、`Read` だけでなく `Edit` の deny も必ず追加すること（通常4行）。
`Edit` の deny はファイルを書き換える組み込みツール全般（`Write` を含む）に効くため、`Write(...)` の deny は書かない:

```json
"Read(ファイル名)",
"Read(**/ファイル名)",
"Edit(ファイル名)",
"Edit(**/ファイル名)"
```

> フックは `Read` と `Bash` にしか掛からない（`Edit`/`Write` 用のフックは無い）。
> そのため書き込み系の防衛は settings.json の `deny` が唯一の層であり、`Edit` deny の追加は必須。

### アーキテクチャ上の注意

フック（patterns.js）と settings.json の deny ルールは**独立した多層防衛**として機能している。
どちらか一方だけを更新した場合でも片方のレイヤーは有効だが、パターンの一貫性のために両方を更新すること。
block-sensitive-files.js と block-sensitive-bash.js は patterns.js を require するだけで、直接パターンを定義しない。
