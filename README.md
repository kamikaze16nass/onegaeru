# おねがえる MVP

お願いを相手へ「ぴょん」と送り、やりたくないお願いにはKPを乗せてカエせる、1対1の共有TODOアプリです。

## MVPでできること

- メールアドレス／パスワードによる登録とログイン
- 8文字の招待コードによる1対1のペア作成
- 任意の期限を付けたお願いの送信（1ユーザー1日3件）
- 「やる！」または「カエす！」の選択
- 初回10KP以上、以降は直前額＋10KP以上の競り上がり
- 「やったよ！」と「見たよ、ありがとう！」による二段階完了
- 完了者への積み上げKP付与とKP履歴
- ペア外のユーザーを遮断するRLS

## セットアップ

必要環境はNode.js 20.19以上または22.12以上です。

1. Supabaseで新しいプロジェクトを作ります。
2. SQL Editorで [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) を実行します。
3. `.env.example`を`.env.local`へコピーし、Project URLとPublishable Keyを設定します。
4. `npm install`、続いて`npm run dev`を実行します。

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

登録直後にログインできるようにする場合は、SupabaseのAuthentication設定でメール確認を無効にしてください。有効のまま使う場合は、届いた確認メールから登録を完了します。

すでに初期マイグレーションを適用した環境で招待コード生成を修正する場合は、SQL Editorで [`supabase/migrations/002_fix_invite_code_generation.sql`](supabase/migrations/002_fix_invite_code_generation.sql) のみを実行してください。

## 設計

画面はReactコンポーネント、通信は`src/lib/api.ts`、認証クライアントは`src/lib/supabase.ts`へ分離しています。カエルの仮キャラクターは`FrogMascot`だけを差し替えれば変更できます。

残高更新や状態遷移はブラウザからテーブルを直接更新せず、PostgreSQL関数内のトランザクションとして実行します。これにより同時操作によるKPの二重消費・二重付与を防ぎます。

## ぴょんぴょん

KP画面の「KPをふやす」から遊べるミニゲームです。追加migrationの適用順・難易度設定・検証方法は [supabase/PYON.md](supabase/PYON.md) を参照してください。

## 開発コマンド

- `npm run dev` — 開発サーバー
- `npm run build` — 型検査と本番ビルド
- `npm run typecheck` — TypeScript型検査
