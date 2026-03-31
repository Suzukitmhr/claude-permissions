#!/usr/bin/env bash
# Claude Code permission settings checker
# Makes sure the install was done right

CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"  # "ok" or "fail"
  if [ "$result" = "ok" ]; then
    echo "  [OK]   $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== File check ==="

[ -f "$CLAUDE_DIR/settings.json" ]           && check "settings.json exists" "ok"           || check "settings.json exists" "fail"
[ -f "$HOOKS_DIR/block-sensitive-files.js" ]  && check "block-sensitive-files.js exists" "ok" || check "block-sensitive-files.js exists" "fail"
[ -f "$HOOKS_DIR/block-sensitive-bash.js" ]   && check "block-sensitive-bash.js exists" "ok"  || check "block-sensitive-bash.js exists" "fail"
[ -f "$HOOKS_DIR/check-version.js" ]          && check "check-version.js exists" "ok"        || check "check-version.js exists" "fail"
[ -f "$CLAUDE_DIR/.install-source" ]           && check ".install-source exists" "ok"         || check ".install-source exists" "fail"

# Show version info
INSTALLED_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CLAUDE_DIR/settings.json','utf8')).version || '')" 2>/dev/null)
if [ -n "$INSTALLED_VERSION" ]; then
  echo "  [INFO] Installed version: v$INSTALLED_VERSION"
fi

if [ -f "$CLAUDE_DIR/.install-source" ]; then
  INSTALL_SOURCE=$(cat "$CLAUDE_DIR/.install-source")
  echo "  [INFO] Remote URL: $INSTALL_SOURCE"
fi

echo ""
echo "=== settings.json check ==="

SETTINGS="$CLAUDE_DIR/settings.json"

grep -q '"CLAUDE_CODE_USE_BEDROCK"' "$SETTINGS" \
  && check "Bedrock mode is set" "ok" \
  || check "Bedrock mode is set" "fail"

grep -q '"PreToolUse"' "$SETTINGS" \
  && check "PreToolUse hooks are set" "ok" \
  || check "PreToolUse hooks are set" "fail"

grep -q '"Bash(sudo:\*)' "$SETTINGS" || grep -q 'Bash(sudo' "$SETTINGS" \
  && check "sudo is blocked" "ok" \
  || check "sudo is blocked" "fail"

grep -q '\.aws' "$SETTINGS" \
  && check "AWS credentials are blocked" "ok" \
  || check "AWS credentials are blocked" "fail"

grep -q '\.pem' "$SETTINGS" \
  && check "Private keys are blocked" "ok" \
  || check "Private keys are blocked" "fail"

grep -q 'docker-compose' "$SETTINGS" \
  && check "docker-compose is blocked" "ok" \
  || check "docker-compose is blocked" "fail"

echo ""
echo "=== Hook test ==="

# Check .env is blocked
ENV_INPUT='{"tool_input":{"path":"/home/user/project/.env"}}'
echo "$ENV_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check "Blocks Read of .env" "ok" \
  || check "Blocks Read of .env" "fail"

# Check AWS credentials is blocked
AWS_INPUT='{"tool_input":{"path":"/home/user/.aws/credentials"}}'
echo "$AWS_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check "Blocks Read of .aws/credentials" "ok" \
  || check "Blocks Read of .aws/credentials" "fail"

# Check .pem is blocked
PEM_INPUT='{"tool_input":{"path":"/home/user/certs/server.pem"}}'
echo "$PEM_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check "Blocks Read of .pem" "ok" \
  || check "Blocks Read of .pem" "fail"

# Check normal files are not blocked
NORMAL_INPUT='{"tool_input":{"path":"/home/user/project/main.js"}}'
echo "$NORMAL_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 0 ] \
  && check "Allows Read of normal files" "ok" \
  || check "Allows Read of normal files" "fail"

# Check Bash .env access is blocked
BASH_ENV_INPUT='{"tool_input":{"command":"cat .env"}}'
echo "$BASH_ENV_INPUT" | node "$HOOKS_DIR/block-sensitive-bash.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check "Blocks Bash access to .env" "ok" \
  || check "Blocks Bash access to .env" "fail"

# Check normal Bash commands are not blocked
BASH_NORMAL_INPUT='{"tool_input":{"command":"ls -la"}}'
echo "$BASH_NORMAL_INPUT" | node "$HOOKS_DIR/block-sensitive-bash.js" > /dev/null 2>&1
[ $? -eq 0 ] \
  && check "Allows normal Bash commands" "ok" \
  || check "Allows normal Bash commands" "fail"

echo ""
echo "=== Result ==="
echo "  Pass: $PASS  Fail: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "All checks passed!"
  exit 0
else
  echo "Some checks failed. Please run install.sh again." >&2
  exit 1
fi
