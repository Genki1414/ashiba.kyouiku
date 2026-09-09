-- クーポンと広告費（0032）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/coupon.sql
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・率と定額で、値引きが正しく出るか（端数の落とし方も）
--   ・**値引きは、割引前を超えないか**（総額がマイナスにならない）
--   ・広告費が「割引後の税抜 ×％」か（げんきさん 2026-09-09）
--   ・使った時の率が記録に焼き付くか（あとで率を変えても動かない）
--   ・期限・停止・全体の上限・1事業者あたりの上限で断れるか
--   ・**取り消した申込みは、使った回数に数えないか**
--   ・同じ申込みに2枚使えないか
-- 画面側の決まりは npx tsx tests/api-shape.mts と tests/coupon.ts が見ている。

\set ON_ERROR_STOP on
\pset pager off
set test.role = 'service_role';

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000041','coupon@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values
  ('c0000000-0000-0000-0000-000000000041','クーポン工業'),
  ('c0000000-0000-0000-0000-000000000042','よその工業')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('a0000000-0000-0000-0000-000000000041','coupon@x.jp','クーポン 担当','c0000000-0000-0000-0000-000000000041')
on conflict (id) do update set company_id = excluded.company_id;

do $$
declare
  co   uuid := 'c0000000-0000-0000-0000-000000000041';
  yoso uuid := 'c0000000-0000-0000-0000-000000000042';
  who  uuid := 'a0000000-0000-0000-0000-000000000041';
  pt   uuid;
  cp   uuid;
  cf   uuid;
  g    uuid;
  r    record;
  n    int;
  msg  text;
