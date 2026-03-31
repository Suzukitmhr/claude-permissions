# Claude Code 権限設定インストールスクリプト
# ユーザディレクトリの ~/.claude/ に settings.json と hooks を配置します

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$claudeDir = Join-Path $HOME ".claude"
$hooksDir = Join-Path $claudeDir "hooks"
$backupDir = Join-Path $claudeDir "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$installSourcePath = Join-Path $claudeDir ".install-source"

# ソースファイルの存在確認
$sourceSettings = Join-Path $scriptDir "settings.json"
$sourceHooksDir = Join-Path $scriptDir "hooks"

if (-not (Test-Path $sourceSettings)) {
    Write-Error "settings.json が見つかりません: $sourceSettings"
    exit 1
}

# .claude ディレクトリがなければ作成
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir | Out-Null
    Write-Host "[作成] $claudeDir"
}

# バックアップ作成
$backupCreated = $false

if (Test-Path (Join-Path $claudeDir "settings.json")) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item (Join-Path $claudeDir "settings.json") (Join-Path $backupDir "settings.json")
    Write-Host "[バックアップ] settings.json -> $backupDir"
    $backupCreated = $true
}

if (Test-Path $hooksDir) {
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    Copy-Item $hooksDir (Join-Path $backupDir "hooks") -Recurse
    Write-Host "[バックアップ] hooks/ -> $backupDir"
    $backupCreated = $true
}

if (-not $backupCreated) {
    Write-Host "[情報] 既存ファイルがないためバックアップは不要です"
}

# settings.json をコピー
Copy-Item $sourceSettings (Join-Path $claudeDir "settings.json") -Force
Write-Host "[インストール] settings.json -> $claudeDir"

# hooks をコピー
if (Test-Path $sourceHooksDir) {
    if (-not (Test-Path $hooksDir)) {
        New-Item -ItemType Directory -Path $hooksDir | Out-Null
    }
    Copy-Item (Join-Path $sourceHooksDir "*") $hooksDir -Recurse -Force
    Write-Host "[インストール] hooks/ -> $hooksDir"
} else {
    Write-Host "[スキップ] hooks ディレクトリが見つかりません: $sourceHooksDir"
}

# バージョン情報を表示
$sourceSettings = Join-Path $scriptDir "settings.json"
$settingsContent = Get-Content $sourceSettings -Raw | ConvertFrom-Json
$version = $settingsContent.version
if ($version) {
    Write-Host "[バージョン] v$version"
}

# リモートURLを保存
try {
    $remoteUrl = git -C $scriptDir remote get-url origin 2>$null
    if ($remoteUrl) {
        Set-Content -Path $installSourcePath -Value $remoteUrl -NoNewline
        Write-Host "[設定] リモートURL -> $installSourcePath"
    }
} catch {
    Write-Host "[スキップ] git リモートURLの取得に失敗しました"
}

Write-Host ""
Write-Host "インストールが完了しました。" -ForegroundColor Green
if ($backupCreated) {
    Write-Host "バックアップ: $backupDir" -ForegroundColor Yellow
}
