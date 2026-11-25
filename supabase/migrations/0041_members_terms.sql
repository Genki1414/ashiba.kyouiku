-- ═══════════════════════════════════════════════════════════
-- 0041 会員制度の条件を決めた（docs/121）
--
-- げんきさん（2026-11-25）「届出不要な状態にして。他もおすすめの構成で」
--
-- ── 決めたこと ──
--   ・チケットは**付与から6か月以内**しか使えない（資金決済法 第4条第2号。6か月内なら
--     前払式支払手段の届出・供託の対象外）。plans.ticket_months は 1〜6 に縛る。
--     ここで縛っておけば、画面でうっかり 12 と入れても入らない
--   ・契約は12か月。満了の1か月前までに申し出が無ければ12か月ずつ自動更新（cron）
--   ・途中解約は翌月末まで。申し出の月の翌月末で終了、以後の会費は請求しない。
--     払った月のチケットは失効日まで使える（cancel_contract）
--   ・契約終了時、残っているチケットは失効（end_contract）。返金なし
--   ・会費の支払期限を14日過ぎたら停止（cron）。入金で再開（pay_contract_payment が active に戻す）
--   ・既存の表は消さない・意味を変えない
-- ═══════════════════════════════════════════════════════════

-- ── チケットの有効期間は 6 か月まで ──
update public.plans set ticket_months = 6 where ticket_months > 6;
alter table public.plans alter column ticket_months set default 6;
alter table public.plans drop constraint if exists plans_ticket_months_check;
alter table public.plans add constraint plans_ticket_months_check check (ticket_months between 1 and 6);
-- もう起こしてある入金行（まだ付与していないもの）も 6 か月に
update public.contract_payments set ticket_months = 6 where ticket_months > 6 and status <> 'paid';

-- ── 契約：解約の申し出と、自動更新の記録 ──
alter table public.contracts
  add column if not exists cancel_requested_on date,
  add column if not exists renewed_at timestamptz;

-- 解約を申し出る。終了日は「申し出の月の翌月末」。以後の請求は起こさない。
-- もう払ってある月のチケットは、その失効日まで使える。
create or replace function public.cancel_contract(p_contract uuid, p_by text default '')
returns date language plpgsql security definer set search_path = public as $$
declare
  c public.contracts;
  v_end date;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null then raise exception 'その契約がありません'; end if;
  if c.status = 'ended' then raise exception '終了した契約です'; end if;
  if c.cancel_requested_on is not null then return c.ends_on; end if;   -- 二度目は何もしない
  -- 翌月末（日本の日付）
  v_end := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '2 months' - interval '1 day')::date;
  -- まだ有効になっていない（入金待ち）なら、その場で終わり
  if c.status = 'pending' then
    v_end := (now() at time zone 'Asia/Tokyo')::date;
  end if;
  update public.contracts
     set cancel_requested_on = (now() at time zone 'Asia/Tokyo')::date,
         ends_on = v_end,
         next_due_on = null,
         note = coalesce(note || E'\n', '') || '解約の申し出 ' || to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || coalesce('（' || nullif(p_by, '') || '）', '')
   where id = c.id;
  -- 入金待ちの請求は取り消す（払わなくてよい）
  update public.contract_payments set status = 'cancelled' where contract_id = c.id and status = 'pending';
  return v_end;
end $$;

-- 契約を終える。残っているチケットは失効（履歴に「契約終了」）。入金待ちは取り消す。
create or replace function public.end_contract(p_contract uuid, p_by text default '', p_note text default '')
returns int language plpgsql security definer set search_path = public as $$
declare
  c   public.contracts;
  lot public.ticket_lots;
  v_sum int := 0;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null then raise exception 'その契約がありません'; end if;
  if c.status = 'ended' then return 0; end if;    -- 二度呼んでも二度は消さない
  for lot in select * from public.ticket_lots where contract_id = c.id and remaining > 0 for update loop
    insert into public.ticket_txns (contract_id, lot_id, kind, amount, note, created_by)
    values (c.id, lot.id, 'expire', -lot.remaining, '契約終了', p_by);
    v_sum := v_sum + lot.remaining;
    update public.ticket_lots set remaining = 0 where id = lot.id;
  end loop;
  update public.contract_payments set status = 'cancelled' where contract_id = c.id and status = 'pending';
  update public.contracts
     set status = 'ended', ended_at = now(), next_due_on = null,
         ends_on = least(coalesce(ends_on, (now() at time zone 'Asia/Tokyo')::date), (now() at time zone 'Asia/Tokyo')::date),
         note = case when nullif(p_note, '') is null then note else coalesce(note || E'\n', '') || p_note end
   where id = c.id;
  return v_sum;
end $$;

-- 自動更新。満了が30日以内で、解約の申し出が無い有効な契約を12か月のばす。戻り値は件数
create or replace function public.renew_contracts()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with t as (
    update public.contracts
       set ends_on = (ends_on + interval '12 months')::date, renewed_at = now()
     where status = 'active' and cancel_requested_on is null
       and ends_on is not null and ends_on <= (now() at time zone 'Asia/Tokyo')::date + 30
    returning 1
  ) select count(*) into v_n from t;
  return v_n;
end $$;

revoke all on function public.cancel_contract(uuid, text) from public, anon, authenticated;
revoke all on function public.end_contract(uuid, text, text) from public, anon, authenticated;
revoke all on function public.renew_contracts() from public, anon, authenticated;
grant execute on function public.cancel_contract(uuid, text) to service_role;
grant execute on function public.end_contract(uuid, text, text) to service_role;
grant execute on function public.renew_contracts() to service_role;

create or replace function public.schema_version()
returns text language sql stable as $$
  select '0041'
$$;
grant execute on function public.schema_version() to anon, authenticated, service_role;
