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
--
-- ── なぜ条件を付けたか（2026-09-09）──
-- この索引は **0011 で外している**（講座が増えると「1人1件」は成り立たない）。
-- ところが apply-all.sql は 0001 から順に流し直すので、
-- **一度 0011 まで進んだ本番に流すと、ここで作り直そうとして落ちる。**
--   ERROR: could not create unique index "enrollments_one_per_user_idx"
--   DETAIL: Key (user_id)=(…) is duplicated.
-- 2つ以上の講座を受けている人が1人でも居れば、必ずここで止まる
-- （げんきさんの本番で 0034 を流したときに出た）。
--
-- このファイルの約束は「何度実行しても壊れない」こと。
-- **0011 まで進んでいるデータベースでは、はじめから作らない。**
-- 見分けは enrollments.course_id（0011 が足す列）があるかどうか。
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enrollments' and column_name = 'course_id'
  ) then
    create unique index if not exists enrollments_one_per_user_idx
      on public.enrollments (user_id)
      where seat_id is null;
  end if;
end $$;
