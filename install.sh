#!/usr/bin/env bash
# Claude Code 権限設定インストールスクリプト
# ユーザディレクトリの ~/.claude/ に settings.json と hooks を配置します

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
BACKUP_DIR="$CLAUDE_DIR/backup_$(date +%Y%m%d_%H%M%S)"

SOURCE_SETTINGS="$SCRIPT_DIR/settings.json"
SOURCE_HOOKS_DIR="$SCRIPT_DIR/hooks"

# ソースファイルの存在確認
if [ ! -f "$SOURCE_SETTINGS" ]; then
  echo "ERROR: settings.json が見つかりません: $SOURCE_SETTINGS" >&2
  exit 1
fi

# .claude ディレクトリがなければ作成
if [ ! -d "$CLAUDE_DIR" ]; then
  mkdir -p "$CLAUDE_DIR"
  echo "[作成] $CLAUDE_DIR"
fi

# バックアップ作成
BACKUP_CREATED=false

if [ -f "$CLAUDE_DIR/settings.json" ]; then
  mkdir -p "$BACKUP_DIR"
  cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings.json"
  echo "[バックアップ] settings.json -> $BACKUP_DIR"
  BACKUP_CREATED=true
fi

if [ -d "$HOOKS_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  cp -r "$HOOKS_DIR" "$BACKUP_DIR/hooks"
  echo "[バックアップ] hooks/ -> $BACKUP_DIR"
  BACKUP_CREATED=true
fi

if [ "$BACKUP_CREATED" = false ]; then
  echo "[情報] 既存ファイルがないためバックアップは不要です"
fi

# settings.json をコピー
cp "$SOURCE_SETTINGS" "$CLAUDE_DIR/settings.json"
echo "[インストール] settings.json -> $CLAUDE_DIR"

# hooks をコピー
if [ -d "$SOURCE_HOOKS_DIR" ]; then
  mkdir -p "$HOOKS_DIR"
  cp -r "$SOURCE_HOOKS_DIR"/. "$HOOKS_DIR/"
  chmod +x "$HOOKS_DIR"/*.js 2>/dev/null || true
  echo "[インストール] hooks/ -> $HOOKS_DIR"
else
  echo "[スキップ] hooks ディレクトリが見つかりません: $SOURCE_HOOKS_DIR"
fi

# バージョン情報を表示
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_SETTINGS','utf8')).version || '')" 2>/dev/null)
if [ -n "$VERSION" ]; then
  echo "[バージョン] v$VERSION"
fi

# リモートURLを保存
REMOTE_URL=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
if [ -n "$REMOTE_URL" ]; then
  printf '%s' "$REMOTE_URL" > "$CLAUDE_DIR/.install-source"
  echo "[設定] リモートURL -> $CLAUDE_DIR/.install-source"
else
  echo "[スキップ] git リモートURLの取得に失敗しました"
fi

echo ""
echo "インストールが完了しました。"
if [ "$BACKUP_CREATED" = true ]; then
  echo "バックアップ: $BACKUP_DIR"
fi
