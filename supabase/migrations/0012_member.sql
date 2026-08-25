-- ═══════════════════════════════════════════════════════════
-- 0012 在籍（人と会社の紐付け）
--
-- これまでは users.company_id が1つあるだけだった。
-- 「いまどこに居るか」しか持てないので、
--   ・辞めた人が名簿から消える（受けた記録ごと消える）
--   ・よその会社へ移ると、前の会社の記録が持って行かれる
-- という形になっていた。
--
-- 特別教育の記録は「教育を行った事業者」が3年保存する決まりなので、
-- 人が辞めても移っても、**受けた当時の会社に記録が残らないと困る**。
--
-- 決めたこと
--   ・在籍（memberships）を別に持つ。いつ入って、いつ抜けたか
--   ・紐付けは受講者が申し込み、会社が許可する（申請 → 許可）
--   ・外すのはどちらからでもよい。許可は要らない（退職は待てない）
--   ・在籍中は1人1社。よその会社の許可が下りたら、前の在籍は閉じる
--   ・受講（enrollments）は「どの会社の席で受けたか」を自分で持つ。
--     人が抜けても、その会社の名簿には記録が残る
--   ・users.company_id は「いま在籍している会社」の控え。
--     書き換えは下の2つの関数を通す
-- ═══════════════════════════════════════════════════════════

create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  -- 受講者が申し込んだ日
  requested_at timestamptz not null default now(),
  -- 会社が許可した日。空なら「申請中」
  approved_at  timestamptz,
  -- 抜けた日。退職・転職・申請を断られた
  left_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint memberships_dates check (left_at is null or left_at >= requested_at)
);

-- 途中の形で作ってしまった場合の受け皿（列が無ければ足す）
alter table public.memberships add column if not exists requested_at timestamptz not null default now();
alter table public.memberships add column if not exists approved_at  timestamptz;
alter table public.memberships add column if not exists left_at      timestamptz;

-- 在籍中（許可が下りていて、まだ抜けていない）は1人1社
create unique index if not exists memberships_active_one_idx
  on public.memberships (user_id) where approved_at is not null and left_at is null;
-- 同じ会社への申し込みは、開いているものを1件だけ
create unique index if not exists memberships_open_one_idx
  on public.memberships (user_id, company_id) where left_at is null;
create index if not exists memberships_company_idx
  on public.memberships (company_id, left_at);

alter table public.memberships enable row level security;

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own on public.memberships
  for select using (user_id = auth.uid());

drop policy if exists memberships_select_company on public.memberships;
create policy memberships_select_company on public.memberships
  for select using (company_id = public.current_company_id());

-- いまの users.company_id から在籍を起こす（何度流しても増えない）
insert into public.memberships (user_id, company_id, approved_at)
select u.id, u.company_id, now()
  from public.users u
 where u.company_id is not null
   and not exists (
     select 1 from public.memberships m
      where m.user_id = u.id and m.left_at is null
   );

-- ── 受講は「どの会社の席で受けたか」を持つ ──
alter table public.enrollments
  add column if not exists company_id uuid references public.companies (id);

-- 席があればその注文の会社、無ければいまの所属で埋める
update public.enrollments e
   set company_id = o.company_id
  from public.seats s
  join public.orders o on o.id = s.order_id
 where e.seat_id = s.id and e.company_id is null;

update public.enrollments e
   set company_id = u.company_id
  from public.users u
 where e.user_id = u.id and e.company_id is null and u.company_id is not null;

create index if not exists enrollments_company_idx on public.enrollments (company_id);

