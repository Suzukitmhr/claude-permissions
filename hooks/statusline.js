// statusLine: 接続先（Team / Bedrock）・モデル・エフォートを表示する。例: "Team | Opus | high"
// 引数に接続先（team | bedrock）を受け取り、stdin の statusLine JSON から
// model.display_name と effort.level を読む。providers/team.json / bedrock.json の statusLine から呼ばれる。
// JSON が読めない・項目が無い（エフォート非対応モデル等）場合は、その項目を省略する。
const LABELS = { team: 'Team', bedrock: 'Bedrock' };

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input) || {}; } catch { /* 空・不正 JSON は接続先だけ表示 */ }

  const parts = [
    LABELS[process.argv[2]],
    data.model && data.model.display_name,
    data.effort && data.effort.level,
  ].filter(Boolean);

  process.stdout.write(parts.join(' | '));
});
