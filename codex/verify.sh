#!/usr/bin/env bash
# Codex CLI settings checker
# Makes sure the install was done right

set -euo pipefail

CODEX_DIR="$HOME/.codex"
HOOKS_DIR="$CODEX_DIR/hooks"
RULES_DIR="$CODEX_DIR/rules"
PASS=0
FAIL=0
SKIP=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    echo "  [OK]   $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

skip_check() {
  echo "  [SKIP] $1"
  SKIP=$((SKIP + 1))
}

run_hook() {
  local payload="$1"
  set +e
  printf '%s' "$payload" | node "$HOOKS_DIR/block-sensitive-bash.js" >/dev/null 2>&1
  local exit_code=$?
  set -e
  return "$exit_code"
}

echo "=== File check ==="

[ -f "$CODEX_DIR/config.toml" ] && check "config.toml exists" "ok" || check "config.toml exists" "fail"
[ -f "$CODEX_DIR/AGENTS.md" ] && check "AGENTS.md exists" "ok" || check "AGENTS.md exists" "fail"
[ -f "$CODEX_DIR/hooks.json" ] && check "hooks.json exists" "ok" || check "hooks.json exists" "fail"
[ -f "$HOOKS_DIR/block-sensitive-bash.js" ] && check "block-sensitive-bash.js exists" "ok" || check "block-sensitive-bash.js exists" "fail"
[ -f "$RULES_DIR/default.rules" ] && check "default.rules exists" "ok" || check "default.rules exists" "fail"
[ -f "$CODEX_DIR/manifest.json" ] && check "manifest.json exists" "ok" || check "manifest.json exists" "fail"
[ -f "$CODEX_DIR/.install-source" ] && check ".install-source exists" "ok" || check ".install-source exists" "fail"

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version || '')" "$CODEX_DIR/manifest.json" 2>/dev/null || true)"
if [ -n "$VERSION" ]; then
  echo "  [INFO] Installed version: v$VERSION"
fi

if [ -f "$CODEX_DIR/.install-source" ]; then
  echo "  [INFO] Remote URL: $(cat "$CODEX_DIR/.install-source")"
fi

echo
echo "=== config.toml check ==="

CONFIG="$CODEX_DIR/config.toml"
grep -q 'model = "gpt-5.4"' "$CONFIG" && check "gpt-5.4 is set" "ok" || check "gpt-5.4 is set" "fail"
grep -q 'approval_policy = "untrusted"' "$CONFIG" && check "approval_policy is untrusted" "ok" || check "approval_policy is untrusted" "fail"
grep -q 'sandbox_mode = "workspace-write"' "$CONFIG" && check "workspace-write is set" "ok" || check "workspace-write is set" "fail"
grep -q 'web_search = "disabled"' "$CONFIG" && check "web_search is disabled" "ok" || check "web_search is disabled" "fail"
grep -q 'project_doc_fallback_filenames = \["CLAUDE.md"\]' "$CONFIG" && check "CLAUDE.md fallback is set" "ok" || check "CLAUDE.md fallback is set" "fail"
grep -q 'notify = \["node", ".*/notify.js"\]' "$CONFIG" && check "notify command is set" "ok" || check "notify command is set" "fail"
grep -q 'codex_hooks = true' "$CONFIG" && check "codex_hooks feature is enabled" "ok" || check "codex_hooks feature is enabled" "fail"
grep -q 'sandbox = "unelevated"' "$CONFIG" && check "Windows sandbox is set" "ok" || check "Windows sandbox is set" "fail"

echo
echo "=== Hook test ==="

if ! command -v node >/dev/null 2>&1; then
  skip_check "Hook runtime test skipped because node is unavailable"
elif uname -s | grep -Eq 'MINGW|MSYS|CYGWIN'; then
  skip_check "Codex hooks runtime is skipped on Windows"
else
  run_hook '{"tool_input":{"command":"cat .env"}}'
  [ $? -eq 2 ] && check "Blocks Bash access to .env" "ok" || check "Blocks Bash access to .env" "fail"

  run_hook '{"tool_input":{"command":"cat ~/.aws/credentials"}}'
  [ $? -eq 2 ] && check "Blocks Bash access to .aws/credentials" "ok" || check "Blocks Bash access to .aws/credentials" "fail"

  run_hook '{"tool_input":{"command":"git push origin main"}}'
  [ $? -eq 2 ] && check "Blocks git push" "ok" || check "Blocks git push" "fail"

  run_hook '{"tool_input":{"command":"ls -la"}}'
  [ $? -eq 0 ] && check "Allows normal Bash commands" "ok" || check "Allows normal Bash commands" "fail"
fi

echo
echo "=== Rules test ==="

if command -v codex >/dev/null 2>&1; then
  RULE_OUTPUT="$(codex execpolicy check --rules "$RULES_DIR/default.rules" -- git push origin main 2>/dev/null || true)"
  printf '%s' "$RULE_OUTPUT" | grep -q 'forbidden' && check "Rules forbid git push" "ok" || check "Rules forbid git push" "fail"
else
  skip_check "Rules test skipped because codex is unavailable"
fi

echo
echo "=== Result ==="
echo "  Pass: $PASS  Fail: $FAIL  Skip: $SKIP"
echo

if [ "$FAIL" -eq 0 ]; then
  echo "All checks passed!"
  exit 0
else
  echo "Some checks failed. Please run codex/install.sh again." >&2
  exit 1
fi
