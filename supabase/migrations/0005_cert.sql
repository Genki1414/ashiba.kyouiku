-- 0005_cert.sql
-- 修了証を出せる条件のうち「入金」の扱い。
--
-- もとの決まり（0003）は、受講コードに紐づく注文が入金済みでなければ
-- 修了証を出さない、というものでした。請求書払いでも資格証だけは止める、という趣旨です。
--
-- ただ、いまはまだ決済の仕組みがありません。
-- 受講コードを持たない受講（自分で登録した人）は注文そのものが無いので、
-- もとの決まりのままだと **誰にも修了証が出せません**。
--
-- そこで、
--   ・受講コードがある受講 … これまでどおり入金済みでなければ出さない（趣旨はそのまま）
--   ・受講コードが無い受講 … いまは通す（社内での無償利用とみなす）
-- とします。
--
-- ※ 決済を入れて席（seats）を配る形にしたら、下の「受講コードが無いとき」の
--    分岐を消してください。そうすれば、もとの決まりに戻ります。

create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat   uuid;
  v_status public.order_status;
begin
  select e.seat_id into v_seat from public.enrollments e where e.id = new.enrollment_id;

  -- 受講コードが無い受講。決済の仕組みが入るまでは通す
  if v_seat is null then
    return new;
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

-- 1受講につき有効な修了証は1枚（取り消したものは残す）
create unique index if not exists certificates_one_active_idx
  on public.certificates (enrollment_id)
  where revoked_at is null;
