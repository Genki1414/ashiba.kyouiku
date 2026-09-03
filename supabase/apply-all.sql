-- ═══════════════════════════════════════════════════════════
-- 足場トレーニング Supabase 初期化（このファイルを SQL Editor に貼って実行）
--
-- 中身:
--   1. マイグレーション 0001_init / 0002_rls / 0003_rules / 0004_auth / 0005_cert / 0006_version / 0007_admin / 0008_tenant / 0009_order / 0010_verify / 0011_course / 0012_member / 0013_keep / 0014_own / 0015_qual / 0016_keep3y / 0017_train / 0018_solo / 0019_view / 0020_sent / 0021_role / 0022_live / 0023_issue / 0024_notice
--   2. lessons（単元の規定時間）233件を投入
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


-- 0009_order.sql
-- 申込みと席（受講コード）、入金と修了証の紐付け。
--
-- ここまでは誰でも登録して、事業者を作って、全部使えていた。
-- 売り物にするので、
--   ① 何人ぶん買ったか（orders）と、1人1枚の席（seats）を配る
--   ② 入金が済むまで修了証を出さない（0003 の本来の決まりへ戻す）
-- ただし、いま使っている事業者を止めてしまわないよう、
-- すでにある事業者は「無償利用」として通す。

-- ── 無償利用の印 ───────────────────────────
-- 運営（東北三上機材）が許した事業者は、席が無くても修了証を出せる。
-- 新しく作った事業者は既定で false。＝席を買わないと修了証は出ない。
alter table public.companies
  add column if not exists trial boolean not null default false;

comment on column public.companies.trial is
  '無償利用。席が無くても修了証を出せる。運営だけが立てられる';

-- すでにある事業者は、いままで通り使えるようにしておく
update public.companies set trial = true where created_at < now();

-- ── 注文に「誰が申し込んだか」と請求先を持たせる ──
alter table public.orders
  add column if not exists ordered_by  uuid references public.users (id) on delete set null,
  add column if not exists bill_to     text,
  add column if not exists note        text;

-- ── 席の有効期限は既定で1年 ────────────────
-- 特別教育に期限は無いが、売った席がいつまでも残ると数が合わなくなる。
alter table public.seats
  alter column expires_at set default (now() + interval '1 year');

-- ── 受講コードの採番 ───────────────────────
-- 12文字。読み違えやすい 0・1・O・I・L は使わない（参加コードと同じ字）。
-- 参加コードは8文字なので、桁で見分けられる。
create or replace function public.gen_seat_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 12)
$$;

-- ── 修了証は入金確認まで出さない（本来の決まりへ戻す）──
-- 0005 では「席が無ければ通す」としていた。決済が無かったため。
-- ここからは
--   ・席がある … その注文が入金済みでなければ出さない
--   ・席が無い … 事業者が無償利用（trial）のときだけ通す
create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat   uuid;
  v_user   uuid;
  v_trial  boolean;
  v_status public.order_status;
begin
  select e.seat_id, e.user_id into v_seat, v_user
    from public.enrollments e where e.id = new.enrollment_id;

  if v_seat is null then
    select c.trial into v_trial
      from public.users u
      join public.companies c on c.id = u.company_id
     where u.id = v_user;
    if coalesce(v_trial, false) then
      return new;
    end if;
    raise exception '受講コードがありません。申込みと入金を確かめてください';
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

