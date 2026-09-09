-- 席を直接配る（0028）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/assign-seat.sql
--
-- **誰に受けさせるかが決まっているなら、12文字を打たせる意味は無い。**
-- 担当者が人と講座を選べば、その場で席が渡る。
-- 受講コードの方式は残してある（その場に居ない人、画面が動かないとき）。
--
-- ここで見るのは、SQL でしか確かめられないこと
--   ・**在籍していない人には渡せないか**（よその会社の人・辞めた人）
--   ・同じ講座の席を二重に渡さないか
--   ・よその会社が買った席を配れないか
--   ・空きが無いときに、黙って渡ったことにしないか
--   ・期限切れの席を配らないか
--   ・配ったら、その人のその講座のリクエストが閉じるか
--   ・ログインした人から、直に呼べないか
--   ・配ったあと、受講コードの取り消し（releaseSeat）で戻せるか

\set ON_ERROR_STOP on
\pset pager off

-- この関数を呼べるのは service_role だけ（下の⑪で見ている）。
-- 本番でも画面のサーバ側が service_role で呼ぶので、そこに合わせる。
-- authenticated のままだと、受講の列を守るしかけ
-- （guard_enrollment_columns）が席の紐付けを止める
set test.role = 'service_role';

create temp table r(label text, got text, want text);
create or replace function t(l text, g text, w text) returns void language sql as $$
  insert into r values (l, g, w) $$;

