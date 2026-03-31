# Claude Code permission settings installer
# Gets source from GitHub and installs to ~/.claude/

$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/Suzukitmhr/claude-permissions.git"
$tempDir = Join-Path $env:TEMP "claude-permission-install"

# clone or pull
if (Test-Path (Join-Path $tempDir ".git")) {
    Write-Host "[Update] Pulling repo: $tempDir"
    git -C $tempDir pull
} else {
    Write-Host "[Download] Cloning repo: $repoUrl"
    git clone $repoUrl $tempDir
}

# Run copy_local.ps1
$localInstall = Join-Path $tempDir "copy_local.ps1"
if (-not (Test-Path $localInstall)) {
    Write-Error "copy_local.ps1 not found: $localInstall"
    exit 1
}

# Set $scriptDir for copy_local.ps1 (it cannot get its own path when run via Invoke-Expression)
$scriptDir = $tempDir

# Run file content inline to avoid execution policy issues
Get-Content $localInstall -Raw | Invoke-Expression
