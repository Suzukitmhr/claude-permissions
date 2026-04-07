# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 目的

このリポジトリは、Claude Codeの権限設定とセキュリティフックを管理しています。`install.ps1` / `install.sh` を使って他のプロジェクトにインストールし、設定とフックを対象プロジェクトの `.claude/` ディレクトリにコピーします。

## アーキテクチャ

- **settings.json** — Claude Codeの設定ファイル:
  - 環境変数（Bedrockモード、AWSリージョン `ap-northeast-1`）
  - `Read` と `Bash` ツール呼び出しに対するPreToolUseフック
  - 権限のallow/denyルール（機密ファイルアクセス、破壊的なgitコマンド、外部ネットワークツールをブロック）
  - モデルデフォルト設定（opus、常時思考モード有効）
- **hooks/** — ツール実行前に動作するNode.jsフックスクリプト:
  - `block-sensitive-files.js` — `.env`、`appsettings.{Staging|Production|Development}.json`、SSH鍵（`id_rsa`、`id_ed25519`）への `Read` アクセスをブロック。stdinからJSON形式でツール入力を読み取り、終了コード2でブロックを通知。
  - `block-sensitive-bash.js` — 機密ファイルを参照する `Bash` コマンドをブロック（同じパターン）。同じstdin JSON / 終了コード2の規約。
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

`permissions.deny` 配列に対応する glob エントリを追加する（通常4行）:

```json
"Read(ファイル名)",
"Read(**/ファイル名)",
"Write(ファイル名)",
"Write(**/ファイル名)"
```

### アーキテクチャ上の注意

フック（patterns.js）と settings.json の deny ルールは**独立した多層防衛**として機能している。
どちらか一方だけを更新した場合でも片方のレイヤーは有効だが、パターンの一貫性のために両方を更新すること。
block-sensitive-files.js と block-sensitive-bash.js は patterns.js を require するだけで、直接パターンを定義しない。
