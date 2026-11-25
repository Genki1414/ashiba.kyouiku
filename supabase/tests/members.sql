-- 法人会員・営業パートナー（0040）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/members.sql
--
-- ここで見るのは、SQL でしか確かめられないこと（docs/119）。
--   ・対象月の入金行は1つしか起きないか
--   ・入金で、契約の有効化・ロットの付与・紹介元の報酬が一度に立つか
--   ・二度立てても二度付かないか
--   ・消費は古いロットから、足りなければ止まるか（負にしない）
--   ・戻しは一度だけか。失効・返金で残額と報酬がどう動くか
--   ・開いている契約は1社に1つか

\set ON_ERROR_STOP on
\pset pager off
set test.role = 'service_role';

-- 会社と担当者、営業パートナー
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000071','member-admin@x.jp'),
  ('a0000000-0000-0000-0000-000000000072','partner@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values ('c0000000-0000-0000-0000-000000000071','会員工業')
on conflict (id) do nothing;
insert into public.users (id, email, name, role, company_id) values
  ('a0000000-0000-0000-0000-000000000071','member-admin@x.jp','会員 担当','admin','c0000000-0000-0000-0000-000000000071'),
  ('a0000000-0000-0000-0000-000000000072','partner@x.jp','営業 太郎','learner',null)
on conflict (id) do update set role = excluded.role, company_id = excluded.company_id;

-- 何度でも流せるように、前に作ったぶんを片づける
delete from public.commissions where partner_id in (select id from public.sales_partners where user_id = 'a0000000-0000-0000-0000-000000000072');
delete from public.commission_payouts where partner_id in (select id from public.sales_partners where user_id = 'a0000000-0000-0000-0000-000000000072');
delete from public.ticket_txns where contract_id in (select id from public.contracts where company_id = 'c0000000-0000-0000-0000-000000000071');
delete from public.ticket_lots where contract_id in (select id from public.contracts where company_id = 'c0000000-0000-0000-0000-000000000071');
delete from public.orders where contract_id in (select id from public.contracts where company_id = 'c0000000-0000-0000-0000-000000000071');
delete from public.contract_payments where contract_id in (select id from public.contracts where company_id = 'c0000000-0000-0000-0000-000000000071');
delete from public.contracts where company_id = 'c0000000-0000-0000-0000-000000000071';
delete from public.referral_changes where company_id = 'c0000000-0000-0000-0000-000000000071';
delete from public.referrals where company_id = 'c0000000-0000-0000-0000-000000000071';
delete from public.sales_partners where user_id = 'a0000000-0000-0000-0000-000000000072';

insert into public.sales_partners (id, user_id, name, status, code, rate, approved_at)
values ('d0000000-0000-0000-0000-000000000072','a0000000-0000-0000-0000-000000000072','営業 太郎','approved','TESTP01',30,now());
insert into public.referrals (company_id, partner_id, code_used, source)
values ('c0000000-0000-0000-0000-000000000071','d0000000-0000-0000-0000-000000000072','TESTP01','code');

\echo -- 1) 契約を立てる（スタンダード 10,000円／付与 20,000円）
insert into public.contracts (id, company_id, plan_id, kind, status, method, brand)
select 'e0000000-0000-0000-0000-000000000071', 'c0000000-0000-0000-0000-000000000071', id, 'member', 'pending', 'invoice', 'tokubetsu'
  from public.plans where kind = 'member' and name = 'スタンダード';
select 'expected: 契約 1件 pending = ' || count(*) from public.contracts
 where company_id = 'c0000000-0000-0000-0000-000000000071' and status = 'pending';

\echo -- 2) 開いている契約は1社に1つ
do $$ begin
  insert into public.contracts (company_id, plan_id, kind)
  select 'c0000000-0000-0000-0000-000000000071', id, 'member' from public.plans where kind='member' limit 1;
  raise exception 'ここへ来てはいけない（2つ目の契約が立った）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;

\echo -- 3) 対象月の入金行は1つだけ起きる（税は1回、付与額はプランを写す）
select 'expected: 同じ id = ' || (public.open_contract_payment('e0000000-0000-0000-0000-000000000071', '2026-12-05') = public.open_contract_payment('e0000000-0000-0000-0000-000000000071', '2026-12-20'));
select 'expected: 12月 10000/1000/11000 付与20000 = ' || net || '/' || tax || '/' || amount || ' 付与' || ticket_amount
  from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2026-12-01';
select 'expected: 入金前の残高 0 = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');

\echo -- 4) 消費は有効な契約だけ
do $$ begin
  perform public.spend_tickets('e0000000-0000-0000-0000-000000000071', 1000, null, 'test');
  raise exception 'ここへ来てはいけない（入金前に消費できた）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;

