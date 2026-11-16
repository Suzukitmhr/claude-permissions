# Claude Code 利用イベント送信

## 対象と前提

計測は任意・デフォルトOFFです。Claude Codeのスキル呼出しとサブエージェント開始を、Bedrock／Team共通で計測します。処理の成功、成果、プラン所属の証明ではありません。Codexは対象外です。

Node.js 20以上と、個人のAWS CLI SSOプロファイルが必要です。AWS CLIの認証ファイルやトークンを収集APIに送ることはありません。共有アクセスキー、環境変数のアクセスキー、IMDSにはフォールバックしません。

## 利用者設定

`~/.claude/usage.json` を自分で作成します。インストーラーはこのファイルを作成・上書きしません。初めは `enabled: false` にして、送信項目・送信先・閲覧者・保存期間をチームに周知してから有効化してください。

```json
{
  "enabled": false,
  "endpoint": "https://YOUR_API_ID.execute-api.ap-northeast-1.amazonaws.com/prod/events",
  "region": "ap-northeast-1",
  "profile": "bedrock_sso"
}
```

`enabled` が厳密に `true` のときだけ動作します。送信先はHTTPSに限定し、URLのユーザー情報・クエリー・フラグメントを禁止します。リダイレクトは追従しません。AWSリージョンは収集APIのリージョンで、Bedrockのリージョンと異なっていても構いません。

送信先・認証プロファイルはホームの利用者設定からのみ読みます。PJ側に同名の設定項目を置いても反映されません。利用者設定とフックを変更できる人は送信先も変更できるため、管理配布時はOSのアクセス権で保護してください。

PJのルートに `.claude/usage.json` を作成します。

```json
{ "project_id": "PJ001" }
```

PJコードは英数字で始まる64文字以内の英数字・`_`・`.`・`-`です。フック入力の `cwd` から親へ検索し、最も近い設定を使用します。未登録のGitリポジトリ境界を越えて親PJへ紐付けません。設定が無い・不正なPJは送信しません。送信対象から外すにはこのファイルを削除します。スキル／エージェント名にも機密名を含めない運用にしてください。

接続先は、配布した `providers/bedrock.json`／`team.json` の `CLAUDE_USAGE_PROVIDER` で識別します。既存利用者は再インストールしてください。識別子が未設定なら推測せず送信しません。インストール時のTeam選択にも識別子を反映します。

```powershell
aws sso login --profile bedrock_sso
node "$HOME/.claude/hooks/usage.js" --check
claude --settings "$HOME/.claude/providers/team.json"
```

`--check` は利用者設定とSSO認証の取得を確認します。OFFなら認証取得しません。APIへのテストイベント送信や、API到達性・IAM権限・個人対応付けの確認は行いません。診断に認証情報や詳細なSDKエラーは表示しません。

## 計測経路と障害時

| イベント | 記録するもの |
|---|---|
| `PreToolUse` / `Skill` | `tool_input.skill` によるClaudeからの呼出し |
| `UserPromptExpansion` / `slash_command` | `command_name` による手動スキル・カスタムコマンドの展開 |
| `SubagentStart` | `agent_type` によるサブエージェント開始 |

手動コマンドがSkillツールのフックを通らない経路も対象にします。失敗・権限拒否された呼出しの試行や、後続フックが拒否したコマンドが含まれる可能性があります。`Read` でSKILL.mdを読むだけの操作は計測しません。

OFF時はフック入力を読み取らず、認証情報取得・通信・記録を行いません。有効時も入力全体やイベントをディスクに保存しません。通常フックは失敗しても終了コード0、標準出力・標準エラーなしで終了します。

認証取得とHTTP通信を合わせ、プロセス開始後5秒で打ち切ります（Claude側のフック上限は6秒）。SSOログイン画面は自動で開きません。再送・永続キューはなく、期限切れ・オフライン・429・5xxなどは欠測します。各呼出しでSSO認証情報を取得するためSSOサービスへの通信も発生し得ます。

## 受信API契約（別リポジトリ）

API Gateway **REST API** の対象POSTメソッドを `AWS_IAM` にし、`execute-api` サービスへのSigV4署名を検証します。利用者のSSO権限セットには対象stage・POST・パスへの `execute-api:Invoke` のみ付与します。IP制限はリソースポリシーで併用し、初版ではCloudFrontは使用しません。

`Content-Type: application/json`、本文は次の8項目だけです。Bearerトークン・自己申告のメンバーIDは使用しません。

```json
{
  "schema_version": 1,
  "event_id": "71123156-cd2a-44d9-bd11-87c9c0ed31ab",
  "occurred_at": "2026-11-16T01:00:00.000Z",
  "project_id": "PJ001",
  "provider": "team",
  "kind": "skill",
  "name": "review"
}
```

`event_id` は呼出しごとのUUID、`occurred_at` は端末時刻のUTC（受信側で受信日時も記録）、`provider` は `bedrock|team`、`kind` は `skill|subagent` です。名前は英数字で始まる200文字以内の英数字・`_`・`.`・`:`・`/`・`-`に限定します。未知の項目・不正な値は受信側も拒否します。

受信側は本文の申告ではなく、IAM認証済みの `requestContext.identity` から送信者を確定してください。共通のSSOロール名だけで個人を区別してはいけません。実環境で得られるprincipal・role session情報を確認し、信頼できる個人との対応表を確定するまでは本番集計を開始しません。SSOユーザーIDが自動でこのJSONに入るわけではありません。

成功は任意の2xx（推奨204、本文なし）。同じ `event_id` の再受信は重複保存せず成功を返す契約とします。受信側では許可した認証主体・PJを検証し、レート制限とサイズ上限（例8KiB）を設けます。Authorization・セッショントークン・本文全体をアクセスログやエラーログへ出力しないでください。会話・コード・引数・パス・Git URLは送信項目にありません。

## 開発・配布・受入検証

```text
npm ci
npm run build:usage
npm test
```

`src/usage*.js` を編集して `hooks/usage.js` を再生成し、バンドルもコミットします。既存のWindows／シェルインストーラーは `hooks/` 全体をコピーするため、インストール先でnpm installは不要です。ビルドにはesbuild、実行にはバンドルしたAWS公式SDKを使用します。

自動テストはモック認証・HTTPで署名・項目限定・無通信・異常系を検証します。実SSO／API／Claudeの結合検証は別途必要です。対象Claude Codeのバージョンを記録し、`/hooks` で3経路が登録されること、手動・自動スキル各1回とサブエージェント1回が重複なく届くこと、並列呼出し・Bedrock/Team切替・SSO期限切れ時の挙動を確認してください。特に `UserPromptExpansion` をサポートしないバージョンは手動呼出しを計測できないため、サポート版へ更新するまでは計測を有効化しないでください。未実測の最低対応バージョンは断定しません。
