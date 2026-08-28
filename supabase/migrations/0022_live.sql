-- ═══════════════════════════════════════════════════════════
-- 0022 討議の回と、出た記録
--
-- 職長教育は討議方式が原則。録画を見せるのは討議にならない。
-- 同じ時間に集まって、やり取りできる状態でやる。
--
-- 「討議の画面を開いた」では修了にしない。
-- 誰が・いつ入って・いつ出て・実際に何分居て・課題に何と答えて・
-- 講師が確認したか、まで残す。ここが残っていないと、
-- あとから「本当にやったのか」を示せない。
--
-- 職長教育だけの作りにはしない。これから討議や演習の要る教育を
-- 足すときに、同じ仕組みを使う（courses.type = hybrid / live）。
-- ═══════════════════════════════════════════════════════════

-- ── 討議の回 ────────────────────────────────
create table if not exists public.live_sessions (
  id           uuid primary key default gen_random_uuid(),
  course_id    text not null references public.courses (id),
  -- その回でやる科目（職長教育なら1〜5）
  subject_id   int  not null check (subject_id > 0),
  -- どの事業者の回か。空なら誰でも申し込める回
  company_id   uuid references public.companies (id) on delete set null,
  starts_at    timestamptz not null,
  -- 予定の長さ（分）。実際に居た時間はこれとは別に数える
  minutes      int  not null check (minutes > 0),
  -- 1回に入れる人数。多いと討議にならない
  capacity     int  not null default 15 check (capacity between 1 and 15),
  -- 進行する人（講師）
  teacher      uuid references public.users (id),
  -- つなぎ先（外の会議ツールを使う場合の部屋の場所）
  room_url     text,
  note         text,
  -- 取りやめた回
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists live_sessions_when_idx
  on public.live_sessions (course_id, subject_id, starts_at);

-- ── 出た記録 ────────────────────────────────
-- 1人1回につき1行。入り直しは spans に足していく。
create table if not exists public.live_attend (
  session_id   uuid not null references public.live_sessions (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  -- 入室と退出の組。[{"in":"…","out":"…"}, …]
  spans        jsonb not null default '[]'::jsonb,
  -- 席を外していた時間（分）。講師が付ける
  away_min     int  not null default 0 check (away_min >= 0),
  -- 課題への答え。書いていなければ修了にしない
  answer       text,
  -- 講師が「討議に参加していた」と認めたか
  teacher_ok   boolean not null default false,
  teacher_note text,
  created_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.live_sessions enable row level security;
alter table public.live_attend  enable row level security;

-- 回は、受けられる人には見える（申し込むため）
drop policy if exists live_sessions_select on public.live_sessions;
create policy live_sessions_select on public.live_sessions
  for select using (true);

-- 出た記録は、本人と、その事業者の担当者だけ
drop policy if exists live_attend_select_own on public.live_attend;
create policy live_attend_select_own on public.live_attend
  for select using (user_id = auth.uid());

drop policy if exists live_attend_select_company on public.live_attend;
create policy live_attend_select_company on public.live_attend
  for select using (
    public.is_admin() and exists (
      select 1 from public.users u
       where u.id = public.live_attend.user_id
         and u.company_id = (select company_id from public.users where id = auth.uid())
    )
  );
-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）

-- ── 申し込む ────────────────────────────────
-- 定員を超えたら断る。数えてから入れるまでを1つの手でやる
-- （数えたあとに入れると、同時に来たとき定員を超える）
create or replace function public.book_live(p_session uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_cap int; v_n int;
begin
  select capacity into v_cap from public.live_sessions
   where id = p_session and closed_at is null
   for update;
  if v_cap is null then
    raise exception 'その回がありません';
  end if;

  select count(*) into v_n from public.live_attend where session_id = p_session;
  if v_n >= v_cap then
    return false;      -- いっぱい
  end if;

  insert into public.live_attend (session_id, user_id)
  values (p_session, p_user)
  on conflict (session_id, user_id) do nothing;
  return true;
end $$;

revoke all on function public.book_live(uuid, uuid) from public, anon, authenticated;
grant execute on function public.book_live(uuid, uuid) to service_role;

-- ── 入る・出る ──────────────────────────────
-- 入室は spans の末尾に足す。すでに開いている組があれば足さない
-- （回線が切れて入り直したときに、二重に数えないため）
create or replace function public.live_in(p_session uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select spans into v from public.live_attend
   where session_id = p_session and user_id = p_user for update;
  if v is null then
    raise exception 'その回に申し込んでいません';
  end if;

  if jsonb_array_length(v) > 0
     and (v -> (jsonb_array_length(v) - 1) ->> 'out') is null then
    return;  -- もう入っている
  end if;

  update public.live_attend
     set spans = v || jsonb_build_array(jsonb_build_object('in', now(), 'out', null))
   where session_id = p_session and user_id = p_user;
end $$;

create or replace function public.live_out(p_session uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v jsonb; n int;
begin
  select spans into v from public.live_attend
   where session_id = p_session and user_id = p_user for update;
  if v is null then return; end if;
  n := jsonb_array_length(v);
  if n = 0 or (v -> (n - 1) ->> 'out') is not null then
    return;  -- もう出ている
  end if;

  update public.live_attend
     set spans = jsonb_set(v, array[(n - 1)::text, 'out'], to_jsonb(now()))
   where session_id = p_session and user_id = p_user;
end $$;

revoke all on function public.live_in(uuid, uuid)  from public, anon, authenticated;
revoke all on function public.live_out(uuid, uuid) from public, anon, authenticated;
grant execute on function public.live_in(uuid, uuid)  to service_role;
grant execute on function public.live_out(uuid, uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0022'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
