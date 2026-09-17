-- ひとりで受ける（0039）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/solo-seat.sql
--
-- げんきさん（2026-09-17）「利用者が増えない。会社登録が邪魔してる気がする」
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・個人（user_id）の受講コードの注文が立つか（0018 の縛りを外したか）
--   ・入金の前は修了証が出ないか（門番がそのまま効くか）
--   ・pay_solo_seat で、入金・本人の席・受講の記録の紐づけが一度に立つか
--   ・二度呼んでも席が増えないか（Stripe の知らせは二度来る）
--   ・受講の門番（席→注文→講座）の問い合わせで通るか
--   ・入金のあとは修了証が出るか
--   ・実務トレーニングの注文には使えないか
-- 画面と口の決まりは npx tsx tests/api-shape.mts が見ている。

\set ON_ERROR_STOP on
\pset pager off
set test.role = 'service_role';

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000061','solo@x.jp')
on conflict (id) do nothing;
insert into public.users (id, email, name) values
  ('a0000000-0000-0000-0000-000000000061','solo@x.jp','ひとり 太郎')
on conflict (id) do update set company_id = null;

-- 何度でも流せるように、前に作ったぶんを片づける
delete from public.certificates c
 using public.enrollments e
 where e.id = c.enrollment_id and e.user_id = 'a0000000-0000-0000-0000-000000000061';
delete from public.enrollments where user_id = 'a0000000-0000-0000-0000-000000000061';
delete from public.seats s
 using public.orders o
 where o.id = s.order_id and o.user_id = 'a0000000-0000-0000-0000-000000000061';
delete from public.orders where user_id = 'a0000000-0000-0000-0000-000000000061';

\echo -- 1) 個人の受講コードの注文が立つ（会社なし）
insert into public.orders (id, user_id, kind, course_id, seats, unit_price, amount, method, status, ordered_by, group_id)
values ('00000000-0000-0000-0000-000000000061','a0000000-0000-0000-0000-000000000061','seat','ashiba',
        1, 4500, 4950, 'invoice', 'pending', 'a0000000-0000-0000-0000-000000000061', gen_random_uuid());
select 'expected: 注文 1件 = ' || count(*) from public.orders where id = '00000000-0000-0000-0000-000000000061';

\echo -- 2) 入金の前は修了証が出ない（席が無い）
do $$
declare v_enroll uuid;
begin
  v_enroll := public.enrollment_for('a0000000-0000-0000-0000-000000000061', 'ashiba');
  insert into public.certificates (enrollment_id, cert_no) values (v_enroll, '2026-9061');
  raise exception 'ここへ来てはいけない（未入金で修了証が出た）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;

\echo -- 3) 入金を確認すると、入金・本人の席・受講の記録が一度に立つ
select 'expected: true = ' || public.pay_solo_seat('00000000-0000-0000-0000-000000000061');
select 'expected: paid = ' || status || ' / paid_at あり = ' || (paid_at is not null)
  from public.orders where id = '00000000-0000-0000-0000-000000000061';
select 'expected: 席 1枚・本人が使用 = ' || count(*)
  from public.seats where order_id = '00000000-0000-0000-0000-000000000061'
   and used_by = 'a0000000-0000-0000-0000-000000000061' and used_at is not null;
select 'expected: 受講の記録に席が付いた = ' || (e.seat_id = s.id)
  from public.enrollments e join public.seats s on s.order_id = '00000000-0000-0000-0000-000000000061'
 where e.user_id = 'a0000000-0000-0000-0000-000000000061' and e.course_id = 'ashiba' and e.closed_at is null;

\echo -- 4) 二度呼んでも席は増えない（Stripe の知らせは二度来る）
select 'expected: true = ' || public.pay_solo_seat('00000000-0000-0000-0000-000000000061');
select 'expected: 席は 1枚のまま = ' || count(*)
  from public.seats where order_id = '00000000-0000-0000-0000-000000000061';

\echo -- 5) 受講の門番（席→注文→講座）で通る。よその講座では通らない
select 'expected: 足場 1 = ' || count(*)
  from public.seats s join public.orders o on o.id = s.order_id
 where s.used_by = 'a0000000-0000-0000-0000-000000000061' and o.course_id = 'ashiba';
select 'expected: 石綿 0 = ' || count(*)
  from public.seats s join public.orders o on o.id = s.order_id
 where s.used_by = 'a0000000-0000-0000-0000-000000000061' and o.course_id = 'ishiwata';

\echo -- 6) 入金のあとは修了証が出る（会社が無くても）
do $$
declare v_enroll uuid;
begin
  v_enroll := public.enrollment_for('a0000000-0000-0000-0000-000000000061', 'ashiba');
  insert into public.certificates (enrollment_id, cert_no) values (v_enroll, '2026-9061');
  raise notice 'expected: 修了証が出た';
end $$;

\echo -- 7) 実務トレーニングの注文には使えない
insert into public.orders (id, user_id, kind, seats, unit_price, amount, method, status)
values ('00000000-0000-0000-0000-000000000062','a0000000-0000-0000-0000-000000000061','training',
        1, 10000, 11000, 'invoice', 'pending');
do $$ begin
  perform public.pay_solo_seat('00000000-0000-0000-0000-000000000062');
  raise exception 'ここへ来てはいけない（実務トレーニングの注文で席が立った）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;

\echo -- 8) 無い注文は false
select 'expected: false = ' || public.pay_solo_seat('00000000-0000-0000-0000-0000000000ff');
