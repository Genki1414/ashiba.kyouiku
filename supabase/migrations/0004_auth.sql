-- 0004_auth.sql
-- ログイン（Supabase Auth）を入れたときの受け皿。
--
-- auth.users に行ができたら public.users を作る。
-- public.users.name は NOT NULL なので、登録時に入れてもらった氏名を使う。
-- 入っていなければ仮の名前を入れておき、受講の準備の画面で本人に直してもらう。

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- すでに auth.users にいて public.users が無い人を拾う（入れ忘れの後追い）
insert into public.users (id, name, email)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
       u.email
from auth.users u
left join public.users p on p.id = u.id
where p.id is null;

-- ── 受講（enrollments）を1人1件だけにする ──
-- いまは決済がまだ無いので、ログインした人に1件だけ受講を作る。
-- 席（seats）を売る形になったら、seat_id を必須にしてここを外す。
create unique index if not exists enrollments_one_per_user_idx
  on public.enrollments (user_id)
  where seat_id is null;
