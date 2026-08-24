-- 0007_admin.sql
-- 教育担当者の画面のための追加。
--
-- ① 実務トレーニング（第1〜3章）の成績を、端末だけでなくサーバにも残す。
--    いままでは端末の中だけだったので、教育担当者からは誰が何をやったか見えなかった。
-- ② 受講者を事業者に紐づける。担当者が見られるのは自社の受講者だけ（RLS は 0002 のまま）。

-- ── 実務トレーニングの成績 ──────────────────
-- 1回通すごとに1行。点や時間だけでなく「言われたこと」も残す（間違いノートの元）。
-- 書き込みは API（service_role）だけ。クライアントから直に足させない。
create table if not exists public.training_attempts (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  chapter       text not null check (chapter in ('ch1','ch2','ch3','ch4','ch5','ch6')),
  -- チュートリアルか本番か
  tutorial      boolean not null default false,
  -- 手摺先行工法で組んだか（第1章だけ）
  sk            boolean not null default false,
  skill         int not null check (skill between 0 and 100),
  score         int not null check (score >= 0),
  sec           int not null check (sec >= 0),
  hints         int not null default 0 check (hints >= 0),
  asks          int not null default 0 check (asks >= 0),
  passed        boolean not null,
  errs          jsonb   not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists training_attempts_enrollment_idx
  on public.training_attempts (enrollment_id, chapter, created_at desc);

alter table public.training_attempts enable row level security;

drop policy if exists training_attempts_select_own on public.training_attempts;
create policy training_attempts_select_own on public.training_attempts
  for select using (public.owns_enrollment(enrollment_id));

drop policy if exists training_attempts_select_company on public.training_attempts;
create policy training_attempts_select_company on public.training_attempts
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）

-- ── 新しく登録した人を事業者に入れる ────────
-- 事業者がちょうど1社のときだけ、その会社に入れる。
-- 2社以上あるときは、どちらに入れるべきか決められないので空のままにする
-- （担当者の画面から入れてもらう）。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select id into v_company from public.companies limit 2;
  if (select count(*) from public.companies) <> 1 then
    v_company := null;
  end if;

  insert into public.users (id, name, email, company_id)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email,
    v_company
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0007'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
