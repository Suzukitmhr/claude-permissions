# 利用イベント受信API 機能要件書

仕様版: 1.0 / 作成日: 2026-11-17 / 関連: [Issue #6](https://github.com/Suzukitmhr/claude-permissions/issues/6)

## 1. 目的と管理方法

Claude Codeのスキル・サブエージェント利用について、「誰が・どのPJで・何を呼んだか」を集計できる最小のイベントを保存する。Bedrock／Team双方の送信を個人のAWS SSO認証で受け付ける。

本書を受信APIの要件の正本とし、このリポジトリでレビュー・変更履歴を管理する。実装は別リポジトリで行う。[実装指示文](usage-api-implementation-prompt.md)と本書の同じ版を実装担当へ渡す。別リポジトリに参照用コピーを置く場合は、取得元URL・コミットSHA・仕様版を記録し、要件変更は正本へ戻す。

送信側との接続方法は[利用ガイド](usage-events.md)、実装上の契約は `src/usage.js` と `src/usage-aws.js` を参照する。互換性のある明確化を除き、本書の作成を理由に送信側の項目を追加・変更しない。

## 2. 初版の範囲と構成

初版はイベントの受信・認証・認可・検証・重複防止・保存と運用手順を実装する。集計・一覧・CSV・ダッシュボード・管理画面・課金集計は後続とし、読み取りAPIは作らない。管理者による保存確認にはAWS CLI等を使用する。

```text
Claude Codeの計測フック（このリポジトリ）
  → HTTPS / SigV4署名
  → API Gateway REST API（Regional、AWS_IAM、IP制限）
  → 受信Lambda
  → DynamoDB（イベント、利用者登録）
```

実装の初期値は、TypeScript、Lambda Node.js 24、AWS SDK v3、AWS CDK v2（TypeScript）、東京リージョンとする。既存の実装先リポジトリに標準の言語・IaCがある場合はそれに合わせ、上記のAPI動作・認証・保存要件を維持する。技術選択の理由は実装先READMEに記載する。

CloudFront、Lambda Function URL、Cognito、独自Bearerトークン、API GatewayのAPIキーは初版では使用しない。開発用に無認証でアクセスできるAWS上の経路も作らない。

## 3. 認証・送信者の識別

### AUTH-01: IAM認証

- `POST /events` を `AWS_IAM` にする。`execute-api` 向けのSigV4署名をAPI Gatewayで検証し、Lambda内で署名検証を再実装しない。
- 許可するAWSアカウントとIdentity Center生成ロールの**完全なIAMロールARN**を環境ごとに列挙する。ロール名に `AWSReservedSSO_` があるだけでは許可しない。
- 利用者の権限セットには対象API・stage・POST・eventsだけの `execute-api:Invoke` を付与する。対象外ロールを明示的に拒否するリソースポリシーも定義し、同一アカウントの広いIAM権限による許可リストの迂回を防ぐ。
- IAM認証はAWS認証情報を検証するもので、SSOログイン操作そのものや実際にキーボードを操作した人を証明するものではない。許可するSSOロールと個人別セッションの運用を前提にする。

### AUTH-02: ネットワーク制限

- 許可する社内・VPNの送信元CIDRをAPI Gatewayのリソースポリシーに設定し、範囲外を明示的に拒否する。`X-Forwarded-For` など、送信者が指定できるヘッダーから判定しない。
- 許可リストが空ならデプロイ設定エラーとする。`0.0.0.0/0`・`::/0`への暗黙のフォールバックは禁止。IPv6を使う場合は許可範囲を明示する。
- IPが許可されていても、無署名・権限なし・登録なしの要求は受け付けない。

### AUTH-03: 個人との対応付け

- Lambda proxy integrationの認証済み `requestContext.identity.userArn` と `requestContext.identity.caller` を使用する。ヘッダー・本文のユーザー情報から補完しない。
- 両値が無い、想定するSTS assumed-role形式でない、または対応する有効な利用者登録が無い場合は403とし、イベントを保存しない。
- `subject_id = SHA-256(UTF-8(userArn + "\n" + caller))` の小文字16進表現を登録キーとする。文字の小文字化、セッション名の削除、メールアドレスらしい部分の推測は行わない。
- 登録候補は、本人が `aws sts get-caller-identity --profile <SSOプロファイル>` で取得した `Arn` と `UserId` から作成する。API Gatewayの実際のuserArn/callerとの一致は疎通で検証し、候補値が一致しない場合は自動補正せず識別検証へ戻る。このコマンドを呼出しごとの受信処理に追加しない。
- 利用者登録は `subject_id`、検証用の完全な `user_arn` と `caller`、安定した `member_id`、`enabled`、`allowed_project_ids` を持つ。`member_id` は英数字で始まる64文字以内の英数字・`_`・`.`・`-`とする。
- 同じ人が異なる許可プロファイルを使う場合は、別の `subject_id` を同じ `member_id` へ管理者が登録する。別人のセッションを同じメンバーへ自動統合しない。
- 毎回DynamoDBの強い整合性の読み取りで登録を確認し、初版ではキャッシュしない。無効化後に開始した要求は拒否する。既に検証中の要求の取り消しは保証しない。

### AUTH-04: 本番利用前の識別検証

同じSSOロールを使う2人で、API Gatewayが渡すARNとcallerが区別できること、同一人物の再ログイン後も登録が利用できることを検証する。本人・管理者による個人との対応付けを記録する。ログインし直すたびに識別子が変わるなど、安定した対応付けが成立しない場合は、この要件では本番利用を開始しない。ロール単位の記録や自己申告IDで代替せず、送信側を含む方式変更をこのリポジトリで検討する。

IAM Identity Centerの権限セットを再作成するとロールのARN等が変わる場合がある。APIの許可ロールと利用者登録を明示的に更新する。自動的に未知のロールを許可しない。

## 4. HTTP・入力契約

### API-01: エンドポイント

- `POST /events`。stageは環境ごとに `dev` または `prod`。例: `https://{apiId}.execute-api.ap-northeast-1.amazonaws.com/prod/events`。
- `Content-Type: application/json` を受け付ける。大文字小文字の差、および `charset=utf-8` の付与は許容する。それ以外のメディアタイプ・文字コードは415とする。
- デコード後の本文はUTF-8で最大8,192バイト。base64形式のproxy eventではデコードして検証する。不正なエンコード・JSONは400、上限超過は413とする。配列・null・文字列・JSON以外の本文は受け付けない。

### API-02: JSONスキーマ

次の7項目をすべて必須とし、追加項目は禁止する。型の自動変換や文字列のtrimは行わない。

| 項目 | 型・許容値 |
|---|---|
| `schema_version` | 数値の整数 `1` のみ |
| `event_id` | 小文字のUUID v4。`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` |
| `occurred_at` | 実在するUTC日時。`YYYY-MM-DDTHH:mm:ss.SSSZ`。パース後の `toISOString()` が元の値と一致すること |
| `project_id` | 文字列、`^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$` |
| `provider` | 文字列、`bedrock` または `team` |
| `kind` | 文字列、`skill` または `subagent` |
| `name` | 文字列、`^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$` |

```json
{
  "schema_version": 1,
  "event_id": "71123156-cd2a-44d9-bd11-87c9c0ed31ab",
  "occurred_at": "2026-11-17T01:00:00.000Z",
  "project_id": "PJ001",
  "provider": "team",
  "kind": "skill",
  "name": "review"
}
```

`member_id`・メール・会話・コード・ツール引数・ファイルパス・Git URLを本文に追加してはならない。スキーマ違反として拒否し、入力値はエラー応答やログへ戻さない。

`occurred_at` は端末の申告時刻で、受信側の時計ではない。初版では時計ずれによる日付範囲の拒否は行わず、別途 `received_at` をサーバーUTCで記録する。`provider`・PJ・機能名も送信側の申告であり、プランの所属・実行成功・実際の作業内容を保証しない。

### API-03: PJ認可

認証された利用者の `allowed_project_ids` に `project_id` が完全一致する場合だけ受け付ける。空リストは全拒否、`*` による全許可は初版では禁止する。PJ設定ファイルがあるだけで受信権限が得られる設計にはしない。

### API-04: 応答

| HTTP | 意味 |
|---|---|
| 204 | 永続保存済み、または同じイベントの同内容での再受信。本文なし |
| 400 | JSON・スキーマ・エンコード違反 |
| 403 | 認証・送信元・利用者・PJ権限の拒否 |
| 409 | 同じ利用者・イベントIDで内容が異なる要求 |
| 413 | 本文サイズ超過 |
| 415 | 非対応のContent-Type |
| 429 | API Gateway等によるスロットリング |
| 503 | 登録確認・保存等の依存サービス障害 |

Lambdaが返すエラーは `{ "code": "INVALID_EVENT", "request_id": "..." }` のような固定コードとサーバー生成の追跡IDだけにする。追跡IDにはLambdaの `context.awsRequestId` を使う。コードは `INVALID_EVENT`、`FORBIDDEN`、`EVENT_CONFLICT`、`PAYLOAD_TOO_LARGE`、`UNSUPPORTED_MEDIA_TYPE`、`SERVICE_UNAVAILABLE` とする。利用者の存在や入力内容、内部例外は返さない。API Gateway自身の署名拒否・未定義ルート等はGatewayの応答となり得るため、すべてのエラーを同じ本文にすることは要求しない。

2xxは保存完了後だけ返す。保存前の202、メモリに置いただけの成功、保存失敗の握りつぶしは禁止する。エラー応答にも `Cache-Control: no-store` を付ける。

## 5. 保存・重複防止

### DATA-01: テーブル

DynamoDBをオンデマンド・暗号化有効で使用する。環境ごとにイベント用と利用者登録用の2テーブルを作る。テーブル名はIaC出力から取得し、ソース内へ固定しない。イベントテーブルの主キーは文字列 `pk` とし、値を `MEMBER#{member_id}#EVENT#{event_id}` にする。利用者登録テーブルの主キーは文字列 `subject_id` とする。

イベントの保存項目は、検証済みの本文7項目、サーバーが確定した `member_id`・`subject_id`・`received_at`・`expires_at`、主キー `pk` に限定する。ARN・caller・トークン・IP・元のproxy eventはイベントに保存しない。ARNとcallerはアクセス制限された利用者登録だけに保持する。

### DATA-02: 冪等性

- 利用者・PJ権限とスキーマを検証してから、`attribute_not_exists(pk)` による条件付きPutを行う。
- 条件違反なら強い整合性で既存項目を読み、本文7項目がすべて同じなら204を返す。JSONのキー順には依存しない。
- 内容が異なる場合は409。既存項目を上書きしない。既存項目を読み取れない場合は503として成功扱いにしない。
- 重複時は `received_at` とTTLを更新しない。同じIDでも別の `member_id` なら別イベントとして保存する。
- 同時要求でも保存は1件とする。冪等性は保存期間内の既存レコードがある範囲で保証し、TTL等で消えた後の永久的な重複排除は対象外とする。

### DATA-03: 保持

初期値は受信日時から90日で、デプロイパラメーター `retentionDays` により変更可能とする。`expires_at` はUnix秒で設定し、DynamoDB TTLを有効にする。TTLは期限ちょうどの物理削除を保証しない。将来の読み取り・集計では期限切れ項目を除外する。

初版ではイベントの自動バックアップ・PITR・別ストレージへの複製を作らない。追加する際はコピー側の保持・削除方針も要件化する。スタック削除・置換では両テーブルを保持し、デプロイ操作で既存データを消さない。利用者登録のTTLは設けず、無効化・削除は管理者が行う。実運用の保持期間と閲覧者は本番有効化前に確定・周知する。

## 6. 運用・非機能要件

- 初期値: Lambdaメモリ256MiB、タイムアウト3秒、予約同時実行数10。API stageはレート20件/秒・バースト40件を初期値とする。すべてIaCパラメーター化する。API Gatewayのスロットリングは厳密な課金上限ではない。
- 送信側は認証取得を含め5秒で終了し、再送しない。受信側は小さな同期保存だけを行い、集計や外部ユーザー検索を呼出経路に入れない。負荷試験で通常の受信API応答p95が1秒以内になることを目標とする。
- Lambdaは登録のGetItemとイベントのPutItem/GetItem、および専用ログ・メトリクス出力だけに権限を限定する。利用者登録の更新・イベントの閲覧は管理者の別権限とする。
- Lambdaの直接呼出し権限を一般利用者へ付与しない。API Gatewayからの呼出し許可は対象API・stage・メソッド・パスに限定し、偽の `requestContext` を渡せる経路を公開しない。
- Lambdaのログは固定の処理結果コード、サーバー側request ID、処理時間に限定する。全イベント・本文・ヘッダー・内部例外のmessage/stackの一括ログ出力は禁止する。
- API Gatewayの本文トレースと実行ログを無効にし、アクセスログはサーバー側の拡張request ID・status・応答時間だけとする。IP・ARN・caller・署名ヘッダーをアクセスログへ追加しない。分散トレーシングは初版では無効にする。
- ログ保持は初期30日。API件数・4xx/5xx・Lambda Errors/Duration/Throttlesと、受信処理の `accepted`・`duplicate`・`rejected`・`failed` の件数を確認できるようにする。メトリクスに利用者・PJ・名前をdimensionとして載せない。
- API 5xxまたはLambda Errorsが5分に1件以上でアラーム状態にする。通知先は環境パラメーターとして、実際の通知先が指定された場合だけ接続する。
- IaCで再現可能にし、リージョン・stage・許可ロール・許可CIDR・保持期間・制限値・通知先を指定できるようにする。空の許可ロール・CIDR、環境名の重複はデプロイ前に拒否する。
- 実アカウントID、個人のARN/caller対応表、社内CIDR、実イベントは公開リポジトリへコミットしない。例は架空値を使い、実設定は管理者が保護したローカル設定またはデプロイ基盤から渡す。

## 7. 管理手順・納品物

実装先は、アプリ、IaC、ロックファイル、テスト、APIスキーマ、README、運用手順を提供する。以下を手順に含める。

1. 環境別設定の作成、ビルド・テスト・IaCのsynth/diff。
2. 許可SSOロールへの最小権限付与、CIDR設定とデプロイ。
3. 安全な検証環境での認証済みセッション情報の確認と利用者登録。イベントやヘッダーを本番ログへ丸ごと出す手順は使用しない。実データ入りの登録ファイルはGit管理しない。
4. 利用者の有効化・無効化、PJ権限追加・削除、ロール再作成時の再登録。登録操作は管理用CLIスクリプトまたは再現できるAWS CLI手順で提供し、管理APIは作らない。
5. 既存フックへの設定反映、疎通、保存件数・個人対応付けの確認。
6. アラーム・認証拒否・429・依存障害の調査、送信側OFFによる収集停止、データを残すロールバック。

IaC出力には送信URL、APIリージョン、SSO権限セットに付与するInvokeポリシーの対象ARN、両テーブル名を含める。実設定を埋めない送信側 `usage.json` の記入例も提供する。送信側設定を自動的に有効化しない。

## 8. 受入条件

| ID | シナリオと期待結果 |
|---|---|
| AT-01 | 許可IP・登録済みSSOセッション・許可PJの正常イベント → 204、永続保存1件、本文7項目とサーバー確定の個人が一致 |
| AT-02 | Bedrock/Team、skill/subagentの全組合せ → 既存フックと互換性のある入力を受理 |
| AT-03 | 無署名・改ざん署名・期限切れ認証・許可外アカウント/ロール・許可外IP → 保存なし。ネットワーク/IAMの拒否は実APIで確認 |
| AT-04 | ARN/caller欠落、未登録・無効利用者、同じ共通ロールの別セッション → 自己申告で補完せず403 |
| AT-05 | 許可外PJ・空のPJ権限 → 403。無効化後の次回要求も拒否 |
| AT-06 | 必須欠落、追加キー、誤った型、未知の版/enum、正規表現違反、実在しない日付 → 400。入力値を応答・ログへ出さない |
| AT-07 | 不正JSON/UTF-8/base64、配列/null/プリミティブ → 400。Content-Type非対応 → 415。本文8,192バイトはサイズ検証を通り、8,193バイトは413 |
| AT-08 | 同内容・同IDの直列/並列再送 → 全て204、保存1件、最初の受信日時とTTLを維持 |
| AT-09 | 同メンバー・同IDの異なる本文 → 409、上書きなし。別メンバーの同IDは別レコード |
| AT-10 | 登録の取得失敗、DynamoDB保存失敗、重複照合の取得失敗 → 503。保存前に2xxを返さない |
| AT-11 | 端末時刻がずれた正常形式のイベント → 受理し、received_atと保持期限はサーバー時刻から算出 |
| AT-12 | TTL設定、テーブル保持、最小権限、IAM必須、許可リスト外の明示拒否、ログの機密除外をIaCテストで確認 |
| AT-13 | 同じSSOロールの2人を区別し、同一人物の再ログインで同じメンバーへ対応付くことを実測して証跡を残す |
| AT-14 | 実Claudeで手動スキル・自動スキル・サブエージェント各1回が届くことを確認し、Claude Codeの版・件数・重複有無を記録する |
| AT-15 | OFF・未登録PJでは受信なし。SSO期限切れ・オフラインでもClaudeが停止せず、欠測する既存動作を確認 |

自動テストで検証できるものは実装先のCIに組み込む。実SSO・IP・実Claudeを使わないテストだけでAT-03/13/14を完了扱いにしない。環境が無ければ未検証項目と実施手順を明示し、本番受入とは分けて報告する。

## 9. 本番投入時に指定する値

API用AWSアカウント、リージョン（既定 `ap-northeast-1`）、stage、許可SSOロールARN一覧、許可CIDR一覧、利用者と認証済みセッションの対応表、利用者ごとの許可PJ、保持期間（既定90日）、管理者・閲覧者、任意の通知先を管理者から受け取る。実装中に架空の実値で穴埋めして本番デプロイしない。

## 10. 参照した公式仕様

- [API GatewayのIAM認証](https://docs.aws.amazon.com/apigateway/latest/developerguide/permissions.html)
- [API Gatewayの認証済みcontext変数](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html)
- [AWS CLIによる呼出者の確認](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html)
- [リソースポリシーとIP制限](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-examples.html)
- [Identity CenterロールのARNと再作成](https://docs.aws.amazon.com/singlesignon/latest/userguide/referencingpermissionsets.html)
- [LambdaのNode.jsランタイム](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [DynamoDB TTLの削除タイミング](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [API Gatewayのスロットリング](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html)

確認日: 2026-11-17。上記のサービス仕様と、本書で選択した構成・制限値・保持期間は区別する。
