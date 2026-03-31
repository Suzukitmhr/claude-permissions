# Claude Code 権限設定インストールスクリプト
# GitHub からソースを取得して ~/.claude/ にインストールします

$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/Suzukitmhr/claude-permissions.git"
$tempDir = Join-Path $env:TEMP "claude-permission-install"

# clone または pull
if (Test-Path (Join-Path $tempDir ".git")) {
    Write-Host "[更新] リポジトリを pull します: $tempDir"
    git -C $tempDir pull
} else {
    Write-Host "[取得] リポジトリを clone します: $repoUrl"
    git clone $repoUrl $tempDir
}

# copy_local.ps1 を実行
$localInstall = Join-Path $tempDir "copy_local.ps1"
if (-not (Test-Path $localInstall)) {
    Write-Error "copy_local.ps1 が見つかりません: $localInstall"
    exit 1
}

# 実行ポリシーに依存しないよう、ファイル内容をインライン実行
Get-Content $localInstall -Raw | Invoke-Expression
