# マイグレーションの検証

Supabase を立てずに、素の PostgreSQL 16 で構文と業務ルールだけ確かめる手順。
`00-supabase-shim.sql` が `auth.users` / `auth.uid()` / `auth.role()` を代用する。

```sh
D=/var/tmp/pgtest
mkdir -p $D && chown postgres:postgres $D && chmod 700 $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start"

su postgres -c "psql -h $D -U postgres -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_rules.sql \
  -f supabase/tests/rules.sql"
```

`rules.sql` が確かめること（いずれも NOTICE で expected: … と出れば通過）

| # | 内容 |
|---|---|
| 1 | 1,000秒と申告しても、実経過を超えては加算されない |
| 2 | 規定時間に達するまで確認問題を合格にできない |
| 3 | 規定時間に達すれば合格できる |
| 4 | 未入金の注文では修了証を発行できない |
| 5 | 入金後は発行できる |
| 6 | 他人の受講の視聴時間は加算できない |
| 7 | 受講者が自分の所属・権限を書き換えられない |
| 8 | `status='paid'` と `paid_at` の不整合が入らない |

---

## 教育担当者の画面が使う問い合わせの検証

`tests/admin-db.mts` は、アプリが実際に投げる問い合わせ（表名・列名・絞り込み）を
本物のスキーマに当てて確かめる。PostgREST 互換 shim を挟むので、
`@supabase/supabase-js` の書き方そのままで試験できる。

```sh
D=/var/tmp/pgtest
mkdir -p $D && chown postgres:postgres $D && chmod 700 $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data \
  -o \"-k $D -c listen_addresses=127.0.0.1 -p 55432\" -l $D/log start"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -c 'create database appdb'"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -d appdb -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql -f supabase/apply-all.sql"

node tests/postgrest-shim.mjs 54321 postgres://postgres@127.0.0.1:55432/appdb &
npm run test:admindb
```

確かめること

| # | 内容 |
|---|---|
| 1 | apply-all.sql（0001〜0007）が素の PostgreSQL で通る |
| 2 | ログインの行を作ると、トリガが受講者の行を作る（氏名も入る） |
| 3 | 事業者が1社だけなら自動で所属する。2社以上なら空のまま |
| 4 | 実務トレーニングの成績が書ける。知らない章・100点超は入らない |
| 5 | 担当者の一覧の問い合わせが、表と列に噛み合っている |
| 6 | 修了証は1受講に1枚。取り消せば出し直せる。記録は残る |
| 7 | 担当者の任命・解任が通る |

RLS そのものはここでは見ていない（shim は service_role として動く）。
RLS は `supabase/tests/rules.sql` が受け持つ。

## お知らせ（0024）

`notices.sql` は、全部の版を流したあとに当てる（`apply-all.sql` を使う）。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql
psql -d appdb -q -t -A -f supabase/tests/notices.sql
```

最後に「24 件通過 / 0 件失敗」と出れば通っている。

| # | 内容 |
|---|---|
| ① | 知らせを1件足せる |
| ② | 同じ返事を続けて2回押しても1行（60秒のあいだ） |
| ③④⑤ | 種類・講座・宛先が違えば、別の行になる |
| ⑥ | 押し直すと、あとの一言で上書きされ、未読に戻る |
| ⑦ | 時間が空いた同じ返事は、別の出来事として並ぶ |
| ⑧ | 宛先や種類が空でも落ちない（作らないだけ） |
| ⑨ | 読んだ印は、その人のぶんだけ付く |
| ⑩ | 古い知らせを捨てられる |
| ⑪ | 人を消したら、その人あての知らせも消える |
| ⑫ | **ログインした人からは、自分あての知らせを作れない** |

## 実技の関門（0023 の drill）

`drill.sql` も、全部の版を流したあとに当てる。

学科だけで修了証を出せば、実技を受けていない人が
「資格がある」と思って現場に出る。

**実技のある講座は増える。講座は `-v course=...` で渡す**（既定は高所作業車）。
単元の数と時間は渡さず、`courses` 表と突き合わせる。
渡すと、渡した数字が間違っていたときに気づけない。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql

psql -d appdb -q -t -A -f supabase/tests/drill.sql                   # 高所作業車
psql -d appdb -q -t -A -v course=harness -f supabase/tests/drill.sql # フルハーネス
psql -d appdb -q -t -A -v course=rope -f supabase/tests/drill.sql    # ロープ高所作業
```

それぞれ「28 件通過 / 0 件失敗」と出れば通っている。
**実技のある講座を足したら、その講座でも回すこと。**

| # | 内容 |
|---|---|
| ① | 講座と単元が入っていて、**単元の合計＝講座の総時間**（courses 表と突き合わせ） |
| ② | 実技の実施日と実施者が、申請と一緒に残る |
| ③ | **出しただけでは通っていない**（＝修了証は出ない） |
| ④ | 断れる。理由が本人に届く |
| ⑤ | 出し直せる。日と人が入れ替わり、前の理由は消える |
| ⑥ | 実技の講座に、討議の候補日は出ない |
| ⑦ | 本部が通してはじめて修了。通しても実技の記録は残る |
| ⑧ | 通ったあとに出し直せない（修了の取り消しになる） |
| ⑨ | 知らない関門（talk / drill 以外）ははじく |
| ⑩ | **ログインした人から、自分の申請を直に通せない** |
| ⑪ | 受講を消したら申請も消える（3年で消すときに残らない） |

画面側は `npm run test:issue` と `node tests/e2e-issue.mjs` が見ている。
