-- クーポンを直す・消す（0038）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/coupon-edit.sql
--
-- げんきさん（2026-09-10）「クーポンに編集と削除を追加して」。
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・使った時のクーポン名が、記録に焼き付くか
--   ・**名前を直しても、焼き付けた名前は動かないか**
--     （請求書はこれを見る。直した字がもう渡した書類に出てはいけない）
--   ・**使われたクーポンを消せないか**（表の作りが止めるか）
--   ・使われていないクーポンは消せるか
--   ・広告費の率を直しても、すでに使われた分の額が動かないか
-- 画面と口の決まりは npx tsx tests/api-shape.mts が見ている。

\set ON_ERROR_STOP on
\pset pager off
set test.role = 'service_role';

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000051','edit@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values
  ('c0000000-0000-0000-0000-000000000051','編集工業')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('a0000000-0000-0000-0000-000000000051','edit@x.jp','編集 担当','c0000000-0000-0000-0000-000000000051')
on conflict (id) do update set company_id = excluded.company_id;

-- 何度でも流せるように、前に作ったぶんを片づける。
-- **1回しか流せない試験は、直したあとに確かめられない**
delete from public.coupon_uses u
 using public.coupons c
 where c.id = u.coupon_id and c.code in ('EDIT10', 'SARA1000');
delete from public.orders o
 using public.coupons c
 where c.id = o.coupon_id and c.code in ('EDIT10', 'SARA1000');
delete from public.coupons where code in ('EDIT10', 'SARA1000');
delete from public.partners where name = '直す紹介';

do $$
declare
  co   uuid := 'c0000000-0000-0000-0000-000000000051';
  who  uuid := 'a0000000-0000-0000-0000-000000000051';
  pt   uuid;
  cp   uuid;
  sara uuid;
  g    uuid := gen_random_uuid();
  r    record;
  nm   text;
  rw   int;
  n    int;
  msg  text;
begin
  insert into partners (name) values ('直す紹介') returning id into pt;
  insert into coupons (code, name, percent_off, partner_id, reward_rate)
  values ('EDIT10', '直す前の名前', 10, pt, 20) returning id into cp;
  -- まだ一度も使っていないクーポン
  insert into coupons (code, name, amount_off)
  values ('SARA1000', 'まっさら 1,000円引き', 1000) returning id into sara;

  -- 使う。10,000円 → 1,000円引き、広告費は 9,000円の20%で1,800円
  select * into r from public.use_coupon('EDIT10', g, co, who, 10000);
  if r.discount <> 1000 or r.reward <> 1800 then
    raise exception 'NG: 使ったときの計算が違う（引き % / 広告費 %）', r.discount, r.reward;
  end if;
  insert into orders (company_id, group_id, course_id, seats, unit_price, amount, discount, coupon_id,
                      method, status, ordered_by)
  values (co, g, 'ashiba', 1, 10000, 9900, 1000, cp, 'invoice', 'pending', who);

  -- ① 使った時の名前が、記録に焼き付いている
  select coupon_name into nm from coupon_uses where group_id = g;
  raise notice 'expected: 使った時の名前が残る（%）', nm;
  if nm <> '直す前の名前' then raise exception 'NG: 名前が焼き付いていない（%）', nm; end if;

  -- ② **名前を直しても、焼き付けた名前は動かない**
  --    請求書はこれを見る。もう渡した書類の字が変わってはいけない
  update coupons set name = '直したあとの名前' where id = cp;
  select coupon_name into nm from coupon_uses where group_id = g;
  raise notice 'expected: 直しても、使った時の名前のまま（%）', nm;
  if nm <> '直す前の名前' then
    raise exception 'NG: 名前を直したら、渡した請求書の字まで変わった（%）', nm;
  end if;

  -- ③ 広告費の率を直しても、すでに使われた分の額は動かない
  update coupons set reward_rate = 50 where id = cp;
  select reward, reward_rate into rw, n from coupon_uses where group_id = g;
  raise notice 'expected: 過去の広告費は動かない（% 円・% ％）', rw, n;
  if rw <> 1800 or n <> 20 then
    raise exception 'NG: 率を直したら、過去の広告費が動いた（% 円・% ％）', rw, n;
  end if;

  -- ④ **使われたクーポンは消せない**（払った広告費の裏が取れなくなる）
  begin
    delete from coupons where id = cp;
    raise exception 'NG: 使われたクーポンが消せた';
  exception when foreign_key_violation then
    get stacked diagnostics msg = message_text;
    raise notice 'expected: 使われたクーポンは消せない（%）', msg;
  end;

  -- ⑤ 使われていないクーポンは消せる
  delete from coupons where id = sara;
  select count(*) into n from coupons where id = sara;
  if n <> 0 then raise exception 'NG: 使われていないクーポンが消せない'; end if;
  raise notice 'expected: 一度も使われていないクーポンは消せる';

  -- ⑦ 版が古い頃の記録（名前が空）に、あとから名前が入るか。
  --    0038 の入れ直しと同じ文を、もう一度当てる。
  --    **入らないと、古い請求書から値引きの名前が消える**
  update coupon_uses set coupon_name = null where group_id = g;
  update public.coupon_uses u
     set coupon_name = c.name
    from public.coupons c
   where c.id = u.coupon_id
     and u.coupon_name is null;
  select coupon_name into nm from coupon_uses where group_id = g;
  raise notice 'expected: 古い記録にも名前が入る（%）', nm;
  -- いまの名前（直したあと）で埋まる。これは仕方がない。
  -- 直す前に流していれば、直す前の名前で埋まる
  if nm is null then raise exception 'NG: 古い記録に名前が入らない'; end if;

  -- ⑥ 期限と上限は、空に戻せる（無期限・無制限）
  update coupons set expires_at = now() + interval '1 day', max_uses = 3 where id = cp;
  update coupons set expires_at = null, max_uses = null where id = cp;
  select count(*) into n from coupons where id = cp and expires_at is null and max_uses is null;
  if n <> 1 then raise exception 'NG: 期限と上限を空に戻せない'; end if;
end $$;

select 'OK: クーポンを直す・消す（0038）';
