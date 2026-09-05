-- ═══════════════════════════════════════════════════════════
-- 0027 実技の実施記録を、発行申請に添える
--
-- なぜ要るか
--   実技のある特別教育（いま38講座）は、学科をうちで受けたあと、
--   実技を事業者が自社で行う。うちが見ていたのは、発行申請に入れてもらう
--   「実技を行った日」と「行った人の名前」の2つだけだった。
--
--   **それは、実技をやったことの証明になっていない。**
--   日付と名前は、打ち込めば通ってしまう。
--
--   決めたこと（げんきさん・2026年9月5日）
--     ・実技の手引きに、**実施記録の様式**を付ける。印刷して使う
--     ・様式には、**実施内容（講座ごとに決めておく。チェックできる）**、
--       **参加者名**、**実施事業者名**、**実施事業者印**を入れる
--     ・**発行申請のときに、書いた記録を撮って（かPDFで）アップロードする**
--     ・**本部が中身を見て確認してから、修了証を出せるようにする**
--
-- 置き場所
--   Supabase Storage は使わず、この表に入れる。
--   ・記録は3年保存する決まりのもの。受講の記録と同じ寿命なので、
--     同じデータベースに置いて、同じ消し方（0016の消去）に乗せる
--   ・申請が消えれば、記録も消える（on delete cascade）
--   ・そのかわり大きさを絞る。1件5MB・合計10MB・最大3件。
--     写真は端末側で縮めてから送る（src/lib/shrink.ts）
-- ═══════════════════════════════════════════════════════════

create table if not exists public.cert_request_files (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.cert_requests (id) on delete cascade,
  -- 出した人。あとから誰が付けたか分かるように
  user_id     uuid references public.users (id) on delete set null,
  -- 元のファイル名。画面に出すだけ
  filename    text not null default '',
  -- image/jpeg, image/png, application/pdf のどれか
  mime        text not null,
  -- 中身。data URL（"data:image/jpeg;base64,…"）で持つ。
  -- bytea にすると PostgREST 越しの読み書きが16進の文字列になって扱いにくい
  data        text not null,
  -- data URL の長さ。並べるときに、いちいち中身を読まないため
  size_bytes  int  not null default 0 check (size_bytes >= 0),
  uploaded_at timestamptz not null default now()
);
create index if not exists cert_request_files_req_idx
  on public.cert_request_files (request_id, uploaded_at);

comment on table public.cert_request_files is
  '実技の実施記録（写真・PDF）。発行申請に添える。本部が見て確認してから修了証を出す';
comment on column public.cert_request_files.data is
  'data URL。3年保存の記録の一部なので、申請が消えるまで残す';

alter table public.cert_request_files enable row level security;

-- 本人と、同じ事業者の担当者だけが見られる（cert_requests と同じ考え方）
drop policy if exists cert_request_files_select_own on public.cert_request_files;
create policy cert_request_files_select_own on public.cert_request_files
  for select using (
    exists (
      select 1 from public.cert_requests r
       where r.id = public.cert_request_files.request_id
         and r.user_id = auth.uid()
    )
  );

drop policy if exists cert_request_files_select_company on public.cert_request_files;
create policy cert_request_files_select_company on public.cert_request_files
  for select using (
    public.is_admin() and exists (
      select 1 from public.cert_requests r
       join public.users u on u.id = r.user_id
       where r.id = public.cert_request_files.request_id
         and u.company_id = (select company_id from public.users where id = auth.uid())
    )
  );

-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）。
-- 入れるのは下の request_cert だけ。

-- ── 申請を出す（実施記録も一緒に入れる）────────
-- **先に 0023 の8引数のほうを落とす。**
-- create or replace は引数が違えば別の関数になるので、
-- 消さずに足すと、**記録を見ない古いほうが残ったまま**になる。
-- 名前で呼ぶ（PostgREST の rpc）と、どちらに当たるか分からない。
drop function if exists public.request_cert(uuid, uuid, text, text, int, text, date, text);

