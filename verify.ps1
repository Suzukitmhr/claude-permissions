# Claude Code permission settings checker
# Makes sure the install was done right

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

Write-Host "=== File check ==="

Check "settings.json exists"           (Test-Path $settingsPath)
Check "block-sensitive-files.js exists" (Test-Path (Join-Path $hooksDir "block-sensitive-files.js"))
Check "block-sensitive-bash.js exists"  (Test-Path (Join-Path $hooksDir "block-sensitive-bash.js"))
Check "check-version.js exists"        (Test-Path (Join-Path $hooksDir "check-version.js"))
Check ".install-source exists"         (Test-Path (Join-Path $claudeDir ".install-source"))

# Show version info
try {
  $settingsObj = Get-Content $settingsPath -Raw | ConvertFrom-Json
  $installedVersion = $settingsObj.version
  if ($installedVersion) {
    Write-Host "  [INFO] Installed version: v$installedVersion"
  }
} catch {}

try {
  $installSource = Get-Content (Join-Path $claudeDir ".install-source") -Raw
  if ($installSource) {
    Write-Host "  [INFO] Remote URL: $installSource"
  }
} catch {}

Write-Host ""
Write-Host "=== settings.json check ==="

$settings = Get-Content $settingsPath -Raw
Check "Bedrock mode is set"           ($settings -match "CLAUDE_CODE_USE_BEDROCK")
Check "PreToolUse hooks are set"      ($settings -match "PreToolUse")
Check "sudo is blocked"               ($settings -match "Bash\(sudo")
Check "AWS credentials are blocked"   ($settings -match "\.aws")
Check "Private keys are blocked"      ($settings -match "\.pem")
Check "docker-compose is blocked"     ($settings -match "docker-compose")

Write-Host ""
Write-Host "=== Hook test ==="

$filesHook = Join-Path $hooksDir "block-sensitive-files.js"
$bashHook  = Join-Path $hooksDir "block-sensitive-bash.js"

# Check .env is blocked
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/project/.env"}}'
Check "Blocks Read of .env" ($exitCode -eq 2)

# Check AWS credentials is blocked
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/.aws/credentials"}}'
Check "Blocks Read of .aws/credentials" ($exitCode -eq 2)

# Check .pem is blocked
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/certs/server.pem"}}'
Check "Blocks Read of .pem" ($exitCode -eq 2)

# Check normal files are not blocked
$exitCode = TestHook $filesHook '{"tool_input":{"path":"/home/user/project/main.js"}}'
Check "Allows Read of normal files" ($exitCode -eq 0)

# Check Bash .env access is blocked
$exitCode = TestHook $bashHook '{"tool_input":{"command":"cat .env"}}'
Check "Blocks Bash access to .env" ($exitCode -eq 2)

# Check normal Bash commands are not blocked
$exitCode = TestHook $bashHook '{"tool_input":{"command":"ls -la"}}'
Check "Allows normal Bash commands" ($exitCode -eq 0)

Write-Host ""
Write-Host "=== Result ==="
Write-Host "  Pass: $pass  Fail: $fail"
Write-Host ""

if ($fail -eq 0) {
  Write-Host "All checks passed!" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Some checks failed. Please run install.ps1 again." -ForegroundColor Red
  exit 1
}
