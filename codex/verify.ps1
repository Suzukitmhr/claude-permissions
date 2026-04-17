# Codex CLI settings checker
# Makes sure the install was done right

$ErrorActionPreference = "Stop"

$codexDir = Join-Path $HOME ".codex"
$hooksDir = Join-Path $codexDir "hooks"
$rulesDir = Join-Path $codexDir "rules"
$configPath = Join-Path $codexDir "config.toml"
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$pass = 0
$fail = 0
$skip = 0

function Check($label, $result) {
  if ($result) {
    Write-Host "  [OK]   $label" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  [FAIL] $label" -ForegroundColor Red
    $script:fail++
  }
}

function SkipCheck($label) {
  Write-Host "  [SKIP] $label" -ForegroundColor Yellow
  $script:skip++
}

function TestHook($hookScript, $inputJson) {
  $null = $inputJson | node $hookScript 2>$null
  return $LASTEXITCODE
}

Write-Host "=== File check ==="

Check "config.toml exists" (Test-Path $configPath)
Check "AGENTS.md exists" (Test-Path (Join-Path $codexDir "AGENTS.md"))
Check "hooks.json exists" (Test-Path (Join-Path $codexDir "hooks.json"))
Check "block-sensitive-bash.js exists" (Test-Path (Join-Path $hooksDir "block-sensitive-bash.js"))
Check "default.rules exists" (Test-Path (Join-Path $rulesDir "default.rules"))
Check "manifest.json exists" (Test-Path (Join-Path $codexDir "manifest.json"))
Check ".install-source exists" (Test-Path (Join-Path $codexDir ".install-source"))

try {
  $manifest = Get-Content (Join-Path $codexDir "manifest.json") -Raw | ConvertFrom-Json
  if ($manifest.version) {
    Write-Host "  [INFO] Installed version: v$($manifest.version)"
  }
} catch {}

try {
  $installSource = Get-Content (Join-Path $codexDir ".install-source") -Raw
  if ($installSource) {
    Write-Host "  [INFO] Remote URL: $installSource"
  }
} catch {}

Write-Host ""
Write-Host "=== config.toml check ==="

$config = Get-Content $configPath -Raw
Check "gpt-5.4 is set" ($config -match 'model = "gpt-5\.4"')
Check "approval_policy is untrusted" ($config -match 'approval_policy = "untrusted"')
Check "workspace-write is set" ($config -match 'sandbox_mode = "workspace-write"')
Check "web_search is disabled" ($config -match 'web_search = "disabled"')
Check "CLAUDE.md fallback is set" ($config -match 'project_doc_fallback_filenames = \["CLAUDE\.md"\]')
Check "notify command is set" ($config -match 'notify = \["node", ".+notify\.js"\]')
Check "codex_hooks feature is enabled" ($config -match 'codex_hooks = true')
Check "Windows sandbox is set" ($config -match 'sandbox = "unelevated"')

Write-Host ""
Write-Host "=== Hook test ==="

if ($isWindowsHost) {
  SkipCheck "Codex hooks runtime is skipped on Windows"
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
  $bashHook = Join-Path $hooksDir "block-sensitive-bash.js"

  $exitCode = TestHook $bashHook '{"tool_input":{"command":"cat .env"}}'
  Check "Blocks Bash access to .env" ($exitCode -eq 2)

  $exitCode = TestHook $bashHook '{"tool_input":{"command":"cat ~/.aws/credentials"}}'
  Check "Blocks Bash access to .aws/credentials" ($exitCode -eq 2)

  $exitCode = TestHook $bashHook '{"tool_input":{"command":"git push origin main"}}'
  Check "Blocks git push" ($exitCode -eq 2)

  $exitCode = TestHook $bashHook '{"tool_input":{"command":"ls -la"}}'
  Check "Allows normal Bash commands" ($exitCode -eq 0)
} else {
  SkipCheck "Hook runtime test skipped because node is unavailable"
}

Write-Host ""
Write-Host "=== Rules test ==="

if (Get-Command codex -ErrorAction SilentlyContinue) {
  $rulesPath = Join-Path $rulesDir "default.rules"
  $output = codex execpolicy check --rules $rulesPath -- git push origin main 2>$null
  Check "Rules forbid git push" ($output -match 'forbidden')
} else {
  SkipCheck "Rules test skipped because codex is unavailable"
}

Write-Host ""
Write-Host "=== Result ==="
Write-Host "  Pass: $pass  Fail: $fail  Skip: $skip"
Write-Host ""

if ($fail -eq 0) {
  Write-Host "All checks passed!" -ForegroundColor Green
  exit 0
} else {
  Write-Host "Some checks failed. Please run codex/install.ps1 again." -ForegroundColor Red
  exit 1
}
