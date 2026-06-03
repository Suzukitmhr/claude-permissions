# Claude Code permission settings installer
# Gets source from GitHub and installs to ~/.claude/

$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/Suzukitmhr/claude-permissions.git"
$tempDir = Join-Path $env:TEMP "claude-permission-install"

# clone or re-clone (pull fails if the temp dir is stale/broken)
if (Test-Path (Join-Path $tempDir ".git")) {
    Write-Host "[Update] Pulling repo: $tempDir"
    git -C $tempDir pull
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Retry] Pull failed, re-cloning..."
        Remove-Item $tempDir -Recurse -Force
        git clone $repoUrl $tempDir
        if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed"; exit 1 }
    }
} else {
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
    Write-Host "[Download] Cloning repo: $repoUrl"
    git clone $repoUrl $tempDir
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed"; exit 1 }
}

# Run copy_local.ps1
$localInstall = Join-Path $tempDir "copy_local.ps1"
if (-not (Test-Path $localInstall)) {
    Write-Error "copy_local.ps1 not found: $localInstall"
    exit 1
}

# Run with Bypass policy so execution policy does not matter
powershell -ExecutionPolicy Bypass -File $localInstall
