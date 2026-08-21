-- 0002_rls.sql
-- 行レベルセキュリティ。
-- 方針：受講者は自分の行だけ。教育担当者（admin）は自社の行だけ。
--       書き込みのうち「金額」「入金」「修了証」はクライアントから触らせない
--       （service_role の API ルート経由のみ。RLS ポリシーを置かない＝拒否）。

-- ── 補助関数 ───────────────────────────────
-- users を参照するポリシーが users 自身の RLS を再帰的に呼ばないよう security definer。
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false)
$$;

-- 指定の受講が自分のものか
create or replace function public.owns_enrollment(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.id = p_enrollment_id and e.user_id = auth.uid()
  )
$$;

-- 指定の受講が自社のものか（admin 用）
create or replace function public.enrollment_in_my_company(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    join public.users u on u.id = e.user_id
    where e.id = p_enrollment_id
      and u.company_id = public.current_company_id()
  )
$$;

alter table public.companies    enable row level security;
alter table public.users        enable row level security;
alter table public.orders       enable row level security;
alter table public.seats        enable row level security;
alter table public.enrollments  enable row level security;
alter table public.progress     enable row level security;
alter table public.verify_logs  enable row level security;
alter table public.exams        enable row level security;
alter table public.certificates enable row level security;

-- ── companies ──────────────────────────────
create policy companies_select_own on public.companies
  for select using (id = public.current_company_id());

-- ── users ──────────────────────────────────
create policy users_select_self on public.users
  for select using (id = auth.uid());
create policy users_select_company on public.users
  for select using (public.is_admin() and company_id = public.current_company_id());
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
-- role・company_id の書き換えは 0003 のトリガで拒否する。

-- ── orders / seats ─────────────────────────
-- 参照は自社の admin。作成・入金反映は Stripe webhook（service_role）のみ。
create policy orders_select_company on public.orders
  for select using (public.is_admin() and company_id = public.current_company_id());

create policy seats_select_company on public.seats
  for select using (
    public.is_admin()
    and exists (select 1 from public.orders o
                where o.id = seats.order_id and o.company_id = public.current_company_id())
  );
-- 受講者は引き換え時に自分のコードを見る
create policy seats_select_own on public.seats
  for select using (used_by = auth.uid());

-- ── enrollments ────────────────────────────
create policy enrollments_select_own on public.enrollments
  for select using (user_id = auth.uid());
create policy enrollments_select_company on public.enrollments
  for select using (public.is_admin() and public.enrollment_in_my_company(id));
create policy enrollments_insert_own on public.enrollments
  for insert with check (user_id = auth.uid());
-- 同意・顔登録・書類の日時は本人が更新する。completed_at はサーバ側だけが立てる（0003）。
create policy enrollments_update_own on public.enrollments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── progress ───────────────────────────────
-- 行の作成は本人。watched_sec の加算と quiz_passed_at は sync_watched_sec / mark_quiz_passed 経由。
create policy progress_select_own on public.progress
  for select using (public.owns_enrollment(enrollment_id));
create policy progress_select_company on public.progress
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
create policy progress_insert_own on public.progress
  for insert with check (public.owns_enrollment(enrollment_id) and watched_sec = 0);
-- update ポリシーは置かない（クライアントからの直接更新を拒否）

-- ── verify_logs ────────────────────────────
create policy verify_logs_insert_own on public.verify_logs
  for insert with check (public.owns_enrollment(enrollment_id));
create policy verify_logs_select_own on public.verify_logs
  for select using (public.owns_enrollment(enrollment_id));
create policy verify_logs_select_company on public.verify_logs
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));

-- ── exams ──────────────────────────────────
-- 採点はサーバ側（service_role）。クライアントは結果を読むだけ。
create policy exams_select_own on public.exams
  for select using (public.owns_enrollment(enrollment_id));
create policy exams_select_company on public.exams
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));

-- ── certificates ───────────────────────────
-- 発行は service_role のみ（入金確認の判定を通す。0003 のトリガ参照）。
create policy certificates_select_own on public.certificates
  for select using (public.owns_enrollment(enrollment_id));
create policy certificates_select_company on public.certificates
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
