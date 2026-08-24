-- ═══════════════════════════════════════════════════════════
-- 足場トレーニング Supabase 初期化（このファイルを SQL Editor に貼って実行）
--
-- 中身:
--   1. マイグレーション 0001_init / 0002_rls / 0003_rules / 0004_auth / 0005_cert / 0006_version / 0007_admin / 0008_tenant
--   2. lessons（単元の規定時間）13件を投入
--   3. 開発用の事業者・受講者・受講コード・受講（フェーズ1〜2で使う）
--
-- 何度実行しても壊れないように書いてある（作成済みなら飛ばす）。
-- 自動生成: npm run build:sql　— 直接編集しないこと
-- ═══════════════════════════════════════════════════════════

-- 0001_init.sql
-- 足場トレーニング／特別教育 データモデル（SPEC.md 第3章）
-- 型・制約・索引のみ。RLS は 0002、関数とトリガは 0003。

create extension if not exists "pgcrypto";

-- ── 列挙型 ─────────────────────────────────
do $$ begin
  create type public.user_role as enum ('learner', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_method as enum ('card', 'invoice');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.order_status as enum ('pending', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.verify_result as enum ('ok', 'ng');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.verify_reason as enum ('no_face', 'multi_face', 'blocked', 'no_motion');
exception when duplicate_object then null; end $$;

-- ── 事業者 ─────────────────────────────────
create table if not exists public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  responsible_name text,
  created_at       timestamptz not null default now()
);

-- ── ユーザー（受講者・教育担当者）──────────
-- id は auth.users.id と同一。Auth 導入前は種データで直接投入する。
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name       text             not null,
  birth_date date,
  email      text,
  role       public.user_role not null default 'learner',
  created_at timestamptz      not null default now()
);
create index if not exists users_company_id_idx on public.users (company_id);

-- ── 注文 ───────────────────────────────────
-- 金額は円。小数を持たせない。
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete restrict,
  seats             int  not null check (seats > 0),
  unit_price        int  not null check (unit_price >= 0),
  amount            int  not null check (amount >= 0),
  method            public.order_method not null,
  status            public.order_status not null default 'pending',
  stripe_session_id text unique,
  due_date          date,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  -- 入金済みの注文には必ず入金日時が入る（修了証の発行可否がここを見る）
  constraint orders_paid_at_matches_status
    check ((status = 'paid') = (paid_at is not null))
);
create index if not exists orders_company_id_idx on public.orders (company_id);
create index if not exists orders_status_idx     on public.orders (status);

