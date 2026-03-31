const fs = require('fs');

let input;
try {
  const data = fs.readFileSync(0, 'utf8').trim();
  if (!data) {
    process.exit(0);
  }
  input = JSON.parse(data);
} catch (err) {
  console.error(`[Hook Error] block-sensitive-bash.js: JSON parse failed: ${err.message}`);
  process.exit(1);
}

const command = input?.tool_input?.command || '';

const blockedPatterns = [
  /\.env(\s|$|\.)/,
  /appsettings\.json/,
  /appsettings\..+\.json/,
  /ssc-connections\.json/,
  /ssc-connections\..+\.json/,
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
  // 設定ファイル
  /config\.xml/,
];

const isBlocked = blockedPatterns.some(pattern => pattern.test(command));

if (isBlocked) {
  console.error(`BLOCKED: 機密ファイルへのBashアクセスは禁止されています\nコマンド: ${command}`);
  process.exit(2);
}

process.exit(0);
