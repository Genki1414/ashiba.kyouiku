-- ═══════════════════════════════════════════════════════════
-- 0038 クーポンを、あとから直せるようにする
--
-- げんきさんの依頼（2026-09-10）
--   「クーポンに編集と削除を追加して」
--
-- ── 直せるようにする前に、塞いでおくことがある ──
-- 請求書は、クーポンの名前を**そのつど coupons から読んで**
-- 「値引き（◯◯協会 会員割）」と出していた。
--
-- つまり、名前を直すと**もう渡した請求書の字まで変わる。**
-- 請求書は相手の手元にある書類で、こちらの都合で書き換わってはいけない。
-- 税務調査で出したものと、いま画面に出るものが違う、が起きる。
--
-- だから、使われた時の名前を記録に**焼き付ける。**
-- 使った時の率（reward_rate）を焼き付けてあるのと、同じ考え方。
--
--   使った時の名前  … coupon_uses.coupon_name（動かない。請求書はこれを見る）
--   いまの名前      … coupons.name（運営の画面と、これから使う人が見る）
--
-- ── 消すことについて ──
-- 表の作りで、**使われたクーポンは消せない**（coupon_uses が
-- on delete restrict で押さえている。0032）。ここは変えない。
-- 消したら、払った広告費の裏が取れなくなる。
-- 使う前に打ち間違えたクーポンだけ、消せればよい。
-- 使ったあとに配るのをやめたいときは「停止する」を使う。
-- ═══════════════════════════════════════════════════════════

-- ── 使われた時の名前を残す ─────────────────
alter table public.coupon_uses add column if not exists coupon_name text;

comment on column public.coupon_uses.coupon_name is
  '使われた時のクーポン名。請求書はこれを見る。あとで名前を直しても、渡した請求書の字は変わらない';

-- すでにある記録に、いまの名前を入れておく。
-- **これまで名前は変えられなかった**ので、いまの名前＝使った時の名前。
update public.coupon_uses u
   set coupon_name = c.name
  from public.coupons c
 where c.id = u.coupon_id
   and u.coupon_name is null;

-- ── 使うときに、名前も焼き付ける ───────────
-- 0032 の use_coupon に coupon_name を足しただけ。ほかは同じ。
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
    (coupon_id, coupon_name, group_id, company_id, user_id,
     gross, discount, net, reward_rate, reward)
  values
    (chk.coupon_id, chk.name, p_group, p_company, p_user,
     p_gross, chk.discount, p_gross - chk.discount, chk.reward_rate, v_reward);

  return query select chk.coupon_id, chk.name, chk.discount, v_reward;
end $$;

revoke all on function public.use_coupon(text, uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.use_coupon(text, uuid, uuid, uuid, int) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0038'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
