-- ═══════════════════════════════════════════════════════════
-- 0025 受講リクエスト
--
-- 受講者は、講座の一覧を見られても、席（受講コード）が無ければ
-- 受けられない。席を買うのは教育担当者だが、「この講座を受けたい」を
-- 伝える手段が今までは口頭しか無かった。
--
-- 決めたこと
--   ・本人がマイページから、講座ごとに送る（自己申告のお願い）
--   ・会社に在籍していない人は送れない（誰の会社宛か決まらない）
--   ・同じ講座に、開いているリクエストは1件だけ（連打で増やさない）
--   ・担当者が「対応した」を立てれば閉じる。立て直せば、また開く
--     （席を用意したあと「もう来なくていい」を戻せないと困る）
--   ・見えるのは本人と、送った先の会社（教育担当者）だけ
--
-- 席そのものはここでは払い出さない。担当者が見て、
-- いつもどおり受講コードを作って渡す。ここは「言った・言われた」を
-- 画面に残すだけの仕組み。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.course_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  -- 申し込んだときに在籍していた会社。あとで会社を移っても変わらない
  company_id   uuid not null references public.companies (id) on delete cascade,
  -- src/content/courses.ts の id
  course_id    text not null references public.courses (id),
  requested_at timestamptz not null default now(),
  -- 担当者が対応した印。空なら「まだ」
  handled_at   timestamptz,
  handled_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 同じ講座に、開いているリクエストは1件だけ
create unique index if not exists course_requests_open_idx
  on public.course_requests (user_id, course_id) where handled_at is null;
create index if not exists course_requests_company_idx on public.course_requests (company_id);
create index if not exists course_requests_user_idx    on public.course_requests (user_id);

alter table public.course_requests enable row level security;

drop policy if exists course_requests_select_own on public.course_requests;
create policy course_requests_select_own on public.course_requests
  for select using (user_id = auth.uid());

-- 担当者は自社宛のぶんだけ見える
drop policy if exists course_requests_select_company on public.course_requests;
create policy course_requests_select_company on public.course_requests
  for select using (public.is_admin() and company_id = public.current_company_id());

-- ── リクエストを送る（本人）─────────────────
-- いま在籍している会社宛に送る。在籍していなければ送れない。
create or replace function public.request_course(p_user uuid, p_course text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_id      uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません';
  end if;

  select company_id into v_company from public.memberships
   where user_id = p_user and approved_at is not null and left_at is null
   limit 1;
  if v_company is null then
    raise exception 'まだ会社に所属していません';
  end if;

  select id into v_id from public.course_requests
   where user_id = p_user and course_id = p_course and handled_at is null;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.course_requests (user_id, company_id, course_id)
  values (p_user, v_company, p_course)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.request_course(uuid, text) from public, anon, authenticated;
grant execute on function public.request_course(uuid, text) to service_role;

-- ── リクエストを取り消す（本人）─────────────
-- 押し間違いを戻せるように。担当者が対応済みにしたあとは取り消せない
-- （もう届いているので、無かったことにはできない）。
create or replace function public.cancel_course_request(p_user uuid, p_course text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.course_requests
   where user_id = p_user and course_id = p_course and handled_at is null;
end $$;

revoke all on function public.cancel_course_request(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_course_request(uuid, text) to service_role;

-- ── 対応済みにする（教育担当者）─────────────
-- 自社宛のリクエストしか動かせない。会社の番号を渡させて確かめる。
-- p_on を false にすると戻せる（押し間違い用）。
create or replace function public.handle_course_request(
  p_id uuid, p_company uuid, p_admin uuid, p_on boolean
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.course_requests
     set handled_at = case when p_on then now() else null end,
         handled_by = case when p_on then p_admin else null end
   where id = p_id and company_id = p_company;
  return found;
end $$;

revoke all on function public.handle_course_request(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.handle_course_request(uuid, uuid, uuid, boolean) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0025'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
