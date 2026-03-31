const fs = require('fs');

let input;
try {
  const data = fs.readFileSync(0, 'utf8').trim();
  if (!data) {
    process.exit(0);
  }
  input = JSON.parse(data);
} catch (err) {
  console.error(`[Hook Error] block-sensitive-files.js: JSON parse failed: ${err.message}`);
  process.exit(1);
}

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
  process.exit(2);
}

process.exit(0);