-- 会社2つ、人4人
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111','a@x.jp'),
  ('b2222222-2222-2222-2222-222222222222','b@x.jp'),
  ('c3333333-3333-3333-3333-333333333333','c@x.jp'),
  ('d4444444-4444-4444-4444-444444444444','d@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values
  ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','あいうえ工業'),
  ('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb','かきくけ建設')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('a1111111-1111-1111-1111-111111111111','a@x.jp','在籍 太郎','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('b2222222-2222-2222-2222-222222222222','b@x.jp','よそ 次郎','22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('c3333333-3333-3333-3333-333333333333','c@x.jp','辞めた 三郎','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('d4444444-4444-4444-4444-444444444444','d@x.jp','在籍 四郎','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
on conflict (id) do nothing;

-- 太郎と四郎は在籍。次郎はよその会社。三郎は辞めた
insert into public.memberships (user_id, company_id, approved_at, left_at) values
  ('a1111111-1111-1111-1111-111111111111','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now(), null),
  ('d4444444-4444-4444-4444-444444444444','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now(), null),
  ('b2222222-2222-2222-2222-222222222222','22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now(), null),
  ('c3333333-3333-3333-3333-333333333333','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now(), now())
on conflict do nothing;

-- あいうえ工業が「足場」を2席、かきくけ建設が「足場」を1席、買った
insert into public.orders (id, company_id, course_id, seats, unit_price, amount, method, status, paid_at) values
  ('0a000000-0000-0000-0000-00000000000a','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ashiba',2,4500,9000,'invoice','paid',now()),
  ('0b000000-0000-0000-0000-00000000000b','22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ashiba',1,4500,4500,'invoice','paid',now())
on conflict (id) do nothing;
insert into public.seats (id, order_id, code) values
  ('5a000000-0000-0000-0000-00000000000a','0a000000-0000-0000-0000-00000000000a','AAAA-1111-2222'),
  ('5a000000-0000-0000-0000-00000000000b','0a000000-0000-0000-0000-00000000000a','AAAA-1111-3333'),
  ('5b000000-0000-0000-0000-00000000000b','0b000000-0000-0000-0000-00000000000b','BBBB-1111-2222')
on conflict (id) do nothing;

-- 太郎は「足場を受けたい」と送ってある
delete from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';
select public.request_course('a1111111-1111-1111-1111-111111111111','ashiba');

-- ① 在籍している人に配れる
select t('①配れる', (public.assign_seat(
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a1111111-1111-1111-1111-111111111111',
  'ashiba','a1111111-1111-1111-1111-111111111111') is not null)::text, 'true');
select t('①席が使われた', used_by::text, 'a1111111-1111-1111-1111-111111111111')
  from public.seats where id='5a000000-0000-0000-0000-00000000000a';
select t('①受講ができた', count(*)::text, '1')
  from public.enrollments
 where user_id='a1111111-1111-1111-1111-111111111111' and course_id='ashiba'
   and seat_id='5a000000-0000-0000-0000-00000000000a';
-- 受けた当時の会社が残る。人が抜けても記録はこの会社に残る
select t('①受けた当時の会社が残る', company_id::text, '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  from public.enrollments
 where user_id='a1111111-1111-1111-1111-111111111111' and course_id='ashiba';

-- ② 配ったら、その人のその講座のリクエストは閉じる
select t('②リクエストが閉じる', (handled_at is not null)::text, 'true')
  from public.course_requests
 where user_id='a1111111-1111-1111-1111-111111111111' and course_id='ashiba';

-- ③ 同じ講座の席を二重に渡さない
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a1111111-1111-1111-1111-111111111111',
    'ashiba','a1111111-1111-1111-1111-111111111111');
  insert into r values ('③二重には渡さない', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('③二重には渡さない', 'はじかれる', 'はじかれる');
end $$;
select t('③2枚目は使われていない', (used_by is null)::text, 'true')
  from public.seats where id='5a000000-0000-0000-0000-00000000000b';

-- ④ **よその会社の人には渡せない**
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','b2222222-2222-2222-2222-222222222222',
    'ashiba','a1111111-1111-1111-1111-111111111111');
  insert into r values ('④よその会社の人には渡せない', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('④よその会社の人には渡せない', 'はじかれる', 'はじかれる');
end $$;

-- ⑤ **辞めた人には渡せない**（渡ると席が戻らないまま消える）
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','c3333333-3333-3333-3333-333333333333',
    'ashiba','a1111111-1111-1111-1111-111111111111');
  insert into r values ('⑤辞めた人には渡せない', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑤辞めた人には渡せない', 'はじかれる', 'はじかれる');
end $$;

-- ⑥ **よその会社が買った席は配れない**。あいうえ工業から見て、
--    かきくけ建設の席（BBBB-…）は無いものとして扱う
select t('⑥よその席は使われていない', (used_by is null)::text, 'true')
  from public.seats where id='5b000000-0000-0000-0000-00000000000b';

-- ⑦ 無い講座は配れない
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d4444444-4444-4444-4444-444444444444',
    'nai-kouza','a1111111-1111-1111-1111-111111111111');
  insert into r values ('⑦無い講座ははじく', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑦無い講座ははじく', 'はじかれる', 'はじかれる');
end $$;

-- ⑧ 2枚目は四郎に配れる（残っている席から順に出る）
select t('⑧残りを次の人に配れる', (public.assign_seat(
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d4444444-4444-4444-4444-444444444444',
  'ashiba','a1111111-1111-1111-1111-111111111111') is not null)::text, 'true');
select t('⑧2枚目が使われた', used_by::text, 'd4444444-4444-4444-4444-444444444444')
  from public.seats where id='5a000000-0000-0000-0000-00000000000b';

-- ⑨ **空きが無ければ、黙って渡ったことにしない**
insert into auth.users (id, email) values ('e5555555-5555-5555-5555-555555555555','e@x.jp')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('e5555555-5555-5555-5555-555555555555','e@x.jp','在籍 五郎','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
on conflict (id) do nothing;
insert into public.memberships (user_id, company_id, approved_at) values
  ('e5555555-5555-5555-5555-555555555555','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now())
on conflict do nothing;
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','e5555555-5555-5555-5555-555555555555',
    'ashiba','a1111111-1111-1111-1111-111111111111');
  insert into r values ('⑨空きが無ければはじく', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑨空きが無ければはじく', 'はじかれる', 'はじかれる');
end $$;
select t('⑨受講は作られていない', count(*)::text, '0')
  from public.enrollments where user_id='e5555555-5555-5555-5555-555555555555';

-- ⑩ **期限切れの席は配らない**（渡した先で開かない）
insert into public.orders (id, company_id, course_id, seats, unit_price, amount, method, status, paid_at) values
  ('0c000000-0000-0000-0000-00000000000c','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','kousho',1,7000,7000,'invoice','paid',now())
on conflict (id) do nothing;
insert into public.seats (id, order_id, code, expires_at) values
  ('5c000000-0000-0000-0000-00000000000c','0c000000-0000-0000-0000-00000000000c','CCCC-1111-2222', now() - interval '1 day')
on conflict (id) do nothing;
do $$
begin
  perform public.assign_seat(
    '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','e5555555-5555-5555-5555-555555555555',
    'kousho','a1111111-1111-1111-1111-111111111111');
  insert into r values ('⑩期限切れは配らない', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑩期限切れは配らない', 'はじかれる', 'はじかれる');
end $$;

-- ⑪ ログインした人から、直に呼べない
select t('⑪anon は配れない',
  has_function_privilege('anon','public.assign_seat(uuid,uuid,text,uuid,text)','execute')::text, 'false');
select t('⑪authenticated は配れない',
  has_function_privilege('authenticated','public.assign_seat(uuid,uuid,text,uuid,text)','execute')::text, 'false');
select t('⑪service_role は配れる',
  has_function_privilege('service_role','public.assign_seat(uuid,uuid,text,uuid,text)','execute')::text, 'true');

-- ⑫ **受講コードの方式は残っている。** 配ったのと同じ形で使える
select t('⑫受講コードでも入れる', (public.redeem_seat(
  'BBBB-1111-2222','b2222222-2222-2222-2222-222222222222') is not null)::text, 'true');
select t('⑫コードで入った席も使われた', used_by::text, 'b2222222-2222-2222-2222-222222222222')
  from public.seats where id='5b000000-0000-0000-0000-00000000000b';

-- ⑬ 配ったあとも、席は未使用に戻せる（担当者の取り消し）。
--    戻せないと、配り間違いで席が1枚死ぬ
update public.seats set used_by = null, used_at = null
 where id='5a000000-0000-0000-0000-00000000000b';
update public.enrollments set seat_id = null
 where seat_id = '5a000000-0000-0000-0000-00000000000b';
select t('⑬戻した席は、また配れる', (public.assign_seat(
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','e5555555-5555-5555-5555-555555555555',
  'ashiba','a1111111-1111-1111-1111-111111111111') is not null)::text, 'true');

\echo '── 結果 ──'
select case when got is not distinct from want then 'OK  ' else 'NG  ' end || label
       || case when got is not distinct from want then ''
               else '   （' || coalesce(got,'null') || ' ／ ' || want || ' のはず）' end as line
  from r;
select count(*) filter (where got is not distinct from want) || ' 件通過 / '
    || count(*) filter (where got is distinct from want) || ' 件失敗' as line from r;