-- ── 受講コード ─────────────────────────────
create table if not exists public.seats (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  code       text not null unique,
  used_by    uuid references public.users (id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz,
  constraint seats_used_pair check ((used_by is null) = (used_at is null))
);
create index if not exists seats_order_id_idx on public.seats (order_id);
create index if not exists seats_used_by_idx  on public.seats (used_by);

-- ── 受講状態 ───────────────────────────────
create table if not exists public.enrollments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  seat_id            uuid unique references public.seats (id) on delete set null,
  consented_at       timestamptz,
  face_registered_at timestamptz,
  id_document_at     timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists enrollments_user_id_idx on public.enrollments (user_id);

-- ── 視聴記録（単元ごと）────────────────────
-- lesson_id は curriculum.json の '1-1' 形式。教材は DB に持たないので FK は張らない。
-- watched_sec の加算は 0003 の sync_watched_sec 経由のみ（クライアントの時刻を信用しない）。
create table if not exists public.progress (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.enrollments (id) on delete cascade,
  lesson_id      text not null,
  watched_sec    int  not null default 0 check (watched_sec >= 0),
  quiz_passed_at timestamptz,
  updated_at     timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

-- ── 照合ログ（顔認証）──────────────────────
-- 画像・特徴量は保存しない。結果と理由だけ。
create table if not exists public.verify_logs (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id     text,
  result        public.verify_result not null,
  reason        public.verify_reason,
  created_at    timestamptz not null default now(),
  constraint verify_logs_reason_required
    check ((result = 'ng') = (reason is not null))
);
create index if not exists verify_logs_enrollment_idx on public.verify_logs (enrollment_id, created_at desc);

-- ── 修了試験 ───────────────────────────────
create table if not exists public.exams (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  score         int  not null check (score >= 0),
  total         int  not null default 20 check (total > 0),
  passed        boolean not null,
  attempt       int  not null check (attempt > 0),
  created_at    timestamptz not null default now(),
  constraint exams_score_within_total check (score <= total),
  unique (enrollment_id, attempt)
);

-- ── 修了証 ─────────────────────────────────
-- 発行名義は事業者。1受講につき1枚（再発行は revoked_at を立ててから）。
create table if not exists public.certificates (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  cert_no       text not null unique,
  issued_at     timestamptz not null default now(),
  issued_by     uuid references public.users (id) on delete set null,
  revoked_at    timestamptz
);
create unique index if not exists certificates_active_one_per_enrollment
  on public.certificates (enrollment_id) where revoked_at is null;


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
drop policy if exists companies_select_own on public.companies;
create policy companies_select_own on public.companies
  for select using (id = public.current_company_id());

-- ── users ──────────────────────────────────
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid());
drop policy if exists users_select_company on public.users;
create policy users_select_company on public.users
  for select using (public.is_admin() and company_id = public.current_company_id());
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
-- role・company_id の書き換えは 0003 のトリガで拒否する。

-- ── orders / seats ─────────────────────────
-- 参照は自社の admin。作成・入金反映は Stripe webhook（service_role）のみ。
drop policy if exists orders_select_company on public.orders;
create policy orders_select_company on public.orders
  for select using (public.is_admin() and company_id = public.current_company_id());

drop policy if exists seats_select_company on public.seats;
create policy seats_select_company on public.seats
  for select using (
    public.is_admin()
    and exists (select 1 from public.orders o
                where o.id = seats.order_id and o.company_id = public.current_company_id())
  );
-- 受講者は引き換え時に自分のコードを見る
drop policy if exists seats_select_own on public.seats;
create policy seats_select_own on public.seats
  for select using (used_by = auth.uid());

-- ── enrollments ────────────────────────────
drop policy if exists enrollments_select_own on public.enrollments;
create policy enrollments_select_own on public.enrollments
  for select using (user_id = auth.uid());
drop policy if exists enrollments_select_company on public.enrollments;
create policy enrollments_select_company on public.enrollments
  for select using (public.is_admin() and public.enrollment_in_my_company(id));
drop policy if exists enrollments_insert_own on public.enrollments;
create policy enrollments_insert_own on public.enrollments
  for insert with check (user_id = auth.uid());
-- 同意・顔登録・書類の日時は本人が更新する。completed_at はサーバ側だけが立てる（0003）。
drop policy if exists enrollments_update_own on public.enrollments;
create policy enrollments_update_own on public.enrollments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── progress ───────────────────────────────
-- 行の作成は本人。watched_sec の加算と quiz_passed_at は sync_watched_sec / mark_quiz_passed 経由。
drop policy if exists progress_select_own on public.progress;
create policy progress_select_own on public.progress
  for select using (public.owns_enrollment(enrollment_id));
drop policy if exists progress_select_company on public.progress;
create policy progress_select_company on public.progress
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
drop policy if exists progress_insert_own on public.progress;
create policy progress_insert_own on public.progress
  for insert with check (public.owns_enrollment(enrollment_id) and watched_sec = 0);
-- update ポリシーは置かない（クライアントからの直接更新を拒否）

-- ── verify_logs ────────────────────────────
drop policy if exists verify_logs_insert_own on public.verify_logs;
create policy verify_logs_insert_own on public.verify_logs
  for insert with check (public.owns_enrollment(enrollment_id));
drop policy if exists verify_logs_select_own on public.verify_logs;
create policy verify_logs_select_own on public.verify_logs
  for select using (public.owns_enrollment(enrollment_id));
drop policy if exists verify_logs_select_company on public.verify_logs;
create policy verify_logs_select_company on public.verify_logs
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));

