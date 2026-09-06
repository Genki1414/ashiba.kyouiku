-- ═══════════════════════════════════════════════════════════
-- 本番の Supabase に流すもの（2026年9月6日）
--
-- Supabase の SQL Editor に、このファイルを丸ごと貼って Run。
--
-- 中身は四つ
--   1. 0025 受講リクエスト
--   2. 0026 修了証の写し（出したときの講座名・法令版を紙に焼く）
--   3. 0027 実技の実施記録
--   4. 講座73本と単元905の登録（courses / lessons の入れ直し）
--
-- **何度流しても同じ結果になるように書いてあります。**
-- 表も列も policy も関数も「無ければ作る／あれば作り直す」で、
-- 講座と単元は on conflict の入れ直し。途中で止まってもう一度
-- 流して構いません。
--
-- **人のデータ（会社・受講者・修了証・席）には一切触りません。**
-- このファイルが流す文の中に、消す文（delete / truncate / drop table）は
-- 一つもありません。関数の中身には delete が出てきますが、それは
-- 「あとで画面から呼ばれたときに、その人の申請を出し直す」ための行で、
-- **このファイルを流した時点では、一行も動きません。**
-- drop があるのは policy と関数だけで、どれも直後に作り直します。
--
-- 最後に確かめの select が出ます。
--   講座 73 ／ 単元 905 ／ 版 0027
-- ここが合っていれば、流し終わりです。
-- ═══════════════════════════════════════════════════════════

begin;



-- ═══════════════════════════════════════════════════════════
-- ▼ 0025　受講リクエスト
-- ═══════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════
-- ▼ 0026　修了証の写し
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 0026 修了証に、出したときの中身を焼き付ける
--
-- なぜ要るか
--   いままで certificates は「誰の受講か」と「番号」と「出した日」しか
--   持っていなかった。修了証の紙に載る講座名・科目・法定時間・根拠は、
--   見るたびに src/content/courses.ts の**そのときの値**から作っていた。
--
--   だから、法令が変わって講座を直した日に、
--   **前に出した修了証の中身まで変わってしまう。**
--   3年保存している記録が、あとから書き換わるということ。
--   これは記録として成り立たない。
--
-- 決めたこと
--   ・発行した瞬間の、講座名・根拠・法定時間・科目・法令バージョンを
--     certificates の行に書き込む（スナップショット）
--   ・照会も再表示も、**書き込んだ値を使う**。教材の側は見ない
--   ・0026 より前に出した修了証は、この欄が空。空のときだけ、
--     いまの教材の値で補って表示する（嘘をつかないよう、画面に断りを出す）
--
--   法令バージョンは src/content/courses.ts の LAW_VERSION（と講座ごとの
--   上書き）。法令が変わって講座を直したら、その講座の版を上げる。
-- ═══════════════════════════════════════════════════════════

alter table public.certificates
  -- どの講座か。courses.id と同じ文字。参照は張らない
  -- （講座を並べ替えたり消したりしても、出した紙は残る）
  add column if not exists course_id    text,
  -- 出したときの正式名称
  add column if not exists course_name  text,
  -- 出したときの法令の根拠
  add column if not exists basis        text,
  -- 出したときの法定時間（分）。学科（＋討議）
  add column if not exists total_min    integer,
  -- 出したときの科目と時間。[{ "id":1, "name":"…", "min":60 }, …]
  add column if not exists subjects     jsonb,
  -- 出したときの法令バージョン（courses.ts の LAW_VERSION）
  add column if not exists law_version  text;

comment on column public.certificates.course_name is
  '発行した時点の講座名。あとから教材を直しても書き換えない';
comment on column public.certificates.law_version is
  '発行した時点の法令バージョン。法令改正で講座を直しても、出した紙は変わらない';

-- 番号で照会するときに引く
create index if not exists certificates_course_idx on public.certificates (course_id);

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0026'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- ▼ 0027　実技の実施記録
-- ═══════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════
-- ▼ 講座と単元　73講座 905単元
-- ═══════════════════════════════════════════════════════════

insert into public.courses (id, name, basis, total_min, sort_order) values
  ('ashiba', '足場の組立て等の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号', 360, 1),
  ('shokucho', '職長・安全衛生責任者教育', '労働安全衛生法第60条／労働安全衛生規則第40条', 840, 2),
  ('ishiwata', '石綿使用建築物等解体等業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第37号／石綿障害予防規則第27条第1項', 270, 3),
  ('kousho', '高所作業車の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第10号の5／安全衛生特別教育規程第13条', 360, 4),
  ('harness', '墜落制止用器具のうちフルハーネス型のものを用いて行う作業に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第41号／安全衛生特別教育規程第24条', 270, 5),
  ('rope', 'ロープ高所作業に係る業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第40号／安全衛生特別教育規程第23条', 240, 6),
  ('funjin', '特定粉じん作業に係る業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第29号／粉じん障害防止規則第22条／粉じん作業特別教育規程', 270, 7),
  ('forklift', 'フォークリフト（最大荷重1トン未満）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第5号／安全衛生特別教育規程第7条', 360, 8),
  ('tailgate', 'テールゲートリフターの操作の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第5号の4／安全衛生特別教育規程第7条の4', 240, 9),
  ('toishi', '自由研削用といしの取替え又は取替え時の試運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第1号／安全衛生特別教育規程第2条', 240, 10),
  ('teiatsu', '低圧電気取扱業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第4号／安全衛生特別教育規程第6条', 420, 11),
  ('winch', '巻上げ機の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第11号／安全衛生特別教育規程第14条', 360, 12),
  ('roller', 'ローラーの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第10号／安全衛生特別教育規程第12条', 360, 13),
  ('chainsaw', 'チェーンソーを用いて行う立木の伐木、かかり木の処理又は造材の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第8号／安全衛生特別教育規程第10条', 540, 14),
  ('arc', 'アーク溶接等の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第3号／安全衛生特別教育規程第4条', 660, 15),
  ('compressor', '作業室及び気こう室へ送気するための空気圧縮機を運転する業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第1号／高気圧業務特別教育規程第1条', 600, 16),
  ('soukiroom', '作業室への送気の調節を行うためのバルブ又はコツクを操作する業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第2号／高気圧業務特別教育規程第2条', 600, 17),
  ('kikoushitsu', '気こう室への送気又は気こう室からの排気の調節を行うためのバルブ又はコツクを操作する業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第3号／高気圧業務特別教育規程第3条', 540, 18),
  ('soukisensui', '潜水作業者への送気の調節を行うためのバルブ又はコツクを操作する業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第4号／高気圧業務特別教育規程第4条', 540, 19),
  ('saiatsushitsu', '再圧室を操作する業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第5号／高気圧業務特別教育規程第5条', 540, 20),
  ('kouatsushitsu', '高圧室内業務に係る特別教育', '労働安全衛生法第59条第3項／高気圧作業安全衛生規則第11条第1項第6号／高気圧業務特別教育規程第6条', 420, 21),
  ('senryouka', '特定線量下業務に係る特別教育', '労働安全衛生法第59条第3項／除染則第25条の8第1項／除染等業務特別教育及び特定線量下業務特別教育規程第5条', 150, 22),
  ('josendojo', '除染等業務（土壌等の除染等）に係る特別教育', '労働安全衛生法第59条第3項／除染則第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程第1条〜第3条', 240, 23),
  ('josenshushu', '除染等業務（除去土壌の収集等）に係る特別教育', '労働安全衛生法第59条第3項／除染則第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程第1条〜第3条', 240, 24),
  ('josenhaiki', '除染等業務（汚染廃棄物の収集等）に係る特別教育', '労働安全衛生法第59条第3項／除染則第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程第1条〜第3条', 240, 25),
  ('josentokutei', '除染等業務（特定汚染土壌等取扱業務）に係る特別教育', '労働安全衛生法第59条第3項／除染則第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程第1条〜第3条', 210, 26),
  ('josentokuteigai', '除染等業務（特定汚染土壌等取扱業務（線量管理外））に係る特別教育', '労働安全衛生法第59条第3項／除染則第19条第1項／除染等業務特別教育及び特定線量下業務特別教育規程第1条〜第3条', 210, 27),
  ('tokureikinkyu', '特例緊急作業に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の9第1項／特例緊急作業特別教育規程第2条・第3条', 390, 28),
  ('haikihasai', '事故由来廃棄物等の処分の業務（破砕等）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の8第1項／事故由来廃棄物等処分業務特別教育規程第2条・第3条', 300, 29),
  ('haikishokyaku', '事故由来廃棄物等の処分の業務（焼却）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の8第1項／事故由来廃棄物等処分業務特別教育規程第2条・第3条', 300, 30),
  ('haikiumetate', '事故由来廃棄物等の処分の業務（埋立て）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の8第1項／事故由来廃棄物等処分業務特別教育規程第2条・第3条', 300, 31),
  ('xrayki', 'エックス線装置又はガンマ線照射装置を取り扱う業務（エックス線装置）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の5第1項／エックス線装置及びガンマ線照射装置取扱業務特別教育規程', 270, 32),
  ('gammaki', 'エックス線装置又はガンマ線照射装置を取り扱う業務（ガンマ線照射装置）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の5第1項／エックス線装置及びガンマ線照射装置取扱業務特別教育規程', 270, 33),
  ('xraygammaki', 'エックス線装置又はガンマ線照射装置を取り扱う業務（エックス線装置とガンマ線照射装置の両方）に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の5第1項／エックス線装置及びガンマ線照射装置取扱業務特別教育規程', 360, 34),
  ('kakunenkakou', '加工施設等（加工施設）において核燃料物質等を取り扱う業務に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の6第1項／核燃料物質等取扱業務特別教育規程第1条', 330, 35),
  ('kakunensaishori', '加工施設等（再処理施設）において核燃料物質等を取り扱う業務に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の6第1項／核燃料物質等取扱業務特別教育規程第1条', 330, 36),
  ('kakunenshiyou', '加工施設等（使用施設等）において核燃料物質等を取り扱う業務に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の6第1項／核燃料物質等取扱業務特別教育規程第1条', 330, 37),
  ('kakunengenshiro', '原子炉施設において核燃料物質等を取り扱う業務に係る特別教育', '労働安全衛生法第59条第3項／電離放射線障害防止規則第52条の7第1項／核燃料物質等取扱業務特別教育規程第2条', 300, 38),
  ('tetraalkyl', '四アルキル鉛等業務に係る特別教育', '労働安全衛生法第59条第3項／四アルキル鉛中毒予防規則第21条第1項／四アルキル鉛等業務特別教育規程', 360, 39),
  ('boiler', '小型ボイラーの取扱いの業務に係る特別教育', '労働安全衛生法第59条第3項／ボイラー及び圧力容器安全規則第92条第1項／小型ボイラー取扱業務特別教育規程第2条', 420, 40),
  ('gondola', 'ゴンドラの操作の業務に係る特別教育', '労働安全衛生法第59条第3項／ゴンドラ安全規則第12条第1項／ゴンドラ取扱い業務特別教育規程第2条', 300, 41),
  ('derrick', 'つり上げ荷重5トン未満のデリツクの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／クレーン等安全規則第107条第1項／クレーン取扱い業務等特別教育規程第3条', 540, 42),
  ('kensetsulift', '建設用リフトの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／クレーン等安全規則第183条第1項／クレーン取扱い業務等特別教育規程第4条', 300, 43),
  ('mobilecrane', 'つり上げ荷重1トン未満の移動式クレーンの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／クレーン等安全規則第67条第1項／クレーン取扱い業務等特別教育規程第2条', 540, 44),
  ('crane', 'つり上げ荷重5トン未満のクレーン及びつり上げ荷重5トン以上の跨線テルハの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／クレーン等安全規則第21条／クレーン取扱い業務等特別教育規程第1条', 540, 45),
  ('tamakake', 'つり上げ荷重1トン未満のクレーン等の玉掛けの業務に係る特別教育', '労働安全衛生法第59条第3項／クレーン等安全規則第222条／クレーン取扱い業務等特別教育規程第5条', 300, 46),
  ('tokushu', '特殊化学設備の取扱い、整備及び修理の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第27号／安全衛生特別教育規程第16条', 780, 47),
  ('tire', '自動車用タイヤの組立てに係る空気充てんの業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第33号／安全衛生特別教育規程第20条', 300, 48),
  ('robotkensa', '産業用ロボットの可動範囲内において行う検査等の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第32号／安全衛生特別教育規程第19条', 540, 49),
  ('robotkyoji', '産業用ロボットの可動範囲内において行う教示等の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第31号／安全衛生特別教育規程第18条', 420, 50),
  ('kidou', '軌道装置の動力車の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第13号／安全衛生特別教育規程第15条', 360, 51),
  ('jack', 'ジャッキ式つり上げ機械の調整又は運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第10号の4／安全衛生特別教育規程第12条の4', 360, 52),
  ('boring', 'ボーリングマシンの運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第10号の3／安全衛生特別教育規程第12条の3', 420, 53),
  ('concrete', 'コンクリート打設用機械の作業装置の操作の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第10号の2／安全衛生特別教育規程第12条の2', 420, 54),
  ('kisosousa', '車両系建設機械（基礎工事用）の作業装置の操作の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号の3／安全衛生特別教育規程第11条の5', 300, 55),
  ('kisokenki', '基礎工事用建設機械の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号の2／安全衛生特別教育規程第11条の4', 420, 56),
  ('kaitai', '小型車両系建設機械（解体用）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号（令別表第7第6号）／安全衛生特別教育規程第11条の3', 420, 57),
  ('kisokouji', '小型車両系建設機械（基礎工事用）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号（令別表第7第3号）／安全衛生特別教育規程第11条の2', 420, 58),
  ('kanikasen', '簡易架線集材装置の運転又は架線集材機械の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第7号の2／安全衛生特別教育規程第9条の2', 360, 59),
  ('kikaishuzai', '機械集材装置の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第7号／安全衛生特別教育規程第9条', 360, 60),
  ('soukou', '走行集材機械の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第6号の3／安全衛生特別教育規程第8条の3', 360, 61),
  ('batsuboku', '伐木等機械の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第6号の2／安全衛生特別教育規程第8条の2', 360, 62),
  ('youka', '揚貨装置（制限荷重5トン未満）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第6号／安全衛生特別教育規程第8条', 660, 63),
  ('press', '動力プレスの金型等の取付け、取外し又は調整の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第2号／安全衛生特別教育規程第3条', 480, 64),
  ('dioxin', 'ダイオキシン類のばく露防止に係る業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第34号から第36号まで／安全衛生特別教育規程第21条', 240, 65),
  ('zuidou', 'ずい道等の掘削等の作業に係る業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第30号／安全衛生特別教育規程第17条', 420, 66),
  ('ev', '電気自動車等の整備の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第4号の2／安全衛生特別教育規程第6条の2', 360, 67),
  ('kouatsu', '高圧・特別高圧電気取扱業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第4号／安全衛生特別教育規程第5条', 660, 68),
  ('fuseichi', '不整地運搬車（最大積載量1トン未満）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第5号の3／安全衛生特別教育規程第7条の3', 360, 69),
  ('shovel', 'ショベルローダー等（最大荷重1トン未満）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第5号の2／安全衛生特別教育規程第7条の2', 360, 70),
  ('kikaitoishi', '機械研削用といしの取替え又は取替え時の試運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第1号／安全衛生特別教育規程第1条', 420, 71),
  ('kogata', '小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号／安全衛生特別教育規程第11条', 420, 72),
  ('sanketsu', '酸素欠乏・硫化水素危険作業に係る業務に係る特別教育', '労働安全衛生法第59条第3項／酸素欠乏症等防止規則第12条／酸素欠乏危険作業特別教育規程第2条', 330, 73)
