-- ═══════════════════════════════════════════════════════════
-- 0011 講座（特別教育の種類）を入れる
--
-- これまでは足場ひとつだけの作りだった。
-- 単元IDが '1-1' で世界に1つしか無く、受講も受講コードも修了証も
-- 「どの講座のものか」を持っていなかった。
--
-- 特別教育は種類が増えていく。増やすたびに作り直すことにならないよう、
-- ここで「講座」を1つ足す。3つ目からは、教材を置いて courses に1行
-- 入れるだけで済む。
--
-- 決めたこと
--   ・単元IDは「講座:番号」（例 ashiba:1-1）。講座ごとに 1-1 が重なるため
--   ・受講（enrollments）は 1人1講座につき1件
--   ・受講コード（席）は1講座ぶん。注文が講座を持ち、席はそれを継ぐ
--   ・修了証は受講に紐づくので、自然と講座ごとになる
-- ═══════════════════════════════════════════════════════════

-- ── 講座 ───────────────────────────────────
create table if not exists public.courses (
  id         text primary key,          -- 'ashiba' など。URLと単元IDに使う
  name       text not null,             -- 正式名称。修了証に載る
  basis      text not null,             -- 法令の根拠
  total_min  int  not null check (total_min > 0),
  sort_order int  not null default 0
);
alter table public.courses enable row level security;
drop policy if exists courses_select_all on public.courses;
create policy courses_select_all on public.courses for select using (true);

insert into public.courses (id, name, basis, total_min, sort_order)
values ('ashiba',
        '足場の組立て等の業務に係る特別教育',
        '労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号',
        360, 1)
on conflict (id) do update
  set name = excluded.name, basis = excluded.basis, total_min = excluded.total_min;

-- ── 単元に講座を持たせ、単元IDに講座を付ける ──
alter table public.lessons
  add column if not exists course_id text references public.courses (id);

do $$ begin
  -- まだ付け替えていない行があるときだけ動かす（何度流しても同じ結果になる）
  if exists (select 1 from public.lessons where lesson_id not like '%:%') then
    alter table public.progress drop constraint if exists progress_lesson_id_fkey;

    update public.lessons  set course_id = 'ashiba' where course_id is null;
    update public.progress set lesson_id = 'ashiba:' || lesson_id where lesson_id not like '%:%';
    update public.verify_logs set lesson_id = 'ashiba:' || lesson_id
      where lesson_id is not null and lesson_id not like '%:%';
    update public.lessons  set lesson_id = 'ashiba:' || lesson_id where lesson_id not like '%:%';

    alter table public.progress
      add constraint progress_lesson_id_fkey
      foreign key (lesson_id) references public.lessons (lesson_id) on delete restrict;
  end if;
end $$;

update public.lessons set course_id = 'ashiba' where course_id is null;
alter table public.lessons alter column course_id set not null;
create index if not exists lessons_course_idx on public.lessons (course_id, sort_order);

-- ── 受講は「1人1講座につき1件」 ─────────────
alter table public.enrollments
  add column if not exists course_id text references public.courses (id);
update public.enrollments set course_id = 'ashiba' where course_id is null;
alter table public.enrollments alter column course_id set not null;
alter table public.enrollments alter column course_id set default 'ashiba';

-- 0004 の「1人1件」は、講座が増えると成り立たない
drop index if exists public.enrollments_one_per_user_idx;
create unique index if not exists enrollments_one_per_user_course_idx
  on public.enrollments (user_id, course_id);

-- ── 注文（＝受講コード）も講座ごと ──────────
alter table public.orders
  add column if not exists course_id text references public.courses (id);
update public.orders set course_id = 'ashiba' where course_id is null;
alter table public.orders alter column course_id set not null;
alter table public.orders alter column course_id set default 'ashiba';

-- ── 受講を1件だけ用意する ───────────────────
-- その人・その講座の受講を返す。無ければ作る。
-- 呼ぶ側で「取れなければ作る」を書くと、同時に来たとき2件できる。
create or replace function public.enrollment_for(p_user uuid, p_course text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません（%）', p_course;
  end if;

  insert into public.enrollments (user_id, course_id, started_at)
       values (p_user, p_course, now())
  on conflict (user_id, course_id) do nothing;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course;
  return v_id;
end $$;

revoke all on function public.enrollment_for(uuid, text) from public, anon, authenticated;
grant execute on function public.enrollment_for(uuid, text) to service_role;

-- ── 席の引き換えは、その講座の受講に付ける ──
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

  update public.users set company_id = v_company where id = p_user;

  -- その講座の受講に付ける。無ければ作る
  v_enroll := public.enrollment_for(p_user, v_course);
  update public.enrollments
     set seat_id = v_seat.id
   where id = v_enroll and seat_id is null;

  return v_company;
end $$;

revoke all on function public.redeem_seat(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_seat(text, uuid) to service_role;

-- ── 修了証は「その講座の席」が入金済みでないと出せない ──
create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat   uuid;
  v_user   uuid;
  v_course text;
  v_trial  boolean;
  v_status public.order_status;
  v_ocourse text;
begin
  select e.seat_id, e.user_id, e.course_id into v_seat, v_user, v_course
    from public.enrollments e where e.id = new.enrollment_id;

  if v_seat is null then
    -- 無償利用の事業者は、席が無くても出せる（試用・社内利用）
    select c.trial into v_trial
      from public.users u join public.companies c on c.id = u.company_id
     where u.id = v_user;
    if coalesce(v_trial, false) then return new; end if;
    raise exception '受講コードがありません。申込みと入金を確かめてください';
  end if;

  select o.status, o.course_id into v_status, v_ocourse
    from public.seats  s
    join public.orders o on o.id = s.order_id
   where s.id = v_seat;

  if v_status is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;
  if v_ocourse is distinct from v_course then
    raise exception 'その受講コードは別の講座のものです';
  end if;
  if v_status <> 'paid' then
    raise exception '未入金の注文です。修了証は発行できません';
  end if;
  return new;
end $$;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0011'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
