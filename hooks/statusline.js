// statusLine: 引数が team のときだけ "Team" を表示する（bedrock のときは何も表示しない）。
// providers/team.json / bedrock.json の statusLine から呼ばれる。
if (process.argv[2] === 'team') process.stdout.write('Team');
