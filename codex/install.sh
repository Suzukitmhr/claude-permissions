#!/usr/bin/env bash
# Codex CLI settings installer
# Copies config.toml, AGENTS.md, hooks and rules to ~/.codex/

set -euo pipefail

REPO_URL="https://github.com/Suzukitmhr/claude-permission.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${TMPDIR:-/tmp}/codex-cli-config-install"

if [ -f "$SCRIPT_DIR/config.toml.template" ] && [ -f "$SCRIPT_DIR/manifest.json" ]; then
  SOURCE_DIR="$SCRIPT_DIR"
else
  if [ -d "$TEMP_DIR/.git" ]; then
    echo "[Update] Pulling repo: $TEMP_DIR"
    git -C "$TEMP_DIR" pull
  else
    echo "[Download] Cloning repo: $REPO_URL"
    rm -rf "$TEMP_DIR"
    git clone "$REPO_URL" "$TEMP_DIR"
  fi
  SOURCE_DIR="$TEMP_DIR/codex"
fi

CODEX_DIR="$HOME/.codex"
HOOKS_DIR="$CODEX_DIR/hooks"
RULES_DIR="$CODEX_DIR/rules"
BACKUP_DIR="$CODEX_DIR/backup_$(date +%Y%m%d_%H%M%S)"
INSTALL_SOURCE="$CODEX_DIR/.install-source"

mkdir -p "$CODEX_DIR"

backup_if_exists() {
  local src="$1"
  if [ -e "$src" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -r "$src" "$BACKUP_DIR/"
    echo "[Backup] $(basename "$src") -> $BACKUP_DIR"
    BACKUP_CREATED=true
  fi
}

BACKUP_CREATED=false
backup_if_exists "$CODEX_DIR/config.toml"
backup_if_exists "$CODEX_DIR/AGENTS.md"
backup_if_exists "$CODEX_DIR/hooks.json"
backup_if_exists "$HOOKS_DIR"
backup_if_exists "$RULES_DIR"
backup_if_exists "$CODEX_DIR/manifest.json"

if [ "$BACKUP_CREATED" = false ]; then
  echo "[Info] No old files found, backup not needed"
fi

mkdir -p "$HOOKS_DIR" "$RULES_DIR"

NOTIFY_SCRIPT="$CODEX_DIR/hooks/notify.js"
sed "s|__NOTIFY_SCRIPT__|$NOTIFY_SCRIPT|g" "$SOURCE_DIR/config.toml.template" > "$CODEX_DIR/config.toml"
echo "[Install] config.toml -> $CODEX_DIR"

cp "$SOURCE_DIR/AGENTS.md" "$CODEX_DIR/AGENTS.md"
echo "[Install] AGENTS.md -> $CODEX_DIR"

cp "$SOURCE_DIR/hooks.json" "$CODEX_DIR/hooks.json"
echo "[Install] hooks.json -> $CODEX_DIR"

cp -r "$SOURCE_DIR/hooks/." "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR"/*.js 2>/dev/null || true
echo "[Install] hooks/ -> $HOOKS_DIR"

cp -r "$SOURCE_DIR/rules/." "$RULES_DIR/"
echo "[Install] rules/ -> $RULES_DIR"

cp "$SOURCE_DIR/manifest.json" "$CODEX_DIR/manifest.json"
echo "[Install] manifest.json -> $CODEX_DIR"

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version || '')" "$SOURCE_DIR/manifest.json" 2>/dev/null || true)"
if [ -n "$VERSION" ]; then
  echo "[Version] v$VERSION"
fi

REMOTE_URL="$(git -C "$SOURCE_DIR" remote get-url origin 2>/dev/null || true)"
if [ -n "$REMOTE_URL" ]; then
  printf '%s' "$REMOTE_URL" > "$INSTALL_SOURCE"
  echo "[Saved] Remote URL -> $INSTALL_SOURCE"
else
  echo "[Skip] Could not get git remote URL"
fi

echo
echo "Done! Install is complete."
if [ "$BACKUP_CREATED" = true ]; then
  echo "Backup saved at: $BACKUP_DIR"
fi
