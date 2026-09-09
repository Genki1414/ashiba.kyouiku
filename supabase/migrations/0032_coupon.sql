-- ═══════════════════════════════════════════════════════════
-- 0032 クーポンと、紹介してくれた人への広告費
--
-- げんきさんの依頼（2026-09-09）。
--   「紹介クーポンや業界団体向けクーポンを出すことになる」
--   「どのクーポンが利用されて、どのくらいの売上になってるかも把握したい」
--   「プラント工事向けのサービス展開してる人がいて、
--     広告費としてクーポン利用売上の何%かを支払いしようと思ってる」
--
-- ── 決めたこと（げんきさん 2026-09-09）──
--   ・割引は**率（10%引き）と定額（3,000円引き）の両方**を持てる。
--     1枚のクーポンは、どちらか一方だけ
--   ・広告費は**割引後の税抜売上 ×％**。値引きしたぶんまで広告費を
--     払わずに済み、預かっている消費税を広告費の元にしない
--
-- ── 表を3つに分けた理由 ──
--   partners     … 広告費の支払い先。1人が何枚もクーポンを持てる
--   coupons      … クーポン1枚。誰に払うか（partner）と率を持つ
--   coupon_uses  … 使われた記録。**申込みまるごとに1件**
--
-- 支払い先を coupons に文字で書くと、名前が変わったときに
-- 過去のぶんと突き合わせられなくなる（「◯◯工業」と「◯◯工業株式会社」）。
--
-- ── 使った時の率を、記録に焼き付ける ──
-- coupon_uses.reward_rate は、**使われた時の率をそのまま残す。**
-- あとで率を 10%→5% に変えても、過去に払う約束をした分は動かない。
-- 動かすと、支払い済みの明細と今の画面が合わなくなる。
--
-- ── 数えるのは「取り消していない申込み」だけ ──
-- 使用回数の上限は、取り消した申込みを数えない。
-- 注文の行がまだ無い記録（作りかけで落ちた）も数えない。
-- こうしておくと、申込みを作れなかったときに
-- **クーポンの残り回数だけが減る、が起きない。**
-- ═══════════════════════════════════════════════════════════

-- ── 広告費の支払い先 ───────────────────────
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  -- 相手の名前（屋号・会社名）。請求と突き合わせるので、正式な名前で
  name       text not null,
  -- 連絡先。メールでも電話でもよい
  contact    text,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;

-- ── クーポン ───────────────────────────────
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  -- 打ち込む文字。大文字でそろえる（打ち方の揺れは画面側で直す）
  code        text not null unique,
  -- 画面と明細に出す名前。「◯◯協会 会員割」
  name        text not null,
  -- 率（％）か、定額（税抜・円）か。**どちらか一方だけ**
  percent_off int  check (percent_off between 1 and 100),
  amount_off  int  check (amount_off > 0),
  constraint coupons_one_kind check ((percent_off is null) <> (amount_off is null)),
  -- 広告費の支払い先。無ければ、ただの値引き（自社の販促）
  partner_id  uuid references public.partners (id) on delete set null,
  -- 広告費の率（％）。割引後の税抜売上に掛ける
  reward_rate int not null default 0 check (reward_rate between 0 and 100),
  starts_at   timestamptz,
  expires_at  timestamptz,
  -- 全体で何回まで使えるか。null なら無制限
  max_uses    int check (max_uses > 0),
  -- 1事業者あたり何回まで。紹介は1回、団体は無制限、という使い分け
  company_uses int check (company_uses > 0),
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.users (id) on delete set null
);
alter table public.coupons enable row level security;
create index if not exists coupons_partner_idx on public.coupons (partner_id);

-- ── 使われた記録 ───────────────────────────
create table if not exists public.coupon_uses (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete restrict,
  -- 申込みまるごとに1件。**同じ申込みに2枚は使えない**
  group_id    uuid not null unique,
  company_id  uuid references public.companies (id) on delete set null,
  user_id     uuid references public.users (id) on delete set null,
  -- 割引前の税抜
  gross       int not null check (gross >= 0),
  -- 値引き（税抜）
  discount    int not null check (discount >= 0),
  -- 割引後の税抜。**広告費の元はこれ**
  net         int not null check (net >= 0),
  -- 使った時の率。あとで率を変えても、ここは動かない
  reward_rate int not null check (reward_rate between 0 and 100),
  -- 広告費（円）
  reward      int not null check (reward >= 0),
  used_at     timestamptz not null default now()
);
alter table public.coupon_uses enable row level security;
create index if not exists coupon_uses_coupon_idx  on public.coupon_uses (coupon_id);
create index if not exists coupon_uses_company_idx on public.coupon_uses (company_id);

-- ── 注文に、使ったクーポンと値引きを持たせる ────
-- 値引きは**行ごと**に持つ。注文の行は講座ごとで、
-- 請求書は行を足して出す。行に配っておかないと、
-- 「合計だけ安いのに、明細を足すと合わない」請求書になる。
alter table public.orders add column if not exists coupon_id uuid references public.coupons (id) on delete set null;
alter table public.orders add column if not exists discount int not null default 0 check (discount >= 0);
create index if not exists orders_coupon_idx on public.orders (coupon_id);

