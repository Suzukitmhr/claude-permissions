const fs = require('fs');
const { bashBlockPatterns } = require('./patterns');

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

const isBlocked = bashBlockPatterns.some(pattern => pattern.test(command));

if (isBlocked) {
  console.error(`BLOCKED: 機密ファイルへのBashアクセスは禁止されています\nコマンド: ${command}`);
  process.exit(2);
}

process.exit(0);
