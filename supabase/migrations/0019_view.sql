-- ═══════════════════════════════════════════════════════════
-- 0019 通し見学を見たか
--
-- 担当者が見たいのは「この人を現場に出せるか」。
-- 手順を最後まで見たかどうかは、点が付く前の段階として要る。
-- 見学は点を付けるものではないので、成績（training_attempts）とは分ける。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.training_views (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  chapter       text not null check (chapter in ('ch1','ch2','ch3','ch4','ch5','ch6')),
  -- 開いた回数
  times         int  not null default 0 check (times >= 0),
  -- 最後まで見たか。途中で閉じたものと分ける
  done          boolean not null default false,
  first_at      timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  primary key (enrollment_id, chapter)
);

alter table public.training_views enable row level security;

drop policy if exists training_views_select_own on public.training_views;
create policy training_views_select_own on public.training_views
  for select using (public.owns_enrollment(enrollment_id));

drop policy if exists training_views_select_company on public.training_views;
create policy training_views_select_company on public.training_views
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）

-- ── 見学を1回ぶん残す ──────────────────────
-- 開いたときに p_done=false、最後まで見たときに p_done=true で呼ぶ。
-- 「開いて最後まで見た」を2回と数えないよう、done のときは回数を足さない。
-- 一度でも最後まで見ていれば done は下がらない。
create or replace function public.see_demo(p_enrollment uuid, p_chapter text, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.training_views (enrollment_id, chapter, times, done)
  values (p_enrollment, p_chapter, case when p_done then 0 else 1 end, coalesce(p_done, false))
  on conflict (enrollment_id, chapter) do update
     set times   = public.training_views.times + case when p_done then 0 else 1 end,
         done    = public.training_views.done or coalesce(p_done, false),
         last_at = now();
end $$;

revoke all on function public.see_demo(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.see_demo(uuid, text, boolean) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0019'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
