# Claude Code permission settings installer (local copy)
# Copies settings.json and hooks to ~/.claude/

$ErrorActionPreference = "Stop"

# When run via Invoke-Expression, $MyInvocation.MyCommand.Path is null.
# In that case, $scriptDir is already set by the caller (install.ps1).
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$claudeDir = Join-Path $HOME ".claude"
$hooksDir = Join-Path $claudeDir "hooks"
$backupDir = Join-Path $claudeDir "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$installSourcePath = Join-Path $claudeDir ".install-source"

# Check source files
$sourceSettings = Join-Path $scriptDir "settings.json"
$sourceHooksDir = Join-Path $scriptDir "hooks"

if (-not (Test-Path $sourceSettings)) {
    Write-Error "settings.json not found: $sourceSettings"
    exit 1
}

# Create .claude folder if needed
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir | Out-Null
    Write-Host "[Created] $claudeDir"
}

# Backup old files
$backupCreated = $false

if (Test-Path (Join-Path $claudeDir "settings.json")) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item (Join-Path $claudeDir "settings.json") (Join-Path $backupDir "settings.json")
    Write-Host "[Backup] settings.json -> $backupDir"
    $backupCreated = $true
}

if (Test-Path $hooksDir) {
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    Copy-Item $hooksDir (Join-Path $backupDir "hooks") -Recurse
    Write-Host "[Backup] hooks/ -> $backupDir"
    $backupCreated = $true
}

if (-not $backupCreated) {
    Write-Host "[Info] No old files found, backup not needed"
}

# Copy settings.json
Copy-Item $sourceSettings (Join-Path $claudeDir "settings.json") -Force
Write-Host "[Install] settings.json -> $claudeDir"

# Copy hooks
if (Test-Path $sourceHooksDir) {
    if (-not (Test-Path $hooksDir)) {
        New-Item -ItemType Directory -Path $hooksDir | Out-Null
    }
    Copy-Item (Join-Path $sourceHooksDir "*") $hooksDir -Recurse -Force
    Write-Host "[Install] hooks/ -> $hooksDir"
} else {
    Write-Host "[Skip] hooks folder not found: $sourceHooksDir"
}

# Show version
$settingsContent = Get-Content $sourceSettings -Raw | ConvertFrom-Json
$version = $settingsContent.version
if ($version) {
    Write-Host "[Version] v$version"
}

# Save remote URL
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