begin
  insert into partners (name, contact) values ('プラント紹介', 'plant@example.jp') returning id into pt;

  -- 率のクーポン（10%引き、広告費20%）と、定額のクーポン（3,000円引き）
  insert into coupons (code, name, percent_off, partner_id, reward_rate)
  values ('PLANT10', 'プラント紹介 10%', 10, pt, 20) returning id into cp;
  insert into coupons (code, name, amount_off)
  values ('KAI3000', '協会 3,000円引き', 3000) returning id into cf;

  -- ① 率。22,500円 → 2,250円引き
  select * into r from public.coupon_check('PLANT10', co, 22500);
  raise notice 'expected: 率で2250円引き（% / %）', r.ok, r.discount;
  if not r.ok or r.discount <> 2250 then raise exception 'NG: 率の値引きが違う（%）', r.discount; end if;

  -- ② 端数は切り捨て（1円でも多く引くと、こちらの取り分が減る）
  select * into r from public.coupon_check('PLANT10', co, 4505);
  if r.discount <> 450 then raise exception 'NG: 端数の落とし方が違う（%）', r.discount; end if;

  -- ③ 定額。**割引前を超えない**（超えると総額がマイナスになる）
  select * into r from public.coupon_check('KAI3000', co, 2000);
  raise notice 'expected: 2,000円の申込みに3,000円引きは、2,000円まで（%）', r.discount;
  if r.discount <> 2000 then raise exception 'NG: 値引きが割引前を超えた（%）', r.discount; end if;

  -- ④ 打ち方の揺れ（小文字・前後の空白）をそろえる
  select * into r from public.coupon_check('  plant10 ', co, 10000);
  if not r.ok or r.discount <> 1000 then raise exception 'NG: 小文字で通らない'; end if;

  -- ⑤ 無いクーポンは、そう言う
  select * into r from public.coupon_check('NASHI', co, 10000);
  if r.ok or r.reason not like '%ありません%' then raise exception 'NG: 無いクーポンが通った'; end if;

  -- ⑥ 使う。**広告費は割引後の税抜 ×％**（22,500 - 2,250）× 20% = 4,050
  g := gen_random_uuid();
  select * into r from public.use_coupon('PLANT10', g, co, who, 22500);
  raise notice 'expected: 広告費 4050円（%）', r.reward;
  if r.discount <> 2250 or r.reward <> 4050 then
    raise exception 'NG: 広告費が違う（値引き % / 広告費 %）', r.discount, r.reward;
  end if;
  select count(*) into n from coupon_uses where group_id = g and net = 20250 and reward_rate = 20;
  if n <> 1 then raise exception 'NG: 記録が残っていない'; end if;

  -- 使ったぶんの注文を立てる（回数の数え方が、これを見る）
  insert into orders (company_id, group_id, course_id, seats, unit_price, amount, discount, coupon_id,
                      method, status, ordered_by)
  values (co, g, 'ashiba', 5, 4500, 22275, 2250, cp, 'invoice', 'pending', who);

  -- ⑦ 同じ申込みに2枚は使えない
  begin
    perform public.use_coupon('KAI3000', g, co, who, 22500);
    raise exception 'NG: 同じ申込みに2枚使えた';
  exception when others then
    msg := sqlerrm;
    if msg not like '%もうクーポンが使われています%' then raise exception 'NG: 断る文が違う（%）', msg; end if;
  end;

  -- ⑧ **使った時の率が焼き付く。**あとで率を変えても、過去は動かない
  update coupons set reward_rate = 5 where id = cp;
  select reward_rate, reward into n, msg from coupon_uses where group_id = g;
  if n <> 20 then raise exception 'NG: 過去の率が動いた（%）', n; end if;
  update coupons set reward_rate = 20 where id = cp;

  -- ⑨ 停止したら使えない
  update coupons set active = false where id = cf;
  select * into r from public.coupon_check('KAI3000', co, 10000);
  if r.ok then raise exception 'NG: 停止したクーポンが使えた'; end if;
  update coupons set active = true where id = cf;

  -- ⑩ 期限切れ
  update coupons set expires_at = now() - interval '1 day' where id = cf;
  select * into r from public.coupon_check('KAI3000', co, 10000);
  if r.ok or r.reason not like '%期限%' then raise exception 'NG: 期限切れが使えた'; end if;
  update coupons set expires_at = null where id = cf;

  -- ⑪ まだ始まっていない
  update coupons set starts_at = now() + interval '1 day' where id = cf;
  select * into r from public.coupon_check('KAI3000', co, 10000);
  if r.ok or r.reason not like '%まだ%' then raise exception 'NG: 始まる前に使えた'; end if;
  update coupons set starts_at = null where id = cf;

  -- ⑫ 1事業者あたりの上限。**よその会社は使える**
  update coupons set company_uses = 1 where id = cp;
  select * into r from public.coupon_check('PLANT10', co, 10000);
  raise notice 'expected: この事業者はもう使っている（%）', r.reason;
  if r.ok then raise exception 'NG: 1事業者1回を超えて使えた'; end if;
  select * into r from public.coupon_check('PLANT10', yoso, 10000);
  if not r.ok then raise exception 'NG: よその会社まで止めた'; end if;

  -- ⑬ **取り消した申込みは、使った回数に数えない**
  update orders set status = 'cancelled' where group_id = g;
  select * into r from public.coupon_check('PLANT10', co, 10000);
  raise notice 'expected: 取り消したので、また使える（%）', r.ok;
  if not r.ok then raise exception 'NG: 取り消した申込みを数えている'; end if;
  update orders set status = 'pending' where group_id = g;
  update coupons set company_uses = null where id = cp;

  -- ⑭ 全体の上限
  update coupons set max_uses = 1 where id = cp;
  select * into r from public.coupon_check('PLANT10', yoso, 10000);
  if r.ok or r.reason not like '%回数%' then raise exception 'NG: 全体の上限を超えて使えた'; end if;
  update coupons set max_uses = null where id = cp;

  -- ⑮ 使うのをやめられる（注文を作れなかったとき）。残り回数だけが減らない
  perform public.release_coupon_use(g);
  select count(*) into n from coupon_uses where group_id = g;
  if n <> 0 then raise exception 'NG: 記録が消えていない'; end if;

  -- ⑯ 広告費の率が0なら、広告費は0（自社の販促。支払い先も無い）
  g := gen_random_uuid();
  select * into r from public.use_coupon('KAI3000', g, co, who, 10000);
  if r.discount <> 3000 or r.reward <> 0 then
    raise exception 'NG: 支払い先の無いクーポンで広告費が出た（%）', r.reward;
  end if;
end $$;

select 'OK: クーポンと広告費（0032）';
