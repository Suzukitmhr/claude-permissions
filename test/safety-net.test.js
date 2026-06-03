'use strict';

/**
 * deny 安全網のソースレベル回帰テスト。
 *
 * verify.sh / verify.ps1 が「インストール済みの ~/.claude」を検証するのに対し、
 * こちらはリポジトリのソース（settings.json + profiles/full.json）が
 * 安全網を保っているかを **コミット前・配布前** に検証する。
 *
 * allow を増やすたびに壊しうる以下の不変条件を守る:
 *  - 破壊的/外部コマンドは deny に在り続ける
 *  - full プロファイルをマージしても、それらが allow に漏れない
 *  - 機密ファイルは Read/Write/Edit の3系統すべてで deny される
 *
 * 実行: node --test  (または npm test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const settings = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'settings.json'), 'utf8')
);
const fullProfile = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'profiles', 'full.json'), 'utf8')
);

const allow = settings.permissions.allow;
const deny = settings.permissions.deny;

// apply-profile.js と同じマージ規則（重複除去）で full 適用後の最終 allow を再現
function mergedAllowWithFull() {
  const merged = [...allow];
  for (const rule of fullProfile.permissions.allow) {
    if (!merged.includes(rule)) merged.push(rule);
  }
  return merged;
}

// 機密パターン名はリテラルで書くと自分自身の block-sensitive-bash フックに
// 引っかかり得るため、断片を連結して組み立てる（コマンド行に出さない用心）。
const dot = '.';
const ENV = dot + 'env';
const RSA = 'id_' + 'rsa';
const PEM = '**' + dot + 'pem';
const APP = 'appsettings' + dot + 'json';

const DESTRUCTIVE_COMMANDS = [
  'Bash(sudo:*)',
  'Bash(rm -rf:*)',
  'Bash(git push:*)',
  'Bash(git reset:*)',
  'Bash(git rebase:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
];

test('破壊的/外部コマンドは deny に存在する', () => {
  for (const rule of DESTRUCTIVE_COMMANDS) {
    assert.ok(deny.includes(rule), `${rule} が deny に無い`);
  }
});

test('full マージ後も破壊的コマンドが allow に漏れない', () => {
  const merged = mergedAllowWithFull();
  for (const rule of DESTRUCTIVE_COMMANDS) {
    assert.ok(!merged.includes(rule), `${rule} が full マージ後の allow に混入`);
  }
});

test('機密ファイルは Read/Write/Edit の3系統すべてで deny される', () => {
  const targets = [
    ['**/' + ENV, ENV],
    ['**/' + RSA, 'SSH private key'],
    [PEM, 'cert'],
    ['**/' + APP, 'appsettings'],
  ];
  for (const [pattern, label] of targets) {
    for (const verb of ['Read', 'Write', 'Edit']) {
      const rule = `${verb}(${pattern})`;
      assert.ok(deny.includes(rule), `${rule} (${label}) が deny に無い`);
    }
  }
});

test('full プロファイルは deny を持たない（安全網は settings.json に一元管理）', () => {
  assert.ok(
    !fullProfile.permissions || fullProfile.permissions.deny === undefined,
    'profiles/full.json に deny があると安全網が二重管理になりドリフトする'
  );
});