on conflict (id) do update
  set name       = excluded.name,
      basis      = excluded.basis,
      total_min  = excluded.total_min,
      sort_order = excluded.sort_order;

insert into public.lessons (lesson_id, course_id, subject_id, title, legal_min, sort_order) values
  ('ashiba:1-1', 'ashiba', 1, '足場の種類、材料、構造及び組立図', 50, 0),
  ('ashiba:1-2', 'ashiba', 1, '組立て、解体及び変更の作業の方法', 60, 1),
  ('ashiba:1-3', 'ashiba', 1, '点検及び補修', 40, 2),
  ('ashiba:1-4', 'ashiba', 1, '登り桟橋、朝顔等の構造と作業の方法', 30, 3),
  ('ashiba:2-1', 'ashiba', 2, '工事用設備及び機械の取扱い', 10, 100),
  ('ashiba:2-2', 'ashiba', 2, '器具及び工具', 10, 101),
  ('ashiba:2-3', 'ashiba', 2, '悪天候時における作業の方法', 10, 102),
  ('ashiba:3-1', 'ashiba', 3, '墜落による危険の防止', 35, 200),
  ('ashiba:3-2', 'ashiba', 3, '飛来落下・倒壊による危険の防止', 25, 201),
  ('ashiba:3-3', 'ashiba', 3, '保護具の使用方法と保守点検', 20, 202),
  ('ashiba:3-4', 'ashiba', 3, '感電・熱中症その他の危険の防止', 10, 203),
  ('ashiba:4-1', 'ashiba', 4, '法、令及び安衛則中の関係条項', 35, 300),
  ('ashiba:4-2', 'ashiba', 4, '事業者と作業者の義務、企業責任', 25, 301),
  ('shokucho:1-1', 'shokucho', 1, '作業方法の決定と作業手順書', 60, 0),
  ('shokucho:1-2', 'shokucho', 1, '労働者の配置と作業前打合せ', 60, 1),
  ('shokucho:2-1', 'shokucho', 2, '部下に対する指導・育成', 75, 100),
  ('shokucho:2-2', 'shokucho', 2, '作業中の監督と指示', 75, 101),
  ('shokucho:3-1', 'shokucho', 3, '危険性又は有害性等の調査の方法', 65, 200),
  ('shokucho:3-2', 'shokucho', 3, '調査の結果に基づき講ずる措置', 65, 201),
  ('shokucho:3-3', 'shokucho', 3, '設備、作業等の具体的な改善の方法', 65, 202),
  ('shokucho:4-1', 'shokucho', 4, '異常時における措置', 45, 300),
  ('shokucho:4-2', 'shokucho', 4, '災害発生時における措置', 45, 301),
  ('shokucho:5-1', 'shokucho', 5, '保守管理と安全衛生点検', 60, 400),
  ('shokucho:5-2', 'shokucho', 5, '災害防止への関心の保持と創意工夫', 60, 401),
  ('shokucho:6-1', 'shokucho', 6, '安全衛生責任者の職務と作業間の連絡調整', 60, 500),
  ('shokucho:6-2', 'shokucho', 6, '安全施工サイクルによる安全衛生活動', 60, 501),
  ('ishiwata:1-1', 'ishiwata', 1, '石綿の性状', 10, 0),
  ('ishiwata:1-2', 'ishiwata', 1, '石綿による疾病の病理及び症状', 10, 1),
  ('ishiwata:1-3', 'ishiwata', 1, '喫煙の影響', 10, 2),
  ('ishiwata:2-1', 'ishiwata', 2, '石綿を含有する製品の種類及び用途', 30, 100),
  ('ishiwata:2-2', 'ishiwata', 2, '事前調査の方法', 30, 101),
  ('ishiwata:3-1', 'ishiwata', 3, '解体等の作業の方法', 20, 200),
  ('ishiwata:3-2', 'ishiwata', 3, '湿潤化の方法', 15, 201),
  ('ishiwata:3-3', 'ishiwata', 3, '作業場所の隔離の方法', 15, 202),
  ('ishiwata:3-4', 'ishiwata', 3, 'その他の発散を抑制するための措置', 10, 203),
  ('ishiwata:4-1', 'ishiwata', 4, '保護具の種類と性能', 30, 300),
  ('ishiwata:4-2', 'ishiwata', 4, '保護具の使用方法及び管理', 30, 301),
  ('ishiwata:5-1', 'ishiwata', 5, '法、令、安衛則及び石綿則中の関係条項', 35, 400),
  ('ishiwata:5-2', 'ishiwata', 5, '石綿等による健康障害の防止', 25, 401),
  ('kousho:1-1', 'kousho', 1, '高所作業車の種類及び用途', 60, 0),
  ('kousho:1-2', 'kousho', 1, '作業装置の構造及び取扱いの方法', 60, 1),
  ('kousho:1-3', 'kousho', 1, '附属装置の構造及び取扱いの方法', 60, 2),
  ('kousho:2-1', 'kousho', 2, '内燃機関の構造及び取扱いの方法', 30, 100),
  ('kousho:2-2', 'kousho', 2, '動力伝達装置及び走行装置の種類', 30, 101),
  ('kousho:3-1', 'kousho', 3, '運転に必要な力学', 30, 200),
  ('kousho:3-2', 'kousho', 3, '感電による危険性', 30, 201),
  ('kousho:4-1', 'kousho', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('harness:1-1', 'harness', 1, '作業に用いる設備の種類、構造及び取扱い方法', 25, 0),
  ('harness:1-2', 'harness', 1, '作業に用いる設備の点検及び整備の方法', 15, 1),
  ('harness:1-3', 'harness', 1, '作業の方法', 20, 2),
  ('harness:2-1', 'harness', 2, 'フルハーネスとランヤードの種類及び構造', 30, 100),
  ('harness:2-2', 'harness', 2, 'フルハーネスの装着の方法', 25, 101),
  ('harness:2-3', 'harness', 2, 'ランヤードの取付け方法及び選定方法', 30, 102),
  ('harness:2-4', 'harness', 2, '墜落制止用器具の点検及び整備の方法', 20, 103),
  ('harness:2-5', 'harness', 2, '関連器具の使用方法', 15, 104),
  ('harness:3-1', 'harness', 3, '墜落による労働災害の防止のための措置', 10, 200),
  ('harness:3-2', 'harness', 3, '落下物による危険防止のための措置', 10, 201),
  ('harness:3-3', 'harness', 3, '感電防止のための措置', 10, 202),
  ('harness:3-4', 'harness', 3, '保護帽の使用方法及び保守点検の方法', 10, 203),
  ('harness:3-5', 'harness', 3, '事故発生時の措置', 10, 204),
  ('harness:3-6', 'harness', 3, 'その他作業に伴う災害及びその防止方法', 10, 205),
  ('harness:4-1', 'harness', 4, '法、令及び安衛則中の関係条項', 30, 300),
  ('rope:1-1', 'rope', 1, 'ロープ高所作業の方法', 25, 0),
  ('rope:1-2', 'rope', 1, '作業に用いる設備の種類、構造及び取扱い方法', 20, 1),
  ('rope:1-3', 'rope', 1, '作業に用いる設備の点検及び整備の方法', 15, 2),
  ('rope:2-1', 'rope', 2, 'メインロープ等の種類、構造、強度及び取扱い方法', 35, 100),
  ('rope:2-2', 'rope', 2, 'メインロープ等の点検及び整備の方法', 25, 101),
  ('rope:3-1', 'rope', 3, '墜落による労働災害の防止のための措置', 10, 200),
  ('rope:3-2', 'rope', 3, '落下物による危険防止のための措置', 10, 201),
  ('rope:3-3', 'rope', 3, '感電防止のための措置', 10, 202),
  ('rope:3-4', 'rope', 3, '保護帽の使用方法及び保守点検の方法', 10, 203),
  ('rope:3-5', 'rope', 3, '事故発生時の措置', 10, 204),
  ('rope:3-6', 'rope', 3, 'その他作業に伴う災害及びその防止方法', 10, 205),
  ('rope:4-1', 'rope', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('funjin:1-1', 'funjin', 1, '粉じんの発散防止対策の種類及び概要', 35, 0),
  ('funjin:1-2', 'funjin', 1, '換気の種類及び概要', 25, 1),
  ('funjin:2-1', 'funjin', 2, '設備の保守点検の方法', 25, 100),
  ('funjin:2-2', 'funjin', 2, '作業環境の点検の方法', 20, 101),
  ('funjin:2-3', 'funjin', 2, '清掃の方法', 15, 102),
  ('funjin:3-1', 'funjin', 3, '呼吸用保護具の種類、性能、使用方法及び管理', 30, 200),
  ('funjin:4-1', 'funjin', 4, '粉じんの有害性', 15, 300),
  ('funjin:4-2', 'funjin', 4, '粉じんによる疾病の病理及び症状', 25, 301),
  ('funjin:4-3', 'funjin', 4, '健康管理の方法', 20, 302),
  ('funjin:5-1', 'funjin', 5, '法、令、安衛則及び粉じん則中の関係条項', 60, 400),
  ('forklift:1-1', 'forklift', 1, '種類と、原動機・動力伝達装置', 40, 0),
  ('forklift:1-2', 'forklift', 1, '走行装置・かじ取り装置・制動装置', 40, 1),
  ('forklift:1-3', 'forklift', 1, '走行に関する附属装置と取扱い方法', 40, 2),
  ('forklift:2-1', 'forklift', 2, '荷役装置（マスト・フォーク・チェーン）', 40, 100),
  ('forklift:2-2', 'forklift', 2, '油圧装置と安全弁', 40, 101),
  ('forklift:2-3', 'forklift', 2, 'ヘッドガード・バックレストと荷役の附属装置・取扱い方法', 40, 102),
  ('forklift:3-1', 'forklift', 3, '力（合成、分解、つり合い及びモーメント）', 10, 200),
  ('forklift:3-2', 'forklift', 3, '重量', 7, 201),
  ('forklift:3-3', 'forklift', 3, '重心及び物の安定', 12, 202),
  ('forklift:3-4', 'forklift', 3, '速度及び加速度', 8, 203),
  ('forklift:3-5', 'forklift', 3, '荷重', 8, 204),
  ('forklift:3-6', 'forklift', 3, '応力', 7, 205),
  ('forklift:3-7', 'forklift', 3, '材料の強さ', 8, 206),
  ('forklift:4-1', 'forklift', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('tailgate:1-1', 'tailgate', 1, '種類、構造及び取扱い方法', 50, 0),
  ('tailgate:1-2', 'tailgate', 1, '点検及び整備の方法', 40, 1),
  ('tailgate:2-1', 'tailgate', 2, '荷の種類及び取扱い方法', 35, 100),
  ('tailgate:2-2', 'tailgate', 2, '台車の種類、構造及び取扱い方法', 30, 101),
  ('tailgate:2-3', 'tailgate', 2, '保護具の着用', 20, 102),
  ('tailgate:2-4', 'tailgate', 2, '災害防止', 35, 103),
  ('tailgate:3-1', 'tailgate', 3, '法、令及び安衛則中の関係条項', 30, 200),
  ('toishi:1-1', 'toishi', 1, '研削盤の種類及び構造並びにその取扱い方法', 35, 0),
  ('toishi:1-2', 'toishi', 1, 'といしの種類、構成、表示及び安全度並びにその取扱い方法', 40, 1),
  ('toishi:1-3', 'toishi', 1, '取付け具', 15, 2),
  ('toishi:1-4', 'toishi', 1, '覆い', 15, 3),
  ('toishi:1-5', 'toishi', 1, '保護具', 15, 4),
  ('toishi:2-1', 'toishi', 2, '研削盤とといしとの適合確認', 10, 100),
  ('toishi:2-2', 'toishi', 2, 'といしの外観検査及び打音検査', 15, 101),
  ('toishi:2-3', 'toishi', 2, '取付け具の締付け方法及び締付け力', 12, 102),
  ('toishi:2-4', 'toishi', 2, 'バランスの取り方', 8, 103),
  ('toishi:2-5', 'toishi', 2, '試運転の方法', 15, 104),
  ('toishi:3-1', 'toishi', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('teiatsu:1-1', 'teiatsu', 1, '低圧の電気の危険性', 15, 0),
  ('teiatsu:1-2', 'teiatsu', 1, '短絡', 10, 1),
  ('teiatsu:1-3', 'teiatsu', 1, '漏電', 12, 2),
  ('teiatsu:1-4', 'teiatsu', 1, '接地', 11, 3),
  ('teiatsu:1-5', 'teiatsu', 1, '電気絶縁', 12, 4),
  ('teiatsu:2-1', 'teiatsu', 2, '配電設備', 25, 100),
  ('teiatsu:2-2', 'teiatsu', 2, '変電設備', 20, 101),
  ('teiatsu:2-3', 'teiatsu', 2, '配線', 25, 102),
  ('teiatsu:2-4', 'teiatsu', 2, '電気使用設備', 25, 103),
  ('teiatsu:2-5', 'teiatsu', 2, '保守及び点検', 25, 104),
  ('teiatsu:3-1', 'teiatsu', 3, '絶縁用保護具', 12, 200),
  ('teiatsu:3-2', 'teiatsu', 3, '絶縁用防具', 10, 201),
  ('teiatsu:3-3', 'teiatsu', 3, '活線作業用器具', 10, 202),
  ('teiatsu:3-4', 'teiatsu', 3, '検電器', 12, 203),
  ('teiatsu:3-5', 'teiatsu', 3, 'その他の安全作業用具', 8, 204),
  ('teiatsu:3-6', 'teiatsu', 3, '管理', 8, 205),
  ('teiatsu:4-1', 'teiatsu', 4, '充電電路の防護', 20, 300),
  ('teiatsu:4-2', 'teiatsu', 4, '作業者の絶縁保護', 20, 301),
  ('teiatsu:4-3', 'teiatsu', 4, '停電電路に対する措置', 25, 302),
  ('teiatsu:4-4', 'teiatsu', 4, '作業管理', 20, 303),
  ('teiatsu:4-5', 'teiatsu', 4, '救急処置', 20, 304),
  ('teiatsu:4-6', 'teiatsu', 4, '災害防止', 15, 305),
  ('teiatsu:5-1', 'teiatsu', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('winch:1-1', 'winch', 1, '種類と、原動機・動力伝達装置・電気装置', 40, 0),
  ('winch:1-2', 'winch', 1, 'ブレーキ・クラッチ・巻胴・逆転防止装置', 40, 1),
  ('winch:1-3', 'winch', 1, '信号装置・連結器材・安全装置・各種計器', 30, 2),
  ('winch:1-4', 'winch', 1, '巻上用ワイヤロープの構造及び取扱いの方法', 35, 3),
  ('winch:1-5', 'winch', 1, '巻上げ機の据付方法', 35, 4),
  ('winch:2-1', 'winch', 2, '合図方法', 30, 100),
  ('winch:2-2', 'winch', 2, '荷掛方法', 35, 101),
  ('winch:2-3', 'winch', 2, '連結方法', 25, 102),
  ('winch:2-4', 'winch', 2, '点検方法', 30, 103),
  ('winch:3-1', 'winch', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('roller:1-1', 'roller', 1, 'ローラーの種類及び用途', 50, 0),
  ('roller:1-2', 'roller', 1, '動力伝達装置', 35, 1),
  ('roller:1-3', 'roller', 1, '作業装置（ロール・振動装置・散水装置）', 40, 2),
  ('roller:1-4', 'roller', 1, 'かじ取り装置', 30, 3),
  ('roller:1-5', 'roller', 1, 'ブレーキ', 35, 4),
  ('roller:1-6', 'roller', 1, '電気装置・警報装置・附属装置と取扱いの方法', 50, 5),
  ('roller:2-1', 'roller', 2, '運転に必要な力学', 30, 100),
  ('roller:2-2', 'roller', 2, 'ローラーによる施工方法', 30, 101),
  ('roller:3-1', 'roller', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('chainsaw:1-1', 'chainsaw', 1, '伐倒の方法', 60, 0),
  ('chainsaw:1-2', 'chainsaw', 1, '伐倒の合図', 25, 1),
  ('chainsaw:1-3', 'chainsaw', 1, '退避の方法', 35, 2),
  ('chainsaw:1-4', 'chainsaw', 1, 'かかり木の種類及びその処理', 50, 3),
  ('chainsaw:1-5', 'chainsaw', 1, '造材の方法', 45, 4),
  ('chainsaw:1-6', 'chainsaw', 1, '下肢の切創防止用保護衣等の着用', 25, 5),
  ('chainsaw:2-1', 'chainsaw', 2, 'チェーンソーの種類、構造及び取扱い方法', 50, 100),
  ('chainsaw:2-2', 'chainsaw', 2, 'チェーンソーの点検及び整備の方法', 40, 101),
  ('chainsaw:2-3', 'chainsaw', 2, 'ソーチェーンの目立ての方法', 30, 102),
  ('chainsaw:3-1', 'chainsaw', 3, '振動障害の原因及び症状', 60, 200),
  ('chainsaw:3-2', 'chainsaw', 3, '振動障害の予防措置', 60, 201),
  ('chainsaw:4-1', 'chainsaw', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('arc:1-1', 'arc', 1, 'アーク溶接等の基礎理論', 30, 0),
  ('arc:1-2', 'arc', 1, '電気に関する基礎知識', 30, 1),
  ('arc:2-1', 'arc', 2, '直流アーク溶接機', 35, 100),
  ('arc:2-2', 'arc', 2, '交流アーク溶接機', 35, 101),
  ('arc:2-3', 'arc', 2, '交流アーク溶接機用自動電撃防止装置', 45, 102),
  ('arc:2-4', 'arc', 2, '溶接棒等及び溶接棒等のホルダー', 35, 103),
  ('arc:2-5', 'arc', 2, '配線', 30, 104),
  ('arc:3-1', 'arc', 3, '作業前の点検整備', 55, 200),
  ('arc:3-2', 'arc', 3, '溶接の方法', 60, 201),
  ('arc:3-3', 'arc', 3, '溶断・ガウジングの方法', 45, 202),
  ('arc:3-4', 'arc', 3, '溶接部の点検', 45, 203),
  ('arc:3-5', 'arc', 3, '作業後の処置', 45, 204),
  ('arc:3-6', 'arc', 3, '災害防止（感電・アーク光・火災）', 60, 205),
  ('arc:3-7', 'arc', 3, '災害防止（ヒューム・ガス・換気・保護具）', 50, 206),
  ('arc:4-1', 'arc', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('compressor:1-1', 'compressor', 1, '圧気工法の概要', 40, 0),
  ('compressor:1-2', 'compressor', 1, '圧気工法による業務の危険性', 40, 1),
  ('compressor:1-3', 'compressor', 1, '事故発生時の措置', 40, 2),
  ('compressor:2-1', 'compressor', 2, '送気設備の種類と構造', 60, 100),
  ('compressor:2-2', 'compressor', 2, '送気設備の取扱い方法', 60, 101),
  ('compressor:2-3', 'compressor', 2, '送気設備の点検修理の方法', 60, 102),
  ('compressor:2-4', 'compressor', 2, '自動警報装置の構造及び取扱い方法', 60, 103),
  ('compressor:3-1', 'compressor', 3, '高気圧障害の病理と症状', 60, 200),
  ('compressor:3-2', 'compressor', 3, '高気圧障害の予防方法', 60, 201),
  ('compressor:4-1', 'compressor', 4, '関係法令（労働基準法と高圧則）', 60, 300),
  ('compressor:4-2', 'compressor', 4, '関係法令（この持ち場にかかる決まり）', 60, 301),
  ('soukiroom:1-1', 'soukiroom', 1, '圧気工法の概要', 40, 0),
  ('soukiroom:1-2', 'soukiroom', 1, '圧気工法による業務の危険性', 40, 1),
  ('soukiroom:1-3', 'soukiroom', 1, '事故発生時の措置', 40, 2),
  ('soukiroom:2-1', 'soukiroom', 2, '送気の方法', 50, 100),
  ('soukiroom:2-2', 'soukiroom', 2, '排気と換気の方法', 40, 101),
  ('soukiroom:2-3', 'soukiroom', 2, '緊急時の減圧法', 60, 102),
  ('soukiroom:2-4', 'soukiroom', 2, '圧気工法に係る設備の種類及び取扱い方法', 50, 103),
  ('soukiroom:2-5', 'soukiroom', 2, '圧気工法に係る設備の修理の方法', 40, 104),
  ('soukiroom:3-1', 'soukiroom', 3, '高気圧障害の病理と症状', 60, 200),
  ('soukiroom:3-2', 'soukiroom', 3, '高気圧障害の予防方法', 60, 201),
  ('soukiroom:4-1', 'soukiroom', 4, '関係法令（労働基準法と高圧則）', 60, 300),
  ('soukiroom:4-2', 'soukiroom', 4, '関係法令（この持ち場にかかる決まり）', 60, 301),
  ('kikoushitsu:1-1', 'kikoushitsu', 1, '圧気工法の概要', 40, 0),
  ('kikoushitsu:1-2', 'kikoushitsu', 1, '圧気工法による業務の危険性', 40, 1),
  ('kikoushitsu:1-3', 'kikoushitsu', 1, '事故発生時の措置', 40, 2),
  ('kikoushitsu:2-1', 'kikoushitsu', 2, '加圧の仕方', 40, 100),
  ('kikoushitsu:2-2', 'kikoushitsu', 2, '減圧の仕方', 40, 101),
  ('kikoushitsu:2-3', 'kikoushitsu', 2, '換気の仕方', 20, 102),
  ('kikoushitsu:2-4', 'kikoushitsu', 2, '緊急時の減圧法', 45, 103),
  ('kikoushitsu:2-5', 'kikoushitsu', 2, '緊急時の換気法', 35, 104),
  ('kikoushitsu:3-1', 'kikoushitsu', 3, '高気圧障害の病理と症状', 60, 200),
  ('kikoushitsu:3-2', 'kikoushitsu', 3, '高気圧障害の予防方法', 60, 201),
  ('kikoushitsu:4-1', 'kikoushitsu', 4, '関係法令（労働基準法と高圧則）', 60, 300),
  ('kikoushitsu:4-2', 'kikoushitsu', 4, '関係法令（この持ち場にかかる決まり）', 60, 301),
  ('soukisensui:1-1', 'soukisensui', 1, '潜水業務の基礎知識', 40, 0),
  ('soukisensui:1-2', 'soukisensui', 1, '潜水業務の危険性', 30, 1),
  ('soukisensui:1-3', 'soukisensui', 1, '事故発生時の措置', 50, 2),
  ('soukisensui:2-1', 'soukisensui', 2, '送気の方法', 40, 100),
  ('soukisensui:2-2', 'soukisensui', 2, '送気の量と、深さとの関係', 30, 101),
  ('soukisensui:2-3', 'soukisensui', 2, '緊急時の減圧法', 50, 102),
  ('soukisensui:2-4', 'soukisensui', 2, '潜水業務に関する設備の種類及び取扱い方法', 35, 103),
  ('soukisensui:2-5', 'soukisensui', 2, '潜水業務に関する設備の修理の方法', 25, 104),
  ('soukisensui:3-1', 'soukisensui', 3, '高気圧障害の病理と症状', 60, 200),
  ('soukisensui:3-2', 'soukisensui', 3, '高気圧障害の予防方法', 60, 201),
  ('soukisensui:4-1', 'soukisensui', 4, '関係法令（労働基準法と高圧則）', 60, 300),
  ('soukisensui:4-2', 'soukisensui', 4, '関係法令（この持ち場にかかる決まり）', 60, 301),
  ('saiatsushitsu:1-1', 'saiatsushitsu', 1, '高気圧障害の病理と症状', 60, 0),
  ('saiatsushitsu:1-2', 'saiatsushitsu', 1, '高気圧障害の予防方法と、見分け方', 60, 1),
  ('saiatsushitsu:2-1', 'saiatsushitsu', 2, '再圧室に関する基礎知識', 45, 100),
  ('saiatsushitsu:2-2', 'saiatsushitsu', 2, '再圧室の作りと、付属の設備', 35, 101),
  ('saiatsushitsu:2-3', 'saiatsushitsu', 2, '標準再圧治療法', 55, 102),
  ('saiatsushitsu:2-4', 'saiatsushitsu', 2, '治療中の見守りと、記録', 45, 103),
  ('saiatsushitsu:3-1', 'saiatsushitsu', 3, '人工呼吸法', 60, 200),
  ('saiatsushitsu:3-2', 'saiatsushitsu', 3, '人工そ生法', 60, 201),
  ('saiatsushitsu:4-1', 'saiatsushitsu', 4, '関係法令（労働基準法と高圧則）', 60, 300),
  ('saiatsushitsu:4-2', 'saiatsushitsu', 4, '関係法令（再圧室にかかる決まり）', 60, 301),
  ('kouatsushitsu:1-1', 'kouatsushitsu', 1, '圧気工法の概要', 30, 0),
  ('kouatsushitsu:1-2', 'kouatsushitsu', 1, '圧気工法による業務の危険性', 30, 1),
  ('kouatsushitsu:2-1', 'kouatsushitsu', 2, '送気設備の種類及び機能', 25, 100),
  ('kouatsushitsu:2-2', 'kouatsushitsu', 2, '気閘室の機能', 20, 101),
  ('kouatsushitsu:2-3', 'kouatsushitsu', 2, '通話装置の取扱い方法', 15, 102),
  ('kouatsushitsu:3-1', 'kouatsushitsu', 3, '急激な圧力低下による異常出水等の防止方法', 60, 200),
  ('kouatsushitsu:3-2', 'kouatsushitsu', 3, '火災等の防止方法', 50, 201),
  ('kouatsushitsu:3-3', 'kouatsushitsu', 3, '事故発生時の措置', 40, 202),
  ('kouatsushitsu:3-4', 'kouatsushitsu', 3, '保護具の使用方法', 30, 203),
  ('kouatsushitsu:4-1', 'kouatsushitsu', 4, '高気圧障害の病理と症状', 60, 300),
  ('kouatsushitsu:5-1', 'kouatsushitsu', 5, '関係法令（労働基準法と高圧則）', 60, 400),
  ('senryouka:1-1', 'senryouka', 1, '電離放射線の種類及び性質', 15, 0),
  ('senryouka:1-2', 'senryouka', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 1),
  ('senryouka:1-3', 'senryouka', 1, '被ばく限度及び被ばく線量測定の方法', 15, 2),
  ('senryouka:1-4', 'senryouka', 1, '被ばく線量測定の結果の確認及び記録等の方法', 10, 3),
  ('senryouka:2-1', 'senryouka', 2, '放射線測定の方法', 10, 100),
  ('senryouka:2-2', 'senryouka', 2, '外部放射線による線量当量率の監視の方法', 10, 101),
  ('senryouka:2-3', 'senryouka', 2, '異常な事態が発生した場合における応急の措置の方法', 10, 102),
  ('senryouka:3-1', 'senryouka', 3, '関係法令', 60, 200),
  ('josendojo:1-1', 'josendojo', 1, '電離放射線の種類及び性質', 15, 0),
  ('josendojo:1-2', 'josendojo', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 1),
  ('josendojo:1-3', 'josendojo', 1, '被ばく限度及び被ばく線量測定の方法', 15, 2),
  ('josendojo:1-4', 'josendojo', 1, '被ばく線量測定の結果の確認及び記録等の方法', 10, 3),
  ('josendojo:2-1', 'josendojo', 2, '土壌等の除染等の業務に係る作業の方法及び順序', 15, 100),
  ('josendojo:2-2', 'josendojo', 2, '放射線測定の方法', 5, 101),
  ('josendojo:2-3', 'josendojo', 2, '外部放射線による線量当量率の監視の方法', 5, 102),
  ('josendojo:2-4', 'josendojo', 2, '汚染防止措置の方法', 10, 103),
  ('josendojo:2-5', 'josendojo', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('josendojo:2-6', 'josendojo', 2, '保護具の性能及び使用方法', 10, 105),
  ('josendojo:2-7', 'josendojo', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 106),
  ('josendojo:3-1', 'josendojo', 3, '作業に使用する機械等の種類と構造', 30, 200),
  ('josendojo:3-2', 'josendojo', 3, '作業に使用する機械等の取扱いと点検', 30, 201),
  ('josendojo:4-1', 'josendojo', 4, '関係法令', 60, 300),
  ('josenshushu:1-1', 'josenshushu', 1, '電離放射線の種類及び性質', 15, 0),
  ('josenshushu:1-2', 'josenshushu', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 1),
  ('josenshushu:1-3', 'josenshushu', 1, '被ばく限度及び被ばく線量測定の方法', 15, 2),
  ('josenshushu:1-4', 'josenshushu', 1, '被ばく線量測定の結果の確認及び記録等の方法', 10, 3),
  ('josenshushu:2-1', 'josenshushu', 2, '除去土壌の収集等に係る業務に係る作業の方法及び順序', 15, 100),
  ('josenshushu:2-2', 'josenshushu', 2, '放射線測定の方法', 5, 101),
  ('josenshushu:2-3', 'josenshushu', 2, '外部放射線による線量当量率の監視の方法', 5, 102),
  ('josenshushu:2-4', 'josenshushu', 2, '汚染防止措置の方法', 10, 103),
  ('josenshushu:2-5', 'josenshushu', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('josenshushu:2-6', 'josenshushu', 2, '保護具の性能及び使用方法', 10, 105),
  ('josenshushu:2-7', 'josenshushu', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 106),
  ('josenshushu:3-1', 'josenshushu', 3, '作業に使用する機械等の種類と構造', 30, 200),
  ('josenshushu:3-2', 'josenshushu', 3, '作業に使用する機械等の取扱いと点検', 30, 201),
  ('josenshushu:4-1', 'josenshushu', 4, '関係法令', 60, 300),
  ('josenhaiki:1-1', 'josenhaiki', 1, '電離放射線の種類及び性質', 15, 0),
  ('josenhaiki:1-2', 'josenhaiki', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 1),
  ('josenhaiki:1-3', 'josenhaiki', 1, '被ばく限度及び被ばく線量測定の方法', 15, 2),
  ('josenhaiki:1-4', 'josenhaiki', 1, '被ばく線量測定の結果の確認及び記録等の方法', 10, 3),
  ('josenhaiki:2-1', 'josenhaiki', 2, '汚染廃棄物の収集等に係る業務に係る作業の方法及び順序', 15, 100),
  ('josenhaiki:2-2', 'josenhaiki', 2, '放射線測定の方法', 5, 101),
  ('josenhaiki:2-3', 'josenhaiki', 2, '外部放射線による線量当量率の監視の方法', 5, 102),
  ('josenhaiki:2-4', 'josenhaiki', 2, '汚染防止措置の方法', 10, 103),
  ('josenhaiki:2-5', 'josenhaiki', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('josenhaiki:2-6', 'josenhaiki', 2, '保護具の性能及び使用方法', 10, 105),
  ('josenhaiki:2-7', 'josenhaiki', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 106),
  ('josenhaiki:3-1', 'josenhaiki', 3, '作業に使用する機械等の種類と構造', 30, 200),
  ('josenhaiki:3-2', 'josenhaiki', 3, '作業に使用する機械等の取扱いと点検', 30, 201),
  ('josenhaiki:4-1', 'josenhaiki', 4, '関係法令', 60, 300),
  ('josentokutei:1-1', 'josentokutei', 1, '電離放射線の種類及び性質', 15, 0),
  ('josentokutei:1-2', 'josentokutei', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 1),
  ('josentokutei:1-3', 'josentokutei', 1, '被ばく限度及び被ばく線量測定の方法', 15, 2),
  ('josentokutei:1-4', 'josentokutei', 1, '被ばく線量測定の結果の確認及び記録等の方法', 10, 3),
  ('josentokutei:2-1', 'josentokutei', 2, '特定汚染土壌等取扱業務に係る作業の方法及び順序', 15, 100),
  ('josentokutei:2-2', 'josentokutei', 2, '放射線測定の方法', 5, 101),
  ('josentokutei:2-3', 'josentokutei', 2, '外部放射線による線量当量率の監視の方法', 5, 102),
  ('josentokutei:2-4', 'josentokutei', 2, '汚染防止措置の方法', 10, 103),
  ('josentokutei:2-5', 'josentokutei', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('josentokutei:2-6', 'josentokutei', 2, '保護具の性能及び使用方法', 10, 105),
  ('josentokutei:2-7', 'josentokutei', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 106),
  ('josentokutei:3-1', 'josentokutei', 3, '作業に使用する機械等の名称及び用途', 30, 200),
  ('josentokutei:4-1', 'josentokutei', 4, '関係法令', 60, 300),
  ('josentokuteigai:1-1', 'josentokuteigai', 1, '電離放射線の種類及び性質', 15, 0),
  ('josentokuteigai:1-2', 'josentokuteigai', 1, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 25, 1),
  ('josentokuteigai:1-3', 'josentokuteigai', 1, '被ばく限度', 20, 2),
  ('josentokuteigai:2-1', 'josentokuteigai', 2, '特定汚染土壌等取扱業務に係る作業の方法及び順序', 20, 100),
  ('josentokuteigai:2-2', 'josentokuteigai', 2, '放射線測定の方法', 5, 101),
  ('josentokuteigai:2-3', 'josentokuteigai', 2, '汚染防止措置の方法', 10, 102),
  ('josentokuteigai:2-4', 'josentokuteigai', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 103),
  ('josentokuteigai:2-5', 'josentokuteigai', 2, '保護具の性能及び使用方法', 10, 104),
  ('josentokuteigai:2-6', 'josentokuteigai', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 105),
  ('josentokuteigai:3-1', 'josentokuteigai', 3, '作業に使用する機械等の名称及び用途', 30, 200),
  ('josentokuteigai:4-1', 'josentokuteigai', 4, '関係法令', 60, 300),
  ('tokureikinkyu:1-1', 'tokureikinkyu', 1, '重大事故等に対処するための作業の方法', 30, 0),
  ('tokureikinkyu:1-2', 'tokureikinkyu', 1, '特例緊急作業における必要な体制の整備', 15, 1),
  ('tokureikinkyu:1-3', 'tokureikinkyu', 1, '特例緊急作業における連絡の方法', 15, 2),
  ('tokureikinkyu:1-4', 'tokureikinkyu', 1, '特例緊急作業における放射線測定の方法', 15, 3),
  ('tokureikinkyu:1-5', 'tokureikinkyu', 1, '外部放射線による線量当量率及び空気中の放射性物質の濃度の監視の方法', 20, 4),
  ('tokureikinkyu:1-6', 'tokureikinkyu', 1, '作業を行う場所の汚染の状態の検査及び汚染の影響の低減のために必要な措置の方法', 20, 5),
  ('tokureikinkyu:1-7', 'tokureikinkyu', 1, '身体等の汚染の状態の検査及び汚染の除去の方法', 15, 6),
  ('tokureikinkyu:1-8', 'tokureikinkyu', 1, '特例緊急作業に使用する保護具の性能及び使用方法', 20, 7),
  ('tokureikinkyu:1-9', 'tokureikinkyu', 1, '応急手当の方法', 15, 8),
  ('tokureikinkyu:1-10', 'tokureikinkyu', 1, '重大事故等及び重大事故等への対処の事例', 15, 9),
  ('tokureikinkyu:2-1', 'tokureikinkyu', 2, '重大事故等に対処するための機能を有する施設及び設備の構造', 60, 100),
  ('tokureikinkyu:2-2', 'tokureikinkyu', 2, '重大事故等に対処するための機能を有する施設及び設備の取扱いの方法', 60, 101),
  ('tokureikinkyu:3-1', 'tokureikinkyu', 3, '電離放射線の種類及び性質', 10, 200),
  ('tokureikinkyu:3-2', 'tokureikinkyu', 3, '特例緊急作業において電離放射線が生体に与える影響', 10, 201),
  ('tokureikinkyu:3-3', 'tokureikinkyu', 3, '特例緊急作業における健康管理の方法', 10, 202),
  ('tokureikinkyu:3-4', 'tokureikinkyu', 3, '特例緊急被ばく限度', 5, 203),
  ('tokureikinkyu:3-5', 'tokureikinkyu', 3, '特例緊急作業における被ばく線量測定の方法', 10, 204),
  ('tokureikinkyu:3-6', 'tokureikinkyu', 3, '被ばく線量測定の結果の確認、記録等の方法', 10, 205),
  ('tokureikinkyu:3-7', 'tokureikinkyu', 3, '被ばく限度を超えた労働者に係る被ばく線量の管理の方法', 5, 206),
  ('tokureikinkyu:4-1', 'tokureikinkyu', 4, '関係法令', 30, 300),
  ('haikihasai:1-1', 'haikihasai', 1, '事故由来廃棄物等の種類及び性状', 30, 0),
  ('haikihasai:2-1', 'haikihasai', 2, '管理区域に関すること', 10, 100),
  ('haikihasai:2-2', 'haikihasai', 2, '破砕等、運搬及び貯蔵の作業の方法及び順序', 20, 101),
  ('haikihasai:2-3', 'haikihasai', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 10, 102),
  ('haikihasai:2-4', 'haikihasai', 2, '放射線測定の方法', 10, 103),
  ('haikihasai:2-5', 'haikihasai', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 10, 104),
  ('haikihasai:2-6', 'haikihasai', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 105),
  ('haikihasai:2-7', 'haikihasai', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 106),
  ('haikihasai:2-8', 'haikihasai', 2, '保護具の性能及び使用方法', 5, 107),
  ('haikihasai:2-9', 'haikihasai', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 108),
  ('haikihasai:3-1', 'haikihasai', 3, '作業に使用する設備の構造', 30, 200),
  ('haikihasai:3-2', 'haikihasai', 3, '作業に使用する設備の取扱いの方法', 30, 201),
  ('haikihasai:4-1', 'haikihasai', 4, '電離放射線の種類及び性質', 15, 300),
  ('haikihasai:4-2', 'haikihasai', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 301),
  ('haikihasai:4-3', 'haikihasai', 4, '被ばく限度及び被ばく線量測定の方法', 15, 302),
  ('haikihasai:4-4', 'haikihasai', 4, '被ばく線量測定の結果の確認及び記録等の方法', 10, 303),
  ('haikihasai:5-1', 'haikihasai', 5, '関係法令', 60, 400),
  ('haikishokyaku:1-1', 'haikishokyaku', 1, '事故由来廃棄物等の種類及び性状', 30, 0),
  ('haikishokyaku:2-1', 'haikishokyaku', 2, '管理区域に関すること', 10, 100),
  ('haikishokyaku:2-2', 'haikishokyaku', 2, '焼却、運搬及び貯蔵の作業の方法及び順序', 20, 101),
  ('haikishokyaku:2-3', 'haikishokyaku', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 10, 102),
  ('haikishokyaku:2-4', 'haikishokyaku', 2, '放射線測定の方法', 10, 103),
  ('haikishokyaku:2-5', 'haikishokyaku', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 10, 104),
  ('haikishokyaku:2-6', 'haikishokyaku', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 105),
  ('haikishokyaku:2-7', 'haikishokyaku', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 106),
  ('haikishokyaku:2-8', 'haikishokyaku', 2, '保護具の性能及び使用方法', 5, 107),
  ('haikishokyaku:2-9', 'haikishokyaku', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 108),
  ('haikishokyaku:3-1', 'haikishokyaku', 3, '作業に使用する設備の構造', 30, 200),
  ('haikishokyaku:3-2', 'haikishokyaku', 3, '作業に使用する設備の取扱いの方法', 30, 201),
  ('haikishokyaku:4-1', 'haikishokyaku', 4, '電離放射線の種類及び性質', 15, 300),
  ('haikishokyaku:4-2', 'haikishokyaku', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 301),
  ('haikishokyaku:4-3', 'haikishokyaku', 4, '被ばく限度及び被ばく線量測定の方法', 15, 302),
  ('haikishokyaku:4-4', 'haikishokyaku', 4, '被ばく線量測定の結果の確認及び記録等の方法', 10, 303),
  ('haikishokyaku:5-1', 'haikishokyaku', 5, '関係法令', 60, 400),
  ('haikiumetate:1-1', 'haikiumetate', 1, '事故由来廃棄物等の種類及び性状', 30, 0),
  ('haikiumetate:2-1', 'haikiumetate', 2, '管理区域に関すること', 10, 100),
  ('haikiumetate:2-2', 'haikiumetate', 2, '運搬、貯蔵及び埋立ての作業の方法及び順序', 20, 101),
  ('haikiumetate:2-3', 'haikiumetate', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 10, 102),
  ('haikiumetate:2-4', 'haikiumetate', 2, '放射線測定の方法', 10, 103),
  ('haikiumetate:2-5', 'haikiumetate', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 10, 104),
  ('haikiumetate:2-6', 'haikiumetate', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 105),
  ('haikiumetate:2-7', 'haikiumetate', 2, '身体等の汚染の状態の検査及び汚染の除去の方法', 10, 106),
  ('haikiumetate:2-8', 'haikiumetate', 2, '保護具の性能及び使用方法', 5, 107),
  ('haikiumetate:2-9', 'haikiumetate', 2, '異常な事態が発生した場合における応急の措置の方法', 5, 108),
  ('haikiumetate:3-1', 'haikiumetate', 3, '作業に使用する設備の構造', 30, 200),
  ('haikiumetate:3-2', 'haikiumetate', 3, '作業に使用する設備の取扱いの方法', 30, 201),
  ('haikiumetate:4-1', 'haikiumetate', 4, '電離放射線の種類及び性質', 15, 300),
  ('haikiumetate:4-2', 'haikiumetate', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 20, 301),
  ('haikiumetate:4-3', 'haikiumetate', 4, '被ばく限度及び被ばく線量測定の方法', 15, 302),
  ('haikiumetate:4-4', 'haikiumetate', 4, '被ばく線量測定の結果の確認及び記録等の方法', 10, 303),
  ('haikiumetate:5-1', 'haikiumetate', 5, '関係法令', 60, 400),
  ('xrayki:1-1', 'xrayki', 1, '作業の手順', 30, 0),
  ('xrayki:1-2', 'xrayki', 1, '電離放射線の測定', 20, 1),
  ('xrayki:1-3', 'xrayki', 1, '被ばく防止の方法', 25, 2),
  ('xrayki:1-4', 'xrayki', 1, '事故時の措置', 15, 3),
  ('xrayki:2-1', 'xrayki', 2, 'エックス線装置の原理', 25, 100),
  ('xrayki:2-2', 'xrayki', 2, 'エックス線管、高電圧発生器及び制御器の構造及び機能', 35, 101),
  ('xrayki:2-3', 'xrayki', 2, 'エックス線装置の操作及び点検', 30, 102),
  ('xrayki:3-1', 'xrayki', 3, '電離放射線の種類及び性質', 15, 200),
  ('xrayki:3-2', 'xrayki', 3, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 201),
  ('xrayki:4-1', 'xrayki', 4, '関係法令', 60, 300),
  ('gammaki:1-1', 'gammaki', 1, '作業の手順', 30, 0),
  ('gammaki:1-2', 'gammaki', 1, '電離放射線の測定', 20, 1),
  ('gammaki:1-3', 'gammaki', 1, '被ばく防止の方法', 25, 2),
  ('gammaki:1-4', 'gammaki', 1, '事故時の措置', 15, 3),
  ('gammaki:2-1', 'gammaki', 2, 'ガンマ線照射装置の種類及び型式', 15, 100),
  ('gammaki:2-2', 'gammaki', 2, '線源容器の構造及び機能', 20, 101),
  ('gammaki:2-3', 'gammaki', 2, '放射線源送出し装置又は遠隔操作装置の構造及び機能', 20, 102),
  ('gammaki:2-4', 'gammaki', 2, '放射線源の構造及び放射性物質の性質', 15, 103),
  ('gammaki:2-5', 'gammaki', 2, 'ガンマ線照射装置の操作及び点検', 20, 104),
  ('gammaki:3-1', 'gammaki', 3, '電離放射線の種類及び性質', 15, 200),
  ('gammaki:3-2', 'gammaki', 3, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 201),
  ('gammaki:4-1', 'gammaki', 4, '関係法令', 60, 300),
  ('xraygammaki:1-1', 'xraygammaki', 1, '作業の手順', 30, 0),
  ('xraygammaki:1-2', 'xraygammaki', 1, '電離放射線の測定', 20, 1),
  ('xraygammaki:1-3', 'xraygammaki', 1, '被ばく防止の方法', 25, 2),
  ('xraygammaki:1-4', 'xraygammaki', 1, '事故時の措置', 15, 3),
  ('xraygammaki:2-1', 'xraygammaki', 2, 'エックス線装置の原理', 25, 100),
  ('xraygammaki:2-2', 'xraygammaki', 2, 'エックス線管、高電圧発生器及び制御器の構造及び機能', 35, 101),
  ('xraygammaki:2-3', 'xraygammaki', 2, 'エックス線装置の操作及び点検', 30, 102),
  ('xraygammaki:2-4', 'xraygammaki', 2, 'ガンマ線照射装置の種類及び型式', 15, 103),
  ('xraygammaki:2-5', 'xraygammaki', 2, '線源容器の構造及び機能', 20, 104),
  ('xraygammaki:2-6', 'xraygammaki', 2, '放射線源送出し装置又は遠隔操作装置の構造及び機能', 20, 105),
  ('xraygammaki:2-7', 'xraygammaki', 2, '放射線源の構造及び放射性物質の性質', 15, 106),
  ('xraygammaki:2-8', 'xraygammaki', 2, 'ガンマ線照射装置の操作及び点検', 20, 107),
  ('xraygammaki:3-1', 'xraygammaki', 3, '電離放射線の種類及び性質', 15, 200),
  ('xraygammaki:3-2', 'xraygammaki', 3, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 201),
  ('xraygammaki:4-1', 'xraygammaki', 4, '関係法令', 60, 300),
  ('kakunenkakou:1-1', 'kakunenkakou', 1, '核燃料物質又は使用済燃料の種類及び性状', 30, 0),
  ('kakunenkakou:1-2', 'kakunenkakou', 1, '汚染された物の種類及び性状', 30, 1),
  ('kakunenkakou:2-1', 'kakunenkakou', 2, '管理区域に関すること', 15, 100),
  ('kakunenkakou:2-2', 'kakunenkakou', 2, '取り扱う作業の方法及び順序', 25, 101),
  ('kakunenkakou:2-3', 'kakunenkakou', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 15, 102),
  ('kakunenkakou:2-4', 'kakunenkakou', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 15, 103),
  ('kakunenkakou:2-5', 'kakunenkakou', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('kakunenkakou:2-6', 'kakunenkakou', 2, '異常な事態が発生した場合における応急の措置の方法', 10, 105),
  ('kakunenkakou:3-1', 'kakunenkakou', 3, '設備の構造', 45, 200),
  ('kakunenkakou:3-2', 'kakunenkakou', 3, '設備の取扱いの方法', 45, 201),
  ('kakunenkakou:4-1', 'kakunenkakou', 4, '電離放射線の種類及び性質', 15, 300),
  ('kakunenkakou:4-2', 'kakunenkakou', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 301),
  ('kakunenkakou:5-1', 'kakunenkakou', 5, '関係法令', 60, 400),
  ('kakunensaishori:1-1', 'kakunensaishori', 1, '核燃料物質又は使用済燃料の種類及び性状', 30, 0),
  ('kakunensaishori:1-2', 'kakunensaishori', 1, '汚染された物の種類及び性状', 30, 1),
  ('kakunensaishori:2-1', 'kakunensaishori', 2, '管理区域に関すること', 15, 100),
  ('kakunensaishori:2-2', 'kakunensaishori', 2, '取り扱う作業の方法及び順序', 25, 101),
  ('kakunensaishori:2-3', 'kakunensaishori', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 15, 102),
  ('kakunensaishori:2-4', 'kakunensaishori', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 15, 103),
  ('kakunensaishori:2-5', 'kakunensaishori', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('kakunensaishori:2-6', 'kakunensaishori', 2, '異常な事態が発生した場合における応急の措置の方法', 10, 105),
  ('kakunensaishori:3-1', 'kakunensaishori', 3, '設備の構造', 45, 200),
  ('kakunensaishori:3-2', 'kakunensaishori', 3, '設備の取扱いの方法', 45, 201),
  ('kakunensaishori:4-1', 'kakunensaishori', 4, '電離放射線の種類及び性質', 15, 300),
  ('kakunensaishori:4-2', 'kakunensaishori', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 301),
  ('kakunensaishori:5-1', 'kakunensaishori', 5, '関係法令', 60, 400),
  ('kakunenshiyou:1-1', 'kakunenshiyou', 1, '核燃料物質又は使用済燃料の種類及び性状', 30, 0),
  ('kakunenshiyou:1-2', 'kakunenshiyou', 1, '汚染された物の種類及び性状', 30, 1),
  ('kakunenshiyou:2-1', 'kakunenshiyou', 2, '管理区域に関すること', 15, 100),
  ('kakunenshiyou:2-2', 'kakunenshiyou', 2, '取り扱う作業の方法及び順序', 25, 101),
  ('kakunenshiyou:2-3', 'kakunenshiyou', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 15, 102),
  ('kakunenshiyou:2-4', 'kakunenshiyou', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 15, 103),
  ('kakunenshiyou:2-5', 'kakunenshiyou', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('kakunenshiyou:2-6', 'kakunenshiyou', 2, '異常な事態が発生した場合における応急の措置の方法', 10, 105),
  ('kakunenshiyou:3-1', 'kakunenshiyou', 3, '設備の構造', 45, 200),
  ('kakunenshiyou:3-2', 'kakunenshiyou', 3, '設備の取扱いの方法', 45, 201),
  ('kakunenshiyou:4-1', 'kakunenshiyou', 4, '電離放射線の種類及び性質', 15, 300),
  ('kakunenshiyou:4-2', 'kakunenshiyou', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 301),
  ('kakunenshiyou:5-1', 'kakunenshiyou', 5, '関係法令', 60, 400),
  ('kakunengenshiro:1-1', 'kakunengenshiro', 1, '核燃料物質又は使用済燃料の種類及び性状', 15, 0),
  ('kakunengenshiro:1-2', 'kakunengenshiro', 1, '汚染された物の種類及び性状', 15, 1),
  ('kakunengenshiro:2-1', 'kakunengenshiro', 2, '管理区域に関すること', 15, 100),
  ('kakunengenshiro:2-2', 'kakunengenshiro', 2, '取り扱う作業の方法及び順序', 25, 101),
  ('kakunengenshiro:2-3', 'kakunengenshiro', 2, '汚染された設備の保守及び点検の作業の方法及び順序', 15, 102),
  ('kakunengenshiro:2-4', 'kakunengenshiro', 2, '線量当量率及び空気中の放射性物質の濃度の監視の方法', 15, 103),
  ('kakunengenshiro:2-5', 'kakunengenshiro', 2, '天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法', 10, 104),
  ('kakunengenshiro:2-6', 'kakunengenshiro', 2, '異常な事態が発生した場合における応急の措置の方法', 10, 105),
  ('kakunengenshiro:3-1', 'kakunengenshiro', 3, '設備の構造', 45, 200),
  ('kakunengenshiro:3-2', 'kakunengenshiro', 3, '設備の取扱いの方法', 45, 201),
  ('kakunengenshiro:4-1', 'kakunengenshiro', 4, '電離放射線の種類及び性質', 15, 300),
  ('kakunengenshiro:4-2', 'kakunengenshiro', 4, '電離放射線が生体の細胞、組織、器官及び全身に与える影響', 15, 301),
  ('kakunengenshiro:5-1', 'kakunengenshiro', 5, '関係法令', 60, 400),
  ('tetraalkyl:1-1', 'tetraalkyl', 1, '四アルキル鉛の性状', 30, 0),
  ('tetraalkyl:1-2', 'tetraalkyl', 1, '四アルキル鉛中毒の病理及び症状', 30, 1),
  ('tetraalkyl:2-1', 'tetraalkyl', 2, 'ドラムかん及び設備の取扱い方法', 60, 100),
  ('tetraalkyl:3-1', 'tetraalkyl', 3, '保護具の種類、性能及び使用方法', 60, 200),
  ('tetraalkyl:4-1', 'tetraalkyl', 4, '洗身、保護具の洗浄及び身体等の清潔の保持の方法', 60, 300),
  ('tetraalkyl:5-1', 'tetraalkyl', 5, '合図又は警報の内容及び退避の場所', 30, 400),
  ('tetraalkyl:5-2', 'tetraalkyl', 5, '除毒剤、拡散防止剤及び補修剤の使用方法', 30, 401),
  ('tetraalkyl:6-1', 'tetraalkyl', 6, '関係法令', 35, 500),
  ('tetraalkyl:6-2', 'tetraalkyl', 6, '四アルキル鉛中毒を防止するため当該業務について必要な事項', 25, 501),
  ('boiler:1-1', 'boiler', 1, '熱及び蒸気', 40, 0),
  ('boiler:1-2', 'boiler', 1, '小型ボイラーの種類', 35, 1),
  ('boiler:1-3', 'boiler', 1, '主要部分の構造', 45, 2),
  ('boiler:2-1', 'boiler', 2, '安全装置', 30, 100),
  ('boiler:2-2', 'boiler', 2, '圧力計', 20, 101),
  ('boiler:2-3', 'boiler', 2, '水面測定装置', 30, 102),
  ('boiler:2-4', 'boiler', 2, '給水装置', 20, 103),
  ('boiler:2-5', 'boiler', 2, '吹出装置', 10, 104),
  ('boiler:2-6', 'boiler', 2, '自動制御装置', 10, 105),
  ('boiler:3-1', 'boiler', 3, '燃料の種類', 35, 200),
  ('boiler:3-2', 'boiler', 3, '燃焼方式及び燃焼装置', 50, 201),
  ('boiler:3-3', 'boiler', 3, '通風装置', 35, 202),
  ('boiler:4-1', 'boiler', 4, '関係法令', 60, 300),
  ('gondola:1-1', 'gondola', 1, '種類及び型式', 25, 0),
  ('gondola:1-2', 'gondola', 1, '昇降装置', 25, 1),
  ('gondola:1-3', 'gondola', 1, '安全装置', 30, 2),
  ('gondola:1-4', 'gondola', 1, 'ブレーキ機能', 15, 3),
  ('gondola:1-5', 'gondola', 1, '取扱い方法', 25, 4),
  ('gondola:2-1', 'gondola', 2, '電気に関する基礎知識', 30, 100),
  ('gondola:2-2', 'gondola', 2, '電動機', 25, 101),
  ('gondola:2-3', 'gondola', 2, '開閉器等電気を通ずる機械器具', 30, 102),
  ('gondola:2-4', 'gondola', 2, '感電による危険性', 35, 103),
  ('gondola:3-1', 'gondola', 3, '関係法令', 60, 200),
  ('derrick:1-1', 'derrick', 1, '種類及び型式', 30, 0),
  ('derrick:1-2', 'derrick', 1, '主要構造部分', 45, 1),
  ('derrick:1-3', 'derrick', 1, '作動装置', 30, 2),
  ('derrick:1-4', 'derrick', 1, '安全装置', 30, 3),
  ('derrick:1-5', 'derrick', 1, 'ブレーキ機能', 20, 4),
  ('derrick:1-6', 'derrick', 1, '取扱い方法', 25, 5),
  ('derrick:2-1', 'derrick', 2, '電気に関する基礎知識', 40, 100),
  ('derrick:2-2', 'derrick', 2, '電動機', 35, 101),
  ('derrick:2-3', 'derrick', 2, '開閉器、コントローラー等電気を通ずる機械器具', 35, 102),
  ('derrick:2-4', 'derrick', 2, '電路の点検及び補修', 35, 103),
  ('derrick:2-5', 'derrick', 2, '感電による危険性', 35, 104),
  ('derrick:3-1', 'derrick', 3, '力（合成、分解、つり合い及びモーメント）', 30, 200),
  ('derrick:3-2', 'derrick', 3, '重心', 20, 201),
  ('derrick:3-3', 'derrick', 3, '荷重', 25, 202),
  ('derrick:3-4', 'derrick', 3, 'ワイヤロープ、フツク及びつり具の強さ', 25, 203),
  ('derrick:3-5', 'derrick', 3, 'ワイヤロープの掛け方と荷重との関係', 20, 204),
  ('derrick:4-1', 'derrick', 4, '関係法令', 60, 300),
  ('kensetsulift:1-1', 'kensetsulift', 1, '種類及び型式', 25, 0),
  ('kensetsulift:1-2', 'kensetsulift', 1, '昇降装置', 25, 1),
  ('kensetsulift:1-3', 'kensetsulift', 1, '安全装置', 30, 2),
  ('kensetsulift:1-4', 'kensetsulift', 1, 'ブレーキ機能', 20, 3),
  ('kensetsulift:1-5', 'kensetsulift', 1, '取扱い方法', 20, 4),
  ('kensetsulift:2-1', 'kensetsulift', 2, '電気に関する基礎知識', 30, 100),
  ('kensetsulift:2-2', 'kensetsulift', 2, '電動機', 25, 101),
  ('kensetsulift:2-3', 'kensetsulift', 2, '開閉器等電気を通ずる機械器具', 30, 102),
  ('kensetsulift:2-4', 'kensetsulift', 2, '感電による危険性', 35, 103),
  ('kensetsulift:3-1', 'kensetsulift', 3, '関係法令', 60, 200),
  ('mobilecrane:1-1', 'mobilecrane', 1, '種類及び型式', 30, 0),
  ('mobilecrane:1-2', 'mobilecrane', 1, '主要構造部分', 35, 1),
  ('mobilecrane:1-3', 'mobilecrane', 1, '作動装置', 30, 2),
  ('mobilecrane:1-4', 'mobilecrane', 1, '安全装置', 35, 3),
  ('mobilecrane:1-5', 'mobilecrane', 1, 'ブレーキ機能', 20, 4),
  ('mobilecrane:1-6', 'mobilecrane', 1, '取扱い方法', 30, 5),
  ('mobilecrane:2-1', 'mobilecrane', 2, '内燃機関', 50, 100),
  ('mobilecrane:2-2', 'mobilecrane', 2, '蒸気機関', 20, 101),
  ('mobilecrane:2-3', 'mobilecrane', 2, '油圧駆動装置', 55, 102),
  ('mobilecrane:2-4', 'mobilecrane', 2, '感電による危険性', 55, 103),
  ('mobilecrane:3-1', 'mobilecrane', 3, '力（合成、分解、つり合い及びモーメント）', 30, 200),
  ('mobilecrane:3-2', 'mobilecrane', 3, '重心', 20, 201),
  ('mobilecrane:3-3', 'mobilecrane', 3, '荷重', 25, 202),
  ('mobilecrane:3-4', 'mobilecrane', 3, 'ワイヤロープ、フツク及びつり具の強さ', 25, 203),
  ('mobilecrane:3-5', 'mobilecrane', 3, 'ワイヤロープの掛け方と荷重との関係', 20, 204),
  ('mobilecrane:4-1', 'mobilecrane', 4, '関係法令', 60, 300),
  ('crane:1-1', 'crane', 1, '種類及び型式', 30, 0),
  ('crane:1-2', 'crane', 1, '主要構造部分', 40, 1),
  ('crane:1-3', 'crane', 1, '作動装置', 30, 2),
  ('crane:1-4', 'crane', 1, '安全装置', 30, 3),
  ('crane:1-5', 'crane', 1, 'ブレーキ機能', 25, 4),
  ('crane:1-6', 'crane', 1, '取扱い方法', 25, 5),
  ('crane:2-1', 'crane', 2, '電気に関する基礎知識', 40, 100),
  ('crane:2-2', 'crane', 2, '電動機', 35, 101),
  ('crane:2-3', 'crane', 2, '開閉器、コントローラー等電気を通ずる機械器具', 35, 102),
  ('crane:2-4', 'crane', 2, '電路の点検及び補修', 35, 103),
  ('crane:2-5', 'crane', 2, '感電による危険性', 35, 104),
  ('crane:3-1', 'crane', 3, '力（合成、分解、つり合い及びモーメント）', 30, 200),
  ('crane:3-2', 'crane', 3, '重心', 20, 201),
  ('crane:3-3', 'crane', 3, '荷重', 25, 202),
  ('crane:3-4', 'crane', 3, 'ワイヤロープ、フック及びつり具の強さ', 25, 203),
  ('crane:3-5', 'crane', 3, 'ワイヤロープの掛け方と荷重との関係', 20, 204),
  ('crane:4-1', 'crane', 4, '関係法令', 60, 300),
  ('tamakake:1-1', 'tamakake', 1, '種類及び型式', 20, 0),
  ('tamakake:1-2', 'tamakake', 1, '構造及び機能', 20, 1),
  ('tamakake:1-3', 'tamakake', 1, '安全装置及びブレーキ', 20, 2),
  ('tamakake:2-1', 'tamakake', 2, '力（合成、分解、つり合い及びモーメント）', 30, 100),
  ('tamakake:2-2', 'tamakake', 2, '重心と物の安定・摩擦・重量・荷重', 30, 101),
  ('tamakake:3-1', 'tamakake', 3, '玉掛用具の選定及び使用の方法', 50, 200),
  ('tamakake:3-2', 'tamakake', 3, '基本動作（安全作業方法を含む）', 40, 201),
  ('tamakake:3-3', 'tamakake', 3, '合図の方法', 30, 202),
  ('tamakake:4-1', 'tamakake', 4, '関係法令', 60, 300),
  ('tokushu:1-1', 'tokushu', 1, '危険物の種類、性状及び危険性', 70, 0),
  ('tokushu:1-2', 'tokushu', 1, '化学反応の概要', 50, 1),
  ('tokushu:1-3', 'tokushu', 1, '発熱反応等の危険性', 60, 2),
  ('tokushu:2-1', 'tokushu', 2, '特殊化学設備の種類及び構造', 70, 100),
  ('tokushu:2-2', 'tokushu', 2, '計測装置、制御装置、安全装置等の構造', 70, 101),
  ('tokushu:2-3', 'tokushu', 2, '特殊化学設備用材料', 40, 102),
  ('tokushu:3-1', 'tokushu', 3, '使用開始時の取扱い方法', 40, 200),
  ('tokushu:3-2', 'tokushu', 3, '使用中の取扱い方法', 40, 201),
  ('tokushu:3-3', 'tokushu', 3, '使用休止時の取扱い方法', 30, 202),
  ('tokushu:3-4', 'tokushu', 3, '点検及び検査の方法', 35, 203),
  ('tokushu:3-5', 'tokushu', 3, '停電時等の異常時における応急の処置', 35, 204),
  ('tokushu:4-1', 'tokushu', 4, '整備及び修理の手順', 60, 300),
  ('tokushu:4-2', 'tokushu', 4, '通風及び換気', 40, 301),
  ('tokushu:4-3', 'tokushu', 4, '保護具の着用', 40, 302),
  ('tokushu:4-4', 'tokushu', 4, 'ガス検知', 40, 303),
  ('tokushu:5-1', 'tokushu', 5, '法、令、安衛則及びボイラー及び圧力容器安全規則中の関係条項', 60, 400),
  ('tire:1-1', 'tire', 1, 'タイヤの種類及び構造', 60, 0),
  ('tire:1-2', 'tire', 1, 'リムへの組込み及びその状況の点検の方法', 60, 1),
  ('tire:2-1', 'tire', 2, '圧力調節装置の種類、構造及び取扱いの方法', 40, 100),
  ('tire:2-2', 'tire', 2, '空気圧縮機を用いてタイヤに空気を充てんする方法', 40, 101),
  ('tire:2-3', 'tire', 2, '安全囲い等の使用方法', 40, 102),
  ('tire:3-1', 'tire', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('robotkensa:1-1', 'robotkensa', 1, '産業用ロボットの種類、制御方式、駆動方式', 80, 0),
  ('robotkensa:1-2', 'robotkensa', 1, '各部の構造及び機能並びに取扱いの方法', 80, 1),
  ('robotkensa:1-3', 'robotkensa', 1, '制御部品の種類及び特性', 80, 2),
  ('robotkensa:2-1', 'robotkensa', 2, '検査等の作業の方法', 100, 100),
  ('robotkensa:2-2', 'robotkensa', 2, '検査等の作業の危険性', 80, 101),
  ('robotkensa:2-3', 'robotkensa', 2, '関連する機械等との連動の方法', 60, 102),
  ('robotkensa:3-1', 'robotkensa', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('robotkyoji:1-1', 'robotkyoji', 1, '産業用ロボットの種類', 60, 0),
  ('robotkyoji:1-2', 'robotkyoji', 1, '各部の機能及び取扱いの方法', 60, 1),
  ('robotkyoji:2-1', 'robotkyoji', 2, '教示等の作業の方法', 100, 100),
  ('robotkyoji:2-2', 'robotkyoji', 2, '教示等の作業の危険性', 80, 101),
  ('robotkyoji:2-3', 'robotkyoji', 2, '関連する機械等との連動の方法', 60, 102),
  ('robotkyoji:3-1', 'robotkyoji', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('kidou:1-1', 'kidou', 1, '動力車の種類及び用途', 60, 0),
  ('kidou:1-2', 'kidou', 1, '原動機・動力伝達装置・制御装置・ブレーキ・台車', 60, 1),
  ('kidou:1-3', 'kidou', 1, '連結装置・電気装置・逸走防止装置・安全装置・計器', 60, 2),
  ('kidou:2-1', 'kidou', 2, '軌条・まくら木・道床', 30, 100),
  ('kidou:2-2', 'kidou', 2, '分岐及びてつさ・逸走防止装置', 30, 101),
  ('kidou:3-1', 'kidou', 3, '信号装置', 20, 200),
  ('kidou:3-2', 'kidou', 3, '合図及び誘導の方法', 20, 201),
  ('kidou:3-3', 'kidou', 3, '車両の連結の方法', 20, 202),
  ('kidou:4-1', 'kidou', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('jack:1-1', 'jack', 1, 'ジャッキ式つり上げ機械の種類及び用途', 50, 0),
  ('jack:1-2', 'jack', 1, '保持機構・作動装置・制御装置と、同時開放防止機構等の安全装置', 80, 1),
  ('jack:1-3', 'jack', 1, '据付け方法', 50, 2),
  ('jack:2-1', 'jack', 2, '調整又は運転に必要な力学', 40, 100),
  ('jack:2-2', 'jack', 2, '調整方法', 40, 101),
  ('jack:2-3', 'jack', 2, '合図方法', 40, 102),
  ('jack:3-1', 'jack', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('boring:1-1', 'boring', 1, 'ボーリングマシンの種類及び用途', 90, 0),
  ('boring:1-2', 'boring', 1, '原動機・動力伝達装置・作業装置', 80, 1),
  ('boring:1-3', 'boring', 1, '巻上げ装置と附属装置', 70, 2),
  ('boring:2-1', 'boring', 2, '運転に必要な力学及び土質工学', 50, 100),
  ('boring:2-2', 'boring', 2, '土木施工の方法', 40, 101),
  ('boring:2-3', 'boring', 2, 'ワイヤロープ及び補助具', 30, 102),
  ('boring:3-1', 'boring', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('concrete:1-1', 'concrete', 1, '作業装置の種類及び用途（ポンプ・ブーム・輸送管）', 100, 0),
  ('concrete:1-2', 'concrete', 1, '作業装置の構造', 70, 1),
  ('concrete:1-3', 'concrete', 1, '作業装置の取扱いの方法', 70, 2),
  ('concrete:2-1', 'concrete', 2, '操作のために必要な力学', 40, 100),
  ('concrete:2-2', 'concrete', 2, 'コンクリートの種類及び性質', 40, 101),
  ('concrete:2-3', 'concrete', 2, 'コンクリート打設の方法', 40, 102),
  ('concrete:3-1', 'concrete', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('kisosousa:1-1', 'kisosousa', 1, '作業装置の種類及び用途', 80, 0),
  ('kisosousa:1-2', 'kisosousa', 1, '作業装置の構造', 50, 1),
  ('kisosousa:1-3', 'kisosousa', 1, '作業装置の取扱い方法', 50, 2),
  ('kisosousa:2-1', 'kisosousa', 2, '操作のために必要な力学及び土質工学', 25, 100),
  ('kisosousa:2-2', 'kisosousa', 2, '土木施工の方法', 20, 101),
  ('kisosousa:2-3', 'kisosousa', 2, 'ワイヤロープ及び補助具', 15, 102),
  ('kisosousa:3-1', 'kisosousa', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('kisokenki:1-1', 'kisokenki', 1, '基礎工事用建設機械の種類及び用途', 80, 0),
  ('kisokenki:1-2', 'kisokenki', 1, '原動機・動力伝達装置・作業装置', 55, 1),
  ('kisokenki:1-3', 'kisokenki', 1, '巻上げ装置とブレーキ', 55, 2),
  ('kisokenki:1-4', 'kisokenki', 1, '電気装置・警報装置・附属装置', 50, 3),
  ('kisokenki:2-1', 'kisokenki', 2, '運転に必要な力学及び土質工学', 50, 100),
  ('kisokenki:2-2', 'kisokenki', 2, '土木施工の方法', 40, 101),
  ('kisokenki:2-3', 'kisokenki', 2, 'ワイヤロープ及び補助具', 30, 102),
  ('kisokenki:3-1', 'kisokenki', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('kaitai:1-1', 'kaitai', 1, '原動機・動力伝達装置・走行装置', 40, 0),
  ('kaitai:1-2', 'kaitai', 1, 'かじ取り装置とブレーキ', 40, 1),
  ('kaitai:1-3', 'kaitai', 1, '電気装置・警報装置と走行に関する附属装置', 40, 2),
  ('kaitai:2-1', 'kaitai', 2, '種類及び用途（ブレーカ・圧砕機・鉄骨切断機・つかみ機）', 45, 100),
  ('kaitai:2-2', 'kaitai', 2, '作業装置及び作業に関する附属装置の構造及び取扱いの方法', 50, 101),
  ('kaitai:2-3', 'kaitai', 2, '一般的作業方法（解体の進め方）', 55, 102),
  ('kaitai:3-1', 'kaitai', 3, '運転に必要な力学', 25, 200),
  ('kaitai:3-2', 'kaitai', 3, 'コンクリート造、鉄骨造又は木造の工作物等の種類及び構造', 40, 201),
  ('kaitai:3-3', 'kaitai', 3, '建設施工の方法', 25, 202),
  ('kaitai:4-1', 'kaitai', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('kisokouji:1-1', 'kisokouji', 1, '原動機・動力伝達装置・走行装置', 40, 0),
  ('kisokouji:1-2', 'kisokouji', 1, '操縦装置とブレーキ', 40, 1),
  ('kisokouji:1-3', 'kisokouji', 1, '電気装置・警報装置と走行に関する附属装置', 40, 2),
  ('kisokouji:2-1', 'kisokouji', 2, '種類及び用途（くい打機・アースドリル・アースオーガー等）', 50, 100),
  ('kisokouji:2-2', 'kisokouji', 2, '作業装置及び作業に関する附属装置の構造及び取扱い方法', 60, 101),
  ('kisokouji:2-3', 'kisokouji', 2, '一般的作業方法（据付けから施工・移動まで）', 70, 102),
  ('kisokouji:3-1', 'kisokouji', 3, '運転に必要な力学及び土質工学', 25, 200),
  ('kisokouji:3-2', 'kisokouji', 3, '土木施工の方法', 20, 201),
  ('kisokouji:3-3', 'kisokouji', 3, 'ワイヤロープ及び補助具', 15, 202),
  ('kisokouji:4-1', 'kisokouji', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('kanikasen:1-1', 'kanikasen', 1, '簡易架線集材装置の集材機の種類及び用途', 30, 0),
  ('kanikasen:1-2', 'kanikasen', 1, '架線集材機械の種類及び用途（スイングヤーダ等）', 30, 1),
  ('kanikasen:2-1', 'kanikasen', 2, '原動機・動力伝達装置・走行装置', 20, 100),
  ('kanikasen:2-2', 'kanikasen', 2, '操縦装置・制動装置・作業装置（ウインチ・ブーム）', 20, 101),
  ('kanikasen:2-3', 'kanikasen', 2, '油圧装置・電気装置・附属装置', 20, 102),
  ('kanikasen:3-1', 'kanikasen', 3, '簡易架線集材装置及び架線集材機械による集材の方法', 70, 200),
  ('kanikasen:3-2', 'kanikasen', 3, '簡易架線集材装置の索張りの方法', 50, 201),
  ('kanikasen:4-1', 'kanikasen', 4, '運転に必要な力学', 15, 300),
  ('kanikasen:4-2', 'kanikasen', 4, '電気に関する基礎知識', 10, 301),
  ('kanikasen:4-3', 'kanikasen', 4, 'ワイヤロープの種類', 15, 302),
  ('kanikasen:4-4', 'kanikasen', 4, 'ワイヤロープの止め方及び継ぎ方の種類', 20, 303),
  ('kanikasen:5-1', 'kanikasen', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('kikaishuzai:1-1', 'kikaishuzai', 1, '集材機の種類、構造及び取扱いの方法', 70, 0),
  ('kikaishuzai:1-2', 'kikaishuzai', 1, '機械集材装置の索張り方式', 60, 1),
  ('kikaishuzai:1-3', 'kikaishuzai', 1, '集材方法', 50, 2),
  ('kikaishuzai:2-1', 'kikaishuzai', 2, 'ワイヤロープの種類', 50, 100),
  ('kikaishuzai:2-2', 'kikaishuzai', 2, 'ワイヤロープの止め方及び継ぎ方の種類', 70, 101),
  ('kikaishuzai:3-1', 'kikaishuzai', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('soukou:1-1', 'soukou', 1, '走行集材機械の種類（フォワーダ・集材車）', 35, 0),
  ('soukou:1-2', 'soukou', 1, '走行集材機械の用途と、隣の機械との区分', 25, 1),
  ('soukou:2-1', 'soukou', 2, '原動機・動力伝達装置・走行装置', 20, 100),
  ('soukou:2-2', 'soukou', 2, '操縦装置・制動装置・作業装置（荷台・グラップル・ウインチ）', 20, 101),
  ('soukou:2-3', 'soukou', 2, '油圧装置・電気装置・附属装置', 20, 102),
  ('soukou:3-1', 'soukou', 3, '作業の前（作業計画・作業道・点検・立入禁止の範囲）', 30, 200),
  ('soukou:3-2', 'soukou', 3, '原木の積込み（グラップルとウインチ・積載量・重心）', 35, 201),
  ('soukou:3-3', 'soukou', 3, '原木の運搬（作業道の走行・傾斜・路肩・すれ違い）', 30, 202),
  ('soukou:3-4', 'soukou', 3, '荷下ろし・土場と、作業の終わり', 25, 203),
  ('soukou:4-1', 'soukou', 4, '走行集材機械の運転に必要な力学', 25, 300),
  ('soukou:4-2', 'soukou', 4, '電気に関する基礎知識', 15, 301),
  ('soukou:4-3', 'soukou', 4, 'ワイヤロープの種類及び取扱いの方法', 20, 302),
  ('soukou:5-1', 'soukou', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('batsuboku:1-1', 'batsuboku', 1, '伐木等機械の種類（ハーベスタ・プロセッサ・フェラーバンチャ・グラップル）', 35, 0),
  ('batsuboku:1-2', 'batsuboku', 1, '伐木等機械の用途と、隣の機械との区分', 25, 1),
  ('batsuboku:2-1', 'batsuboku', 2, '原動機・動力伝達装置・走行装置', 20, 100),
  ('batsuboku:2-2', 'batsuboku', 2, '操縦装置・制動装置・作業装置', 20, 101),
  ('batsuboku:2-3', 'batsuboku', 2, '油圧装置・電気装置・附属装置', 20, 102),
  ('batsuboku:3-1', 'batsuboku', 3, '作業の前（作業計画・地形と地質・点検・立入禁止の範囲）', 30, 200),
  ('batsuboku:3-2', 'batsuboku', 3, '伐木（機械による伐倒）', 35, 201),
  ('batsuboku:3-3', 'batsuboku', 3, '造材（枝払いと玉切り）', 25, 202),
  ('batsuboku:3-4', 'batsuboku', 3, '原木の集積と、作業の終わり', 30, 203),
  ('batsuboku:4-1', 'batsuboku', 4, '伐木等機械の運転に必要な力学', 35, 300),
  ('batsuboku:4-2', 'batsuboku', 4, '電気に関する基礎知識', 25, 301),
  ('batsuboku:5-1', 'batsuboku', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('youka:1-1', 'youka', 1, 'デリックブーム、デリックポスト、ガイその他の主要構造部分', 80, 0),
  ('youka:1-2', 'youka', 1, '巻上げ装置', 50, 1),
  ('youka:1-3', 'youka', 1, '制動装置', 40, 2),
  ('youka:1-4', 'youka', 1, '揚貨装置の機能及び取扱い方法', 70, 3),
  ('youka:2-1', 'youka', 2, '蒸気機関', 10, 100),
  ('youka:2-2', 'youka', 2, '内燃機関', 15, 101),
  ('youka:2-3', 'youka', 2, '電動機', 20, 102),
  ('youka:2-4', 'youka', 2, '電流、電圧及び抵抗', 20, 103),
  ('youka:2-5', 'youka', 2, '電力及び電力量', 15, 104),
  ('youka:2-6', 'youka', 2, '電力計、制御装置その他の揚貨装置に関する電気機械器具', 20, 105),
  ('youka:2-7', 'youka', 2, '感電による危険性', 20, 106),
  ('youka:3-1', 'youka', 3, '力（合成、分解、つり合い及びモーメント）', 30, 200),
  ('youka:3-2', 'youka', 3, '重心', 20, 201),
  ('youka:3-3', 'youka', 3, '重量', 15, 202),
  ('youka:3-4', 'youka', 3, '速度', 15, 203),
  ('youka:3-5', 'youka', 3, '荷重（静荷重及び動荷重）', 25, 204),
  ('youka:3-6', 'youka', 3, '応力', 20, 205),
  ('youka:3-7', 'youka', 3, '材料の強さ', 20, 206),
  ('youka:3-8', 'youka', 3, 'ワイヤロープ', 35, 207),
  ('youka:3-9', 'youka', 3, 'フック及びスリングの強さ', 30, 208),
  ('youka:3-10', 'youka', 3, 'ワイヤロープの掛け方と荷重との関係', 30, 209),
  ('youka:4-1', 'youka', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('press:1-1', 'press', 1, 'プレス機械の種類と構造（クラッチの種類が全ての元）', 40, 0),
  ('press:1-2', 'press', 1, 'シヤーの種類と構造', 25, 1),
  ('press:1-3', 'press', 1, '安全装置と安全囲いの種類と構造', 35, 2),
  ('press:1-4', 'press', 1, 'プレス機械・シヤー・安全装置の点検', 20, 3),
  ('press:2-1', 'press', 2, '材料の送給及び製品の取出し', 60, 100),
  ('press:2-2', 'press', 2, '金型、刃部、安全装置、安全囲いの異常及びその処理', 60, 101),
  ('press:3-1', 'press', 3, '金型の点検', 35, 200),
  ('press:3-2', 'press', 3, '金型の取付け', 50, 201),
  ('press:3-3', 'press', 3, '金型の取外し', 30, 202),
  ('press:3-4', 'press', 3, '調整（ダイハイト・ストローク・安全装置の合わせ直し）', 40, 203),
  ('press:3-5', 'press', 3, 'シヤーの刃部の点検、取付け、取外し及び調整', 25, 204),
  ('press:4-1', 'press', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('dioxin:1-1', 'dioxin', 1, 'ダイオキシン類の性状', 30, 0),
  ('dioxin:2-1', 'dioxin', 2, '作業の手順', 20, 100),
  ('dioxin:2-2', 'dioxin', 2, 'ダイオキシン類のばく露を低減させるための措置', 25, 101),
  ('dioxin:2-3', 'dioxin', 2, '作業環境改善の方法', 15, 102),
  ('dioxin:2-4', 'dioxin', 2, '洗身及び身体等の清潔の保持の方法', 15, 103),
  ('dioxin:2-5', 'dioxin', 2, '事故時の措置', 15, 104),
  ('dioxin:3-1', 'dioxin', 3, 'ばく露を低減させるための設備の作業開始時の点検', 30, 200),
  ('dioxin:4-1', 'dioxin', 4, '保護具の種類、性能、洗浄方法、使用方法及び保守点検の方法', 60, 300),
  ('dioxin:5-1', 'dioxin', 5, '法、令及び安衛則中の関係条項', 18, 400),
  ('dioxin:5-2', 'dioxin', 5, 'ばく露を防止するため当該業務について必要な事項', 12, 401),
  ('zuidou:1-1', 'zuidou', 1, '掘削工法の概要', 40, 0),
  ('zuidou:1-2', 'zuidou', 1, '坑内における作業の種類', 25, 1),
  ('zuidou:1-3', 'zuidou', 1, '地質の種類及び性質', 25, 2),
  ('zuidou:2-1', 'zuidou', 2, '掘削設備', 30, 100),
  ('zuidou:2-2', 'zuidou', 2, 'ずり積み設備', 20, 101),
  ('zuidou:2-3', 'zuidou', 2, '運搬設備', 20, 102),
  ('zuidou:2-4', 'zuidou', 2, '覆工設備', 20, 103),
  ('zuidou:3-1', 'zuidou', 3, '落盤又は肌落ちの防止のための措置', 45, 200),
  ('zuidou:3-2', 'zuidou', 3, '爆発又は火災の防止のための措置', 35, 201),
  ('zuidou:3-3', 'zuidou', 3, '工事用設備による労働災害の防止のための措置', 30, 202),
  ('zuidou:3-4', 'zuidou', 3, '作業環境改善の方法', 30, 203),
  ('zuidou:3-5', 'zuidou', 3, '事故発生時の措置', 25, 204),
  ('zuidou:3-6', 'zuidou', 3, '保護具の使用方法', 15, 205),
  ('zuidou:4-1', 'zuidou', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('ev:1-1', 'ev', 1, '電気の危険性', 16, 0),
  ('ev:1-2', 'ev', 1, '短絡', 11, 1),
  ('ev:1-3', 'ev', 1, '漏電', 11, 2),
  ('ev:1-4', 'ev', 1, '接地', 11, 3),
  ('ev:1-5', 'ev', 1, '電気絶縁', 11, 4),
  ('ev:2-1', 'ev', 2, '自動車の仕組みと種類', 30, 100),
  ('ev:2-2', 'ev', 2, 'コンバータ及びインバータ', 25, 101),
  ('ev:2-3', 'ev', 2, '配線', 20, 102),
  ('ev:2-4', 'ev', 2, '駆動用蓄電池及び充電器', 30, 103),
  ('ev:2-5', 'ev', 2, '駆動用原動機及び発電機', 20, 104),
  ('ev:2-6', 'ev', 2, '電気使用機器', 12, 105),
  ('ev:2-7', 'ev', 2, '保守及び点検', 13, 106),
  ('ev:3-1', 'ev', 3, '絶縁用保護具・絶縁用防具・絶縁工具及び絶縁テープ', 12, 200),
  ('ev:3-2', 'ev', 3, '検電器', 8, 201),
  ('ev:3-3', 'ev', 3, 'その他の安全作業用具', 5, 202),
  ('ev:3-4', 'ev', 3, '管理', 5, 203),
  ('ev:4-1', 'ev', 4, '充電電路の防護', 10, 300),
  ('ev:4-2', 'ev', 4, '作業者の絶縁保護', 10, 301),
  ('ev:4-3', 'ev', 4, '停電の方法', 10, 302),
  ('ev:4-4', 'ev', 4, '停電電路に対する措置', 10, 303),
  ('ev:4-5', 'ev', 4, '作業管理', 8, 304),
  ('ev:4-6', 'ev', 4, '救急処置', 7, 305),
  ('ev:4-7', 'ev', 4, '災害防止', 5, 306),
  ('ev:5-1', 'ev', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('kouatsu:1-1', 'kouatsu', 1, '高圧又は特別高圧の電気の危険性', 20, 0),
  ('kouatsu:1-2', 'kouatsu', 1, '接近限界距離', 15, 1),
  ('kouatsu:1-3', 'kouatsu', 1, '短絡', 12, 2),
  ('kouatsu:1-4', 'kouatsu', 1, '漏電', 11, 3),
  ('kouatsu:1-5', 'kouatsu', 1, '接地', 12, 4),
  ('kouatsu:1-6', 'kouatsu', 1, '静電誘導', 10, 5),
  ('kouatsu:1-7', 'kouatsu', 1, '電気絶縁', 10, 6),
  ('kouatsu:2-1', 'kouatsu', 2, '発電設備', 15, 100),
  ('kouatsu:2-2', 'kouatsu', 2, '送電設備', 15, 101),
  ('kouatsu:2-3', 'kouatsu', 2, '配電設備', 20, 102),
  ('kouatsu:2-4', 'kouatsu', 2, '変電設備', 15, 103),
  ('kouatsu:2-5', 'kouatsu', 2, '受電設備', 25, 104),
  ('kouatsu:2-6', 'kouatsu', 2, '電気使用設備', 15, 105),
  ('kouatsu:2-7', 'kouatsu', 2, '保守及び点検', 15, 106),
  ('kouatsu:3-1', 'kouatsu', 3, '絶縁用保護具', 15, 200),
  ('kouatsu:3-2', 'kouatsu', 3, '絶縁用防具', 12, 201),
  ('kouatsu:3-3', 'kouatsu', 3, '活線作業用器具', 12, 202),
  ('kouatsu:3-4', 'kouatsu', 3, '活線作業用装置', 12, 203),
  ('kouatsu:3-5', 'kouatsu', 3, '検電器', 12, 204),
  ('kouatsu:3-6', 'kouatsu', 3, '短絡接地器具', 12, 205),
  ('kouatsu:3-7', 'kouatsu', 3, 'その他の安全作業用具', 8, 206),
  ('kouatsu:3-8', 'kouatsu', 3, '管理', 7, 207),
  ('kouatsu:4-1', 'kouatsu', 4, '充電電路の防護', 40, 300),
  ('kouatsu:4-2', 'kouatsu', 4, '作業者の絶縁保護', 40, 301),
  ('kouatsu:4-3', 'kouatsu', 4, '活線作業用器具及び活線作業用装置の取扱い', 40, 302),
  ('kouatsu:4-4', 'kouatsu', 4, '安全距離の確保', 35, 303),
  ('kouatsu:4-5', 'kouatsu', 4, '停電電路に対する措置', 45, 304),
  ('kouatsu:4-6', 'kouatsu', 4, '開閉装置の操作', 30, 305),
  ('kouatsu:4-7', 'kouatsu', 4, '作業管理', 25, 306),
  ('kouatsu:4-8', 'kouatsu', 4, '救急処置', 25, 307),
  ('kouatsu:4-9', 'kouatsu', 4, '災害防止', 20, 308),
  ('kouatsu:5-1', 'kouatsu', 5, '法、令及び安衛則中の関係条項', 60, 400),
  ('fuseichi:1-1', 'fuseichi', 1, '種類（クローラ式・ホイール式）と、原動機・動力伝達装置', 40, 0),
  ('fuseichi:1-2', 'fuseichi', 1, '走行装置（クローラ）・操縦装置・制動装置', 40, 1),
  ('fuseichi:1-3', 'fuseichi', 1, '電気装置・警報装置と、走行に関する附属装置の取扱いの方法', 40, 2),
  ('fuseichi:2-1', 'fuseichi', 2, '荷役装置（ダンプ装置・あおり）と油圧装置', 40, 100),
  ('fuseichi:2-2', 'fuseichi', 2, '荷の積卸しの方法', 40, 101),
  ('fuseichi:2-3', 'fuseichi', 2, '荷の運搬の方法', 40, 102),
  ('fuseichi:3-1', 'fuseichi', 3, '力（合成、分解、つり合い及びモーメント）', 15, 200),
  ('fuseichi:3-2', 'fuseichi', 3, '重量', 10, 201),
  ('fuseichi:3-3', 'fuseichi', 3, '重心及び物の安定', 15, 202),
  ('fuseichi:3-4', 'fuseichi', 3, '速度及び加速度', 10, 203),
  ('fuseichi:3-5', 'fuseichi', 3, '荷重', 10, 204),
  ('fuseichi:4-1', 'fuseichi', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('shovel:1-1', 'shovel', 1, '種類（ショベルとフォーク）と、原動機・動力伝達装置', 40, 0),
  ('shovel:1-2', 'shovel', 1, '走行装置・操縦装置（中折れ）・制動装置', 40, 1),
  ('shovel:1-3', 'shovel', 1, '電気装置・警報装置と、走行に関する附属装置の取扱い方法', 40, 2),
  ('shovel:2-1', 'shovel', 2, '荷役装置（バケット・フォーク・リフトアーム）', 40, 100),
  ('shovel:2-2', 'shovel', 2, '油圧装置', 40, 101),
  ('shovel:2-3', 'shovel', 2, 'ヘッドガードと、荷役に関する附属装置の取扱い方法', 40, 102),
  ('shovel:3-1', 'shovel', 3, '力（合成、分解、つり合い及びモーメント）', 10, 200),
  ('shovel:3-2', 'shovel', 3, '重量', 7, 201),
  ('shovel:3-3', 'shovel', 3, '重心及び物の安定', 12, 202),
  ('shovel:3-4', 'shovel', 3, '速度及び加速度', 8, 203),
  ('shovel:3-5', 'shovel', 3, '荷重', 8, 204),
  ('shovel:3-6', 'shovel', 3, '応力', 7, 205),
  ('shovel:3-7', 'shovel', 3, '材料の強さ', 8, 206),
  ('shovel:4-1', 'shovel', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('kikaitoishi:1-1', 'kikaitoishi', 1, '研削盤の種類及び構造並びにその取扱い方法', 60, 0),
  ('kikaitoishi:1-2', 'kikaitoishi', 1, 'といしの種類、構成、表示及び安全度並びにその取扱い方法', 60, 1),
  ('kikaitoishi:1-3', 'kikaitoishi', 1, '取付け具', 30, 2),
  ('kikaitoishi:1-4', 'kikaitoishi', 1, '覆い', 30, 3),
  ('kikaitoishi:1-5', 'kikaitoishi', 1, '保護具', 30, 4),
  ('kikaitoishi:1-6', 'kikaitoishi', 1, '研削液', 30, 5),
  ('kikaitoishi:2-1', 'kikaitoishi', 2, '研削盤とといしとの適合確認', 20, 100),
  ('kikaitoishi:2-2', 'kikaitoishi', 2, 'といしの外観検査及び打音検査', 30, 101),
  ('kikaitoishi:2-3', 'kikaitoishi', 2, '取付け具の締付け方法及び締付け力', 25, 102),
  ('kikaitoishi:2-4', 'kikaitoishi', 2, 'バランスの取り方', 20, 103),
  ('kikaitoishi:2-5', 'kikaitoishi', 2, '試運転の方法', 25, 104),
  ('kikaitoishi:3-1', 'kikaitoishi', 3, '法、令及び安衛則中の関係条項', 60, 200),
  ('kogata:1-1', 'kogata', 1, '原動機と動力伝達装置', 60, 0),
  ('kogata:1-2', 'kogata', 1, '走行装置と操縦装置', 60, 1),
  ('kogata:1-3', 'kogata', 1, 'ブレーキ・電気装置・警報装置と走行に関する附属装置', 60, 2),
  ('kogata:2-1', 'kogata', 2, '種類及び用途', 40, 100),
  ('kogata:2-2', 'kogata', 2, '作業装置及び作業に関する附属装置の構造及び取扱い方法', 40, 101),
  ('kogata:2-3', 'kogata', 2, '一般的作業方法', 40, 102),
  ('kogata:3-1', 'kogata', 3, '運転に必要な力学及び土質工学', 35, 200),
  ('kogata:3-2', 'kogata', 3, '土木施工の方法', 25, 201),
  ('kogata:4-1', 'kogata', 4, '法、令及び安衛則中の関係条項', 60, 300),
  ('sanketsu:1-1', 'sanketsu', 1, '酸素欠乏の発生の原因', 25, 0),
  ('sanketsu:1-2', 'sanketsu', 1, '硫化水素の発生の原因', 20, 1),
  ('sanketsu:1-3', 'sanketsu', 1, '酸素欠乏等の発生しやすい場所', 15, 2),
  ('sanketsu:2-1', 'sanketsu', 2, '酸素欠乏等による危険性', 30, 100),
  ('sanketsu:2-2', 'sanketsu', 2, '酸素欠乏症等の主な症状', 30, 101),
  ('sanketsu:3-1', 'sanketsu', 3, '空気呼吸器、酸素呼吸器、送気マスク及び換気装置の種類', 25, 200),
  ('sanketsu:3-2', 'sanketsu', 3, '使用方法及び保守点検の方法', 35, 201),
  ('sanketsu:4-1', 'sanketsu', 4, '退避と、墜落制止用器具等・救出用の設備及び器具の使用方法及び保守点検の方法', 25, 300),
  ('sanketsu:4-2', 'sanketsu', 4, '人工呼吸の方法', 25, 301),
  ('sanketsu:4-3', 'sanketsu', 4, '人工そ生器の使用方法', 10, 302),
  ('sanketsu:5-1', 'sanketsu', 5, '酸素及び硫化水素の濃度の測定の方法', 30, 400),
  ('sanketsu:5-2', 'sanketsu', 5, '換気の方法と作業の進め方', 25, 401),
  ('sanketsu:5-3', 'sanketsu', 5, '法、令、安衛則及び酸欠則中の関係条項', 35, 402)
on conflict (lesson_id) do update
  set course_id  = excluded.course_id,
      subject_id = excluded.subject_id,
      title      = excluded.title,
      legal_min  = excluded.legal_min,
      sort_order = excluded.sort_order;

commit;

-- ═══════════════════════════════════════════════════════════
-- 確かめ
-- ═══════════════════════════════════════════════════════════
select '講座'   as なに, count(*)::text as いくつ, '73'   as あるべき from public.courses
union all
select '単元',        count(*)::text,                '905'         from public.lessons
union all
select '版',          public.schema_version()::text, '0027'
union all
select '受講リクエストの表', (to_regclass('public.course_requests') is not null)::text, 'true'
union all
select '修了証の講座名の列', (exists(select 1 from information_schema.columns
                                where table_schema='public' and table_name='certificates'
                                  and column_name='course_name'))::text, 'true'
union all
select '実技の実施記録の表', (to_regclass('public.cert_request_files') is not null)::text, 'true';
