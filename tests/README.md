# 検証

| ファイル | 何を確かめるか | 前提 |
|---|---|---|
| `e2e-lesson.mjs` | 受講画面（1単元が最後まで通る） | 実ブラウザ。端末内記録モード |
| `e2e-prep-exam.mjs` | 同意→本人確認→受講中の照合→修了試験 | 実ブラウザ＋フェイクカメラ |
| `supabase-mode.mjs` | サーバ記録モードで、記録が実際に DB の行になること | DB接続が必要 |
| `postgrest-shim.mjs` | 検証用の PostgREST 互換サーバ（本物ではない） | ローカル PostgreSQL |

## E2E（実ブラウザ）

```sh
npm run dev -- -p 3100
node tests/e2e-lesson.mjs
node tests/e2e-prep-exam.mjs
```

サーバ記録モード（`.env.local` あり）で実行すると、
画面から視聴時間を飛ばせない部分は SKIP して終わります。
その範囲は `supabase-mode.mjs` が受け持ちます。

## サーバ記録モード

本物の Supabase に対して実行する場合：

```sh
npm run dev -- -p 3100
PG_URL="<Supabaseの接続文字列>" node tests/supabase-mode.mjs
```

確かめること（12件）

- `/api/health` がサーバ記録モードを報告する
- 単元を開いてから見た時間が、初回の同期でも取りこぼされない
- 申告を盛っても実経過ぶんしか加算されない／桁外れの申告は API が拒否
- 規定時間の未達を DB が拒否する（409）／到達後は合格を記録できる
- 照合ログ4種が入り、不正な理由は拒否される
- 修了試験の出題に正解が含まれない／採点はサーバ／改ざんトークンは拒否
- `exams` に受験回（attempt）が採番される
- 未入金では修了証を発行できない

## Supabase 無しでの検証（この開発環境で使った手順）

`supabase.co` へ出られない環境では、ローカル PostgreSQL と
PostgREST 互換 shim で同じ経路を通せる。
**shim は本物の PostgREST ではない**ので、これで確かめられるのは
「アプリのクエリがスキーマと矛盾しないこと」まで。

```sh
D=/var/tmp/pgtest
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data \
  -o '-k $D -c listen_addresses=127.0.0.1 -p 55432' -l $D/log start"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -c 'create database appdb'"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -d appdb \
  -f supabase/tests/00-supabase-shim.sql -f supabase/apply-all.sql"

node tests/postgrest-shim.mjs 54321 postgres://postgres@127.0.0.1:55432/appdb &
# .env.local に NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 などを書いて
npm run dev -- -p 3100
node tests/supabase-mode.mjs
```
