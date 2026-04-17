const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function logError(msg) {
  try {
    const logPath = path.join(os.homedir(), '.codex', 'notify_error.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
  } catch (_) {}
}

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

async function resolveChannelId(target, token) {
  if (!target || !target.trim()) {
    throw new Error('Slack channel was not provided.');
  }
  if (target.startsWith('@')) {
    const userId = target.slice(1);
    if (!/^U[A-Z0-9]+$/.test(userId)) {
      throw new Error('Direct messages must use the form @U12345678.');
    }
    const res = await slackRequest('conversations.open', { users: userId }, token);
    if (!res.ok) {
      throw new Error(`conversations.open failed: ${res.error}`);
    }
    return res.channel.id;
  }
  return target;
}

function buildMessage(payload) {
  const eventName = payload?.event_name || payload?.event || payload?.kind || payload?.notification_type || 'event';
  const title = payload?.title || `Codex: ${eventName}`;

  const summary = payload?.message
    || payload?.summary
    || payload?.body
    || payload?.text
    || payload?.last_assistant_message
    || payload?.statusMessage
    || '';

  const detailParts = [];
  if (payload?.cwd) {
    detailParts.push(`Dir: ${payload.cwd}`);
  }
  if (payload?.session_id) {
    detailParts.push(`Session: ${payload.session_id}`);
  }
  if (payload?.turn_id) {
    detailParts.push(`Turn: ${payload.turn_id}`);
  }

  let message = summary;
  if (!message) {
    try {
      message = JSON.stringify(payload);
    } catch (_) {
      message = 'Codex notification';
    }
  }
  if (detailParts.length > 0) {
    message = `${message}\n${detailParts.join(' | ')}`;
  }
  if (message.length > 500) {
    message = `${message.slice(0, 500)}...`;
  }
  return { title, message };
}

async function notifyViaBot(title, message, token, defaultChannel) {
  const channelId = await resolveChannelId(defaultChannel || '#general', token);
  const resp = await slackRequest(
    'chat.postMessage',
    {
      channel: channelId,
      text: `${title}: ${message}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: message } },
      ],
    },
    token
  );

  if (!resp.ok) {
    logError(`[SlackAPIError] ${resp.error}`);
  }
}

async function notifyViaWebhook(title, message, webhookUrl) {
  const body = JSON.stringify({ text: `*${title}*\n${message}` });
  const url = new URL(webhookUrl);

  await new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      () => resolve()
    );
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

function notifyDesktop(title, message) {
  if (process.platform === 'win32') {
    const safeTitle = title.replace(/'/g, "''");
    const safeMessage = message.replace(/'/g, "''").replace(/\r?\n/g, ' ');
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$n = New-Object System.Windows.Forms.NotifyIcon',
      '$n.Icon = [System.Drawing.SystemIcons]::Information',
      '$n.Visible = $true',
      `$n.ShowBalloonTip(8000, '${safeTitle}', '${safeMessage}', 'Info')`,
      'Start-Sleep 3',
      '$n.Dispose()',
    ].join('\n');
    spawnSync('powershell', ['-Command', script], { timeout: 8000 });
    return;
  }

  if (process.platform === 'darwin') {
    spawnSync('osascript', ['-e', `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`], { timeout: 8000 });
    return;
  }

  spawnSync('notify-send', [title, message], { timeout: 8000 });
}

(async () => {
  const payload = readPayload();
  if (!payload) {
    process.exit(0);
  }

  const { title, message } = buildMessage(payload);
  const botToken = process.env.CODEX_SLACK_BOT_TOKEN || process.env.CLAUDE_CODE_SLACK_BOT_TOKEN;
  const defaultChannel = process.env.CODEX_SLACK_DEFAULT_CHANNEL || process.env.CLAUDE_CODE_SLACK_DEFAULT_CHANNEL;
  const webhookUrl = process.env.CODEX_SLACK_WEBHOOK_URL || process.env.CLAUDE_CODE_SLACK_WEBHOOK_URL;

  try {
    if (botToken) {
      await notifyViaBot(title, message, botToken, defaultChannel);
    } else if (webhookUrl) {
      await notifyViaWebhook(title, message, webhookUrl);
    } else {
      notifyDesktop(title, message);
    }
  } catch (err) {
    logError(`[Error] ${err.message}`);
  }

  process.exit(0);
})();
