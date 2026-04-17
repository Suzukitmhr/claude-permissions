# Codex CLI settings installer (local copy)
# Copies config.toml, AGENTS.md, hooks and rules to ~/.codex/

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$codexDir = Join-Path $HOME ".codex"
$hooksDir = Join-Path $codexDir "hooks"
$rulesDir = Join-Path $codexDir "rules"
$backupDir = Join-Path $codexDir "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$installSourcePath = Join-Path $codexDir ".install-source"

$sourceConfigTemplate = Join-Path $scriptDir "config.toml.template"
$sourceAgents = Join-Path $scriptDir "AGENTS.md"
$sourceHooksJson = Join-Path $scriptDir "hooks.json"
$sourceHooksDir = Join-Path $scriptDir "hooks"
$sourceRulesDir = Join-Path $scriptDir "rules"
$sourceManifest = Join-Path $scriptDir "manifest.json"

foreach ($required in @($sourceConfigTemplate, $sourceAgents, $sourceHooksJson, $sourceManifest)) {
    if (-not (Test-Path $required)) {
        Write-Error "Required file not found: $required"
        exit 1
    }
}

if (-not (Test-Path $codexDir)) {
    New-Item -ItemType Directory -Path $codexDir | Out-Null
    Write-Host "[Created] $codexDir"
}

$backupCreated = $false
foreach ($path in @(
    (Join-Path $codexDir "config.toml"),
    (Join-Path $codexDir "AGENTS.md"),
    (Join-Path $codexDir "hooks.json"),
    $hooksDir,
    $rulesDir,
    (Join-Path $codexDir "manifest.json")
)) {
    if (Test-Path $path) {
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }
        $leaf = Split-Path $path -Leaf
        Copy-Item $path (Join-Path $backupDir $leaf) -Recurse -Force
        Write-Host "[Backup] $leaf -> $backupDir"
        $backupCreated = $true
    }
}

if (-not $backupCreated) {
    Write-Host "[Info] No old files found, backup not needed"
}

if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir | Out-Null
}
if (-not (Test-Path $rulesDir)) {
    New-Item -ItemType Directory -Path $rulesDir | Out-Null
}

$notifyScriptPath = (Join-Path $codexDir "hooks\\notify.js") -replace '\\', '/'
$configContent = Get-Content $sourceConfigTemplate -Raw
$configContent = $configContent.Replace("__NOTIFY_SCRIPT__", $notifyScriptPath)
Set-Content -Path (Join-Path $codexDir "config.toml") -Value $configContent -NoNewline
Write-Host "[Install] config.toml -> $codexDir"

Copy-Item $sourceAgents (Join-Path $codexDir "AGENTS.md") -Force
Write-Host "[Install] AGENTS.md -> $codexDir"

Copy-Item $sourceHooksJson (Join-Path $codexDir "hooks.json") -Force
Write-Host "[Install] hooks.json -> $codexDir"

Copy-Item (Join-Path $sourceHooksDir "*") $hooksDir -Recurse -Force
Write-Host "[Install] hooks/ -> $hooksDir"

Copy-Item (Join-Path $sourceRulesDir "*") $rulesDir -Recurse -Force
Write-Host "[Install] rules/ -> $rulesDir"

Copy-Item $sourceManifest (Join-Path $codexDir "manifest.json") -Force
Write-Host "[Install] manifest.json -> $codexDir"

$manifest = Get-Content $sourceManifest -Raw | ConvertFrom-Json
if ($manifest.version) {
    Write-Host "[Version] v$($manifest.version)"
}

try {
    $remoteUrl = git -C $scriptDir remote get-url origin 2>$null
    if ($remoteUrl) {
        Set-Content -Path $installSourcePath -Value $remoteUrl -NoNewline
        Write-Host "[Saved] Remote URL -> $installSourcePath"
    }
} catch {
    Write-Host "[Skip] Could not get git remote URL"
}

Write-Host ""
Write-Host "Done! Install is complete." -ForegroundColor Green
if ($backupCreated) {
    Write-Host "Backup saved at: $backupDir" -ForegroundColor Yellow
}
