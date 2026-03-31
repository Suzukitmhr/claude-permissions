#!/usr/bin/env bash
# Claude Code 権限設定 検証スクリプト
# インストールが正しく適用されているかを確認します

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

echo "=== ファイル存在チェック ==="

[ -f "$CLAUDE_DIR/settings.json" ]       && check "settings.json が存在する" "ok" || check "settings.json が存在する" "fail"
[ -f "$HOOKS_DIR/block-sensitive-files.js" ] && check "block-sensitive-files.js が存在する" "ok" || check "block-sensitive-files.js が存在する" "fail"
[ -f "$HOOKS_DIR/block-sensitive-bash.js" ]  && check "block-sensitive-bash.js が存在する" "ok" || check "block-sensitive-bash.js が存在する" "fail"

echo ""
echo "=== settings.json 内容チェック ==="

SETTINGS="$CLAUDE_DIR/settings.json"

grep -q '"CLAUDE_CODE_USE_BEDROCK"' "$SETTINGS" \
  && check "Bedrockモードが設定されている" "ok" \
  || check "Bedrockモードが設定されている" "fail"

grep -q '"PreToolUse"' "$SETTINGS" \
  && check "PreToolUseフックが設定されている" "ok" \
  || check "PreToolUseフックが設定されている" "fail"

grep -q '"Bash(sudo:\*)' "$SETTINGS" || grep -q 'Bash(sudo' "$SETTINGS" \
  && check "sudo ブロックが設定されている" "ok" \
  || check "sudo ブロックが設定されている" "fail"

grep -q '\.aws' "$SETTINGS" \
  && check "AWS認証情報ブロックが設定されている" "ok" \
  || check "AWS認証情報ブロックが設定されている" "fail"

grep -q '\.pem' "$SETTINGS" \
  && check "秘密鍵ブロックが設定されている" "ok" \
  || check "秘密鍵ブロックが設定されている" "fail"

grep -q 'docker-compose' "$SETTINGS" \
  && check "docker-compose ブロックが設定されている" "ok" \
  || check "docker-compose ブロックが設定されている" "fail"

echo ""
echo "=== フック動作テスト ==="

# .env をブロックするか確認
ENV_INPUT='{"tool_input":{"path":"/home/user/project/.env"}}'
echo "$ENV_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check ".env の Read をブロックする" "ok" \
  || check ".env の Read をブロックする" "fail"

# AWS credentials をブロックするか確認
AWS_INPUT='{"tool_input":{"path":"/home/user/.aws/credentials"}}'
echo "$AWS_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check ".aws/credentials の Read をブロックする" "ok" \
  || check ".aws/credentials の Read をブロックする" "fail"

# .pem をブロックするか確認
PEM_INPUT='{"tool_input":{"path":"/home/user/certs/server.pem"}}'
echo "$PEM_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check ".pem の Read をブロックする" "ok" \
  || check ".pem の Read をブロックする" "fail"

# 通常ファイルはブロックしないか確認
NORMAL_INPUT='{"tool_input":{"path":"/home/user/project/main.js"}}'
echo "$NORMAL_INPUT" | node "$HOOKS_DIR/block-sensitive-files.js" > /dev/null 2>&1
[ $? -eq 0 ] \
  && check "通常ファイルはブロックしない" "ok" \
  || check "通常ファイルはブロックしない" "fail"

# Bash フック: .env を含むコマンドをブロックするか確認
BASH_ENV_INPUT='{"tool_input":{"command":"cat .env"}}'
echo "$BASH_ENV_INPUT" | node "$HOOKS_DIR/block-sensitive-bash.js" > /dev/null 2>&1
[ $? -eq 2 ] \
  && check "Bash での .env アクセスをブロックする" "ok" \
  || check "Bash での .env アクセスをブロックする" "fail"

# Bash フック: 通常コマンドはブロックしないか確認
BASH_NORMAL_INPUT='{"tool_input":{"command":"ls -la"}}'
echo "$BASH_NORMAL_INPUT" | node "$HOOKS_DIR/block-sensitive-bash.js" > /dev/null 2>&1
[ $? -eq 0 ] \
  && check "Bash 通常コマンドはブロックしない" "ok" \
  || check "Bash 通常コマンドはブロックしない" "fail"

echo ""
echo "=== 結果 ==="
echo "  合格: $PASS  失敗: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "すべてのチェックが合格しました。"
  exit 0
else
  echo "失敗したチェックがあります。install.sh を再実行してください。" >&2
  exit 1
fi
