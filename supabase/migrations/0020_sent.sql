-- ═══════════════════════════════════════════════════════════
-- 0020 請求書を送ったこと
--
-- 買った側にも請求書を見せる。
-- 「送った」を立てるまでは知らせない。立てる前に知らせると、
-- まだ手元に届いていないのに「届いています」と出てしまう。
-- ═══════════════════════════════════════════════════════════

alter table public.orders
  add column if not exists invoiced_at timestamptz;

comment on column public.orders.invoiced_at is
  '請求書を相手に送った日時。買った側の画面に「請求書が届いています」を出す目印';

-- ── 送ったことにする ────────────────────────
-- 何度押しても、はじめに送った日時のまま（送り直しで日付が動かない）
create or replace function public.mark_invoiced(p_order uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_at timestamptz;
begin
  update public.orders
     set invoiced_at = coalesce(invoiced_at, now())
   where id = p_order
  returning invoiced_at into v_at;

  if v_at is null then
    raise exception 'その注文がありません';
  end if;
  return v_at;
end $$;

revoke all on function public.mark_invoiced(uuid) from public, anon, authenticated;
grant execute on function public.mark_invoiced(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0020'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
