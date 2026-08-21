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