-- ── exams ──────────────────────────────────
-- 採点はサーバ側（service_role）。クライアントは結果を読むだけ。
drop policy if exists exams_select_own on public.exams;
create policy exams_select_own on public.exams
  for select using (public.owns_enrollment(enrollment_id));
drop policy if exists exams_select_company on public.exams;
create policy exams_select_company on public.exams
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));

-- ── certificates ───────────────────────────
-- 発行は service_role のみ（入金確認の判定を通す。0003 のトリガ参照）。
drop policy if exists certificates_select_own on public.certificates;
create policy certificates_select_own on public.certificates
  for select using (public.owns_enrollment(enrollment_id));
drop policy if exists certificates_select_company on public.certificates;
create policy certificates_select_company on public.certificates
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));


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


-- 0004_auth.sql
-- ログイン（Supabase Auth）を入れたときの受け皿。
--
-- auth.users に行ができたら public.users を作る。
-- public.users.name は NOT NULL なので、登録時に入れてもらった氏名を使う。
-- 入っていなければ仮の名前を入れておき、受講の準備の画面で本人に直してもらう。

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- すでに auth.users にいて public.users が無い人を拾う（入れ忘れの後追い）
insert into public.users (id, name, email)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
       u.email
from auth.users u
left join public.users p on p.id = u.id
where p.id is null;

-- ── 受講（enrollments）を1人1件だけにする ──
-- いまは決済がまだ無いので、ログインした人に1件だけ受講を作る。
-- 席（seats）を売る形になったら、seat_id を必須にしてここを外す。
create unique index if not exists enrollments_one_per_user_idx
  on public.enrollments (user_id)
  where seat_id is null;


-- 0005_cert.sql
-- 修了証を出せる条件のうち「入金」の扱い。
--
-- もとの決まり（0003）は、受講コードに紐づく注文が入金済みでなければ
-- 修了証を出さない、というものでした。請求書払いでも資格証だけは止める、という趣旨です。
--
-- ただ、いまはまだ決済の仕組みがありません。
-- 受講コードを持たない受講（自分で登録した人）は注文そのものが無いので、
-- もとの決まりのままだと **誰にも修了証が出せません**。
--
-- そこで、
--   ・受講コードがある受講 … これまでどおり入金済みでなければ出さない（趣旨はそのまま）
--   ・受講コードが無い受講 … いまは通す（社内での無償利用とみなす）
-- とします。
--
-- ※ 決済を入れて席（seats）を配る形にしたら、下の「受講コードが無いとき」の
--    分岐を消してください。そうすれば、もとの決まりに戻ります。

create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat   uuid;
  v_status public.order_status;
begin
  select e.seat_id into v_seat from public.enrollments e where e.id = new.enrollment_id;

  -- 受講コードが無い受講。決済の仕組みが入るまでは通す
  if v_seat is null then
    return new;
  end if;

  select o.status into v_status
    from public.seats  s
    join public.orders o on o.id = s.order_id
   where s.id = v_seat;

  if v_status is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;
  if v_status <> 'paid' then
    raise exception '未入金の注文です。修了証は発行できません';
  end if;
  return new;
end $$;

-- 1受講につき有効な修了証は1枚（取り消したものは残す）
create unique index if not exists certificates_one_active_idx
  on public.certificates (enrollment_id)
  where revoked_at is null;


-- 0006_version.sql
-- いまデータベースに入っている版を返すだけの関数。
--
-- 「apply-all.sql を流したかどうか」を画面（/setup）から見るために使います。
-- 手を入れて新しいマイグレーションを足したら、下の数字を上げてください。

create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0006'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- 0007_admin.sql
-- 教育担当者の画面のための追加。
--
-- ① 実務トレーニング（第1〜3章）の成績を、端末だけでなくサーバにも残す。
--    いままでは端末の中だけだったので、教育担当者からは誰が何をやったか見えなかった。
-- ② 受講者を事業者に紐づける。担当者が見られるのは自社の受講者だけ（RLS は 0002 のまま）。

