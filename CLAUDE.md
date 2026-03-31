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

## フックの規約

フックはstdinからJSON形式でツール入力を受け取ります。終了コード 0 = 許可、終了コード 2 = ブロック（Claudeに通知）。エラーメッセージはstderrに出力します。

## ブロック対象ファイルの追加

ユーザから読み込み対象外にしたいファイルパターンを指示された場合、以下の3ファイルすべてを更新すること:

1. **settings.json** — `permissions.deny` 配列に `Read(パターン)` を追加
2. **hooks/block-sensitive-files.js** — `blockedPatterns` 配列に対応する正規表現を追加
3. **hooks/block-sensitive-bash.js** — `blockedPatterns` 配列に対応する正規表現を追加

3ファイルのブロックパターンは常に同期を保つこと。
