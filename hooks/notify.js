const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ── stdin ─────────────────────────────────────────────────────────────────
let input;
try {
  const data = fs.readFileSync(0, 'utf8').trim();
  if (!data) process.exit(0);
  input = JSON.parse(data);
} catch (_) {
  process.exit(0);
}

// ── event type ────────────────────────────────────────────────────────────
// Notification event: has 'message' field
// Stop event: has 'stop_hook_active' field
let title, message;
if (typeof input.message === 'string') {
  title = 'Claude Code: 確認が必要です';
  message = input.message;
} else {
  title = 'Claude Code';
  message = '実行が完了しました';
}

const sessionId = input.session_id || null;

// ── Slack Bot helpers (ported from notify.ps1) ────────────────────────────
function slackRequest(apiPath, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'slack.com',
        path: `/api/${apiPath}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// Resolve channel: '#channel-name' → as-is, '@U12345678' → conversations.open
async function resolveChannelId(target, token) {
  if (!target || !target.trim()) throw new Error('Slack channel was not provided.');
  if (target.startsWith('@')) {
    const userId = target.slice(1);
    if (!/^U[A-Z0-9]+$/.test(userId))
      throw new Error('Direct messages must use the form @U12345678.');
    const res = await slackRequest('conversations.open', { users: userId }, token);
    if (!res.ok) throw new Error(`conversations.open failed: ${res.error}`);
    return res.channel.id;
  }
  return target;
}

function logError(msg) {
  try {
    const logPath = path.join(os.homedir(), '.claude', 'notify_error.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
  } catch (_) {}
}

// ── notify implementations ────────────────────────────────────────────────
async function notifyViaBot(token, defaultChannel) {
  const target = defaultChannel || '#general';
  const channelId = await resolveChannelId(target, token);

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: message } },
  ];
  if (sessionId) {
    blocks.push({
      type: 'section',
      fields: [{ type: 'mrkdwn', text: `*Session:*\n${sessionId}` }],
    });
  }

  const resp = await slackRequest(
    'chat.postMessage',
    { channel: channelId, text: `${title}: ${message}`, blocks },
    token
  );

  if (!resp.ok) {
    const known = {
      channel_not_found: 'Channel not found. Confirm bot access or use a channel ID.',
      not_in_channel: 'Bot is not a member of the channel. Invite it with /invite @BotName.',
      is_archived: 'Channel is archived.',
      token_revoked: 'Token was revoked. Refresh credentials.',
    };
    logError(`[SlackAPIError] ${resp.error}`);
    console.error(known[resp.error] || `Slack API Error: ${resp.error}`);
    return;
  }

  logError(`[OK] Sent to ${channelId}`);
}

async function notifyViaWebhook(webhookUrl) {
  const body = JSON.stringify({ text: `*${title}*\n${message}` });
  const url = new URL(webhookUrl);
  await new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      () => resolve()
    );
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
  // Wait briefly for the request to be sent before exiting
  await new Promise((r) => setTimeout(r, 500));
}

function notifyViaBalloon() {
  const safeTitle = title.replace(/'/g, "''");
  const safeMessage = message.replace(/'/g, "''").replace(/\r?\n/g, ' ');
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(8000, '${safeTitle}', '${safeMessage}', 'Info')
Start-Sleep 3
$n.Dispose()
`;
    spawnSync('powershell', ['-Command', script], { timeout: 8000 });
  } catch (_) {
    // Ignore notification failures
  }
}

// ── dispatch (priority: Bot Token > Webhook > Balloon) ────────────────────
(async () => {
  const botToken = process.env.CLAUDE_CODE_SLACK_BOT_TOKEN;
  const defaultChannel = process.env.CLAUDE_CODE_SLACK_DEFAULT_CHANNEL;
  const webhookUrl = process.env.CLAUDE_CODE_SLACK_WEBHOOK_URL;

  if (botToken) {
    try {
      await notifyViaBot(botToken, defaultChannel);
    } catch (e) {
      logError(`[Error] ${e.message}`);
    }
  } else if (webhookUrl) {
    try {
      await notifyViaWebhook(webhookUrl);
    } catch (_) {}
  } else {
    notifyViaBalloon();
  }

  process.exit(0);
})();
