const fs = require('fs');
const { SENSITIVE_FILE_RULES, DANGEROUS_COMMAND_RULES } = require('./patterns');

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

const sensitiveMatch = SENSITIVE_FILE_RULES.find(rule => rule.bashPattern.test(command));
if (sensitiveMatch) {
  console.error(`BLOCKED: 機密ファイルへの Bash アクセスは禁止されています (${sensitiveMatch.label})\nコマンド: ${command}`);
  process.exit(2);
}

const dangerousMatch = DANGEROUS_COMMAND_RULES.find(rule => rule.pattern.test(command));
if (dangerousMatch) {
  console.error(`BLOCKED: 危険な Bash コマンドは禁止されています (${dangerousMatch.label})\nコマンド: ${command}`);
  process.exit(2);
}

process.exit(0);
