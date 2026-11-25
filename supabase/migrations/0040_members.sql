-- ═══════════════════════════════════════════════════════════
-- 0040 法人会員・販売代理店・営業パートナー（docs/119）
--
-- げんきさんの実装指示書（2026-11-25）。フェーズ1の土台。
--
-- ── 決めたこと ──
--   ・法人会員＝既存の「事業者（companies）」に月額契約（contracts）を足す。
--     社員・名簿・受講・修了証は今までの表のまま
--   ・チケットは残高の列を1つ持たない。**付与ロットごとに残額と失効日**を持ち、
--     増減は全部 ticket_txns に残す。消費は古いロットから、行ロックで、負にしない
--   ・入金→契約の更新→ロット付与→紹介元の報酬登録は **1つの関数**（pay_contract_payment）。
--     入金 id で一意なので、二度呼んでも二度付かない
--   ・営業パートナーの報酬は入金1件につき1行。確定（入金あり）と見込み（契約だけ）は
--     表で分かれる：commissions にあるものだけが確定
--   ・金額は全部 int（円）。税抜で持ち、税込は出すときに計算
--   ・販売代理店は契約の種類（kind='agency'）で分ける。ショップはフェーズ2
--   ・既存の表は消さない・意味を変えない。orders に支払方法 'ticket' と contract_id を足すだけ
-- ═══════════════════════════════════════════════════════════

-- ── プラン ──────────────────────────────────
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('member','agency')),
  name          text not null,
  -- 月額会費（税抜・円）
  monthly_fee   int  not null check (monthly_fee >= 0),
  -- 毎月付与するチケット（通常価格・税抜ベースの円）
  ticket_amount int  not null check (ticket_amount >= 0),
  -- 付与日から何か月で失効するか（資金決済法の判断で変えられるように列で持つ。docs/119）
  ticket_months int  not null default 12 check (ticket_months between 1 and 36),
  public        boolean not null default true,
  sort_order    int  not null default 0,
  note          text,
  created_at    timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists plans_select_public on public.plans;
create policy plans_select_public on public.plans for select using (public);

-- 初期プラン（指示書3・5）。1件も無いときだけ入れる。運営が画面で直す
insert into public.plans (kind, name, monthly_fee, ticket_amount, sort_order)
select * from (values
  ('member','ライト',          5000,  10000,  1),
  ('member','スタンダード',   10000,  20000,  2),
  ('member','ビジネス',       20000,  40000,  3),
  ('member','エンタープライズ',50000, 100000,  4),
  ('agency','代理店 1万',     10000,  20000, 11),
  ('agency','代理店 2万',     20000,  40000, 12),
  ('agency','代理店 3万',     30000,  60000, 13),
  ('agency','代理店 5万',     50000, 100000, 14),
  ('agency','代理店 10万',   100000, 200000, 15)
) as v(kind, name, monthly_fee, ticket_amount, sort_order)
where not exists (select 1 from public.plans);

-- ── 協力会社（親会社の下に付く） ───────────
alter table public.companies
  add column if not exists parent_id uuid references public.companies (id) on delete set null;

