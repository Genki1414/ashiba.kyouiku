-- 0003_rules.sql
-- SPEC.md 第5章「実装上の重要な決まり」を DB 側で担保する。
-- ここには SPEC のデータモデルに無い追加が1つある：lessons（規定時間の参照表）。
-- 教材本体は curriculum.json のままで、DB には「単元IDと legal_min」だけを写す。
-- 理由：規定時間に達したかの判定をクライアントの申告に任せないため。

-- ── 単元の規定時間（curriculum.json から scripts/sync-lessons.ts で投入）──
create table if not exists public.lessons (
  lesson_id  text primary key,          -- '1-1' 形式
  subject_id int  not null,
  title      text not null,
  legal_min  int  not null check (legal_min > 0),
  sort_order int  not null
);
alter table public.lessons enable row level security;
drop policy if exists lessons_select_all on public.lessons;
create policy lessons_select_all on public.lessons for select using (true);

do $$ begin
  alter table public.progress
    add constraint progress_lesson_id_fkey
    foreign key (lesson_id) references public.lessons (lesson_id) on delete restrict;
exception when duplicate_object then null; end $$;

-- ── 単元を開いたことを記録 ─────────────────
-- 進捗行をここで作る。updated_at が「単元を開いた時刻」になるので、
-- 最初の同期でも、開いてからの実経過ぶんを正しく加算できる。
create or replace function public.touch_progress(
  p_enrollment_id uuid, p_lesson_id text)
returns public.progress language plpgsql security definer set search_path = public as $$
declare v_row public.progress;
begin
  if auth.role() <> 'service_role' and not public.owns_enrollment(p_enrollment_id) then
    raise exception '受講者が一致しません';
  end if;

  insert into public.progress (enrollment_id, lesson_id)
       values (p_enrollment_id, p_lesson_id)
  on conflict (enrollment_id, lesson_id) do nothing;

  select * into v_row from public.progress
   where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  return v_row;
end $$;

-- ── 視聴時間の加算 ─────────────────────────
-- クライアントは「前回同期からの再生秒数」を送るだけ。
-- 実際に加算するのは、サーバ側の実経過時間で頭打ちにした値。
create or replace function public.sync_watched_sec(
  p_enrollment_id uuid, p_lesson_id text, p_delta_sec int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_now  timestamptz := now();
  v_prev timestamptz;
  v_add  int;
  v_total int;
begin
  -- Auth 導入前のフェーズ1は service_role の API ルートが開発用受講に記録する
  if auth.role() <> 'service_role' and not public.owns_enrollment(p_enrollment_id) then
    raise exception '受講者が一致しません';
  end if;
  if p_delta_sec is null or p_delta_sec < 0 then
    raise exception '加算値が不正です';
  end if;

  insert into public.progress (enrollment_id, lesson_id)
       values (p_enrollment_id, p_lesson_id)
  on conflict (enrollment_id, lesson_id) do nothing;

  select updated_at into v_prev
    from public.progress
   where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id
     for update;

  -- 上限は二重にかける。
  --  ・実経過 + 2秒（通信の遅れ分だけ許容し、それ以上は切り捨てる）
  --  ・1回あたり 120秒（同期は15秒間隔なので、通信失敗の取り返しでも足りる）
  v_add := least(
    p_delta_sec,
    greatest(0, floor(extract(epoch from (v_now - v_prev)))::int) + 2,
    120);

  update public.progress
     set watched_sec = watched_sec + v_add,
         updated_at  = v_now
   where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id
  returning watched_sec into v_total;

  return v_total;
end $$;

-- ── 確認問題の合格 ─────────────────────────
-- 規定時間（lessons.legal_min）に達していなければ合格にしない。
create or replace function public.mark_quiz_passed(
  p_enrollment_id uuid, p_lesson_id text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_need int;
  v_watched int;
  v_at timestamptz;
begin
  if auth.role() <> 'service_role' and not public.owns_enrollment(p_enrollment_id) then
    raise exception '受講者が一致しません';
  end if;

  select legal_min * 60 into v_need from public.lessons where lesson_id = p_lesson_id;
  if v_need is null then
    raise exception '単元が見つかりません: %', p_lesson_id;
  end if;

  select watched_sec into v_watched
    from public.progress
   where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;

  if coalesce(v_watched, 0) < v_need then
    raise exception '規定時間に達していません（% 秒 / % 秒）', coalesce(v_watched, 0), v_need;
  end if;

  update public.progress
     set quiz_passed_at = coalesce(quiz_passed_at, now()),
         updated_at     = now()
   where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id
  returning quiz_passed_at into v_at;

  return v_at;
end $$;

revoke all on function public.touch_progress(uuid, text)      from public;
grant execute on function public.touch_progress(uuid, text)   to authenticated;
revoke all on function public.sync_watched_sec(uuid, text, int) from public;
revoke all on function public.mark_quiz_passed(uuid, text)      from public;
grant execute on function public.sync_watched_sec(uuid, text, int) to authenticated;
grant execute on function public.mark_quiz_passed(uuid, text)      to authenticated;

-- ── 権限列の保護 ───────────────────────────
-- 本人更新を許した users / enrollments で、触らせたくない列を止める。
create or replace function public.guard_users_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
    raise exception '所属と権限は変更できません';
  end if;
  return new;
end $$;
drop trigger if exists users_guard_columns on public.users;
create trigger users_guard_columns before update on public.users
  for each row execute function public.guard_users_columns();

create or replace function public.guard_enrollment_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.completed_at is distinct from old.completed_at
     or new.seat_id is distinct from old.seat_id then
    raise exception '修了と受講コードの紐付けは変更できません';
  end if;
  return new;
end $$;
drop trigger if exists enrollments_guard_columns on public.enrollments;
create trigger enrollments_guard_columns before update on public.enrollments
  for each row execute function public.guard_enrollment_columns();

-- ── 修了証は入金確認まで発行しない ─────────
-- SPEC 5章：請求書払いでも受講コードは即時発行するが、資格証だけは止める。
create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status public.order_status;
begin
  select o.status into v_status
    from public.enrollments e
    join public.seats  s on s.id = e.seat_id
    join public.orders o on o.id = s.order_id
   where e.id = new.enrollment_id;

  if v_status is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;
  if v_status <> 'paid' then
    raise exception '未入金の注文です。修了証は発行できません';
  end if;
  return new;
end $$;
drop trigger if exists certificates_check_paid on public.certificates;
create trigger certificates_check_paid before insert on public.certificates
  for each row execute function public.certificates_require_paid();
