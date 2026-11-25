'use strict';

/**
 * apply-personal.js（配布した設定に個人の設定を上乗せする）のテスト。
 *
 * 実行: node --test  (または npm test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { mergePersonal, applyPersonal } = require('../apply-personal.js');

const script = path.join(__dirname, '..', 'apply-personal.js');

const notifyStop = { hooks: [{ type: 'command', command: 'node "$HOME/.claude/hooks/notify.js"' }] };
const inboxStop = { hooks: [{ type: 'command', command: 'agent-inbox hook stop', timeout: 30 }] };
const inboxPrompt = { hooks: [{ type: 'command', command: 'agent-inbox hook prompt', timeout: 30 }] };

const distributed = {
  env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'ap-northeast-1' },
  permissions: { allow: ['Read'], deny: ['Read(./.env)', 'Bash(rm -rf:*)'] },
  hooks: { Stop: [notifyStop] },
  statusLine: { type: 'command', command: 'node statusline.js' },
};

const personal = {
  env: { AWS_REGION: 'us-east-1', MY_VAR: 'x' },
  permissions: { allow: ['Bash(agent-inbox:*)'] },
  hooks: { Stop: [inboxStop], UserPromptSubmit: [inboxPrompt] },
};

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'apply-personal-'));
}

test('Hook は配布分を残したまま追記される', () => {
  const merged = mergePersonal(distributed, personal);
  assert.deepEqual(merged.hooks.Stop, [notifyStop, inboxStop]);
  assert.deepEqual(merged.hooks.UserPromptSubmit, [inboxPrompt]);
  assert.deepEqual(merged.statusLine, distributed.statusLine);
});

test('配布の deny は消えず、allow は足される', () => {
  const merged = mergePersonal(distributed, { permissions: { deny: [] } });
  assert.deepEqual(merged.permissions.deny, distributed.permissions.deny);
  assert.deepEqual(mergePersonal(distributed, personal).permissions.allow, ['Read', 'Bash(agent-inbox:*)']);
});

test('env のキーは個人の値で上書きされ、他のキーは残る', () => {
  const merged = mergePersonal(distributed, personal);
  assert.deepEqual(merged.env, { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-east-1', MY_VAR: 'x' });
});

test('引数のオブジェクトを書き換えない', () => {
  const before = JSON.stringify(distributed);
  mergePersonal(distributed, personal);
  assert.equal(JSON.stringify(distributed), before);
});

test('2回適用しても重複しない（ファイル）', () => {
  const dir = tempDir();
  const target = path.join(dir, 'settings.json');
  const mine = path.join(dir, 'settings.personal.json');
  fs.writeFileSync(target, JSON.stringify(distributed));
  fs.writeFileSync(mine, '﻿' + JSON.stringify(personal)); // BOM付きでも読める
  assert.deepEqual(applyPersonal(target, mine), { applied: true, changed: true });
  const once = fs.readFileSync(target, 'utf8');
  assert.deepEqual(applyPersonal(target, mine), { applied: true, changed: false });
  assert.equal(fs.readFileSync(target, 'utf8'), once);
  assert.deepEqual(JSON.parse(once).hooks.Stop, [notifyStop, inboxStop]);
});

test('個人ファイルがなければ何もしない', () => {
  const dir = tempDir();
  const target = path.join(dir, 'settings.json');
  fs.writeFileSync(target, JSON.stringify(distributed));
  assert.deepEqual(applyPersonal(target, path.join(dir, 'none.json')), { applied: false });
  assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify(distributed));
});

test('壊れたJSONでは対象を書き換えず、終了コード1', () => {
  const dir = tempDir();
  const target = path.join(dir, 'hooks.json');
  const mine = path.join(dir, 'hooks.personal.json');
  fs.writeFileSync(target, JSON.stringify({ hooks: {} }));
  fs.writeFileSync(mine, '{ broken');
  const r = spawnSync('node', [script, target, mine], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /apply-personal/);
  assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify({ hooks: {} }));
});

test('引数で Codex の hooks.json に適用できる', () => {
  const dir = tempDir();
  const target = path.join(dir, 'hooks.json');
  const mine = path.join(dir, 'hooks.personal.json');
  const sessionStart = { hooks: [{ type: 'command', command: 'herdr session' }] };
  fs.writeFileSync(target, JSON.stringify({ hooks: { SessionStart: [sessionStart] } }));
  fs.writeFileSync(mine, JSON.stringify({ hooks: { Stop: [inboxStop] } }));
  const r = spawnSync('node', [script, target, mine], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')).hooks, { SessionStart: [sessionStart], Stop: [inboxStop] });
});
