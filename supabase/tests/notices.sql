-- お知らせ（0024）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/notices.sql
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・押し直しを1行にまとめる窓（60秒）が、種類・講座・宛先ごとに効くか
--   ・読んだ印が、その人のぶんだけ付くか
--   ・**ログインした人から、自分あての知らせを作れないか**
-- 画面側の決まりは npm run test:notice が見ている。

\set ON_ERROR_STOP on
\pset pager off
create temp table r(label text, got text, want text);
create or replace function t(l text, g text, w text) returns void language sql as $$
  insert into r values (l, g, w) $$;

-- 人を2人つくる
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111','a@x.jp'),
       ('22222222-2222-2222-2222-222222222222','b@x.jp')
on conflict (id) do nothing;
insert into public.users (id, email, name)
values ('11111111-1111-1111-1111-111111111111', 'a@x.jp', '芦田'),
       ('22222222-2222-2222-2222-222222222222', 'b@x.jp', '山口')
on conflict (id) do nothing;

truncate public.notices;

-- ① 1件足せる
select t('①足せる', (public.add_notice(
  '11111111-1111-1111-1111-111111111111','member_ok',null,'') is not null)::text, 'true');
select t('①1件ある', count(*)::text, '1') from public.notices;

-- ② 同じ返事を続けて2回押しても1行（60秒のあいだ）
select public.add_notice('11111111-1111-1111-1111-111111111111','member_ok',null,'');
select t('②押し直しても1行', count(*)::text, '1') from public.notices;

-- ③ 種類が違えば別の行
select public.add_notice('11111111-1111-1111-1111-111111111111','seat',null,'');
select t('③種類が違えば別', count(*)::text, '2') from public.notices;

-- ④ 講座が違えば別の行
select public.add_notice('11111111-1111-1111-1111-111111111111','slot','ashiba','');
select public.add_notice('11111111-1111-1111-1111-111111111111','slot','shokucho','');
select t('④講座が違えば別', count(*)::text, '4') from public.notices;

-- ⑤ 宛先が違えば別の行
select public.add_notice('22222222-2222-2222-2222-222222222222','member_ok',null,'');
select t('⑤宛先が違えば別', count(*)::text, '5') from public.notices;

-- ⑥ 押し直しは、あとの一言で上書きされて未読に戻る
update public.notices set read_at = now() where kind='member_ok'
   and user_id='11111111-1111-1111-1111-111111111111';
select public.add_notice('11111111-1111-1111-1111-111111111111','member_ok',null,'あとから直した');
select t('⑥一言が上書きされる', note, 'あとから直した') from public.notices
 where kind='member_ok' and user_id='11111111-1111-1111-1111-111111111111';
select t('⑥未読に戻る', (read_at is null)::text, 'true') from public.notices
 where kind='member_ok' and user_id='11111111-1111-1111-1111-111111111111';

-- ⑦ 60秒より前の同じ返事は、まとめない（別の出来事）
update public.notices set created_at = now() - interval '5 minutes'
 where kind='seat';
select public.add_notice('11111111-1111-1111-1111-111111111111','seat',null,'');
select t('⑦時間が空けば別の行', count(*)::text, '2') from public.notices where kind='seat';

-- ⑧ 宛先が無ければ何もしない（落ちない）
select t('⑧宛先なしは作らない', (public.add_notice(null,'seat',null,'') is null)::text, 'true');
select t('⑧種類が空も作らない', (public.add_notice(
  '11111111-1111-1111-1111-111111111111','   ',null,'') is null)::text, 'true');

-- ⑨ 読んだ印は、その人のぶんだけ
select t('⑨読んだ数', public.read_notices('11111111-1111-1111-1111-111111111111')::text, '5');
select t('⑨自分は全部既読', count(*)::text, '0') from public.notices
 where user_id='11111111-1111-1111-1111-111111111111' and read_at is null;
select t('⑨よその人は残る', count(*)::text, '1') from public.notices
 where user_id='22222222-2222-2222-2222-222222222222' and read_at is null;
select t('⑨二度押しても0件', public.read_notices('11111111-1111-1111-1111-111111111111')::text, '0');

-- ⑩ 古いものを捨てる
update public.notices set created_at = now() - interval '200 days' where kind='slot';
select t('⑩捨てた数', public.sweep_notices(180)::text, '2');
select t('⑩新しいものは残る', count(*)::text, '4') from public.notices;

-- ⑪ 人を消したら知らせも消える
delete from public.users where id='22222222-2222-2222-2222-222222222222';
select t('⑪人と一緒に消える', count(*)::text, '0') from public.notices
 where user_id='22222222-2222-2222-2222-222222222222';

-- ⑫ ログインした人からは、直に書けない
select t('⑫anon は作れない',
  has_function_privilege('anon','public.add_notice(uuid,text,text,text)','execute')::text, 'false');
select t('⑫authenticated は作れない',
  has_function_privilege('authenticated','public.add_notice(uuid,text,text,text)','execute')::text, 'false');
select t('⑫service_role は作れる',
  has_function_privilege('service_role','public.add_notice(uuid,text,text,text)','execute')::text, 'true');
select t('⑫RLS が入っている', relrowsecurity::text, 'true')
  from pg_class where oid = 'public.notices'::regclass;
select t('⑫読む道だけ', count(*)::text, '1') from pg_policies
 where tablename='notices';
select t('⑫それは select', cmd, 'SELECT') from pg_policies where tablename='notices';

\echo '── 結果 ──'
select case when got is not distinct from want then 'OK  ' else 'NG  ' end || label
       || case when got is not distinct from want then ''
               else '   （' || coalesce(got,'null') || ' ／ ' || want || ' のはず）' end as line
  from r;
select count(*) filter (where got is not distinct from want) || ' 件通過 / '
    || count(*) filter (where got is distinct from want) || ' 件失敗' as line from r;
