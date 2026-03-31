#!/usr/bin/env bash
# Claude Code permission settings installer
# Copies settings.json and hooks to ~/.claude/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
BACKUP_DIR="$CLAUDE_DIR/backup_$(date +%Y%m%d_%H%M%S)"

SOURCE_SETTINGS="$SCRIPT_DIR/settings.json"
SOURCE_HOOKS_DIR="$SCRIPT_DIR/hooks"

# Check source files
if [ ! -f "$SOURCE_SETTINGS" ]; then
  echo "ERROR: settings.json not found: $SOURCE_SETTINGS" >&2
  exit 1
fi

# Create .claude folder if needed
if [ ! -d "$CLAUDE_DIR" ]; then
  mkdir -p "$CLAUDE_DIR"
  echo "[Created] $CLAUDE_DIR"
fi

# Backup old files
BACKUP_CREATED=false

if [ -f "$CLAUDE_DIR/settings.json" ]; then
  mkdir -p "$BACKUP_DIR"
  cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings.json"
  echo "[Backup] settings.json -> $BACKUP_DIR"
  BACKUP_CREATED=true
fi

if [ -d "$HOOKS_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  cp -r "$HOOKS_DIR" "$BACKUP_DIR/hooks"
  echo "[Backup] hooks/ -> $BACKUP_DIR"
  BACKUP_CREATED=true
fi

if [ "$BACKUP_CREATED" = false ]; then
  echo "[Info] No old files found, backup not needed"
fi

# Copy settings.json
cp "$SOURCE_SETTINGS" "$CLAUDE_DIR/settings.json"
echo "[Install] settings.json -> $CLAUDE_DIR"

# Copy hooks
if [ -d "$SOURCE_HOOKS_DIR" ]; then
  mkdir -p "$HOOKS_DIR"
  cp -r "$SOURCE_HOOKS_DIR"/. "$HOOKS_DIR/"
  chmod +x "$HOOKS_DIR"/*.js 2>/dev/null || true
  echo "[Install] hooks/ -> $HOOKS_DIR"
else
  echo "[Skip] hooks folder not found: $SOURCE_HOOKS_DIR"
fi

# Show version
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SOURCE_SETTINGS','utf8')).version || '')" 2>/dev/null)
if [ -n "$VERSION" ]; then
  echo "[Version] v$VERSION"
fi

# Save remote URL
REMOTE_URL=$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null)
if [ -n "$REMOTE_URL" ]; then
  printf '%s' "$REMOTE_URL" > "$CLAUDE_DIR/.install-source"
  echo "[Saved] Remote URL -> $CLAUDE_DIR/.install-source"
else
  echo "[Skip] Could not get git remote URL"
fi

echo ""
echo "Done! Install is complete."
if [ "$BACKUP_CREATED" = true ]; then
  echo "Backup saved at: $BACKUP_DIR"
fi
