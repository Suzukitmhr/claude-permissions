const fs = require('fs');
const https = require('https');
const { spawnSync } = require('child_process');

let input;
try {
  const data = fs.readFileSync(0, 'utf8').trim();
  if (!data) process.exit(0);
  input = JSON.parse(data);
} catch (_) {
  process.exit(0);
}

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

const webhookUrl = process.env.CLAUDE_CODE_SLACK_WEBHOOK_URL;

if (webhookUrl) {
  // Slack notification
  try {
    const text = `*${title}*\n${message}`;
    const body = JSON.stringify({ text });
    const url = new URL(webhookUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    });
    req.on('error', () => {});
    req.write(body);
    req.end();
    // Wait briefly for the request to be sent before exiting
    setTimeout(() => process.exit(0), 500);
  } catch (_) {
    process.exit(0);
  }
} else {
  // Fallback: Windows balloon notification (same pattern as check-version.js lines 87-95)
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
  process.exit(0);
}
