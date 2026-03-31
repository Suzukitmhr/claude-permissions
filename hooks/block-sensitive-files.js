const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input?.tool_input?.path || '';

const blockedPatterns = [
  /\.env$/,
  /\.env\./,
  /appsettings\.json$/,
  /appsettings\..+\.json$/,
  /id_rsa$/,
  /id_ed25519$/,
  // AWS認証情報
  /[\/\\]\.aws[\/\\]credentials$/,
  /[\/\\]\.aws[\/\\]config$/,
  // 秘密鍵・証明書
  /\.pem$/,
  /\.key$/,
  /\.pfx$/,
  /\.p12$/,
  // Dockerシークレット
  /docker-compose\.yml$/,
  /docker-compose\..+\.yml$/,
];

const isBlocked = blockedPatterns.some(pattern => pattern.test(filePath));

if (isBlocked) {
  console.error(`BLOCKED: ${filePath} は読み込みが禁止されています`);
  process.exit(2); // exit code 2でClaudeにブロックを伝える
}

process.exit(0);