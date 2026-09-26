# チーム12 サポーターズハッカソン

## 開発環境の起動

```bash
npm install
npm run dev
```

## Supabase 環境変数

`your-project-ref` と `your-anon-key` は、Supabase ダッシュボードの
`Project Settings > API` で確認できます。

ローカル開発用の `.env` は Git 管理しないでください。

## Edge Functions デプロイ時の環境変数

Edge Functions をデプロイする際の環境変数は、
`supabase/functions/<function-name>/.env` ではなく、
Supabase プロジェクトのシークレットとして設定します。

```bash
supabase secrets set KEY_NAME=VALUE --project-ref your-project-ref
```

必要に応じて複数キーを同時に設定できます。

```bash
supabase secrets set \
	SUPABASE_URL=https://your-project-ref.supabase.co \
	SUPABASE_ANON_KEY=your-anon-key \
	OPENAI_API_KEY=your-openai-api-key \
	--project-ref your-project-ref
```

これにより、デプロイされた Edge Function がこれらの環境変数を安全に利用できるようになります。

更新内容の確認:

```bash
supabase secrets list --project-ref your-project-ref
```

#### 動作確認

このステップが完了したか確認するには、Edge Function をローカルで実行し、テストリクエストを送ります。

1. Edge Function のローカル実行

プロジェクトのルートディレクトリで以下を実行します。

```bash
supabase functions serve private-notes --no-verify-jwt
```

`--no-verify-jwt` オプションは、ローカル開発時に認証トークンの検証をスキップするために使用されます。

2. 別ターミナルからテストリクエスト送信

```bash
curl http://localhost:54321/functions/v1/private-notes
```

期待される出力:

```json
{"message":"Private notes function is running!"}
```

このレスポンスが返ってくれば、Supabase Edge Function の初期設定が正しく行われ、
Supabase クライアントも問題なく初期化されていることを確認できます。

補足: `supabase functions serve` のローカル実行には Docker Desktop または Podman が必要です。

CLI バージョンによっては `supabase functions serve --watch` が未対応です。
その場合は次を使ってください。

```bash
supabase functions serve get-private-notes --no-verify-jwt
```

デプロイ前に未リンクの場合は、先に `supabase link --project-ref your-project-ref` を実行します。

## ステップ2: 個人メモの参照（Read）APIの実装とテスト

### 目的

リクエスト元ユーザーが作成した、指定ターゲットユーザー向けのメモを `user_private_notes` から取得する Edge Function を実装します。RLS が `auth.uid()` に基づいて適用され、自身のメモのみ参照できることを確認します。

### 実装手順

1. Edge Function ファイルの作成

```bash
mkdir -p supabase/functions/get-private-notes
touch supabase/functions/get-private-notes/index.ts
```

2. Edge Function の実装

`supabase/functions/get-private-notes/index.ts` に、Authorization ヘッダーから JWT を受け取り、`target_user_id` を条件に `user_private_notes` を参照する処理を実装します。

3. Edge Function のデプロイ

```bash
supabase functions deploy get-private-notes --no-verify-jwt
```

`--no-verify-jwt` フラグにより、JWT 検証は Postgres の RLS 側に委ねられ、Edge Function 内で独自の検証ロジックを持たなくても安全に制御できます。

### 動作確認

以下はデプロイ済みの `get-private-notes` を対象にした確認手順です。

### シナリオ1: 認証済みユーザーAとして、ユーザーBへの自身のメモを参照

```bash
curl -X GET 'YOUR_SUPABASE_URL/functions/v1/get-private-notes?target_user_id=<USER_B_UID>' \
-H 'Authorization: Bearer <USER_A_JWT>' \
-H 'Content-Type: application/json'
```

期待される結果: ユーザーAがユーザーBに対して作成したメモのリストが返されます。

### シナリオ2: 認証済みユーザーCとして、ユーザーBへのユーザーAのメモを参照

```bash
curl -X GET 'YOUR_SUPABASE_URL/functions/v1/get-private-notes?target_user_id=<USER_B_UID>' \
-H 'Authorization: Bearer <USER_C_JWT>' \
-H 'Content-Type: application/json'
```

期待される結果: ユーザーCがユーザーBに対して作成したメモのリストが返されます（ユーザーAのメモは含まれません）。ユーザーCがユーザーBに対してメモを作成していなければ、空の配列 `[]` が返されます。これはRLSが正しく機能していることを示します。

### シナリオ3: 認証なしでアクセス

```bash
curl -X GET 'YOUR_SUPABASE_URL/functions/v1/get-private-notes?target_user_id=<ANY_USER_UID>' \
-H 'Content-Type: application/json'
```

期待される結果: `401 Unauthorized` エラー、または `Authorization header missing` という内容のエラーレスポンスが返されます。

### シナリオ4: target_user_id パラメータなしでアクセス

```bash
curl -X GET 'YOUR_SUPABASE_URL/functions/v1/get-private-notes' \
-H 'Authorization: Bearer <ANY_VALID_JWT>' \
-H 'Content-Type: application/json'
```

期待される結果: `400 Bad Request` エラー、または `target_user_id is required` という内容のエラーレスポンスが返されます。

## ステップ3: 個人メモの作成（Create）APIの実装とテスト

### 目的

認証済みユーザーが指定した `target_user_id` に対して、`user_private_notes` に非公開メモを作成できることを確認します。メモ本文は最大 1,000 文字とし、作成者は `author_user_id` として記録されます。

### 実装手順

1. Edge Function の作成

```bash
supabase functions new create-private-note
```

2. Edge Function の実装

`supabase/functions/create-private-note/index.ts` に、`Authorization` ヘッダーから JWT を受け取り、`target_user_id` と `note_content` を検証して `user_private_notes` に挿入する処理を実装します。

3. Edge Function のデプロイ

```bash
supabase functions deploy create-private-note --no-verify-jwt
```

### 動作確認

`Authorization` ありで `target_user_id` と `note_content` を送ると 201 が返り、認証なしでは 401、本文が 1,000 文字を超えると 400 が返ります。

## ステップ4: 個人メモの更新（Update）および削除（Delete）APIの実装とテスト

### 目的

認証済みユーザーが自身のメモのみを更新・削除できることを、RLS と Edge Function の両方で確認します。更新と削除は `author_user_id` を基準に制御します。

### 実装手順

1. 更新用 Edge Function のデプロイ

```bash
supabase functions deploy update_note --no-verify-jwt
```

2. 削除用 Edge Function のデプロイ

```bash
supabase functions deploy delete_note --no-verify-jwt
```

### 動作確認

ローカル実行時は次のコマンドで関数を起動します。

```bash
supabase functions serve --no-verify-jwt --workdir .
```

更新は `note_id` と `note_content` を POST し、削除は `note_id` を POST します。成功時は更新が 200、削除が 200 になります。別ユーザーの JWT で同じ `note_id` を操作すると、`Note not found or you do not have permission...` の 404 が返ります。

RLS の更新・削除ポリシーは `supabase/migrations/20260927000000_add_private_note_update_delete_policies.sql` に追加済みです。
