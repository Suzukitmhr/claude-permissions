#!/usr/bin/env node
'use strict';

/**
 * 配布した設定ファイルに、個人用の設定ファイルを上乗せ（マージ）する。
 *
 * install は ~/.claude/settings.json や ~/.codex/hooks.json を配布物で上書きするため、
 * 個人で足した Hook などは消えてしまう。個人の設定は別ファイルに置き、install の最後に
 * このスクリプトでマージする。
 *
 *   Claude Code: ~/.claude/settings.personal.json → ~/.claude/settings.json（既定）
 *   Codex CLI:   ~/.codex/hooks.personal.json     → ~/.codex/hooks.json
 *
 * ※ Claude Code はホーム直下の ~/.claude/settings.local.json を読まない
 *   （settings.local.json はプロジェクトの .claude/ にあるときだけ有効）。
 *
 * マージの規則:
 *   - オブジェクトは再帰的にマージする
 *   - 配列は和集合（JSONとして同じ要素は追加しない）。hooks.Stop も permissions.deny も同じ
 *   - それ以外の値（文字列・数値・真偽値・null）は個人の値で上書きする
 *   - 配布側の配列から要素は消さない（配布の deny などの安全網は個人の設定では外せない）
 *   - 何度実行しても結果は同じ。個人ファイルから消した項目を戻すには install を再実行する
 *
 * 使い方:
 *   node apply-personal.js                       # Claude Code（既定のパス）
 *   node apply-personal.js <target> <personal>   # 任意のファイル（Codex など）
 * 個人ファイルがなければ何もしない（終了コード0）。JSONが壊れていれば対象を書き換えずに終了コード1。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** base に personal をマージした新しい値を返す（引数は変更しない）。 */
function mergePersonal(base, personal) {
  if (Array.isArray(base) && Array.isArray(personal)) {
    const merged = [...base];
    const seen = new Set(base.map((item) => JSON.stringify(item)));
    for (const item of personal) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  }
  if (isPlainObject(base) && isPlainObject(personal)) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(personal)) {
      merged[key] = key in base ? mergePersonal(base[key], value) : value;
    }
    return merged;
  }
  return personal;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`${file} を読めません: ${err.message}`);
  }
}

/**
 * personalPath があれば targetPath にマージして書き込む。
 * 戻り値: { applied: false }（個人ファイルなし） / { applied: true, changed }
 */
function applyPersonal(targetPath, personalPath) {
  if (!fs.existsSync(personalPath)) {
    return { applied: false };
  }
  const personal = readJson(personalPath);
  if (!isPlainObject(personal)) {
    throw new Error(`${personalPath} はJSONオブジェクトにしてください`);
  }
  const target = fs.existsSync(targetPath) ? readJson(targetPath) : {};
  const merged = mergePersonal(target, personal);
  const before = JSON.stringify(target);
  const after = JSON.stringify(merged);
  if (before !== after) {
    fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  }
  return { applied: true, changed: before !== after };
}

module.exports = { mergePersonal, applyPersonal };

if (require.main === module) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const targetPath = process.argv[2] || path.join(claudeDir, 'settings.json');
  const personalPath = process.argv[3] || path.join(claudeDir, 'settings.personal.json');
  try {
    const result = applyPersonal(targetPath, personalPath);
    if (!result.applied) {
      console.log(`[apply-personal] 個人の設定なし（${personalPath}）`);
    } else {
      console.log(`[apply-personal] ${personalPath} -> ${targetPath}${result.changed ? '' : '（変更なし）'}`);
    }
  } catch (err) {
    console.error(`[apply-personal] ERROR: ${err.message}`);
    process.exit(1);
  }
}
