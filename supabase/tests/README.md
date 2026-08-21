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
