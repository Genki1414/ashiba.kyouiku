-- 複数の講座をまとめて申し込む（0029）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/order-group.sql
--
-- **申込みは1回、請求書は1枚、振込も1回。**
-- 注文の行は講座ごとに立てる（受講コードは講座ごとに出るため）が、
-- 同じ申込みの行は同じ group_id を持つ。
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・group_id を書かずに入れても、勝手に埋まるか（入れ忘れで請求書が消えない）
--   ・古い注文にも group_id が入っているか（古い請求書が開けなくなっていない）
--   ・group で数えると、申込みが1件として数えられるか
--   ・入金を group でまとめて立てられるか（押し忘れた講座だけ残る、を起こさない）
-- 画面側の決まりは npx tsx tests/api-shape.mts が見ている。

\set ON_ERROR_STOP on
\pset pager off

-- 本番でも画面のサーバ側が service_role で書く。そこに合わせる。
-- authenticated のままだと、所属と権限を守るしかけ（guard_users_columns）が
-- 会社の紐付けを止める
set test.role = 'service_role';

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001','matome@x.jp')
on conflict (id) do nothing;
insert into companies (id, name) values
  ('cccccccc-0000-0000-0000-000000000001','まとめ工業')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','matome@x.jp','まとめ 担当',
   'cccccccc-0000-0000-0000-000000000001')
on conflict (id) do update set company_id = excluded.company_id;

do $$
declare
  co   uuid := 'cccccccc-0000-0000-0000-000000000001';
  who  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';  -- by は予約語なので使わない
  g    uuid := gen_random_uuid();
  n    int;
  one  uuid;
  nul  int;
begin
  -- ① 3講座を、ひとまとめの印を付けて入れる
  insert into orders (company_id, group_id, course_id, seats, unit_price, amount, method, status, ordered_by)
  values
    (co, g, 'ashiba',   5, 4500, 24750, 'invoice', 'pending', who),
    (co, g, 'ishiwata', 3, 4500, 14850, 'invoice', 'pending', who),
    (co, g, 'sanketsu', 2, 4500,  9900, 'invoice', 'pending', who);

  select count(*) into n from orders where group_id = g;
  raise notice 'expected: 3行が1つの申込み（%）', n;
  if n <> 3 then raise exception 'NG: 行が3つない（%）', n; end if;

  -- ② 申込みは1件。**行の数ではなく group で数える**
  select count(distinct group_id) into n from orders where company_id = co;
  raise notice 'expected: 申込みは1件（%）', n;
  if n <> 1 then raise exception 'NG: 申込みが1件になっていない（%）', n; end if;

  -- ③ 合計は行を足したもの。請求書はこの1枚
  select sum(amount) into n from orders where group_id = g;
  raise notice 'expected: 合計 49500 円（%）', n;
  if n <> 49500 then raise exception 'NG: 合計が合わない（%）', n; end if;

  -- ④ **印を書き忘れても、勝手に埋まる。**
  --    入れる道が増えたときに書き忘れると、その注文だけ請求書が出ない
  insert into orders (company_id, course_id, seats, unit_price, amount, method, status, ordered_by)
  values (co, 'ashiba', 1, 4500, 4950, 'invoice', 'pending', who)
  returning id into one;
  select count(*) into nul from orders where id = one and group_id = one;
  raise notice 'expected: 書き忘れても自分の番号で埋まる（%）', nul;
  if nul <> 1 then raise exception 'NG: group_id が埋まっていない'; end if;

  -- ⑤ **入金は申込みまるごと。**行ごとに押させると、押し忘れた講座だけ
  --    受講コードが出ず、「足場は届いたのに石綿が来ない」になる
  update orders set status = 'paid', paid_at = now()
   where group_id = g and status = 'pending';
  select count(*) into n from orders where group_id = g and status = 'paid';
  raise notice 'expected: 3行とも入金済み（%）', n;
  if n <> 3 then raise exception 'NG: まとめて立たない（%）', n; end if;

  -- ⑥ 別の申込みは巻き込まない
  select status into strict nul from (select case when status = 'pending' then 1 else 0 end as status
                                        from orders where id = one) t;
  raise notice 'expected: 別の申込みは入金待ちのまま（%）', nul;
  if nul <> 1 then raise exception 'NG: 関係のない申込みまで立てた'; end if;

  -- ⑦ 入金済みの行に、入金日時が入っている（修了証の発行可否がここを見る）
  select count(*) into n from orders where group_id = g and paid_at is null;
  raise notice 'expected: 入金日時の抜けは0（%）', n;
  if n <> 0 then raise exception 'NG: 入金日時が入っていない'; end if;
end $$;

-- ⑧ 古い注文にも印が入っている（0029 が埋めた）。
--    入っていないと、その注文の請求書が開けなくなる
do $$
declare n int;
begin
  select count(*) into n from orders where group_id is null;
  raise notice 'expected: 印の無い注文は0（%）', n;
  if n <> 0 then raise exception 'NG: 印の無い注文がある（%）', n; end if;
end $$;

select 'OK: まとめ申込み（0029）';
