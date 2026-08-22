-- 0006_version.sql
-- いまデータベースに入っている版を返すだけの関数。
--
-- 「apply-all.sql を流したかどうか」を画面（/setup）から見るために使います。
-- 手を入れて新しいマイグレーションを足したら、下の数字を上げてください。

create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0006'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
