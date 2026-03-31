const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const command = input?.tool_input?.command || '';

const blockedPatterns = [
  /\.env(\s|$|\.)/,
  /appsettings\.(Staging|Production|Development)\.json/,
  /id_rsa/,
  /id_ed25519/,
];

const isBlocked = blockedPatterns.some(pattern => pattern.test(command));

if (isBlocked) {
  console.error(`BLOCKED: 機密ファイルへのBashアクセスは禁止されています\nコマンド: ${command}`);
  process.exit(2);
}

process.exit(0);