-- ── 実務トレーニングの成績 ──────────────────
-- 1回通すごとに1行。点や時間だけでなく「言われたこと」も残す（間違いノートの元）。
-- 書き込みは API（service_role）だけ。クライアントから直に足させない。
create table if not exists public.training_attempts (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  chapter       text not null check (chapter in ('ch1','ch2','ch3','ch4','ch5','ch6')),
  -- チュートリアルか本番か
  tutorial      boolean not null default false,
  -- 手摺先行工法で組んだか（第1章だけ）
  sk            boolean not null default false,
  skill         int not null check (skill between 0 and 100),
  score         int not null check (score >= 0),
  sec           int not null check (sec >= 0),
  hints         int not null default 0 check (hints >= 0),
  asks          int not null default 0 check (asks >= 0),
  passed        boolean not null,
  errs          jsonb   not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists training_attempts_enrollment_idx
  on public.training_attempts (enrollment_id, chapter, created_at desc);

alter table public.training_attempts enable row level security;

drop policy if exists training_attempts_select_own on public.training_attempts;
create policy training_attempts_select_own on public.training_attempts
  for select using (public.owns_enrollment(enrollment_id));

drop policy if exists training_attempts_select_company on public.training_attempts;
create policy training_attempts_select_company on public.training_attempts
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）

-- ── 新しく登録した人を事業者に入れる ────────
-- 事業者がちょうど1社のときだけ、その会社に入れる。
-- 2社以上あるときは、どちらに入れるべきか決められないので空のままにする
-- （担当者の画面から入れてもらう）。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select id into v_company from public.companies limit 2;
  if (select count(*) from public.companies) <> 1 then
    v_company := null;
  end if;

  insert into public.users (id, name, email, company_id)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email,
    v_company
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0007'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- 0008_tenant.sql
-- 外販（複数の事業者が同じ仕組みを使う）を前提にした直し。
--
-- ① 事業者ごとに参加コードを持たせる。受講者はコードで自分の事業者に入る
-- ② 登録しただけの人を、どこかの事業者へ勝手に入れない
-- ③ 証明番号を、番号が尽きても衝突しない形にする
--
-- 0007 までは「1社で使う」前提が残っていた。そのまま外販すると
-- ・他社の受講者が自社の名簿に混ざる
-- ・2社目の教育担当者が決められない
-- ・同じ月に1万件を超えると修了証が発行できなくなる

-- ── ① 参加コードと、事業者を作った人 ──────
alter table public.companies
  add column if not exists join_code  text,
  add column if not exists created_by uuid references public.users (id) on delete set null;

create unique index if not exists companies_join_code_idx
  on public.companies (join_code) where join_code is not null;

comment on column public.companies.join_code is
  '受講者が自分の事業者に入るための合言葉。教育担当者が配る';
comment on column public.companies.responsible_name is
  '教育実施責任者。修了証にこの名前が載る';

-- すでにある事業者にも参加コードを配っておく（画面から押さなくてよいように）。
-- 紙に書いて渡すので、読み違えやすい字（0/1/O/I/L）は使わない。
create or replace function public.gen_join_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 8)
$$;

do $$
declare
  r record;
  c text;
begin
  for r in select id from public.companies where join_code is null loop
    -- まれにぶつかる。ぶつかったら取り直す
    for i in 1..10 loop
      c := public.gen_join_code();
      begin
        update public.companies set join_code = c where id = r.id;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end $$;

-- ── ② 登録した人は、どこにも属さない状態から始める ──
-- 0007 では「事業者が1社だけならそこへ入れる」としていたが、
-- 外販だと2社目以降で他社の名簿に混ざる。所属は参加コードで決める。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ③ 証明番号 ─────────────────────────────
-- もとは受講IDから4桁を作っていたので、同じ月に1万件を超えると必ずぶつかる。
-- ぶつかると cert_no の一意制約で発行が止まる（＝出せなくなる）。
-- 通し番号にして、ぶつからないようにする。
create sequence if not exists public.cert_no_seq start 1;

