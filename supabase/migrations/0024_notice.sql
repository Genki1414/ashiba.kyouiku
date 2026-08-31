-- ═══════════════════════════════════════════════════════════
-- 0024 ホームのお知らせ（本部・担当者からの返事）
--
-- いまは、こちらが手を動かしても、相手には何も伝わらない。
--
--   ・参加申込を許可した     → その人は、開いてみるまで分からない
--   ・入金を確認した         → 担当者は、開いてみるまで分からない
--   ・討議の候補日を出した   → 待っている本人に届かない
--   ・断った                 → 理由がどこにも出ない
--
-- 待っている側は「まだかな」と何度も開くか、開くのをやめる。
-- **開くのをやめた人には、こちらが動いたことが永久に伝わらない。**
--
-- そこで、返事のたびに1行を残す。開けば、いつ何があったか分かる。
-- あとで足す Push は「1件増えた」と叩くだけにして、
-- 中身はここから読む（Push の通り道に本文を流さない）。
--
-- ── 中身をどう持つか ──
-- 開く先（href）は**しまわない。** kind と講座から組み立てる
-- （src/lib/noticeText.ts）。
-- しまうと、行き先が1つでも書き換われば、古い行が迷子になる。
-- 書き込むのはこちら側だけとはいえ、しまった住所へ飛ばす作りは、
-- どこかで外から入れられる道を作ってしまう。
--
-- note は**こちらが書いた一言**（断った理由など）。相手に返る。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  -- 誰に宛てたか。読むのはこの人だけ
  user_id    uuid not null references public.users (id) on delete cascade,
  -- 何があったか。字は src/lib/noticeText.ts の NoticeKind と合わせる
  kind       text not null,
  -- 講座に紐づく知らせだけ入る（討議の日、修了証など）。
  -- courses を参照しない＝講座を入れ替えても、過ぎた知らせは残る
  course_id  text,
  -- こちらが書いた一言。断った理由はここに入って、そのまま相手に出る
  note       text not null default '',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- 新しい順に出す
create index if not exists notices_user_idx
  on public.notices (user_id, created_at desc);
-- 未読の数。ホームの丸い数字を出すのに毎回数える
create index if not exists notices_unread_idx
  on public.notices (user_id) where read_at is null;

alter table public.notices enable row level security;

-- 読めるのは本人だけ。担当者にも本部にも見せない
-- （宛てた本人への返事であって、名簿ではない）
drop policy if exists notices_select_own on public.notices;
create policy notices_select_own on public.notices
  for select using (user_id = auth.uid());

-- insert / update / delete のポリシーは置かない（＝画面からは書けない）。
-- 書くのは下の関数だけ。
-- 置くと、**自分あてに好きな知らせを作れる**。
-- 「許可されました」を自分で書いて、担当者に見せることができてしまう。

-- ── 1件足す ────────────────────────────────
-- 同じ返事を続けて2回押したときに2行にしない。
-- 押し間違いの押し直しは日常にあるので、そのたび増えると読めなくなる。
-- **60秒のあいだの、同じ宛先・同じ種類・同じ講座は1行にまとめる**
-- （note は新しいほうで上書きし、未読に戻す）。
-- 断ってから出し直した、のような**中身の変わる押し直し**でも、
-- 相手が見るのは最後の1件でよい。
create or replace function public.add_notice(
  p_user   uuid,
  p_kind   text,
  p_course text default null,
  p_note   text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null or coalesce(trim(p_kind), '') = '' then
    return null;
  end if;

  select id into v_id
    from public.notices
   where user_id = p_user
     and kind = p_kind
     and course_id is not distinct from p_course
     and created_at > now() - interval '60 seconds'
   order by created_at desc
   limit 1
   for update;

  if v_id is not null then
    update public.notices
       set note = coalesce(p_note, ''), created_at = now(), read_at = null
     where id = v_id;
    return v_id;
  end if;

  insert into public.notices (user_id, kind, course_id, note)
  values (p_user, p_kind, nullif(trim(coalesce(p_course, '')), ''), coalesce(p_note, ''))
  returning id into v_id;
  return v_id;
end $$;

-- ── 読んだ印 ────────────────────────────────
-- 1件ずつではなく、開いたら全部を読んだことにする。
-- 1件ずつ押させると、押し忘れた古い1件がいつまでも数に残って、
-- 丸い数字が消えなくなる。消えない数字は、そのうち見られなくなる。
create or replace function public.read_notices(
  p_user uuid
) returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update public.notices set read_at = now()
   where user_id = p_user and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 古いものを捨てる ────────────────────────
-- 知らせは記録ではない。読んだあとの1年前の「許可されました」に用は無い。
-- 受けた記録そのものは enrollments / certificates に残る（0016 の3年保存）。
create or replace function public.sweep_notices(
  p_days int default 180
) returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from public.notices
   where created_at < now() - (greatest(1, p_days) || ' days')::interval;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.add_notice(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.read_notices(uuid)                 from public, anon, authenticated;
revoke all on function public.sweep_notices(int)                 from public, anon, authenticated;

grant execute on function public.add_notice(uuid, text, text, text) to service_role;
grant execute on function public.read_notices(uuid)                 to service_role;
grant execute on function public.sweep_notices(int)                 to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0024'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
