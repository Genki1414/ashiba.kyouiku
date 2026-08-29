-- ═══════════════════════════════════════════════════════════
-- 0023 修了証の発行申請と、こちらが出す候補日
--
-- 学科だけで修了する講座（足場の特別教育）は、条件を満たせば
-- その場で修了証を出してよい。修了しているから。
--
-- ところが、学科のあとに討議や実技が残る講座で同じことをすると、
-- **まだ修了していない人に修了証が出る**。
--
-- そこで、学科を終えた人に発行申請を出してもらう。
-- 討議のある講座（職長教育）は、こちらが候補日を出し、
-- 本人が選んだ日に討議をやって、そこではじめて修了になる。
--
-- 討議の回を先に立てておく作りにはしない。
-- 立てるまで誰も申し込めず、誰が待っているのかも分からない。
-- 申請が来てから日を出す。
--
-- 実技のある講座は、事業者が自社で実技を行う。日を決めるのは
-- こちらではないので候補日は出さない。済んでから申請してもらい、
-- 実施日と実施者を控える。
-- ═══════════════════════════════════════════════════════════

-- ── 申請から生まれた回の印 ──────────────────
-- 0022 の live_sessions は「company_id が空＝誰でも申し込める回」。
-- 申請から作った回をそのまま入れると、一人で受けている人の討議が
-- **全員の一覧に出てしまう**。印を付けて、一覧からは外す。
-- 本人の画面には、申し込みの行から引いて出す。
alter table public.live_sessions
  add column if not exists by_request boolean not null default false;
create index if not exists live_sessions_by_request_idx
  on public.live_sessions (course_id, by_request, starts_at);

-- ── 申請 ────────────────────────────────────
-- 1受講につき1件。出し直しは同じ行を使い回す
-- （履歴を増やすと、いまどの状態なのかが読めなくなる）。
create table if not exists public.cert_requests (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  course_id     text not null references public.courses (id),
  user_id       uuid not null references public.users (id) on delete cascade,
  -- どの関門か。src/content/courses.ts の gate と同じ字
  kind          text not null check (kind in ('talk', 'drill')),
  -- 討議を、どの科目の時間として数えるか。講座ごとに違う
  -- （職長教育は科目3。src/content/shokucho.ts の TALK_SUBJECT）
  talk_subject  int  not null default 1 check (talk_subject > 0),
  status        text not null default 'open'
                check (status in ('open', 'offered', 'picked', 'cleared', 'declined')),
  -- 本人が添えた一言（都合の悪い日など）
  note          text not null default '',
  requested_at  timestamptz not null default now(),

  -- 実技（kind = 'drill'）。事業者が行った記録
  drill_on      date,
  drill_by      text not null default '',

  -- こちらの返事
  replied_at    timestamptz,
  reply_note    text not null default '',
  -- 誰が返したか（運営のメール。users は参照しない＝運営は名簿に居ないことがある）
  replied_by    text not null default '',

  -- 討議の日が決まったら、その回
  session_id    uuid references public.live_sessions (id) on delete set null,
  decided_at    timestamptz,
  -- 関門を通した時刻
  cleared_at    timestamptz
);
create index if not exists cert_requests_queue_idx
  on public.cert_requests (status, requested_at);
create index if not exists cert_requests_course_idx
  on public.cert_requests (course_id, status);

