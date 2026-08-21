-- 0001_init.sql
-- 足場トレーニング／特別教育 データモデル（SPEC.md 第3章）
-- 型・制約・索引のみ。RLS は 0002、関数とトリガは 0003。

create extension if not exists "pgcrypto";

-- ── 列挙型 ─────────────────────────────────
create type public.user_role     as enum ('learner', 'admin');
create type public.order_method  as enum ('card', 'invoice');
create type public.order_status  as enum ('pending', 'paid', 'cancelled');
create type public.verify_result as enum ('ok', 'ng');
create type public.verify_reason as enum ('no_face', 'multi_face', 'blocked', 'no_motion');

-- ── 事業者 ─────────────────────────────────
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null,
  responsible_name text,
  created_at       timestamptz not null default now()
);

-- ── ユーザー（受講者・教育担当者）──────────
-- id は auth.users.id と同一。Auth 導入前は種データで直接投入する。
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name       text             not null,
  birth_date date,
  email      text,
  role       public.user_role not null default 'learner',
  created_at timestamptz      not null default now()
);
create index users_company_id_idx on public.users (company_id);

-- ── 注文 ───────────────────────────────────
-- 金額は円。小数を持たせない。
create table public.orders (
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
create index orders_company_id_idx on public.orders (company_id);
create index orders_status_idx     on public.orders (status);

-- ── 受講コード ─────────────────────────────
create table public.seats (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  code       text not null unique,
  used_by    uuid references public.users (id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz,
  constraint seats_used_pair check ((used_by is null) = (used_at is null))
);
create index seats_order_id_idx on public.seats (order_id);
create index seats_used_by_idx  on public.seats (used_by);

-- ── 受講状態 ───────────────────────────────
create table public.enrollments (
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
create index enrollments_user_id_idx on public.enrollments (user_id);

-- ── 視聴記録（単元ごと）────────────────────
-- lesson_id は curriculum.json の '1-1' 形式。教材は DB に持たないので FK は張らない。
-- watched_sec の加算は 0003 の sync_watched_sec 経由のみ（クライアントの時刻を信用しない）。
create table public.progress (
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
create table public.verify_logs (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id     text,
  result        public.verify_result not null,
  reason        public.verify_reason,
  created_at    timestamptz not null default now(),
  constraint verify_logs_reason_required
    check ((result = 'ng') = (reason is not null))
);
create index verify_logs_enrollment_idx on public.verify_logs (enrollment_id, created_at desc);

-- ── 修了試験 ───────────────────────────────
create table public.exams (
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
create table public.certificates (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  cert_no       text not null unique,
  issued_at     timestamptz not null default now(),
  issued_by     uuid references public.users (id) on delete set null,
  revoked_at    timestamptz
);
create unique index certificates_active_one_per_enrollment
  on public.certificates (enrollment_id) where revoked_at is null;