-- ── 席を1つ引き換える ──────────────────────
-- 同時に2人が同じコードを入れても、1人しか通らないようにする
-- （行を掴んでから使用済みにする）。
create or replace function public.redeem_seat(p_code text, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seat    public.seats;
  v_company uuid;
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

  select o.company_id into v_company from public.orders o where o.id = v_seat.order_id;
  if v_company is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;

  if v_seat.used_by is null then
    update public.seats
       set used_by = p_user, used_at = now()
     where id = v_seat.id;
  end if;

  update public.users set company_id = v_company where id = p_user;

  -- その人の受講に席を紐づける（まだ受講が無ければ、あとで作られる分に付く）
  update public.enrollments
     set seat_id = v_seat.id
   where user_id = p_user and seat_id is null;

  return v_company;
end $$;

revoke all on function public.redeem_seat(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_seat(text, uuid) to service_role;
revoke all on function public.gen_seat_code() from public, anon, authenticated;
grant execute on function public.gen_seat_code() to service_role;

-- ── 1人1受講の索引を外す ───────────────────
-- 0004 では「席が無い受講は1人1件」としていた。
-- 席を紐づけると seat_id が入るので、この索引には当たらなくなる。そのままでよい。

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0009'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0010 受講中の照合に「別人」を足す
--
-- これまでの照合は、明るさとばらつきしか見ていなかった。
-- 手でレンズを塞いでも通ってしまうので、学習済みのモデルで
-- 顔そのものを見るようにした（端末の中で動く。映像は送らない）。
--
-- 見分けが付くようになった分、理由がひとつ増える。
--   not_me … 受講の準備で登録した人と違う
--
-- 記録するのは「外れた理由」だけ。
-- 顔の画像も特徴量も、これまでどおりサーバへは送らない。
-- ═══════════════════════════════════════════════════════════

alter type public.verify_reason add value if not exists 'not_me';

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0010'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


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


-- ═══════════════════════════════════════════════════════════
-- 0013 受けた記録は消さない
--
-- 特別教育を行っているのは、この仕組みの運営（東北三上機材株式会社）です。
-- 修了証もその名義で出しています。
-- ということは、**記録を保存する義務はこの仕組みの側にあります**。
-- 受講者の勤め先が変わっても、受講コードを取り消しても、
-- 記録そのものは残っていなければなりません。
--
-- 0012 までの作りでは、受講コードの引き換えを取り消したときに
-- 視聴記録・試験・実務・照合ログを消していました。
-- 「買い直した席で法定時間を引き継がせない」ためでしたが、
-- 消してしまうと、行った教育の記録が残りません。
--
-- そこで、消すのをやめて **閉じる** ことにします。
--   ・取り消した受講は closed_at が入り、そこで終わり
--   ・同じ人が同じ講座をもう一度受けると、新しい受講が始まる（0から）
--   ・閉じた受講の記録は、そのまま残る
-- ═══════════════════════════════════════════════════════════

alter table public.enrollments
  add column if not exists closed_at timestamptz;

-- 開いている受講は、1人1講座につき1件。閉じたものは何件でも残せる
drop index if exists public.enrollments_one_per_user_course_idx;
create unique index if not exists enrollments_open_one_idx
  on public.enrollments (user_id, course_id) where closed_at is null;
create index if not exists enrollments_closed_idx
  on public.enrollments (user_id, course_id, closed_at);

-- ── 受講を1件だけ用意する（閉じたものは数えない）──
create or replace function public.enrollment_for(p_user uuid, p_course text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません（%）', p_course;
  end if;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course and closed_at is null;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.enrollments (user_id, course_id, company_id, started_at)
       select p_user, p_course, u.company_id, now()
         from public.users u where u.id = p_user
  on conflict do nothing;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course and closed_at is null;
  return v_id;
end $$;

revoke all on function public.enrollment_for(uuid, text) from public, anon, authenticated;
grant execute on function public.enrollment_for(uuid, text) to service_role;

-- ── 受講コードの引き換えを取り消す ──────────
-- 席を未使用に戻し、その席で受けていた受講を閉じる。
-- 記録は消さない。次に受けるときは、新しい受講が0から始まる。
create or replace function public.release_seat(p_seat uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.enrollments
     set closed_at = now(), seat_id = null
   where seat_id = p_seat and closed_at is null;

  update public.seats
     set used_by = null, used_at = null
   where id = p_seat;
end $$;

revoke all on function public.release_seat(uuid) from public, anon, authenticated;
grant execute on function public.release_seat(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0013'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0014 事業者を作った人の在籍
--
-- 事業者を作ると users.company_id は書いていたが、
-- 在籍（memberships）が立っていなかった。
-- そのため、
--   ・作った本人が自分の名簿に出ない
--   ・在籍で見る決まり（無償利用の判定）から漏れる
-- という形になっていた。
--
-- 作る側（/api/admin/setup）は join_company を通すように直した。
-- ここでは、それより前に作られた事業者ぶんを埋める。
--
-- 0012 の埋め戻しと同じ形。何度流しても増えない。
-- ═══════════════════════════════════════════════════════════

insert into public.memberships (user_id, company_id, approved_at)
select u.id, u.company_id, now()
  from public.users u
 where u.company_id is not null
   and not exists (
     select 1 from public.memberships m
      where m.user_id = u.id and m.left_at is null
   );

-- 事業者を作った人が、users.company_id ごと抜けていた場合の受け皿。
-- companies.created_by は残っているので、そこから起こす。
-- すでに在籍しているなら触らない（よその会社に移っている人を戻さない）。
insert into public.memberships (user_id, company_id, approved_at)
select c.created_by, c.id, now()
  from public.companies c
 where c.created_by is not null
   and not exists (
     select 1 from public.memberships m
      where m.user_id = c.created_by and m.left_at is null
   );

update public.users u
   set company_id = m.company_id
  from public.memberships m
 where m.user_id = u.id
   and m.approved_at is not null
   and m.left_at is null
   and u.company_id is distinct from m.company_id;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0014'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0015 よそで取った資格
--
-- 足場の職人が持っているものは、この仕組みの外で取ったものが多い。
-- 前の会社で受けた特別教育、教習機関で取った技能講習、免許。
--
-- 特別教育は「その業務に就かせる前に」行う決まりで、
-- すでに受けている人に受け直させる決まりではない。
-- ただ、事業者は「受けている」ことを確かめないと就かせられない。
-- 入ってきた人が何を持っているのか分からないと、
-- 受講コードを無駄に買うか、持っていない人を現場に出すことになる。
--
-- 決めたこと
--   ・本人がマイページから足す（自己申告）
--   ・現物（修了証）を見た会社が confirmed_at を立てる
--     自己申告のままでは「確かめた」ことにならない
--   ・見えるのは本人と、いま在籍している会社だけ
--   ・会社を移っても消さない。資格は人に付いてくるもの
--
-- この仕組みで出した修了証（certificates）とは別の表にする。
-- 混ぜると、こちらで出した記録と自己申告の区別が付かなくなる。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.held_quals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  -- src/content/quals.ts の id。一覧に無いものは 'other'
  qual_id      text not null,
  -- 'other' のときの名前。本人が書く
  label        text,
  -- どこで受けたか（前の会社・教習機関）
  issuer       text,
  -- 取った日。分かる範囲で
  got_on       date,
  -- 修了証番号。分かれば
  cert_no      text,
  -- 会社が現物を見て確かめた
  confirmed_at timestamptz,
  confirmed_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 同じ資格を二重に足さない。'other' は名前が違えば何件でも
create unique index if not exists held_quals_one_idx
  on public.held_quals (user_id, qual_id) where qual_id <> 'other';
create index if not exists held_quals_user_idx on public.held_quals (user_id);

alter table public.held_quals enable row level security;

drop policy if exists held_quals_select_own on public.held_quals;
create policy held_quals_select_own on public.held_quals
  for select using (user_id = auth.uid());

-- いま在籍している人のぶんだけ、その会社から見える。
-- 抜けた人のぶんは見えない（資格は人に付いてくるもので、会社の記録ではない）
drop policy if exists held_quals_select_company on public.held_quals;
create policy held_quals_select_company on public.held_quals
  for select using (
    exists (
      select 1 from public.memberships m
       where m.user_id = public.held_quals.user_id
         and m.company_id = public.current_company_id()
         and m.approved_at is not null
         and m.left_at is null
    )
  );

-- ── 資格を足す ─────────────────────────────
-- 同じものが既にあれば、書き足すだけ（二重に増やさない）。
-- 中身を直すと、会社が確かめた印は落ちる。
-- 確かめたのは「そのとき見せられた紙」なので、書き換えたら確かめ直す。
create or replace function public.add_qual(
  p_user uuid, p_qual text, p_label text, p_issuer text,
  p_got date, p_cert text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_qual), '') = '' then
    raise exception '資格が選ばれていません';
  end if;
  if p_qual = 'other' and coalesce(btrim(p_label), '') = '' then
    raise exception 'その他を選んだときは、名前を書いてください';
  end if;

  if p_qual <> 'other' then
    select id into v_id from public.held_quals
     where user_id = p_user and qual_id = p_qual;
  end if;

  if v_id is not null then
    update public.held_quals
       set label = p_label, issuer = p_issuer, got_on = p_got, cert_no = p_cert,
           confirmed_at = null, confirmed_by = null
     where id = v_id;
    return v_id;
  end if;

  insert into public.held_quals (user_id, qual_id, label, issuer, got_on, cert_no)
  values (p_user, p_qual, p_label, p_issuer, p_got, p_cert)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.add_qual(uuid, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.add_qual(uuid, text, text, text, date, text) to service_role;

-- ── 資格を外す ─────────────────────────────
-- 自分のぶんだけ。間違えて足したときに戻せないと困る。
create or replace function public.drop_qual(p_user uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.held_quals where id = p_id and user_id = p_user;
end $$;

revoke all on function public.drop_qual(uuid, uuid) from public, anon, authenticated;
grant execute on function public.drop_qual(uuid, uuid) to service_role;

-- ── 現物を見て確かめた ─────────────────────
-- 押せるのは、その人がいま在籍している会社だけ。
-- 会社の番号を渡させて、在籍を数えてから立てる。
create or replace function public.confirm_qual(
  p_id uuid, p_company uuid, p_admin uuid, p_on boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.held_quals where id = p_id;
  if v_user is null then
    return false;
  end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_user and m.company_id = p_company
       and m.approved_at is not null and m.left_at is null
  ) then
    raise exception '自社に在籍している人ではありません';
  end if;

  update public.held_quals
     set confirmed_at = case when p_on then now() else null end,
         confirmed_by = case when p_on then p_admin else null end
   where id = p_id;
  return true;
end $$;

revoke all on function public.confirm_qual(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.confirm_qual(uuid, uuid, uuid, boolean) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0015'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0016 3年たった記録の、個人の部分を消せるようにする
--
-- 特別教育を行ったときは、受講者・科目等の記録を作成して
-- 3年間保存する決まり（安衛則 第38条）。
-- 教育を行っているのはこの仕組みなので、保存するのもこちら。
--
-- 一方で、要らなくなった個人情報は消すのが筋（個人情報保護法）。
-- 3年を過ぎたら、**個人の部分だけ**消せるようにする。
--
-- 決めたこと
--   ・自動では消さない。本部が、誰が消えるかを見てから押す
--     決まりの記録を、気づかないうちに消してはいけない
--   ・消すのは人ごと。その人の受講記録が**全部**3年より前のときだけ
--     よその会社でまだ1年目の受講が残っていたら、消せない
--   ・在籍しているうちは消さない。まだ働いている人だから
--   ・残すもの … 受講の記録（単元・時間・試験）、修了証の番号と日付
--     消すもの … 氏名・メール・生年月日、顔の照合ログ、自己申告の資格
--
--   修了証の番号を残すのは、元請や監督署が番号で照会するため。
--   照会の画面は前から名前を伏せ字にしてあるので、番号だけで足りる。
--   「何人に受けさせたか」も、名前を消しても数えられる。
-- ═══════════════════════════════════════════════════════════

-- いつ消したか。消した人をもう一度数えないための印でもある
alter table public.users add column if not exists erased_at timestamptz;
create index if not exists users_erased_idx on public.users (erased_at);

-- ── 個人の部分を消す ───────────────────────
-- 消せるかどうかの見極め（3年たっているか・在籍していないか）は
-- 呼ぶ側で行う。ここは「消す」だけを受け持つ。
-- ただし、在籍している人だけは念のためここでも止める。
-- 押し間違いで、いま働いている人の名前が消えると取り返しがつかない。
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
  select '0016'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0017 実務トレーニングの利用権
--
-- 第1章は、ログインすれば誰でも遊べる（試し）。
-- 第2章から先は、利用権を持っている人だけ。
--
-- 特別教育（学科）とは別の売り物にする。
-- 学科は「1人1枚の席」で、修了証が出る決まりのもの。
-- 実務トレーニングは修了証の要件ではないので、席とは分ける。
--
-- 決めたこと
--   ・利用権は**人**に付く。会社ではない
--     教育担当者を通さずに、本人が買えるようにするため。
--     会社を移っても持っていける（自分で買ったものだから）
--   ・付け方は3つ。いまは owner だけが動く
--       owner … 本部が手で付ける（振込を確認して付ける。いま使う道）
--       card  … カード払いが通ったら、webhook が付ける
--       code  … 会社がまとめて買って配る（受講コードと同じ形）
--   ・取り消せる。間違えて付けたときに戻せないと困る
--   ・無償利用の事業者に在籍している人は、利用権が無くても全部使える
--     （そちらは entitle 側で見る。ここには行を作らない）
-- ═══════════════════════════════════════════════════════════

create table if not exists public.training_access (
  user_id    uuid primary key references public.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.users (id) on delete set null,
  -- owner / card / code のどれで付いたか
  source     text not null default 'owner',
  -- 振込の日付・注文番号など。あとで突き合わせるため
  note       text,
  constraint training_access_source
    check (source in ('owner', 'card', 'code'))
);

alter table public.training_access enable row level security;

-- 自分のぶんは見える（画面に「使えます」と出すため）
drop policy if exists training_access_select_own on public.training_access;
create policy training_access_select_own on public.training_access
  for select using (user_id = auth.uid());

-- いま在籍している人のぶんは、その会社からも見える。
-- 担当者が「誰が使えるか」を把握できないと、配る判断ができない
drop policy if exists training_access_select_company on public.training_access;
create policy training_access_select_company on public.training_access
  for select using (
    exists (
      select 1 from public.memberships m
       where m.user_id = public.training_access.user_id
         and m.company_id = public.current_company_id()
         and m.approved_at is not null
         and m.left_at is null
    )
  );

-- ── 付ける ─────────────────────────────────
-- 何度押しても増えない。付け直すと、いつ・誰が・何でが上書きになる。
create or replace function public.grant_training(
  p_user uuid, p_by uuid, p_source text, p_note text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users where id = p_user) then
    return false;
  end if;

  insert into public.training_access (user_id, granted_by, source, note)
  values (p_user, p_by, coalesce(nullif(btrim(p_source), ''), 'owner'), p_note)
  on conflict (user_id) do update
     set granted_at = now(),
         granted_by = excluded.granted_by,
         source     = excluded.source,
         note       = excluded.note;
  return true;
end $$;

revoke all on function public.grant_training(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_training(uuid, uuid, text, text) to service_role;

-- ── 取り消す ───────────────────────────────
-- 間違えて付けたときに戻せないと困る。
-- 遊んだ記録（training_attempts）は消さない。受けた事実は残す。
create or replace function public.revoke_training(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.training_access where user_id = p_user;
end $$;

revoke all on function public.revoke_training(uuid) from public, anon, authenticated;
grant execute on function public.revoke_training(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0017'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0018 個人の注文
--
-- これまで注文は「事業者が席を買う」ものだけだった。
-- 実務トレーニング（第2章から先）は、教育担当者を通さずに
-- 本人が買えるようにしたので、注文にも個人の形が要る。
--
-- 決めたこと
--   ・注文は「会社のもの」か「個人のもの」かのどちらか
--     company_id か user_id の、どちらか片方だけが入る
--   ・何を買ったかを持つ（kind）
--       seat     … 特別教育の受講コード（1人1枚の席）。会社が買う
--       training … 実務トレーニングの利用権。会社でも個人でも買える
--   ・請求書の宛名は bill_to。個人なら本人の名前を入れる
--     個人宛の請求書を出せないと、経費で落とす人が買えない
--   ・入金を確認したら、個人の training の注文は利用権に変わる
-- ═══════════════════════════════════════════════════════════

-- 会社の注文でなくてもよくなる
alter table public.orders alter column company_id drop not null;

-- 個人が買ったとき、誰が買ったか
alter table public.orders add column if not exists user_id uuid
  references public.users (id) on delete set null;

-- 何を買ったか。今までのものは全部「席」
alter table public.orders add column if not exists kind text not null default 'seat';

-- 請求書の宛名と宛先。個人宛に出すために要る
alter table public.orders add column if not exists bill_addr text;

create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_kind_idx on public.orders (kind);

do $$
begin
  -- 会社のものか個人のものか、どちらか片方
  if not exists (
    select 1 from pg_constraint where conname = 'orders_owner_one'
  ) then
    alter table public.orders add constraint orders_owner_one
      check ((company_id is not null) <> (user_id is not null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_kind_ok'
  ) then
    alter table public.orders add constraint orders_kind_ok
      check (kind in ('seat', 'training'));
  end if;

  -- 席は会社しか買えない。個人に受講コードを配らせない
  -- （修了証は事業者の名簿に紐づくものなので、個人で持たせない）
  if not exists (
    select 1 from pg_constraint where conname = 'orders_seat_is_company'
  ) then
    alter table public.orders add constraint orders_seat_is_company
      check (kind <> 'seat' or company_id is not null);
  end if;
end $$;

-- 利用権の付き方に「注文」を足す（振込を確認した個人の注文）
alter table public.training_access drop constraint if exists training_access_source;
alter table public.training_access add constraint training_access_source
  check (source in ('owner', 'card', 'code', 'order'));

-- ── 個人の注文の入金を確認する ─────────────
-- 入金を立てて、そのまま利用権を付ける。
-- 2つに分けると、片方だけ通ったときに
-- 「払ったのに開かない」「開いているのに未入金」が起きる。
create or replace function public.pay_solo_order(p_order uuid, p_by uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if v.id is null then
    return false;
  end if;
  if v.user_id is null then
    raise exception '個人の注文ではありません';
  end if;
  if v.kind <> 'training' then
    raise exception 'この注文は実務トレーニングのものではありません';
  end if;

  if v.status <> 'paid' then
    update public.orders
       set status = 'paid', paid_at = now()
     where id = p_order;
  end if;

  insert into public.training_access (user_id, granted_by, source, note)
  values (v.user_id, p_by, 'order', '注文 ' || left(p_order::text, 8))
  on conflict (user_id) do update
     set granted_at = now(),
         granted_by = excluded.granted_by,
         source     = excluded.source,
         note       = excluded.note;

  return true;
end $$;

revoke all on function public.pay_solo_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pay_solo_order(uuid, uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0018'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0019 通し見学を見たか
--
-- 担当者が見たいのは「この人を現場に出せるか」。
-- 手順を最後まで見たかどうかは、点が付く前の段階として要る。
-- 見学は点を付けるものではないので、成績（training_attempts）とは分ける。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.training_views (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  chapter       text not null check (chapter in ('ch1','ch2','ch3','ch4','ch5','ch6')),
  -- 開いた回数
  times         int  not null default 0 check (times >= 0),
  -- 最後まで見たか。途中で閉じたものと分ける
  done          boolean not null default false,
  first_at      timestamptz not null default now(),
  last_at       timestamptz not null default now(),
  primary key (enrollment_id, chapter)
);

alter table public.training_views enable row level security;

drop policy if exists training_views_select_own on public.training_views;
create policy training_views_select_own on public.training_views
  for select using (public.owns_enrollment(enrollment_id));

drop policy if exists training_views_select_company on public.training_views;
create policy training_views_select_company on public.training_views
  for select using (public.is_admin() and public.enrollment_in_my_company(enrollment_id));
-- insert / update ポリシーは置かない（＝クライアントからの書き込みは拒否）

-- ── 見学を1回ぶん残す ──────────────────────
-- 開いたときに p_done=false、最後まで見たときに p_done=true で呼ぶ。
-- 「開いて最後まで見た」を2回と数えないよう、done のときは回数を足さない。
-- 一度でも最後まで見ていれば done は下がらない。
create or replace function public.see_demo(p_enrollment uuid, p_chapter text, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.training_views (enrollment_id, chapter, times, done)
  values (p_enrollment, p_chapter, case when p_done then 0 else 1 end, coalesce(p_done, false))
  on conflict (enrollment_id, chapter) do update
     set times   = public.training_views.times + case when p_done then 0 else 1 end,
         done    = public.training_views.done or coalesce(p_done, false),
         last_at = now();
end $$;

revoke all on function public.see_demo(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.see_demo(uuid, text, boolean) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0019'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0020 請求書を送ったこと
--
-- 買った側にも請求書を見せる。
-- 「送った」を立てるまでは知らせない。立てる前に知らせると、
-- まだ手元に届いていないのに「届いています」と出てしまう。
-- ═══════════════════════════════════════════════════════════

alter table public.orders
  add column if not exists invoiced_at timestamptz;

comment on column public.orders.invoiced_at is
  '請求書を相手に送った日時。買った側の画面に「請求書が届いています」を出す目印';

-- ── 送ったことにする ────────────────────────
-- 何度押しても、はじめに送った日時のまま（送り直しで日付が動かない）
create or replace function public.mark_invoiced(p_order uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  update public.orders
     set invoiced_at = coalesce(invoiced_at, now())
   where id = p_order
  returning invoiced_at into v_at;

  if v_at is null then
    raise exception 'その注文がありません';
  end if;
  return v_at;
end $$;

revoke all on function public.mark_invoiced(uuid) from public, anon, authenticated;
grant execute on function public.mark_invoiced(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0020'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════
-- 0021 会社を移ったら、教育担当者ではなくなる
--
-- 見つかった穴：
--   教育担当者かどうかは users.role='admin' と users.company_id で決めていた。
--   ところが会社を移す所（join_company / redeem_seat）は company_id だけ
--   書き換えて role をそのままにしていた。だから、
--
--     ① 新規登録して、適当な事業者を1つ作る（誰でもできる。role='admin' が付く）
--     ② よその会社の参加コード（8文字）か受講コード（12文字）を入れる
--     ③ その会社の教育担当者になってしまう
--
--   参加コードは一般の社員に配るもの。悪意が無くても、
--   自分の会社を作ってみた人が参加コードを入れた時点でこうなる。
--   なった人は、その会社の名簿・修了証の発行と取消・
--   その会社名義の発注・請求書まで見られる。
--
-- 直し方：
--   会社を移ったら role を降ろす。担当者は、移った先で
--   改めて指名してもらう（/api/admin/role）。
--   同じ会社に入り直したときは降ろさない（担当者が自分の受講コードを
--   引き換えただけで担当を外れる、というのは困る）。
-- ═══════════════════════════════════════════════════════════

create or replace function public.join_company(p_user uuid, p_company uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_now uuid;
begin
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'その事業者がありません';
  end if;

  -- いまの所属。移るのかどうかで、担当者を降ろすかが変わる
  select company_id into v_now from public.users where id = p_user;

  -- よその会社の在籍は閉じる（転職）。記録はその会社に残る
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

  -- ここが直したところ。**別の会社へ移ったときだけ**担当者を降ろす
  if v_now is distinct from p_company then
    update public.users set role = 'learner'
     where id = p_user and role = 'admin';
  end if;

  return p_company;
end $$;

revoke all on function public.join_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_company(uuid, uuid) to service_role;

-- ── 会社を抜けたら、担当者ではなくなる ──────
-- 抜けたあと company_id は空になるので currentAdmin は通らないが、
-- role を残しておくと、次にどこかへ入った瞬間に担当者に戻ってしまう。
create or replace function public.leave_company(p_user uuid, p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.memberships
     set left_at = now()
   where user_id = p_user and company_id = p_company and left_at is null;

  update public.users set company_id = null
   where id = p_user and company_id = p_company;

  update public.users set role = 'learner'
   where id = p_user and company_id is null and role = 'admin';
end $$;

revoke all on function public.leave_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_company(uuid, uuid) to service_role;

-- ── 取り違えを直す ──────────────────────────
-- すでに「作った会社と、いま居る会社が違う担当者」が居たら降ろす。
-- 自分の会社を作った人（companies.created_by）はそのまま。
update public.users u
   set role = 'learner'
 where u.role = 'admin'
   and u.company_id is not null
   and not exists (
     select 1 from public.companies c
      where c.id = u.company_id and c.created_by = u.id
   )
   -- その会社の担当者として、ほかに指名された形跡があるかは分からないので、
   -- 在籍していない担当者だけを降ろす（安全側）
   and not exists (
     select 1 from public.memberships m
      where m.user_id = u.id and m.company_id = u.company_id
        and m.approved_at is not null and m.left_at is null
   );

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0021'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


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


-- ═══════════════════════════════════════════════════════════
-- 3'. courses（src/content/courses.ts の写し）
--
-- 講座を足したときに、ここへ入らないと受講も席も作れない。
-- 準備中のものも入れておく（教材ができた日に流し直さなくて済む）。
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
  ('shovel', 'ショベルローダー等（最大荷重1トン未満）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第5号の2／安全衛生特別教育規程第7条の2', 360, 16),
  ('kikaitoishi', '機械研削用といしの取替え又は取替え時の試運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第1号／安全衛生特別教育規程第1条', 420, 17),
  ('kogata', '小型車両系建設機械（整地・運搬・積込み用及び掘削用）の運転の業務に係る特別教育', '労働安全衛生法第59条第3項／労働安全衛生規則第36条第9号／安全衛生特別教育規程第11条', 420, 18),
  ('sanketsu', '酸素欠乏・硫化水素危険作業に係る業務に係る特別教育', '労働安全衛生法第59条第3項／酸素欠乏症等防止規則第12条／酸素欠乏危険作業特別教育規程第2条', 330, 19)
on conflict (id) do update
  set name       = excluded.name,
      basis      = excluded.basis,
      total_min  = excluded.total_min,
      sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════
-- 4. lessons（curriculum.json の単元ID・題名・規定時間の写し）
-- ═══════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════
-- 完了。
--
-- 開発用の種データ（開発テスト工業・受講テスト・DEV-0001）は、
-- ここには入れない。本番でこのファイルを流すと、買った覚えのない
-- 0円の注文が画面に出てしまうため。
-- 手元で使うときだけ supabase/seed.sql を別に流すこと。
-- ═══════════════════════════════════════════════════════════
select
  (select count(*) from public.courses)     as courses,
  (select count(*) from public.lessons)     as lessons,
  (select count(*) from public.enrollments) as enrollments,
  public.schema_version()                   as schema_version;
