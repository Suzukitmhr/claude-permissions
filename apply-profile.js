#!/usr/bin/env node
'use strict';

/**
 * インストール済みの ~/.claude/settings.json に、選択されたプロファイルの
 * permissions.allow をマージする。
 *
 * standard: settings.json をそのまま使う（マージ無し）。
 * full:     profiles/full.json の allow を追記する。
 *
 * deny ルール（機密ファイル・破壊的コマンドの安全網）は settings.json に
 * 一元管理されており、本スクリプトは一切変更しない。
 *
 * プロファイル決定の優先順位:
 *   1. コマンドライン引数 (process.argv[2])
 *   2. 環境変数 CLAUDE_PERMISSIONS_PROFILE
 *   3. 既定値 "standard"
 *
 * 使い方: node apply-profile.js [profile]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const repoDir = __dirname;
const profilesDir = path.join(repoDir, 'profiles');
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

function fail(msg) {
  console.error(`[apply-profile] ERROR: ${msg}`);
  process.exit(1);
}

// プロファイル名の決定と正規化
let profile = (process.argv[2] || process.env.CLAUDE_PERMISSIONS_PROFILE || 'standard')
  .trim()
  .toLowerCase();

if (profile === '') {
  profile = 'standard';
}

const KNOWN_PROFILES = ['standard', 'full'];
if (!KNOWN_PROFILES.includes(profile)) {
  fail(`未知のプロファイル "${profile}"。指定可能: ${KNOWN_PROFILES.join(', ')}`);
}

// standard は追加マージ無し
if (profile === 'standard') {
  console.log('[apply-profile] standard プロファイル（追加の allow なし）');
  process.exit(0);
}

// full: 差分ファイルを読み込んでマージ
const profilePath = path.join(profilesDir, `${profile}.json`);
if (!fs.existsSync(profilePath)) {
  fail(`プロファイル定義が見つかりません: ${profilePath}`);
}
if (!fs.existsSync(settingsPath)) {
  fail(`インストール済み settings.json が見つかりません: ${settingsPath}`);
}

let settings;
let profileDef;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (err) {
  fail(`settings.json の読み込みに失敗: ${err.message}`);
}
try {
  profileDef = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
} catch (err) {
  fail(`${profile}.json の読み込みに失敗: ${err.message}`);
}

const extraAllow = profileDef?.permissions?.allow;
if (!Array.isArray(extraAllow)) {
  fail(`${profile}.json に permissions.allow 配列がありません`);
}

settings.permissions = settings.permissions || {};
const baseAllow = Array.isArray(settings.permissions.allow)
  ? settings.permissions.allow
  : [];

// 重複を除いてマージ（順序は base → 追加の順を保持）
const merged = [...baseAllow];
let added = 0;
for (const rule of extraAllow) {
  if (!merged.includes(rule)) {
    merged.push(rule);
    added++;
  }
}
settings.permissions.allow = merged;

try {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
} catch (err) {
  fail(`settings.json の書き込みに失敗: ${err.message}`);
}

console.log(`[apply-profile] full プロファイルを適用しました（allow を ${added} 件追加）`);
process.exit(0);
