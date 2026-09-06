-- 受講リクエスト（0025）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/course-request.sql
--
-- **コードを渡されていない人が、担当者に「この講座を受けたい」と言う道。**
-- 電話や口頭でしか言えなかったものを、画面に残す仕組み。
-- 席（受講コード）はここでは作らない。担当者がいつもどおり用意する。
--
-- ここで見るのは、SQL でしか確かめられないこと
--   ・会社に居ない人は送れないか（誰宛か決まらない）
--   ・同じ講座に、開いているリクエストが2件できないか
--   ・押し間違いを取り消せるか。**対応済みのあとは取り消せないか**
--   ・よその会社のリクエストを動かせないか
--   ・ログインした人から、直に関数を呼べないか
--   ・人や会社を消したとき、リクエストも一緒に消えるか

\set ON_ERROR_STOP on
\pset pager off

-- ここの関数を呼べるのは service_role だけ（下の⑪で見ている）。
-- 本番でも画面のサーバ側が service_role で呼ぶので、そこに合わせる
set test.role = 'service_role';

create temp table r(label text, got text, want text);
create or replace function t(l text, g text, w text) returns void language sql as $$
  insert into r values (l, g, w) $$;

-- 会社を2つと、人を3人つくる
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111','a@x.jp'),
  ('b2222222-2222-2222-2222-222222222222','b@x.jp'),
  ('c3333333-3333-3333-3333-333333333333','c@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values
  ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','あいうえ工業'),
  ('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb','かきくけ建設')
on conflict (id) do nothing;
insert into public.users (id, email, name) values
  ('a1111111-1111-1111-1111-111111111111','a@x.jp','在籍 太郎'),
  ('b2222222-2222-2222-2222-222222222222','b@x.jp','よそ 次郎'),
  ('c3333333-3333-3333-3333-333333333333','c@x.jp','無所属 三郎')
on conflict (id) do nothing;

-- 太郎はあいうえ工業に在籍。次郎はかきくけ建設。三郎はどこにも居ない
insert into public.memberships (user_id, company_id, approved_at) values
  ('a1111111-1111-1111-1111-111111111111','11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now()),
  ('b2222222-2222-2222-2222-222222222222','22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now())
on conflict do nothing;

delete from public.course_requests
 where user_id in ('a1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222');

-- ① 在籍している人は送れる
select t('①送れる', (public.request_course(
  'a1111111-1111-1111-1111-111111111111','ashiba') is not null)::text, 'true');
select t('①1件ある', count(*)::text, '1')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';
-- 会社は画面から受け取らない。在籍から決める
select t('①宛先は在籍している会社', company_id::text, '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';
select t('①まだ対応されていない', (handled_at is null)::text, 'true')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ② 連打しても増えない。同じ講座に開いているものは1件だけ
select public.request_course('a1111111-1111-1111-1111-111111111111','ashiba');
select public.request_course('a1111111-1111-1111-1111-111111111111','ashiba');
select t('②連打しても1件のまま', count(*)::text, '1')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ③ 別の講座は別に送れる
select public.request_course('a1111111-1111-1111-1111-111111111111','kousho');
select t('③別の講座は別に立つ', count(*)::text, '2')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ④ 無い講座は送れない
do $$
begin
  perform public.request_course('a1111111-1111-1111-1111-111111111111','nai-kouza');
  insert into r values ('④無い講座ははじく', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('④無い講座ははじく', 'はじかれる', 'はじかれる');
end $$;

-- ⑤ 会社に居ない人は送れない（誰宛か決まらない）
do $$
begin
  perform public.request_course('c3333333-3333-3333-3333-333333333333','ashiba');
  insert into r values ('⑤会社に居ない人ははじく', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑤会社に居ない人ははじく', 'はじかれる', 'はじかれる');
end $$;

-- ⑥ 押し間違いを取り消せる
select public.cancel_course_request('a1111111-1111-1111-1111-111111111111','kousho');
select t('⑥取り消せる', count(*)::text, '1')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ⑦ 担当者が対応済みにできる。自社宛だけ
select t('⑦自社宛は動かせる', public.handle_course_request(
  (select id from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111'),
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a1111111-1111-1111-1111-111111111111', true)::text, 'true');
select t('⑦対応した印が立つ', (handled_at is not null)::text, 'true')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';
select t('⑦誰が対応したかが残る', handled_by::text, 'a1111111-1111-1111-1111-111111111111')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ⑧ よその会社のリクエストは動かせない
select t('⑧よその会社は動かせない', public.handle_course_request(
  (select id from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111'),
  '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b2222222-2222-2222-2222-222222222222', true)::text, 'false');

-- ⑨ 対応済みのあとは、本人が取り消せない。**もう届いているので無かったことにはできない**
select public.cancel_course_request('a1111111-1111-1111-1111-111111111111','ashiba');
select t('⑨対応済みは取り消せない', count(*)::text, '1')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ⑩ 対応済みを戻せば、同じ講座にまた送れる（押し間違い用）
select public.handle_course_request(
  (select id from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111'),
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a1111111-1111-1111-1111-111111111111', false);
select t('⑩戻せる', (handled_at is null)::text, 'true')
  from public.course_requests where user_id='a1111111-1111-1111-1111-111111111111';

-- ⑪ ログインした人から、直に呼べない
select t('⑪anon は送れない',
  has_function_privilege('anon','public.request_course(uuid,text)','execute')::text, 'false');
select t('⑪authenticated は送れない',
  has_function_privilege('authenticated','public.request_course(uuid,text)','execute')::text, 'false');
select t('⑪authenticated は対応済みにできない',
  has_function_privilege('authenticated','public.handle_course_request(uuid,uuid,uuid,boolean)','execute')::text, 'false');
select t('⑪service_role は対応済みにできる',
  has_function_privilege('service_role','public.handle_course_request(uuid,uuid,uuid,boolean)','execute')::text, 'true');
select t('⑪RLS が入っている', relrowsecurity::text, 'true')
  from pg_class where oid = 'public.course_requests'::regclass;

-- ⑫ 人を消したら、リクエストも消える（3年で消すときに残らない）
select public.request_course('b2222222-2222-2222-2222-222222222222','ashiba');
select t('⑫よその人のぶんも立つ', count(*)::text, '1')
  from public.course_requests where user_id='b2222222-2222-2222-2222-222222222222';
/* 人を消す前に、席は未使用に戻す。本番の道筋も同じ（release_seat）。
   戻さずに消すと、seats.used_by だけが null になって
   used_by と used_at の対（seats_used_pair）が崩れ、削除そのものが通らない */
update public.enrollments set closed_at = now(), seat_id = null
 where user_id = 'b2222222-2222-2222-2222-222222222222' and seat_id is not null;
update public.seats set used_by = null, used_at = null
 where used_by = 'b2222222-2222-2222-2222-222222222222';
delete from public.users where id='b2222222-2222-2222-2222-222222222222';
select t('⑫人と一緒に消える', count(*)::text, '0')
  from public.course_requests where user_id='b2222222-2222-2222-2222-222222222222';

-- ⑬ 会社を消しても残らない
select t('⑬会社の参照は張ってある', count(*)::text, '1')
  from information_schema.table_constraints c
  join information_schema.constraint_column_usage u on u.constraint_name = c.constraint_name
 where c.table_name='course_requests' and c.constraint_type='FOREIGN KEY' and u.table_name='companies';

\echo '── 結果 ──'
select case when got is not distinct from want then 'OK  ' else 'NG  ' end || label
       || case when got is not distinct from want then ''
               else '   （' || coalesce(got,'null') || ' ／ ' || want || ' のはず）' end as line
  from r;
select count(*) filter (where got is not distinct from want) || ' 件通過 / '
    || count(*) filter (where got is distinct from want) || ' 件失敗' as line from r;