create or replace function public.next_cert_no()
returns text language sql volatile security definer set search_path = public as $$
  select 'AT-' || to_char(now() at time zone 'Asia/Tokyo', 'YYYYMM')
      || '-' || lpad(nextval('public.cert_no_seq')::text, 5, '0')
$$;

revoke all on function public.next_cert_no() from public, anon, authenticated;
grant execute on function public.next_cert_no() to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0008'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 4. lessons（curriculum.json の単元ID・題名・規定時間の写し）
-- ═══════════════════════════════════════════════════════════
insert into public.lessons (lesson_id, subject_id, title, legal_min, sort_order) values
  ('1-1', 1, '足場の種類、材料、構造及び組立図', 50, 0),
  ('1-2', 1, '組立て、解体及び変更の作業の方法', 60, 1),
  ('1-3', 1, '点検及び補修', 40, 2),
  ('1-4', 1, '登り桟橋、朝顔等の構造と作業の方法', 30, 3),
  ('2-1', 2, '工事用設備及び機械の取扱い', 10, 100),
  ('2-2', 2, '器具及び工具', 10, 101),
  ('2-3', 2, '悪天候時における作業の方法', 10, 102),
  ('3-1', 3, '墜落による危険の防止', 35, 200),
  ('3-2', 3, '飛来落下・倒壊による危険の防止', 25, 201),
  ('3-3', 3, '保護具の使用方法と保守点検', 20, 202),
  ('3-4', 3, '感電・熱中症その他の危険の防止', 10, 203),
  ('4-1', 4, '法、令及び安衛則中の関係条項', 35, 300),
  ('4-2', 4, '事業者と作業者の義務、企業責任', 25, 301)
on conflict (lesson_id) do update
  set subject_id = excluded.subject_id,
      title      = excluded.title,
      legal_min  = excluded.legal_min,
      sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════
-- 5. 開発用の種データ（フェーズ1〜2）
--
-- Auth のログインはフェーズ2の時点で未接続なので、
-- 視聴記録・照合ログ・受験記録はこの「開発用受講」に付ける。
-- 本番運用を始めるときは、この5行分を削除すること。
-- ═══════════════════════════════════════════════════════════

-- 認証ユーザー（public.users が auth.users を参照するため先に作る）。
-- パスワードは設定しないのでログインには使えない。記録の紐付け先としてだけ使う。
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'dev@example.invalid', now(), now())
on conflict (id) do nothing;

insert into public.companies (id, name, responsible_name)
  values ('22222222-2222-2222-2222-222222222222', '開発テスト工業', '開発 太郎')
  on conflict (id) do nothing;

insert into public.users (id, company_id, name, role)
  values ('11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222', '受講テスト', 'learner')
  on conflict (id) do nothing;

insert into public.orders (id, company_id, seats, unit_price, amount, method, status)
  values ('33333333-3333-3333-3333-333333333333',
          '22222222-2222-2222-2222-222222222222', 1, 0, 0, 'invoice', 'pending')
  on conflict (id) do nothing;

insert into public.seats (id, order_id, code, used_by, used_at)
  values ('44444444-4444-4444-4444-444444444444',
          '33333333-3333-3333-3333-333333333333', 'DEV-0001',
          '11111111-1111-1111-1111-111111111111', now())
  on conflict (id) do nothing;

insert into public.enrollments (id, user_id, seat_id, consented_at, started_at)
  values ('55555555-5555-5555-5555-555555555555',
          '11111111-1111-1111-1111-111111111111',
          '44444444-4444-4444-4444-444444444444', now(), now())
  on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- 完了。最後に出る enrollment_id を .env.local の DEV_ENROLLMENT_ID に入れる
-- （既定値のままでよい: 55555555-5555-5555-5555-555555555555）
-- ═══════════════════════════════════════════════════════════
select
  (select count(*) from public.lessons)                     as lessons,
  (select count(*) from public.enrollments)                 as enrollments,
  '55555555-5555-5555-5555-555555555555'::uuid              as dev_enrollment_id;
