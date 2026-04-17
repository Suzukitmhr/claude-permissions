# Codex CLI settings installer
# Gets source from GitHub and installs to ~/.codex/

$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/Suzukitmhr/claude-permission.git"
$tempDir = Join-Path $env:TEMP "codex-cli-config-install"

if (Test-Path (Join-Path $tempDir ".git")) {
    Write-Host "[Update] Pulling repo: $tempDir"
    git -C $tempDir pull
} else {
    Write-Host "[Download] Cloning repo: $repoUrl"
    git clone $repoUrl $tempDir
}

$localInstall = Join-Path $tempDir "codex\\copy_local.ps1"
if (-not (Test-Path $localInstall)) {
    Write-Error "copy_local.ps1 not found: $localInstall"
    exit 1
}

powershell -ExecutionPolicy Bypass -File $localInstall