-- ── 参加を申し込む ─────────────────────────
-- 受講者が会社を探して申し込む。ここではまだ入らない（会社の許可待ち）。
-- すでに在籍していれば、そのまま。
create or replace function public.request_membership(p_user uuid, p_company uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'その事業者はありません';
  end if;

  select id into v_id from public.memberships
   where user_id = p_user and company_id = p_company and left_at is null;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.memberships (user_id, company_id) values (p_user, p_company)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.request_membership(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_membership(uuid, uuid) to service_role;

-- ── 会社に入れる（許可）─────────────────────
-- よその会社に在籍していれば、そこを閉じてから入る（転職）。
-- 前の会社の受講記録は enrollments 側に残るので、消えない。
create or replace function public.join_company(p_user uuid, p_company uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'その事業者はありません';
  end if;

  -- すでに同じ会社に在籍していれば、何もしない
  if exists (
    select 1 from public.memberships
     where user_id = p_user and company_id = p_company
       and approved_at is not null and left_at is null
  ) then
    update public.users set company_id = p_company where id = p_user;
    return p_company;
  end if;

  -- よその会社の在籍を閉じる（転職）
  update public.memberships
     set left_at = now()
   where user_id = p_user and company_id <> p_company
     and approved_at is not null and left_at is null;

  -- 申請中のものがあれば、それを許可する。無ければその場で入れる
  update public.memberships
     set approved_at = now()
   where user_id = p_user and company_id = p_company and left_at is null;

  if not found then
    insert into public.memberships (user_id, company_id, approved_at)
    values (p_user, p_company, now());
  end if;

  update public.users set company_id = p_company where id = p_user;
  return p_company;
end $$;

revoke all on function public.join_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_company(uuid, uuid) to service_role;

-- ── 会社を抜ける（退職）───────────────────
-- どちらからでも外せる。許可は要らない（退職は待てない）。
-- 申請中のものを外せば「取り下げ／断る」になる。
-- 記録は消さない。名簿には「退職」として残る。
create or replace function public.leave_company(p_user uuid, p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.memberships
     set left_at = now()
   where user_id = p_user and company_id = p_company and left_at is null;

  update public.users set company_id = null
   where id = p_user and company_id = p_company;
end $$;

revoke all on function public.leave_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_company(uuid, uuid) to service_role;

-- ── 席の引き換えは、その会社に入る ──────────
create or replace function public.redeem_seat(p_code text, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seat    public.seats;
  v_company uuid;
  v_course  text;
  v_enroll  uuid;
begin
  select * into v_seat from public.seats
   where code = upper(btrim(p_code))
   for update;

  if v_seat.id is null then
    raise exception 'そのコードの席がありません';
  end if;
  if v_seat.used_by is not null and v_seat.used_by <> p_user then
    raise exception 'その受講コードは、もう使われています';
  end if;
  if v_seat.expires_at is not null and v_seat.expires_at < now() then
    raise exception 'その受講コードは期限切れです';
  end if;

  select o.company_id, o.course_id into v_company, v_course
    from public.orders o where o.id = v_seat.order_id;
  if v_company is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;

  if v_seat.used_by is null then
    update public.seats
       set used_by = p_user, used_at = now()
     where id = v_seat.id;
  end if;

  perform public.join_company(p_user, v_company);

  v_enroll := public.enrollment_for(p_user, v_course);
  update public.enrollments
     set seat_id = v_seat.id,
         -- 受けた当時の会社。人が抜けても、記録はこの会社に残る
         company_id = v_company
   where id = v_enroll and seat_id is null;

  return v_company;
end $$;

revoke all on function public.redeem_seat(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_seat(text, uuid) to service_role;

-- ── 受講を1件だけ用意する（会社も入れる）──
create or replace function public.enrollment_for(p_user uuid, p_course text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません（%）', p_course;
  end if;

  insert into public.enrollments (user_id, course_id, company_id, started_at)
       select p_user, p_course, u.company_id, now()
         from public.users u where u.id = p_user
  on conflict (user_id, course_id) do nothing;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course;
  return v_id;
end $$;

revoke all on function public.enrollment_for(uuid, text) from public, anon, authenticated;
grant execute on function public.enrollment_for(uuid, text) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0012'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
