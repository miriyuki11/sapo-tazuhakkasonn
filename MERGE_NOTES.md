# 統合版メモ

このプロジェクトは以下の2つを統合したものです。

- `sapo-tazuhakkasonn-main`：Supabase認証、公開プロフィール、プライベートノート、元のチームAPIなど
- `team-profile-app-merged`：Slack風UI、チーム管理、プロフィール、/intro画面

## 統合内容

- Slack風の共通レイアウト（サイドバー / トップバー）を採用
- `/teams`、`/teams/new`、`/teams/[teamId]`、`/teams/[teamId]/edit` を追加
- `/profile` はSlack側のプロフィール画面
- 元のSupabaseプロフィール編集画面は `/profile/settings` に保持
- `/intro` とメンバー詳細・プライベートノートUIを統合
- 元アプリの `/login`、`/auth`、公開プロフィール等を保持
- `/api/team` 系の既存APIを保持
- Slack UI側が利用する `/api/teams`、`/api/users/*` のローカルアダプターを追加
- `lib/api.ts` はSupabase認証用 `withAuth` とフロントAPI通信を統合
- `NEXT_PUBLIC_API_URL` が未設定の場合は同一Next.jsアプリの `/api/...` を利用

## 注意

`/api/users/me/profile` と `/api/users/*/notes` の新規アダプターは、統合確認用のインメモリ実装です。
本番運用ではSupabase/DBへの永続化処理へ置き換えてください。

## 起動

```bash
npm install
npm run dev
```

Supabaseを利用する場合は `.env.example` を参考に環境変数を設定してください。