\echo -- 5) 入金を確認すると、契約・ロット・報酬が一度に立つ
select 'expected: true = ' || public.pay_contract_payment(
  (select id from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2026-12-01'), 'test', 'manual:test-1');
select 'expected: active 2026-12-01〜2027-11-30 次回 2027-01-01 = ' || status || ' ' || started_on || '〜' || ends_on || ' 次回 ' || next_due_on
  from public.contracts where id = 'e0000000-0000-0000-0000-000000000071';
select 'expected: ロット 1・残 20000 = ' || count(*) || '・残 ' || sum(remaining) from public.ticket_lots where contract_id = 'e0000000-0000-0000-0000-000000000071';
select 'expected: 報酬 1行 3000 confirmed = ' || count(*) || '行 ' || sum(amount) || ' ' || min(status)
  from public.commissions where partner_id = 'd0000000-0000-0000-0000-000000000072';
select 'expected: 紹介元が固定された = ' || (locked_at is not null) from public.referrals where company_id = 'c0000000-0000-0000-0000-000000000071';

\echo -- 6) 二度立てても二度付かない
select 'expected: true = ' || public.pay_contract_payment(
  (select id from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2026-12-01'), 'test');
select 'expected: ロットは 1 のまま = ' || count(*) from public.ticket_lots where contract_id = 'e0000000-0000-0000-0000-000000000071';
select 'expected: 報酬も 1行のまま = ' || count(*) from public.commissions where partner_id = 'd0000000-0000-0000-0000-000000000072';

\echo -- 7) 翌月も入金すると残高 40000
select public.pay_contract_payment(public.open_contract_payment('e0000000-0000-0000-0000-000000000071', '2027-01-01'), 'test', 'manual:test-2') \gset
select 'expected: 残高 40000 = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');

\echo -- 8) 消費は古いロットから（25000 → 1本目 0・2本目 15000）
insert into public.orders (id, company_id, contract_id, kind, course_id, seats, unit_price, amount, method, status, paid_at)
values ('00000000-0000-0000-0000-000000000071','c0000000-0000-0000-0000-000000000071','e0000000-0000-0000-0000-000000000071','seat','ashiba',5,4500,24750,'ticket','paid',now());
select 'expected: 消費後の残高 15000 = ' || public.spend_tickets('e0000000-0000-0000-0000-000000000071', 25000, '00000000-0000-0000-0000-000000000071', 'test');
select 'expected: 古い順 0,15000 = ' || string_agg(remaining::text, ',' order by granted_at) from public.ticket_lots where contract_id = 'e0000000-0000-0000-0000-000000000071';

\echo -- 9) 足りなければ止まる（負にしない）
do $$ begin
  perform public.spend_tickets('e0000000-0000-0000-0000-000000000071', 20000, null, 'test');
  raise exception 'ここへ来てはいけない（残高を超えて消費できた）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;
select 'expected: 残高は 15000 のまま = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');

\echo -- 10) 戻しは一度だけ
select 'expected: 戻した 25000 = ' || public.return_tickets('00000000-0000-0000-0000-000000000071', 'test');
select 'expected: 残高 40000 = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');
select 'expected: 二度目は 0 = ' || public.return_tickets('00000000-0000-0000-0000-000000000071', 'test');

\echo -- 11) 失効（1本目を期限切れにする）
update public.ticket_lots set expires_at = now() - interval '1 day'
 where contract_id = 'e0000000-0000-0000-0000-000000000071' and granted_at = (select min(granted_at) from public.ticket_lots where contract_id = 'e0000000-0000-0000-0000-000000000071');
select 'expected: 失効 20000 = ' || public.expire_tickets();
select 'expected: 残高 20000 = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');

\echo -- 12) 返金（2月目）。ロットの残りは消え、未払いの報酬は無効に
select 'expected: true = ' || public.refund_contract_payment(
  (select id from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2027-01-01'), 'test', '試験');
select 'expected: 残高 0 = ' || total from public.ticket_balance('e0000000-0000-0000-0000-000000000071');
select 'expected: 1月の報酬は void = ' || c.status from public.commissions c
  join public.contract_payments p on p.id = c.payment_id
 where p.period_month = '2027-01-01' and c.kind = 'earn';

\echo -- 13) 支払済みの報酬を返金すると、負の調整行が立つ
update public.commissions set status = 'paid' where partner_id = 'd0000000-0000-0000-0000-000000000072' and kind = 'earn' and status = 'confirmed';
select 'expected: true = ' || public.refund_contract_payment(
  (select id from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2026-12-01'), 'test');
select 'expected: 調整 -3000 = ' || sum(amount) from public.commissions where partner_id = 'd0000000-0000-0000-0000-000000000072' and kind = 'adjust';

\echo -- 14) 返金済みは二度返金できない
do $$ begin
  perform public.refund_contract_payment((select id from public.contract_payments where contract_id = 'e0000000-0000-0000-0000-000000000071' and period_month = '2026-12-01'), 'test');
  raise exception 'ここへ来てはいけない（二度返金できた）';
exception when others then
  if sqlerrm like '%ここへ来てはいけない%' then raise; end if;
  raise notice 'expected: %', sqlerrm;
end $$;

\echo -- 15) 履歴は全部残っている（grant 2・spend・return・expire・refund 2）
select 'expected: 種類 = ' || string_agg(kind || ':' || n, ' ' order by kind)
  from (select kind, count(*) n from public.ticket_txns where contract_id = 'e0000000-0000-0000-0000-000000000071' group by kind) t;