-- ── 値引きの計算 ───────────────────────────
-- **画面（src/lib/coupon.ts）と、ここで同じ式を使う。**
-- 片方だけ直すと、見せた金額と請求する金額が食い違う。
-- 食い違いは tests/coupon.ts と supabase/tests/coupon.sql が見ている。
create or replace function public.coupon_discount(
  p_percent int, p_amount int, p_gross int
) returns int language sql immutable as $$
  select least(
    coalesce(
      case when p_percent is not null then (p_gross * p_percent) / 100 else p_amount end,
      0),
    greatest(p_gross, 0));
$$;

-- ── 使えるかどうかを見る（記録はしない）────
-- 申込みの画面が「いくら引けるか」を出すのに使う。
-- 断る理由は、次にやることが分かる文で返す。
create or replace function public.coupon_check(
  p_code text, p_company uuid, p_gross int
) returns table (ok boolean, reason text, coupon_id uuid, name text, discount int, reward_rate int)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons;
  n int;
begin
  select * into c from public.coupons where code = upper(btrim(p_code));
  if c.id is null then
    return query select false, 'そのクーポンはありません。打ち間違いがないか確かめてください。'::text,
                        null::uuid, null::text, 0, 0;
    return;
  end if;
  if not c.active then
    return query select false, 'そのクーポンは、いまお使いいただけません。'::text, c.id, c.name, 0, 0;
    return;
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return query select false, 'そのクーポンは、まだお使いいただけません。'::text, c.id, c.name, 0, 0;
    return;
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return query select false, 'そのクーポンは期限が切れています。'::text, c.id, c.name, 0, 0;
    return;
  end if;

  -- 使った回数。**取り消した申込みと、注文の行が無い記録は数えない**
  if c.max_uses is not null then
    select count(*) into n
      from public.coupon_uses u
     where u.coupon_id = c.id
       and exists (select 1 from public.orders o
                    where o.group_id = u.group_id and o.status <> 'cancelled');
    if n >= c.max_uses then
      return query select false, 'そのクーポンは、使える回数を超えています。'::text, c.id, c.name, 0, 0;
      return;
    end if;
  end if;

  if c.company_uses is not null and p_company is not null then
    select count(*) into n
      from public.coupon_uses u
     where u.coupon_id = c.id and u.company_id = p_company
       and exists (select 1 from public.orders o
                    where o.group_id = u.group_id and o.status <> 'cancelled');
    if n >= c.company_uses then
      return query select false, 'そのクーポンは、この事業者ではもうお使いになっています。'::text,
                          c.id, c.name, 0, 0;
      return;
    end if;
  end if;

  if p_gross <= 0 then
    return query select false, '金額が分かりません。'::text, c.id, c.name, 0, 0;
    return;
  end if;

  return query select true, null::text, c.id, c.name,
                      public.coupon_discount(c.percent_off, c.amount_off, p_gross), c.reward_rate;
end $$;

-- ── 使う（記録する）───────────────────────
-- **見るのと記録するのを、ひとつの関数の中でやる。**
-- 画面で見てから申し込むまでの間に、上限に達することがある。
-- 別々にすると、上限を1回だけ超える申込みが通ってしまう。
create or replace function public.use_coupon(
  p_code text, p_group uuid, p_company uuid, p_user uuid, p_gross int
) returns table (coupon_id uuid, name text, discount int, reward int)
language plpgsql security definer set search_path = public as $$
declare
  chk record;
  v_reward int;
begin
  if exists (select 1 from public.coupon_uses where group_id = p_group) then
    raise exception 'その申込みには、もうクーポンが使われています';
  end if;

  select * into chk from public.coupon_check(p_code, p_company, p_gross);
  if not chk.ok then
    raise exception '%', chk.reason;
  end if;

  -- 広告費は**割引後の税抜売上 ×％**（げんきさん 2026-09-09）
  v_reward := ((p_gross - chk.discount) * chk.reward_rate) / 100;

  insert into public.coupon_uses
    (coupon_id, group_id, company_id, user_id, gross, discount, net, reward_rate, reward)
  values
    (chk.coupon_id, p_group, p_company, p_user, p_gross, chk.discount,
     p_gross - chk.discount, chk.reward_rate, v_reward);

  return query select chk.coupon_id, chk.name, chk.discount, v_reward;
end $$;

-- ── 使うのをやめる ─────────────────────────
-- 注文を作れなかったときに呼ぶ。**残り回数だけが減る、を起こさない。**
-- 数え方（注文の行が無い記録は数えない）でも守っているが、
-- 記録そのものを残さない方が、あとで見たときに分かりやすい。
create or replace function public.release_coupon_use(p_group uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.coupon_uses where group_id = p_group;
$$;

revoke all on function public.coupon_check(text, uuid, int) from public, anon, authenticated;
revoke all on function public.use_coupon(text, uuid, uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.release_coupon_use(uuid) from public, anon, authenticated;
grant execute on function public.coupon_check(text, uuid, int) to service_role;
grant execute on function public.use_coupon(text, uuid, uuid, uuid, int) to service_role;
grant execute on function public.release_coupon_use(uuid) to service_role;
grant execute on function public.coupon_discount(int, int, int) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0032'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