-- ── 営業パートナー ───────────────────────────
create table if not exists public.sales_partners (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.users (id) on delete cascade,
  name        text not null,
  kind        text not null default 'individual' check (kind in ('corp','individual')),
  status      text not null default 'pending' check (status in ('pending','approved','suspended')),
  -- 紹介コード。URL にも入れる
  code        text not null unique,
  -- 報酬率（％）。指示書は30。個別に変えられるように列で持つ
  rate        int  not null default 30 check (rate between 0 and 100),
  contact     text,
  note        text,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.sales_partners enable row level security;
drop policy if exists sales_partners_select_own on public.sales_partners;
create policy sales_partners_select_own on public.sales_partners
  for select using (user_id = auth.uid());

-- 振込先。本人と運営だけ。**他の人には一切見せない**
create table if not exists public.partner_bank (
  partner_id uuid primary key references public.sales_partners (id) on delete cascade,
  bank_name  text,
  branch     text,
  acct_type  text check (acct_type in ('普通','当座','貯蓄')),
  acct_no    text,
  holder     text,
  -- 請求・税務に要るもの（インボイス番号など）
  tax_note   text,
  updated_at timestamptz not null default now()
);
alter table public.partner_bank enable row level security;
drop policy if exists partner_bank_select_own on public.partner_bank;
create policy partner_bank_select_own on public.partner_bank
  for select using (exists (select 1 from public.sales_partners p where p.id = partner_id and p.user_id = auth.uid()));

-- ── 月額契約 ────────────────────────────────
create table if not exists public.contracts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete restrict,
  plan_id     uuid not null references public.plans (id) on delete restrict,
  kind        text not null check (kind in ('member','agency')),
  -- pending=初回の入金待ち／active=有効／suspended=停止／ended=終了
  status      text not null default 'pending' check (status in ('pending','active','suspended','ended')),
  method      text not null default 'invoice' check (method in ('invoice','card')),
  -- どの店から入ったか（集計のため）
  brand       text,
  started_on  date,
  ends_on     date,
  next_due_on date,
  referrer_id uuid references public.sales_partners (id) on delete set null,
  note        text,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
-- 開いている契約は1社に1つ
create unique index if not exists contracts_one_open_idx
  on public.contracts (company_id) where status in ('pending','active','suspended');
alter table public.contracts enable row level security;
drop policy if exists contracts_select_company on public.contracts;
create policy contracts_select_company on public.contracts
  for select using (public.is_admin() and company_id = public.current_company_id());

-- ── 月ごとの入金 ─────────────────────────────
create table if not exists public.contract_payments (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts (id) on delete cascade,
  -- 対象の月（1日）
  period_month  date not null,
  net           int  not null check (net >= 0),
  tax           int  not null check (tax >= 0),
  amount        int  not null check (amount >= 0),
  -- 入金したら付与する額と月数。**起票したときのプランの値を写す**（あとでプランを直しても、請求済みの分は動かない）
  ticket_amount int  not null check (ticket_amount >= 0),
  ticket_months int  not null default 12,
  method        text not null default 'invoice' check (method in ('invoice','card')),
  status        text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  -- 決済の id（Stripe の id、手入力なら 'manual:…'）。**二度来ても二度付かない鍵**
  external_id   text unique,
  due_on        date,
  invoiced_at   timestamptz,
  paid_at       timestamptz,
  refunded_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint contract_payments_paid_at check ((status in ('paid','refunded')) = (paid_at is not null)),
  unique (contract_id, period_month)
);
create index if not exists contract_payments_status_idx on public.contract_payments (status, due_on);
alter table public.contract_payments enable row level security;
drop policy if exists contract_payments_select_company on public.contract_payments;
create policy contract_payments_select_company on public.contract_payments
  for select using (exists (select 1 from public.contracts c
                             where c.id = contract_id and public.is_admin() and c.company_id = public.current_company_id()));

-- ── チケットのロットと履歴 ───────────────────
create table if not exists public.ticket_lots (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  payment_id  uuid unique references public.contract_payments (id) on delete set null,
  amount      int  not null check (amount >= 0),
  remaining   int  not null check (remaining >= 0),
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists ticket_lots_contract_idx on public.ticket_lots (contract_id, expires_at);
alter table public.ticket_lots enable row level security;
drop policy if exists ticket_lots_select_company on public.ticket_lots;
create policy ticket_lots_select_company on public.ticket_lots
  for select using (exists (select 1 from public.contracts c
                             where c.id = contract_id and public.is_admin() and c.company_id = public.current_company_id()));

create table if not exists public.ticket_txns (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  lot_id      uuid references public.ticket_lots (id) on delete set null,
  -- grant=付与／spend=消費／expire=失効／return=注文が作れず戻した／refund=返金／adjust=運営の調整
  kind        text not null check (kind in ('grant','spend','expire','return','refund','adjust')),
  -- 増えるなら正、減るなら負
  amount      int  not null,
  order_id    uuid references public.orders (id) on delete set null,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists ticket_txns_contract_idx on public.ticket_txns (contract_id, created_at);
alter table public.ticket_txns enable row level security;
drop policy if exists ticket_txns_select_company on public.ticket_txns;
create policy ticket_txns_select_company on public.ticket_txns
  for select using (exists (select 1 from public.contracts c
                             where c.id = contract_id and public.is_admin() and c.company_id = public.current_company_id()));

-- ── 紹介の紐付け ─────────────────────────────
create table if not exists public.referrals (
  company_id uuid primary key references public.companies (id) on delete cascade,
  partner_id uuid not null references public.sales_partners (id) on delete restrict,
  code_used  text,
  source     text not null default 'code' check (source in ('url','code','manual')),
  -- 契約が成立した時点で固定。以後は運営だけが理由つきで変える
  locked_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
drop policy if exists referrals_select_partner on public.referrals;
create policy referrals_select_partner on public.referrals
  for select using (exists (select 1 from public.sales_partners p where p.id = partner_id and p.user_id = auth.uid()));

create table if not exists public.referral_changes (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  from_partner uuid references public.sales_partners (id) on delete set null,
  to_partner   uuid references public.sales_partners (id) on delete set null,
  reason       text not null,
  changed_by   text,
  created_at   timestamptz not null default now()
);
alter table public.referral_changes enable row level security;

-- ── 報酬 ────────────────────────────────────
create table if not exists public.commission_payouts (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.sales_partners (id) on delete restrict,
  period_month date not null,
  total        int  not null,
  status       text not null default 'planned' check (status in ('planned','paid')),
  paid_at      timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
alter table public.commission_payouts enable row level security;
drop policy if exists commission_payouts_select_own on public.commission_payouts;
create policy commission_payouts_select_own on public.commission_payouts
  for select using (exists (select 1 from public.sales_partners p where p.id = partner_id and p.user_id = auth.uid()));

create table if not exists public.commissions (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid references public.contract_payments (id) on delete set null,
  partner_id   uuid not null references public.sales_partners (id) on delete restrict,
  contract_id  uuid references public.contracts (id) on delete set null,
  period_month date not null,
  -- 税抜の入金額 × 率
  base_net     int  not null,
  rate         int  not null,
  amount       int  not null,
  -- earn=入金で発生／adjust=返金などの調整（負の額）
  kind         text not null default 'earn' check (kind in ('earn','adjust')),
  status       text not null default 'confirmed' check (status in ('confirmed','paid','void')),
  payout_id    uuid references public.commission_payouts (id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);
-- 入金1件につき発生は1行。**二度呼んでも二度付かない**
create unique index if not exists commissions_one_per_payment on public.commissions (payment_id) where kind = 'earn';
alter table public.commissions enable row level security;
drop policy if exists commissions_select_own on public.commissions;
create policy commissions_select_own on public.commissions
  for select using (exists (select 1 from public.sales_partners p where p.id = partner_id and p.user_id = auth.uid()));

-- ── 運営の操作ログと目標 ─────────────────────
create table if not exists public.admin_logs (
  id         uuid primary key default gen_random_uuid(),
  actor      text,
  action     text not null,
  target     text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_logs enable row level security;

create table if not exists public.targets (
  id             int primary key default 1 check (id = 1),
  deadline       date not null default '2027-01-31',
  mrr_min        int  not null default 500000,
  mrr_goal       int  not null default 800000,
  net_goal       int  not null default 500000,
  partners_goal  int  not null default 10,
  contracts_goal int  not null default 40,
  updated_at     timestamptz not null default now()
);
alter table public.targets enable row level security;
insert into public.targets (id) values (1) on conflict (id) do nothing;

-- ── 注文に「チケットで払った」を足す ──────────
alter type public.order_method add value if not exists 'ticket';
alter table public.orders
  add column if not exists contract_id uuid references public.contracts (id) on delete set null;

-- ═══════════════════════════════════════════════
-- 関数
-- ═══════════════════════════════════════════════

-- 対象月の入金行を起こす（請求書の元）。もうあれば、その id を返す
create or replace function public.open_contract_payment(p_contract uuid, p_month date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c  public.contracts;
  pl public.plans;
  v_id uuid;
  v_month date := date_trunc('month', p_month)::date;
  v_tax int;
begin
  select * into c from public.contracts where id = p_contract for update;
  if c.id is null then raise exception 'その契約がありません'; end if;
  if c.status = 'ended' then raise exception '終了した契約です'; end if;
  select * into pl from public.plans where id = c.plan_id;

  select id into v_id from public.contract_payments
   where contract_id = p_contract and period_month = v_month;
  if v_id is not null then return v_id; end if;

  v_tax := floor(pl.monthly_fee * 0.10);
  insert into public.contract_payments
    (contract_id, period_month, net, tax, amount, ticket_amount, ticket_months, method, due_on)
  values
    (p_contract, v_month, pl.monthly_fee, v_tax, pl.monthly_fee + v_tax, pl.ticket_amount, pl.ticket_months, c.method,
     -- 前払い。期限はその月の1日より前（起票から1週間後と、月初の早い方）
     least(v_month, (current_date + 7)))
  returning id into v_id;
  return v_id;
end $$;

-- 入金を確認した。契約を有効にし、ロットを付与し、紹介元の報酬を登録する。
-- **1つのトランザクション。**二度呼んでも二度付かない（status を見る）。
create or replace function public.pay_contract_payment(p_payment uuid, p_by text default '', p_external text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p  public.contract_payments;
  c  public.contracts;
  sp public.sales_partners;
  r  public.referrals;
  v_lot uuid;
  v_now timestamptz := now();
begin
  select * into p from public.contract_payments where id = p_payment for update;
  if p.id is null then return false; end if;
  if p.status = 'paid' then return true; end if;        -- もう立っている
  if p.status in ('refunded','cancelled') then
    raise exception 'この入金行は % です。立てられません', p.status;
  end if;

  select * into c from public.contracts where id = p.contract_id for update;
  if c.status = 'ended' then raise exception '終了した契約です'; end if;

  update public.contract_payments
     set status = 'paid', paid_at = v_now,
         external_id = coalesce(p_external, external_id)
   where id = p_payment;

  -- 契約：初回なら開始日と満了日（12か月）を決める。次回は翌月
  update public.contracts
     set status      = 'active',
         started_on  = coalesce(started_on, p.period_month),
         ends_on     = coalesce(ends_on, (p.period_month + interval '12 months' - interval '1 day')::date),
         next_due_on = (p.period_month + interval '1 month')::date
   where id = c.id;

  -- 付与ロット。入金1件につき1つ（payment_id が一意）
  insert into public.ticket_lots (contract_id, payment_id, amount, remaining, granted_at, expires_at)
  values (c.id, p.id, p.ticket_amount, p.ticket_amount, v_now, v_now + (p.ticket_months || ' months')::interval)
  returning id into v_lot;
  insert into public.ticket_txns (contract_id, lot_id, kind, amount, note, created_by)
  values (c.id, v_lot, 'grant', p.ticket_amount, to_char(p.period_month, 'YYYY-MM') || ' 分の付与', p_by);

  -- 紹介元があれば報酬。税抜の入金額 × 率。入金1件につき1行
  select * into r from public.referrals where company_id = c.company_id;
  if r.partner_id is not null then
    select * into sp from public.sales_partners where id = r.partner_id;
    if sp.status = 'approved' then
      insert into public.commissions (payment_id, partner_id, contract_id, period_month, base_net, rate, amount, kind, status)
      values (p.id, sp.id, c.id, p.period_month, p.net, sp.rate, floor(p.net * sp.rate / 100.0), 'earn', 'confirmed')
      on conflict do nothing;
    end if;
    -- 契約が成立した時点で紹介元を固定
    update public.referrals set locked_at = coalesce(locked_at, v_now) where company_id = c.company_id;
  end if;

  return true;
end $$;

-- チケットの残高。期限内のロットの残額の合計と、30日以内に失効する額
create or replace function public.ticket_balance(p_contract uuid)
returns table (total int, expiring int, next_expire timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(remaining), 0)::int,
         coalesce(sum(remaining) filter (where expires_at <= now() + interval '30 days'), 0)::int,
         min(expires_at) filter (where remaining > 0)
    from public.ticket_lots
   where contract_id = p_contract and remaining > 0 and expires_at > now()
$$;

-- チケットを消費する。**古いロットから。行ロック。足りなければ例外で止める（負にしない）。**
-- 戻り値は消費後の残高
create or replace function public.spend_tickets(p_contract uuid, p_amount int, p_order uuid, p_by text default '')
returns int language plpgsql security definer set search_path = public as $$
declare
  lot  public.ticket_lots;
  v_left int := p_amount;
  v_take int;
  v_total int;
begin
  if p_amount <= 0 then raise exception '消費する額が0以下です'; end if;
  perform 1 from public.contracts where id = p_contract and status = 'active' for update;
  if not found then raise exception '有効な契約がありません'; end if;

  select coalesce(sum(remaining), 0) into v_total
    from public.ticket_lots where contract_id = p_contract and remaining > 0 and expires_at > now();
  if v_total < p_amount then
    raise exception 'チケットが足りません（不足 %円）', (p_amount - v_total);
  end if;

  for lot in
    select * from public.ticket_lots
     where contract_id = p_contract and remaining > 0 and expires_at > now()
     order by expires_at, granted_at
     for update
  loop
    exit when v_left <= 0;
    v_take := least(lot.remaining, v_left);
    update public.ticket_lots set remaining = remaining - v_take where id = lot.id;
    insert into public.ticket_txns (contract_id, lot_id, kind, amount, order_id, created_by)
    values (p_contract, lot.id, 'spend', -v_take, p_order, p_by);
    v_left := v_left - v_take;
  end loop;

  select total into v_total from public.ticket_balance(p_contract);
  return v_total;
end $$;

-- 注文が作れなかった・取り消したとき、その注文で消費したぶんを元のロットへ戻す
create or replace function public.return_tickets(p_order uuid, p_by text default '')
returns int language plpgsql security definer set search_path = public as $$
declare
  t public.ticket_txns;
  v_sum int := 0;
begin
  for t in select * from public.ticket_txns where order_id = p_order and kind = 'spend' for update loop
    -- 同じ注文を二度戻さない
    if exists (select 1 from public.ticket_txns r where r.order_id = p_order and r.kind = 'return' and r.lot_id = t.lot_id) then
      continue;
    end if;
    update public.ticket_lots set remaining = remaining + (-t.amount) where id = t.lot_id;
    insert into public.ticket_txns (contract_id, lot_id, kind, amount, order_id, created_by)
    values (t.contract_id, t.lot_id, 'return', -t.amount, p_order, p_by);
    v_sum := v_sum + (-t.amount);
  end loop;
  return v_sum;
end $$;

-- 失効。期限を過ぎて残っているロットを0にし、履歴に残す。戻り値は失効させた額
create or replace function public.expire_tickets()
returns int language plpgsql security definer set search_path = public as $$
declare
  lot public.ticket_lots;
  v_sum int := 0;
begin
  for lot in select * from public.ticket_lots where remaining > 0 and expires_at <= now() for update loop
    insert into public.ticket_txns (contract_id, lot_id, kind, amount, note)
    values (lot.contract_id, lot.id, 'expire', -lot.remaining, '有効期限切れ');
    v_sum := v_sum + lot.remaining;
    update public.ticket_lots set remaining = 0 where id = lot.id;
  end loop;
  return v_sum;
end $$;

-- 返金。入金行を返金にし、そのロットの残りを消し、報酬を打ち消す。
-- 消費済みのぶんは戻せないので、履歴にそう残す
create or replace function public.refund_contract_payment(p_payment uuid, p_by text default '', p_note text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p   public.contract_payments;
  lot public.ticket_lots;
  cm  public.commissions;
begin
  select * into p from public.contract_payments where id = p_payment for update;
  if p.id is null then return false; end if;
  if p.status <> 'paid' then raise exception '入金済みの行だけ返金できます（いまは %）', p.status; end if;

  update public.contract_payments set status = 'refunded', refunded_at = now() where id = p_payment;

  select * into lot from public.ticket_lots where payment_id = p_payment for update;
  if lot.id is not null then
    insert into public.ticket_txns (contract_id, lot_id, kind, amount, note, created_by)
    values (lot.contract_id, lot.id, 'refund', -lot.remaining,
            case when lot.remaining < lot.amount then '返金。消費済み ' || (lot.amount - lot.remaining) || '円は戻せない' else '返金' end
            || coalesce('：' || nullif(p_note, ''), ''), p_by);
    update public.ticket_lots set remaining = 0 where id = lot.id;
  end if;

  -- 報酬：未払いなら無効に、支払済みなら負の調整行
  for cm in select * from public.commissions where payment_id = p_payment and kind = 'earn' for update loop
    if cm.status = 'paid' then
      insert into public.commissions (payment_id, partner_id, contract_id, period_month, base_net, rate, amount, kind, status, note)
      values (p_payment, cm.partner_id, cm.contract_id, date_trunc('month', now())::date, -cm.base_net, cm.rate, -cm.amount, 'adjust', 'confirmed', '返金による調整');
    else
      update public.commissions set status = 'void', note = coalesce(note, '') || ' 返金' where id = cm.id;
    end if;
  end loop;
  return true;
end $$;

-- 呼べるのはサーバだけ
revoke all on function public.open_contract_payment(uuid, date) from public, anon, authenticated;
revoke all on function public.pay_contract_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.ticket_balance(uuid) from public, anon, authenticated;
revoke all on function public.spend_tickets(uuid, int, uuid, text) from public, anon, authenticated;
revoke all on function public.return_tickets(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_tickets() from public, anon, authenticated;
revoke all on function public.refund_contract_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.open_contract_payment(uuid, date) to service_role;
grant execute on function public.pay_contract_payment(uuid, text, text) to service_role;
grant execute on function public.ticket_balance(uuid) to service_role;
grant execute on function public.spend_tickets(uuid, int, uuid, text) to service_role;
grant execute on function public.return_tickets(uuid, text) to service_role;
grant execute on function public.expire_tickets() to service_role;
grant execute on function public.refund_contract_payment(uuid, text, text) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0040'
$$;
grant execute on function public.schema_version() to anon, authenticated, service_role;
