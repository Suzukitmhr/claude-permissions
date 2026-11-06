#!/usr/bin/env node
'use strict';

/**
 * インストール済みの ~/.claude/settings.json に、選択した接続先（providers/<名前>.json）を反映する。
 *
 * bedrock: providers/bedrock.json の内容（env・statusLine）をマージする。
 * team:    providers/team.json の statusLine をマージする。
 *          env は反映しない（Team は env 無しが基本。env は --settings で Bedrock から切り替える用）。
 *
 * 決定の優先順位: 引数 → 環境変数 CLAUDE_PERMISSIONS_PROVIDER → 既定 "bedrock"
 * 使い方: node apply-provider.js [team|bedrock]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const provider = (process.argv[2] || process.env.CLAUDE_PERMISSIONS_PROVIDER || 'bedrock').trim().toLowerCase();

if (!['team', 'bedrock'].includes(provider)) {
  console.error(`[apply-provider] ERROR: 未知の接続先 "${provider}"。指定可能: team, bedrock`);
  process.exit(1);
}

try {
  const def = JSON.parse(fs.readFileSync(path.join(__dirname, 'providers', `${provider}.json`), 'utf8'));
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const { env, ...rest } = def;
  Object.assign(settings, rest);
  if (provider === 'bedrock') settings.env = { ...settings.env, ...env };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
} catch (err) {
  console.error(`[apply-provider] ERROR: ${err.message}`);
  process.exit(1);
}
console.log(`[apply-provider] ${provider}`);
