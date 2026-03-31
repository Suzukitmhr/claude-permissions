# Claude Code 権限設定 検証スクリプト
# インストールが正しく適用されているかを確認します

$ErrorActionPreference = "Stop"

$claudeDir = Join-Path $HOME ".claude"
$hooksDir = Join-Path $claudeDir "hooks"
$settingsPath = Join-Path $claudeDir "settings.json"
$pass = 0
$fail = 0

function Check($label, $result) {
  if ($result) {
    Write-Host "  [OK]   $label" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  [FAIL] $label" -ForegroundColor Red
    $script:fail++
  }
}

function TestHook($hookScript, $inputJson) {
  $output = $inputJson | node $hookScript 2>$null
  return $LASTEXITCODE
}

Write-Host "=== ファイル存在チェック ==="

Check "settings.json が存在する"           (Test-Path $settingsPath)
Check "block-sensitive-files.js が存在する" (Test-Path (Join-Path $hooksDir "block-sensitive-files.js"))
Check "block-sensitive-bash.js が存在する"  (Test-Path (Join-Path $hooksDir "block-sensitive-bash.js"))
Check "check-version.js が存在する"        (Test-Path (Join-Path $hooksDir "check-version.js"))
Check ".install-source が存在する"         (Test-Path (Join-Path $claudeDir ".install-source"))

# バージョン情報を表示
try {
  $settingsObj = Get-Content $settingsPath -Raw | ConvertFrom-Json
  $installedVersion = $settingsObj.version
  if ($installedVersion) {
    Write-Host "  [INFO] インストール済みバージョン: v$installedVersion"
  }
} catch {}

try {
  $installSource = Get-Content (Join-Path $claudeDir ".install-source") -Raw
  if ($installSource) {
    Write-Host "  [INFO] リモートURL: $installSource"
  }
} catch {}

Write-Host ""
Write-Host "=== settings.json 内容チェック ==="

$settings = Get-Content $settingsPath -Raw
Check "Bedrockモードが設定されている"           ($settings -match "CLAUDE_CODE_USE_BEDROCK")
Check "PreToolUseフックが設定されている"         ($settings -match "PreToolUse")
Check "sudo ブロックが設定されている"            ($settings -match "Bash\(sudo")
Check "AWS認証情報ブロックが設定されている"       ($settings -match "\.aws")
Check "秘密鍵ブロックが設定されている"           ($settings -match "\.pem")
Check "docker-compose ブロックが設定されている"  ($settings -match "docker-compose")

Write-Host ""
Write-Host "=== フック動作テスト ==="

$filesHook = Join-Path $hooksDir "block-sensitive-files.js"
$bashHook  = Join-Path $hooksDir "block-sensitive-bash.js"

# .env をブロックするか確認
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/project/.env"}}'
Check ".env の Read をブロックする" ($exitCode -eq 2)

# AWS credentials をブロックするか確認
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/.aws/credentials"}}'
Check ".aws/credentials の Read をブロックする" ($exitCode -eq 2)

# .pem をブロックするか確認
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/certs/server.pem"}}'
Check ".pem の Read をブロックする" ($exitCode -eq 2)

# 通常ファイルはブロックしないか確認
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/project/main.js"}}'
Check "通常ファイルはブロックしない" ($exitCode -eq 0)

# Bash フック: .env を含むコマンドをブロックするか確認
$exitCode = TestHook $bashHook '{"tool_input":{"command":"cat .env"}}'
Check "Bash での .env アクセスをブロックする" ($exitCode -eq 2)

# Bash フック: 通常コマンドはブロックしないか確認
$exitCode = TestHook $bashHook '{"tool_input":{"command":"ls -la"}}'
Check "Bash 通常コマンドはブロックしない" ($exitCode -eq 0)

Write-Host ""
Write-Host "=== 結果 ==="
Write-Host "  合格: $pass  失敗: $fail"
Write-Host ""

if ($fail -eq 0) {
  Write-Host "すべてのチェックが合格しました。" -ForegroundColor Green
  exit 0
} else {
  Write-Host "失敗したチェックがあります。install.ps1 を再実行してください。" -ForegroundColor Red
  exit 1
}
