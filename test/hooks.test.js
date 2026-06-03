'use strict';

/**
 * フック実行レベルの回帰テスト。
 *
 * block-sensitive-files.js / block-sensitive-bash.js を実際に子プロセスとして
 * 起動し、stdin JSON / 終了コード規約（0=許可、2=ブロック）を検証する。
 * patterns.js の正規表現が機密ファイルを取りこぼさないことを担保する。
 *
 * 実行: node --test  (または npm test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const filesHook = path.join(repoRoot, 'hooks', 'block-sensitive-files.js');
const bashHook = path.join(repoRoot, 'hooks', 'block-sensitive-bash.js');

// 機密名はリテラルで書かず断片連結で組み立てる（自分のフックに引っかからない用心）
const dot = '.';
const ENV = dot + 'env';
const RSA = 'id_' + 'rsa';
const PEM = 'server' + dot + 'pem';

function runHook(hookPath, toolInput) {
  const r = spawnSync('node', [hookPath], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: 'utf8',
  });
  return r.status;
}

test('Read フック: 機密ファイルはブロック(exit 2)', () => {
  assert.equal(runHook(filesHook, { path: '/proj/' + ENV }), 2);
  assert.equal(runHook(filesHook, { path: '/home/u/.ssh/' + RSA }), 2);
  assert.equal(runHook(filesHook, { path: '/proj/certs/' + PEM }), 2);
});

test('Read フック: 通常ファイルは許可(exit 0)', () => {
  assert.equal(runHook(filesHook, { path: '/proj/src/main.js' }), 0);
  assert.equal(runHook(filesHook, { path: '/proj/README.md' }), 0);
});

test('Bash フック: 機密ファイル参照はブロック(exit 2)', () => {
  assert.equal(runHook(bashHook, { command: 'cat ' + ENV }), 2);
});

test('Bash フック: 読み取り系コマンドは許可(exit 0)', () => {
  assert.equal(runHook(bashHook, { command: 'git status' }), 0);
  assert.equal(runHook(bashHook, { command: 'ls -la' }), 0);
  assert.equal(runHook(bashHook, { command: 'git log --oneline -5' }), 0);
});
