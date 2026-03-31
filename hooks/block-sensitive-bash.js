const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const command = input?.tool_input?.command || '';

const blockedPatterns = [
  /\.env(\s|$|\.)/,
  /appsettings\.json/,
  /appsettings\..+\.json/,
  /id_rsa/,
  /id_ed25519/,
  // AWS認証情報
  /\.aws[\/\\]credentials/,
  /\.aws[\/\\]config/,
  // 秘密鍵・証明書
  /\.pem(\s|$)/,
  /\.key(\s|$)/,
  /\.pfx(\s|$)/,
  /\.p12(\s|$)/,
  // Dockerシークレット
  /docker-compose\.yml/,
  /docker-compose\..+\.yml/,
];

const isBlocked = blockedPatterns.some(pattern => pattern.test(command));

if (isBlocked) {
  console.error(`BLOCKED: 機密ファイルへのBashアクセスは禁止されています\nコマンド: ${command}`);
  process.exit(2);
}

process.exit(0);