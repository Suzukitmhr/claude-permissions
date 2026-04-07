const fs = require('fs');
const { fileBlockPatterns } = require('./patterns');

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

const isBlocked = fileBlockPatterns.some(pattern => pattern.test(filePath));

if (isBlocked) {
  console.error(`BLOCKED: ${filePath} は読み込みが禁止されています`);
  process.exit(2);
}

process.exit(0);
