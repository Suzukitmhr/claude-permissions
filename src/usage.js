'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const LIMIT_MS = 5000;
const code = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const name = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/;

function configuration(home = os.homedir()) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'usage.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error('invalid user configuration'); }
  if (config.enabled !== true) return null;
  const url = new URL(config.endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname) {
    throw new Error('endpoint must be HTTPS without credentials, query or fragment');
  }
  if (!/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(config.region || '') ||
      typeof config.profile !== 'string' || !config.profile.trim()) throw new Error('region and SSO profile are required');
  return { endpoint: url.href, region: config.region, profile: config.profile };
}

function projectId(cwd) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return null;
  let dir = path.resolve(cwd);
  for (;;) {
    const file = path.join(dir, '.claude', 'usage.json');
    if (fs.existsSync(file)) {
      const config = JSON.parse(fs.readFileSync(file, 'utf8'));
      return code.test(config.project_id || '') ? config.project_id : null;
    }
    // Do not attribute an unregistered nested repository to its parent project.
    if (fs.existsSync(path.join(dir, '.git'))) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function event(input, project, provider) {
  if (!['bedrock', 'team'].includes(provider)) return null;
  let kind, called;
  if (input.hook_event_name === 'PreToolUse' && input.tool_name === 'Skill') {
    kind = 'skill'; called = input.tool_input?.skill;
  } else if (input.hook_event_name === 'UserPromptExpansion' && input.expansion_type === 'slash_command') {
    kind = 'skill'; called = input.command_name;
  } else if (input.hook_event_name === 'SubagentStart') {
    kind = 'subagent'; called = input.agent_type;
  } else return null;
  if (typeof called !== 'string' || !name.test(called)) return null;
  return { schema_version: 1, event_id: randomUUID(), occurred_at: new Date().toISOString(),
    project_id: project, provider, kind, name: called };
}

async function run(input, { home, provider = process.env.CLAUDE_USAGE_PROVIDER,
  send = (...args) => require('./usage-aws').send(...args), check = false } = {}) {
  const config = configuration(home);
  if (!config) return 'disabled';
  const project = projectId(input.cwd);
  if (!project && !check) return 'unregistered-project';
  const payload = check ? null : event(input, project, provider);
  if (!payload && !check) return 'unsupported-event-or-provider';
  await send(config, payload);
  return check ? 'sso-ready (API connectivity and identity mapping not checked)' : 'sent';
}

async function main() {
  const check = process.argv.includes('--check');
  // A hard deadline covers SDK credential refresh and all network operations.
  const timer = setTimeout(() => {
    if (check) console.error('[usage] timed out; run aws sso login for the configured profile');
    process.exit(check ? 1 : 0);
  }, LIMIT_MS);
  try {
    if (check) {
      console.log('[usage] ' + await run({ cwd: process.cwd() }, { check: true }));
    } else {
      // OFF must not consume or retain hook input, or load the AWS SDK.
      if (!configuration()) return;
      let raw = '';
      for await (const chunk of process.stdin) {
        raw += chunk;
        if (raw.length > 1024 * 1024) throw new Error('hook input too large');
      }
      await run(JSON.parse(raw));
    }
  } catch {
    // Never echo SDK exceptions: they can contain credentials, URLs or input.
    if (check) {
      console.error('[usage] configuration or SSO authentication failed; check usage.json and aws sso login');
      process.exitCode = 1;
    }
  } finally { clearTimeout(timer); }
}

module.exports = { configuration, projectId, event, run, main };
