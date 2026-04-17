# Global AGENTS.md for Codex CLI

このファイルは `~/.codex/AGENTS.md` に配置されるグローバル既定です。
リポジトリごとの詳細な文脈は、各プロジェクトの `AGENTS.md` または `CLAUDE.md` を優先してください。

## Working Style

- 変更は最小限かつ安全側に寄せる
- まずリポジトリの構成と既存パターンを読んでから編集する
- 検索は `rg` / `rg --files` を優先する
- 無関係な差分は戻さない

## Safety

- `git push` / `git reset` / `git rebase` / `sudo` / `rm -rf` は明示的な指示なしで実行しない
- `curl` / `wget` のような外部ネットワーク取得は必要性を説明できる場合だけ使う
- `.env`、`.aws/credentials`、秘密鍵、証明書、環境依存の設定ファイルは読まない・書かない

## Execution

- 変更後は対象に近い最小の検証を行う
- 失敗した検証は黙って飛ばさず、原因と未確認点を報告する
