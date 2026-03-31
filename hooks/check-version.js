const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// 1日1回だけチェックする（tempファイルで制御）
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const markerPath = path.join(os.tmpdir(), `claude-version-check-${today}`);

if (fs.existsSync(markerPath)) {
  process.exit(0);
}

// マーカーファイルを作成（以降の呼び出しではスキップ）
try {
  fs.writeFileSync(markerPath, today);
} catch (_) {
  // マーカー作成失敗しても続行
}

// インストール元のリモートURL取得
const claudeDir = path.join(os.homedir(), '.claude');
const sourcePath = path.join(claudeDir, '.install-source');

if (!fs.existsSync(sourcePath)) {
  process.exit(0);
}

const remoteUrl = fs.readFileSync(sourcePath, 'utf8').trim();
if (!remoteUrl) {
  process.exit(0);
}

// インストール済みバージョン取得
const settingsPath = path.join(claudeDir, 'settings.json');
let installedVersion = '0.0.0';
try {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  installedVersion = settings.version || '0.0.0';
} catch (_) {
  process.exit(0);
}

// git ls-remote --tags でリモートの最新タグを取得
let latestVersion = null;
try {
  const output = execSync(`git ls-remote --tags "${remoteUrl}"`, {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // refs/tags/v1.0.0 形式のタグを解析（^{} は除外）
  const versions = output
    .split('\n')
    .map(line => {
      const match = line.match(/refs\/tags\/v(\d+\.\d+\.\d+)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (versions.length === 0) {
    process.exit(0);
  }

  // semver 比較でソートして最新を取得
  versions.sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  });

  latestVersion = versions[versions.length - 1];
} catch (_) {
  // ネットワークエラーやタイムアウトは無視
  process.exit(0);
}

if (!latestVersion) {
  process.exit(0);
}

// バージョン比較
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

if (compareVersions(installedVersion, latestVersion) < 0) {
  console.error(
    `\n⚠ Claude Code の設定が古くなっています (v${installedVersion} → v${latestVersion})。\n` +
    `  install.ps1 または install.sh を再実行してください。\n`
  );
}

process.exit(0);