-- ── 候補日 ──────────────────────────────────
-- こちらが出す。本人は選ぶだけ。
create table if not exists public.cert_request_slots (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.cert_requests (id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     int  not null check (minutes between 1 and 480),
  note        text not null default '',
  -- 本人が選んだ候補（1件だけ）
  picked_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (request_id, starts_at)
);
create index if not exists cert_request_slots_req_idx
  on public.cert_request_slots (request_id, starts_at);

alter table public.cert_requests      enable row level security;
alter table public.cert_request_slots enable row level security;

-- 申請は、本人と、その事業者の担当者だけが見られる
drop policy if exists cert_requests_select_own on public.cert_requests;
create policy cert_requests_select_own on public.cert_requests
  for select using (user_id = auth.uid());

drop policy if exists cert_requests_select_company on public.cert_requests;
create policy cert_requests_select_company on public.cert_requests
  for select using (
    public.is_admin() and exists (
      select 1 from public.users u
       where u.id = public.cert_requests.user_id
         and u.company_id = (select company_id from public.users where id = auth.uid())
    )
  );

-- 候補日は、その申請の本人だけ
drop policy if exists cert_request_slots_select on public.cert_request_slots;
create policy cert_request_slots_select on public.cert_request_slots
  for select using (
    exists (
      select 1 from public.cert_requests r
       where r.id = public.cert_request_slots.request_id
         and r.user_id = auth.uid()
    )
  );

-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）。
-- 状態を進めるのは、下の関数だけ。

-- ── 申請を出す ──────────────────────────────
-- 出し直し（断られたあと）も同じ行を使う。
-- 状態を戻すので、前に出した候補日は消す。
create or replace function public.request_cert(
  p_enrollment uuid,
  p_user       uuid,
  p_course     text,
  p_kind       text,
  p_subject    int  default 1,
  p_note       text default '',
  p_drill_on   date default null,
  p_drill_by   text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text;
begin
  select id, status into v_id, v_status
    from public.cert_requests where enrollment_id = p_enrollment for update;

  if v_id is null then
    insert into public.cert_requests
      (enrollment_id, course_id, user_id, kind, talk_subject, note, drill_on, drill_by)
    values
      (p_enrollment, p_course, p_user, p_kind, greatest(1, coalesce(p_subject, 1)),
       coalesce(p_note, ''), p_drill_on, coalesce(p_drill_by, ''))
    returning id into v_id;
    return v_id;
  end if;

  -- すでに通っているものは触らない。修了を取り消すことになる
  if v_status = 'cleared' then
    raise exception 'すでに修了しています';
  end if;

  -- 日が決まっているのに出し直すのは、こちらが取り消してからにする
  if v_status = 'picked' then
    raise exception '討議の日が決まっています。変えたいときはご連絡ください';
  end if;

  delete from public.cert_request_slots where request_id = v_id;
  update public.cert_requests
     set status = 'open', note = coalesce(p_note, ''), requested_at = now(),
         talk_subject = greatest(1, coalesce(p_subject, talk_subject)),
         drill_on = p_drill_on, drill_by = coalesce(p_drill_by, ''),
         replied_at = null, reply_note = '', replied_by = '',
         session_id = null, decided_at = null
   where id = v_id;
  return v_id;
end $$;

-- ── 候補日を出す（本部） ────────────────────
-- 前に出した候補は消してから入れ直す。残すと、
-- 古い日と新しい日が混ざって並ぶ。
create or replace function public.offer_slots(
  p_request uuid,
  p_slots   jsonb,
  p_note    text default '',
  p_by      text default ''
) returns int language plpgsql security definer set search_path = public as $$
declare v_status text; v_n int; v_ses uuid; v_user uuid; v_left int;
begin
  select status, session_id, user_id into v_status, v_ses, v_user
    from public.cert_requests where id = p_request for update;
  if v_status is null then raise exception 'その申請がありません'; end if;
  if v_status = 'cleared' then raise exception 'すでに修了しています'; end if;

  /* すでに日が決まっていた人に、出し直すことがある（こちらの都合が変わったとき）。
     前の回の申し込みを外しておかないと、その人が2つの回に居ることになる。
     誰も居なくなった回は閉じる（空の回が一覧に残らないように） */
  if v_ses is not null then
    delete from public.live_attend where session_id = v_ses and user_id = v_user;
    select count(*) into v_left from public.live_attend where session_id = v_ses;
    if v_left = 0 then
      update public.live_sessions set closed_at = now()
       where id = v_ses and by_request and closed_at is null;
    end if;
  end if;

  delete from public.cert_request_slots where request_id = p_request;

  -- 秒より下は捨てる。同じ日を2人に出したとき、秒がずれていると
  -- 「同じ日時の回」に集まらず、別々の部屋に分かれてしまう
  insert into public.cert_request_slots (request_id, starts_at, minutes, note)
  select p_request,
         date_trunc('minute', (e ->> 'startsAt')::timestamptz),
         (e ->> 'minutes')::int,
         coalesce(e ->> 'note', '')
    from jsonb_array_elements(p_slots) as e;

  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception '候補日がありません'; end if;

  update public.cert_requests
     set status = 'offered', replied_at = now(), reply_note = coalesce(p_note, ''),
         replied_by = coalesce(p_by, ''), session_id = null, decided_at = null
   where id = p_request;
  return v_n;
end $$;

-- ── 候補日を選ぶ（本人） ────────────────────
-- 同じ日時の回がすでにあれば、そこへ入れる。
-- 毎回あたらしく作ると、同じ日に呼んだ2人が別々の部屋に入ることになる。
-- 討議は複数人でやるものなので、それでは討議にならない。
--
-- 回を作ってから別の手で申し込むと、あいだで落ちたときに
-- 「回はあるのに誰も入っていない」が残る。ひとつの手で済ませる。
create or replace function public.pick_slot(
  p_slot uuid,
  p_user uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_req uuid; v_status text; v_owner uuid; v_course text; v_subject int;
  v_start timestamptz; v_min int; v_session uuid; v_cap int; v_n int;
begin
  select s.request_id, r.status, r.user_id, r.course_id, r.talk_subject, s.starts_at, s.minutes
    into v_req, v_status, v_owner, v_course, v_subject, v_start, v_min
    from public.cert_request_slots s
    join public.cert_requests r on r.id = s.request_id
   where s.id = p_slot
   for update of s;

  if v_req is null then raise exception 'その候補日がありません'; end if;
  if v_owner <> p_user then raise exception '自分の申請ではありません'; end if;
  if v_status <> 'offered' then raise exception 'いま選べる状態ではありません'; end if;

  -- 同じ日時の回を探す。空きがあればそこへ。
  -- 分より下は見ない（候補日は分単位で入っている）
  select id, capacity into v_session, v_cap
    from public.live_sessions
   where course_id = v_course and by_request and closed_at is null
     and date_trunc('minute', starts_at) = date_trunc('minute', v_start)
     and minutes = v_min
   order by created_at
   limit 1
   for update;

  if v_session is not null then
    select count(*) into v_n from public.live_attend where session_id = v_session;
    if v_n >= v_cap then v_session := null; end if;   -- いっぱい。別に立てる
  end if;

  if v_session is null then
    -- 申請から作る回は、一覧に出さない（by_request）。
    -- company_id は入れない。会社をまたいで同じ回に入ることがあるため、
    -- 会社で絞ると同じ日に呼んだ人が別の部屋に分かれてしまう。
    insert into public.live_sessions
      (course_id, subject_id, company_id, starts_at, minutes, capacity, by_request)
    values (v_course, v_subject, null, v_start, v_min, 15, true)
    returning id into v_session;
  end if;

  insert into public.live_attend (session_id, user_id) values (v_session, p_user)
  on conflict (session_id, user_id) do nothing;

  update public.cert_request_slots set picked_at = now() where id = p_slot;
  update public.cert_requests
     set status = 'picked', session_id = v_session, decided_at = now()
   where id = v_req;
  return v_session;
end $$;

-- ── 関門を通す ──────────────────────────────
-- 討議は、時間・課題・講師の確認がそろってから通す。
-- 判断そのものはサーバ側（src/lib/hours.ts の judgeTalk）でやるので、
-- ここは印を付けるだけ。実技は本部が記録を見て通す。
-- 二度押しても壊れない。
create or replace function public.clear_request(
  p_request uuid,
  p_note    text default '',
  p_by      text default ''
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.cert_requests
     set status = 'cleared', cleared_at = coalesce(cleared_at, now()),
         reply_note = coalesce(nullif(p_note, ''), reply_note),
         replied_by = coalesce(nullif(p_by, ''), replied_by),
         replied_at = now()
   where id = p_request;
end $$;

-- ── 断る ────────────────────────────────────
create or replace function public.decline_request(
  p_request uuid,
  p_note    text,
  p_by      text default ''
) returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_note), '') = '' then
    raise exception '理由を書いてください';
  end if;
  update public.cert_requests
     set status = 'declined', replied_at = now(), reply_note = p_note,
         replied_by = coalesce(p_by, '')
   where id = p_request and status <> 'cleared';
end $$;

revoke all on function public.request_cert(uuid, uuid, text, text, int, text, date, text)
  from public, anon, authenticated;
revoke all on function public.offer_slots(uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.pick_slot(uuid, uuid)             from public, anon, authenticated;
revoke all on function public.clear_request(uuid, text, text)   from public, anon, authenticated;
revoke all on function public.decline_request(uuid, text, text) from public, anon, authenticated;

grant execute on function public.request_cert(uuid, uuid, text, text, int, text, date, text)
  to service_role;
grant execute on function public.offer_slots(uuid, jsonb, text, text)  to service_role;
grant execute on function public.pick_slot(uuid, uuid)                 to service_role;
grant execute on function public.clear_request(uuid, text, text)       to service_role;
grant execute on function public.decline_request(uuid, text, text)     to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0023'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
