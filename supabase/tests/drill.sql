-- 実技の関門（0023 の drill）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/drill.sql                   -- 高所作業車
--   psql -d appdb -q -t -A -v course=harness -f supabase/tests/drill.sql -- フルハーネス
--
-- **実技のある講座は、これから増える。どれも同じ決まりで見る。**
-- 講座は -v course=... で渡す（既定は高所作業車）。
-- 単元の数と時間は渡さず、**courses 表と突き合わせる。**
-- 渡すと、渡した数字が間違っていたときに気づけない。
--
-- **この関門を使う講座は高所作業車が初めてだった。**
-- 学科だけで修了証を出せば、実技を受けていない人が
-- 「資格がある」と思って高所作業車に乗る。
-- 画面側は tests/issue.ts と tests/e2e-issue.mjs が見ている。
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・実技の実施日と実施者が、申請と一緒に残るか
--   ・本部が通すまで cleared にならないか
--   ・断ってから出し直せるか。そのとき前の返事が消えるか
--   ・通ったあとに出し直せないか（修了の取り消しになる）
--   ・ログインした人から、自分の申請を直に通せないか

\set ON_ERROR_STOP on
\pset pager off
\if :{?course}
\else
  \set course kousho
\endif
\echo '── 講座:' :course '──' 
create temp table r(label text, got text, want text);
-- psql の変数は $$ … $$ の中では展開されない（⑧⑨の do ブロックで使う）。
-- セッションの設定に入れて、そちらから読む
select set_config('drilltest.course', :'course', false);
create or replace function t(l text, g text, w text) returns void language sql as $$
  insert into r values (l, g, w) $$;

-- 人と受講をつくる（高所作業車）
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333','k@x.jp')
on conflict (id) do nothing;
insert into public.users (id, email, name)
values ('33333333-3333-3333-3333-333333333333','k@x.jp','高木')
on conflict (id) do nothing;

delete from public.cert_requests
 where user_id = '33333333-3333-3333-3333-333333333333';
delete from public.enrollments
 where user_id = '33333333-3333-3333-3333-333333333333';

insert into public.enrollments (id, user_id, course_id)
values ('44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333', :'course');

-- ① 講座と単元が入っている
select t('①講座がある', count(*)::text, '1')
  from public.courses where id = :'course';
select t('①単元がある', (count(*) > 0)::text, 'true')
  from public.lessons where course_id = :'course';
-- 単元の合計が、講座に登録した総時間と合っているか。
-- ずれると、受けた人の視聴時間の合計が法定に届かない
select t('①単元の合計＝講座の総時間',
  (select sum(legal_min)::text from public.lessons where course_id = :'course'),
  (select total_min::text from public.courses where id = :'course'));

-- ② 実技の実施日と実施者を付けて申請できる
select public.request_cert(
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  :'course', 'drill', 1, '天井の高い倉庫でやりました',
  date '2026-08-20', '中川　元基');
select t('②1件ある', count(*)::text, '1')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('②実技の日が残る', drill_on::text, '2026-08-20')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('②実技をやった人が残る', drill_by, '中川　元基')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('②関門は実技', kind, 'drill')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

-- ③ 出しただけでは通っていない（＝修了証は出ない）
select t('③まだ通っていない', status, 'open')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('③通した時刻は空', (cleared_at is null)::text, 'true')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

-- ④ 断られる。理由が本人に届く
select public.decline_request(
  (select id from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444'),
  '実技をやった人の名前が社内に見当たりません。確かめてもう一度お願いします。', 'unei@x.jp');
select t('④断られた', status, 'declined')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('④理由が残る', (reply_note <> '')::text, 'true')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

-- ⑤ 出し直せる。そのとき前の返事は消える（古い理由が残ると読み違える）
select public.request_cert(
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  :'course', 'drill', 1, '', date '2026-08-21', '佐藤　健一');
select t('⑤また open', status, 'open')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑤日が入れ替わる', drill_on::text, '2026-08-21')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑤人が入れ替わる', drill_by, '佐藤　健一')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑤前の理由は消える', reply_note, '')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑤1件のまま', count(*)::text, '1')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

-- ⑥ 実技の講座に、討議の候補日は要らない（出していないので0件）
select t('⑥候補日は0件', count(*)::text, '0')
  from public.cert_request_slots
 where request_id = (select id from public.cert_requests
                      where enrollment_id='44444444-4444-4444-4444-444444444444');

-- ⑦ 本部が通す。ここではじめて修了
select public.clear_request(
  (select id from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444'),
  '実技の記録を確かめました。', 'unei@x.jp');
select t('⑦通った', status, 'cleared')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑦通した時刻が入る', (cleared_at is not null)::text, 'true')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';
select t('⑦通しても実技の記録は残る', drill_on::text, '2026-08-21')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

-- ⑧ 通ったあとに出し直せない（修了を取り消すことになる）
do $$
begin
  perform public.request_cert(
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    current_setting('drilltest.course'), 'drill', 1, '', date '2026-08-22', '別の人');
  insert into r values ('⑧通ったあとは出し直せない', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑧通ったあとは出し直せない', 'はじかれる', 'はじかれる');
end $$;

-- ⑨ 関門は talk か drill だけ
do $$
begin
  perform public.request_cert(
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    current_setting('drilltest.course'), 'nanika');
  insert into r values ('⑨知らない関門ははじく', 'とおった', 'はじかれる');
exception when others then
  insert into r values ('⑨知らない関門ははじく', 'はじかれる', 'はじかれる');
end $$;

-- ⑩ ログインした人から、直に通せない
select t('⑩anon は申請できない',
  has_function_privilege('anon','public.request_cert(uuid,uuid,text,text,int,text,date,text)','execute')::text, 'false');
select t('⑩authenticated は申請できない',
  has_function_privilege('authenticated','public.request_cert(uuid,uuid,text,text,int,text,date,text)','execute')::text, 'false');
select t('⑩authenticated は通せない',
  has_function_privilege('authenticated','public.clear_request(uuid,text,text)','execute')::text, 'false');
select t('⑩service_role は通せる',
  has_function_privilege('service_role','public.clear_request(uuid,text,text)','execute')::text, 'true');
select t('⑩RLS が入っている', relrowsecurity::text, 'true')
  from pg_class where oid = 'public.cert_requests'::regclass;

-- ⑪ 受講を消したら申請も消える（3年で消すときに残らない）
delete from public.enrollments where id='44444444-4444-4444-4444-444444444444';
select t('⑪受講と一緒に消える', count(*)::text, '0')
  from public.cert_requests where enrollment_id='44444444-4444-4444-4444-444444444444';

\echo '── 結果 ──'
select case when got is not distinct from want then 'OK  ' else 'NG  ' end || label
       || case when got is not distinct from want then ''
               else '   （' || coalesce(got,'null') || ' ／ ' || want || ' のはず）' end as line
  from r;
select count(*) filter (where got is not distinct from want) || ' 件通過 / '
    || count(*) filter (where got is distinct from want) || ' 件失敗' as line from r;
