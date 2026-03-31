const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input?.tool_input?.path || '';

const blockedPatterns = [
  /\.env$/,
  /\.env\./,
  /appsettings\.(Staging|Production|Development)\.json$/,
  /id_rsa$/,
  /id_ed25519$/,
];

const isBlocked = blockedPatterns.some(pattern => pattern.test(filePath));

if (isBlocked) {
  console.error(`BLOCKED: ${filePath} は読み込みが禁止されています`);
  process.exit(2); // exit code 2でClaudeにブロックを伝える
}

process.exit(0);