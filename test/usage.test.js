'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { configuration, projectId, event, run } = require('../src/usage');
const { signedRequest, send } = require('../src/usage-aws');

function fixture(t, enabled = true) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const cwd = path.join(home, 'project');
  fs.mkdirSync(path.join(home, '.claude'));
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  const config = { enabled, endpoint: 'https://example.execute-api.ap-northeast-1.amazonaws.com/events',
    region: 'ap-northeast-1', profile: 'bedrock_sso' };
  fs.writeFileSync(path.join(home, '.claude/usage.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(cwd, '.claude/usage.json'), JSON.stringify({ project_id: 'PJ01', endpoint: 'https://untrusted.invalid' }));
  return { home, cwd, config };
}
const skill = { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'review', args: 'PRIVATE' }, prompt: 'PRIVATE' };

test('OFF skips project input, credentials and network', async t => {
  const { home } = fixture(t, false);
  assert.equal(await run(null, { home, send: () => assert.fail('must not send') }), 'disabled');
});
test('only allowlisted fields leave the project; endpoint comes from user config', async t => {
  const { home, cwd, config } = fixture(t);
  let sent;
  await run({ ...skill, cwd }, { home, provider: 'team', send: async (c, p) => { sent = p; assert.equal(c.endpoint, config.endpoint); } });
  assert.deepEqual(Object.keys(sent).sort(), ['schema_version', 'event_id', 'occurred_at', 'project_id', 'provider', 'kind', 'name'].sort());
  assert.equal(sent.project_id, 'PJ01'); assert.equal(sent.provider, 'team');
  assert.match(sent.event_id, /^[a-f0-9-]{36}$/);
  assert.ok(!JSON.stringify(sent).includes('PRIVATE'));
});
test('all three invocation paths, unsupported events and unsafe names', () => {
  assert.equal(event(skill, 'PJ', 'bedrock').kind, 'skill');
  assert.equal(event({ hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: 'plugin:review' }, 'PJ', 'team').name, 'plugin:review');
  assert.equal(event({ hook_event_name: 'SubagentStart', agent_type: 'Explore' }, 'PJ', 'team').kind, 'subagent');
  assert.equal(event({ hook_event_name: 'SubagentStop' }, 'PJ', 'team'), null);
  assert.equal(event(skill, 'PJ', undefined), null);
  assert.equal(event({ ...skill, tool_input: { skill: 'review secret argument' } }, 'PJ', 'team'), null);
});
test('unregistered and nested unregistered repositories do not send', async t => {
  const { home, cwd } = fixture(t);
  fs.unlinkSync(path.join(cwd, '.claude/usage.json'));
  assert.equal(await run({ ...skill, cwd }, { home, provider: 'team', send: () => assert.fail() }), 'unregistered-project');
  fs.writeFileSync(path.join(cwd, '.claude/usage.json'), '{"project_id":"PJ"}');
  const nested = path.join(cwd, 'nested'); fs.mkdirSync(path.join(nested, '.git'), { recursive: true });
  assert.equal(projectId(nested), null);
  const child = path.join(cwd, 'src'); fs.mkdirSync(child);
  assert.equal(projectId(child), 'PJ');
});
test('unsafe endpoint and malformed user config fail closed', t => {
  const { home, config } = fixture(t);
  for (const endpoint of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/?secret=x', 'https://example.com/#x']) {
    fs.writeFileSync(path.join(home, '.claude/usage.json'), JSON.stringify({ ...config, endpoint }));
    assert.throws(() => configuration(home));
  }
});
const credentials = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'EXAMPLESECRET', sessionToken: 'EXAMPLESESSION' };
test('SigV4 signs execute-api, path, body and temporary session token', async () => {
  const config = { endpoint: 'https://example.com/prod/events', region: 'ap-northeast-1' };
  const signed = await signedRequest(config, { name: 'review' }, credentials);
  assert.match(signed.headers.authorization, /ap-northeast-1\/execute-api\/aws4_request/);
  assert.equal(signed.headers['x-amz-security-token'], credentials.sessionToken);
  assert.equal(signed.path, '/prod/events');
  const other = await signedRequest(config, { name: 'other' }, credentials);
  assert.notEqual(signed.headers.authorization, other.headers.authorization);
});
test('HTTPS POST rejects redirects and non-success responses, never retries', async () => {
  let calls = 0;
  const config = { endpoint: 'https://example.com/events', region: 'ap-northeast-1' };
  await assert.rejects(send(config, { name: 'review' }, { credentials, fetchImpl: async (url, init) => {
    calls++; assert.equal(init.redirect, 'error'); assert.equal(init.method, 'POST');
    assert.ok(init.signal); return { ok: false };
  } }));
  assert.equal(calls, 1);
});
test('check authenticates but never submits an event', async () => {
  await send({}, null, { credentials, fetchImpl: () => assert.fail('no event') });
});
test('successful transport submits the signed JSON exactly once', async () => {
  const payload = event(skill, 'PJ', 'team');
  let count = 0;
  await send({ endpoint: 'https://example.com/events', region: 'ap-northeast-1' }, payload, {
    credentials, fetchImpl: async (url, init) => {
      count++; assert.deepEqual(JSON.parse(init.body), payload);
      assert.match(init.headers.authorization, /^AWS4-HMAC-SHA256 /);
      return { ok: true, body: { cancel: async () => {} } };
    }
  });
  assert.equal(count, 1);
});
test('standalone distributed bundle refuses non-SSO profiles despite available environment keys', t => {
  const { home } = fixture(t);
  const config = path.join(home, 'aws-config');
  const shared = path.join(home, 'aws-credentials');
  fs.writeFileSync(config, '[profile bedrock_sso]\nregion=ap-northeast-1\n');
  fs.writeFileSync(shared, '[bedrock_sso]\naws_access_key_id=EXAMPLE\naws_secret_access_key=PRIVATE\n');
  const isolated = path.join(home, 'usage.js');
  fs.copyFileSync(path.join(__dirname, '../hooks/usage.js'), isolated);
  const result = spawnSync(process.execPath, [isolated, '--check'], {
    env: { ...process.env, HOME: home, USERPROFILE: home, AWS_CONFIG_FILE: config,
      AWS_SHARED_CREDENTIALS_FILE: shared, AWS_ACCESS_KEY_ID: 'EXAMPLE', AWS_SECRET_ACCESS_KEY: 'PRIVATE' },
    encoding: 'utf8', timeout: 7000
  });
  assert.equal(result.status, 1); assert.match(result.stderr, /configuration or SSO authentication failed/);
  assert.ok(!result.stderr.includes('PRIVATE')); assert.equal(result.stdout, '');
});
test('hard deadline ends a hanging credential operation without exposing input', t => {
  const { home, cwd } = fixture(t);
  const script = `const Module = require('node:module'); const original = Module._load;
    Module._load = function(id, ...args) { if (id === './usage-aws') return { send: () => new Promise(() => {}) }; return original.call(this, id, ...args); };
    require(process.argv[1]).main();`;
  const started = Date.now();
  const result = spawnSync(process.execPath, ['-e', script, path.join(__dirname, '../src/usage.js')], {
    env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_USAGE_PROVIDER: 'team' },
    input: JSON.stringify({ ...skill, cwd }), encoding: 'utf8', timeout: 7000
  });
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  assert.ok(Date.now() - started >= 4900);
});
test('installed bundle is self-contained and fails open for malformed input', t => {
  const { home } = fixture(t);
  fs.writeFileSync(path.join(home, '.claude/usage.json'), '{broken');
  const result = spawnSync(process.execPath, [path.join(__dirname, '../hooks/usage.js')], {
    env: { ...process.env, HOME: home, USERPROFILE: home }, input: 'secret invalid JSON', encoding: 'utf8', timeout: 7000 });
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
test('hook registrations coexist with security hooks; provider markers are explicit', () => {
  const settings = require('../settings.json');
  assert.ok(settings.hooks.PreToolUse.some(h => h.matcher === 'Read'));
  assert.ok(settings.hooks.PreToolUse.some(h => h.matcher === 'Bash'));
  assert.ok(settings.hooks.PreToolUse.some(h => h.matcher === 'Skill'));
  assert.ok(settings.hooks.UserPromptExpansion); assert.ok(settings.hooks.SubagentStart);
  for (const provider of ['bedrock', 'team']) assert.equal(require(`../providers/${provider}.json`).env.CLAUDE_USAGE_PROVIDER, provider);
});
test('installer provider merge supplies a marker for both providers and preserves user usage configuration', t => {
  const { home } = fixture(t, false);
  const usagePath = path.join(home, '.claude/usage.json');
  const original = fs.readFileSync(usagePath, 'utf8');
  const settingsPath = path.join(home, '.claude/settings.json');
  for (const provider of ['team', 'bedrock']) {
    fs.writeFileSync(settingsPath, '{}');
    const result = spawnSync(process.execPath, [path.join(__dirname, '../apply-provider.js'), provider], {
      env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    const settings = JSON.parse(fs.readFileSync(settingsPath));
    assert.equal(settings.env.CLAUDE_USAGE_PROVIDER, provider);
    assert.equal(fs.readFileSync(usagePath, 'utf8'), original);
  }
  // Both distribution paths copy the entire self-contained hooks directory.
  assert.match(fs.readFileSync(path.join(__dirname, '../copy_local.ps1'), 'utf8'), /Copy-Item \(Join-Path \$sourceHooksDir "\*"\) \$hooksDir -Recurse -Force/);
  assert.match(fs.readFileSync(path.join(__dirname, '../install.sh'), 'utf8'), /cp -r "\$SOURCE_HOOKS_DIR"\/\. "\$HOOKS_DIR\/"/);
});
