-- 0009_order.sql
-- 申込みと席（受講コード）、入金と修了証の紐付け。
--
-- ここまでは誰でも登録して、事業者を作って、全部使えていた。
-- 売り物にするので、
--   ① 何人ぶん買ったか（orders）と、1人1枚の席（seats）を配る
--   ② 入金が済むまで修了証を出さない（0003 の本来の決まりへ戻す）
-- ただし、いま使っている事業者を止めてしまわないよう、
-- すでにある事業者は「無償利用」として通す。

-- ── 無償利用の印 ───────────────────────────
-- 運営（東北三上機材）が許した事業者は、席が無くても修了証を出せる。
-- 新しく作った事業者は既定で false。＝席を買わないと修了証は出ない。
alter table public.companies
  add column if not exists trial boolean not null default false;

comment on column public.companies.trial is
  '無償利用。席が無くても修了証を出せる。運営だけが立てられる';

-- すでにある事業者は、いままで通り使えるようにしておく
update public.companies set trial = true where created_at < now();

-- ── 注文に「誰が申し込んだか」と請求先を持たせる ──
alter table public.orders
  add column if not exists ordered_by  uuid references public.users (id) on delete set null,
  add column if not exists bill_to     text,
  add column if not exists note        text;

-- ── 席の有効期限は既定で1年 ────────────────
-- 特別教育に期限は無いが、売った席がいつまでも残ると数が合わなくなる。
alter table public.seats
  alter column expires_at set default (now() + interval '1 year');

-- ── 受講コードの採番 ───────────────────────
-- 12文字。読み違えやすい 0・1・O・I・L は使わない（参加コードと同じ字）。
-- 参加コードは8文字なので、桁で見分けられる。
create or replace function public.gen_seat_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 12)
$$;

-- ── 修了証は入金確認まで出さない（本来の決まりへ戻す）──
-- 0005 では「席が無ければ通す」としていた。決済が無かったため。
-- ここからは
--   ・席がある … その注文が入金済みでなければ出さない
--   ・席が無い … 事業者が無償利用（trial）のときだけ通す
create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat   uuid;
  v_user   uuid;
  v_trial  boolean;
  v_status public.order_status;
begin
  select e.seat_id, e.user_id into v_seat, v_user
    from public.enrollments e where e.id = new.enrollment_id;

  if v_seat is null then
    select c.trial into v_trial
      from public.users u
      join public.companies c on c.id = u.company_id
     where u.id = v_user;
    if coalesce(v_trial, false) then
      return new;
    end if;
    raise exception '受講コードがありません。申込みと入金を確かめてください';
  end if;

  select o.status into v_status
    from public.seats  s
    join public.orders o on o.id = s.order_id
   where s.id = v_seat;

  if v_status is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;
  if v_status <> 'paid' then
    raise exception '未入金の注文です。修了証は発行できません';
  end if;
  return new;
end $$;

-- ── 席を1つ引き換える ──────────────────────
-- 同時に2人が同じコードを入れても、1人しか通らないようにする
-- （行を掴んでから使用済みにする）。
create or replace function public.redeem_seat(p_code text, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seat    public.seats;
  v_company uuid;
begin
  select * into v_seat from public.seats
   where code = upper(btrim(p_code))
   for update;

  if v_seat.id is null then
    raise exception 'そのコードの席がありません';
  end if;
  if v_seat.used_by is not null and v_seat.used_by <> p_user then
    raise exception 'その受講コードは、もう使われています';
  end if;
  if v_seat.expires_at is not null and v_seat.expires_at < now() then
    raise exception 'その受講コードは期限切れです';
  end if;

  select o.company_id into v_company from public.orders o where o.id = v_seat.order_id;
  if v_company is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;

  if v_seat.used_by is null then
    update public.seats
       set used_by = p_user, used_at = now()
     where id = v_seat.id;
  end if;

  update public.users set company_id = v_company where id = p_user;

  -- その人の受講に席を紐づける（まだ受講が無ければ、あとで作られる分に付く）
  update public.enrollments
     set seat_id = v_seat.id
   where user_id = p_user and seat_id is null;

  return v_company;
end $$;

revoke all on function public.redeem_seat(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_seat(text, uuid) to service_role;
revoke all on function public.gen_seat_code() from public, anon, authenticated;
grant execute on function public.gen_seat_code() to service_role;

-- ── 1人1受講の索引を外す ───────────────────
-- 0004 では「席が無い受講は1人1件」としていた。
-- 席を紐づけると seat_id が入るので、この索引には当たらなくなる。そのままでよい。

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0009'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
