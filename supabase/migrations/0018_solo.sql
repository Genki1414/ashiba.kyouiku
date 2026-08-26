-- ═══════════════════════════════════════════════════════════
-- 0018 個人の注文
--
-- これまで注文は「事業者が席を買う」ものだけだった。
-- 実務トレーニング（第2章から先）は、教育担当者を通さずに
-- 本人が買えるようにしたので、注文にも個人の形が要る。
--
-- 決めたこと
--   ・注文は「会社のもの」か「個人のもの」かのどちらか
--     company_id か user_id の、どちらか片方だけが入る
--   ・何を買ったかを持つ（kind）
--       seat     … 特別教育の受講コード（1人1枚の席）。会社が買う
--       training … 実務トレーニングの利用権。会社でも個人でも買える
--   ・請求書の宛名は bill_to。個人なら本人の名前を入れる
--     個人宛の請求書を出せないと、経費で落とす人が買えない
--   ・入金を確認したら、個人の training の注文は利用権に変わる
-- ═══════════════════════════════════════════════════════════

-- 会社の注文でなくてもよくなる
alter table public.orders alter column company_id drop not null;

-- 個人が買ったとき、誰が買ったか
alter table public.orders add column if not exists user_id uuid
  references public.users (id) on delete set null;

-- 何を買ったか。今までのものは全部「席」
alter table public.orders add column if not exists kind text not null default 'seat';

-- 請求書の宛名と宛先。個人宛に出すために要る
alter table public.orders add column if not exists bill_addr text;

create index if not exists orders_user_idx on public.orders (user_id);
create index if not exists orders_kind_idx on public.orders (kind);

do $$
begin
  -- 会社のものか個人のものか、どちらか片方
  if not exists (
    select 1 from pg_constraint where conname = 'orders_owner_one'
  ) then
    alter table public.orders add constraint orders_owner_one
      check ((company_id is not null) <> (user_id is not null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_kind_ok'
  ) then
    alter table public.orders add constraint orders_kind_ok
      check (kind in ('seat', 'training'));
  end if;

  -- 席は会社しか買えない。個人に受講コードを配らせない
  -- （修了証は事業者の名簿に紐づくものなので、個人で持たせない）
  if not exists (
    select 1 from pg_constraint where conname = 'orders_seat_is_company'
  ) then
    alter table public.orders add constraint orders_seat_is_company
      check (kind <> 'seat' or company_id is not null);
  end if;
end $$;

-- 利用権の付き方に「注文」を足す（振込を確認した個人の注文）
alter table public.training_access drop constraint if exists training_access_source;
alter table public.training_access add constraint training_access_source
  check (source in ('owner', 'card', 'code', 'order'));

-- ── 個人の注文の入金を確認する ─────────────
-- 入金を立てて、そのまま利用権を付ける。
-- 2つに分けると、片方だけ通ったときに
-- 「払ったのに開かない」「開いているのに未入金」が起きる。
create or replace function public.pay_solo_order(p_order uuid, p_by uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if v.id is null then
    return false;
  end if;
  if v.user_id is null then
    raise exception '個人の注文ではありません';
  end if;
  if v.kind <> 'training' then
    raise exception 'この注文は実務トレーニングのものではありません';
  end if;

  if v.status <> 'paid' then
    update public.orders
       set status = 'paid', paid_at = now()
     where id = p_order;
  end if;

  insert into public.training_access (user_id, granted_by, source, note)
  values (v.user_id, p_by, 'order', '注文 ' || left(p_order::text, 8))
  on conflict (user_id) do update
     set granted_at = now(),
         granted_by = excluded.granted_by,
         source     = excluded.source,
         note       = excluded.note;

  return true;
end $$;

revoke all on function public.pay_solo_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pay_solo_order(uuid, uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0018'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