-- 0023 の request_cert に p_files を足した。
-- **申請と記録を別々に入れると、記録の無い申請ができてしまう。**
-- 一つの関数の中で入れ替えるので、途中で切れても片方だけ残らない。
create or replace function public.request_cert(
  p_enrollment uuid,
  p_user       uuid,
  p_course     text,
  p_kind       text,
  p_subject    int  default 1,
  p_note       text default '',
  p_drill_on   date default null,
  p_drill_by   text default '',
  p_files      jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text; v_n int; v_total bigint;
begin
  -- 実技の申請は、実施記録が要る。ここで断る
  if p_kind = 'drill' then
    if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) = 0 then
      raise exception '実技の実施記録を添えてください';
    end if;
    v_n := jsonb_array_length(p_files);
    if v_n > 3 then
      raise exception '実施記録は3件までです';
    end if;
    select coalesce(sum(length(f->>'data')), 0) into v_total
      from jsonb_array_elements(p_files) f;
    if v_total > 14000000 then
      raise exception '実施記録が大きすぎます';
    end if;
  end if;

  select id, status into v_id, v_status
    from public.cert_requests where enrollment_id = p_enrollment for update;

  if v_id is null then
    insert into public.cert_requests
      (enrollment_id, course_id, user_id, kind, talk_subject, note, drill_on, drill_by)
    values
      (p_enrollment, p_course, p_user, p_kind, greatest(1, coalesce(p_subject, 1)),
       coalesce(p_note, ''), p_drill_on, coalesce(p_drill_by, ''))
    returning id into v_id;
  else
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
  end if;

  -- 記録を入れ替える。出し直したら、前に付けたものは残さない
  if p_files is not null and jsonb_typeof(p_files) = 'array' then
    delete from public.cert_request_files where request_id = v_id;
    insert into public.cert_request_files (request_id, user_id, filename, mime, data, size_bytes)
    select v_id, p_user,
           left(coalesce(f->>'name', ''), 200),
           coalesce(f->>'mime', 'application/octet-stream'),
           f->>'data',
           length(f->>'data')
      from jsonb_array_elements(p_files) f
     where coalesce(f->>'data', '') <> '';
  end if;

  return v_id;
end $$;

revoke all on function public.request_cert(uuid, uuid, text, text, int, text, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.request_cert(uuid, uuid, text, text, int, text, date, text, jsonb)
  to service_role;

-- ── 通す（本部）────────────────────────────
-- **実技の申請は、実施記録が付いていなければ通せない。**
-- 画面の作りだけで縛ると、画面を変えた日に抜ける。ここで止める。
create or replace function public.clear_request(
  p_request uuid,
  p_note    text default '',
  p_by      text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  select kind into v_kind from public.cert_requests where id = p_request;
  if v_kind = 'drill'
     and not exists (select 1 from public.cert_request_files where request_id = p_request) then
    raise exception '実技の実施記録が付いていません';
  end if;
  -- ここから下は 0023 のまま。足したのは上の一つだけ
  update public.cert_requests
     set status = 'cleared', cleared_at = coalesce(cleared_at, now()),
         reply_note = coalesce(nullif(p_note, ''), reply_note),
         replied_by = coalesce(nullif(p_by, ''), replied_by),
         replied_at = now()
   where id = p_request;
end $$;

revoke all on function public.clear_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.clear_request(uuid, text, text) to service_role;

-- ── 3年たった人を消すとき、実施記録も消す ──────
-- 実施記録には、**参加者名・事業者名・印**が写っている。個人の記録そのもの。
-- 0016 は顔の照合ログと資格を消していたが、この写真は残ってしまう。
create or replace function public.erase_learner(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.users where id = p_user;
  if v_name is null then
    return false;
  end if;

  if exists (
    select 1 from public.memberships m
     where m.user_id = p_user and m.approved_at is not null and m.left_at is null
  ) then
    raise exception 'まだ事業者に在籍している人は消せません';
  end if;

  -- 顔の照合ログ。誰がいつ止まったかは、個人の記録そのもの
  delete from public.verify_logs v
   using public.enrollments e
   where v.enrollment_id = e.id and e.user_id = p_user;

  -- よそで取った資格（自己申告）
  delete from public.held_quals where user_id = p_user;

  -- **実技の実施記録（写真・PDF）。参加者名と事業者の印が写っている**
  delete from public.cert_request_files f
   using public.cert_requests r
   where f.request_id = r.id and r.user_id = p_user;

  -- 氏名・メール・生年月日。受講の記録そのものは残す
  update public.users
     set name       = '（削除済み）',
         email      = null,
         birth_date = null,
         erased_at  = now()
   where id = p_user;

  return true;
end $$;

revoke all on function public.erase_learner(uuid) from public, anon, authenticated;
grant execute on function public.erase_learner(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0027'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
