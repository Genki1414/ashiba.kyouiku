-- ═══════════════════════════════════════════════════════════
-- 0039 ひとりで受ける（個人の受講コード）
--
-- げんきさん（2026-09-17）「利用者が増えない。会社登録が邪魔してる気がする」
--   「1と3作って」（1＝ひとりで受ける、3＝無料の1単元）
--
-- ── これまで ──
-- 受講コード（席）は会社しか買えなかった（0018 の orders_seat_is_company）。
-- 投稿を見て来た人は1人なのに、会社を登録して自分を教育担当者にし、
-- 人数ぶん申し込み、出た受講コードを自分に配って引き換える、という
-- 7段の道を歩かされていた。会社の話が出た時点で「うちの話じゃない」と閉じる。
--
-- ── 決めたこと ──
--   ・受講コードの注文も、個人（user_id）で立ててよい
--     会社のものか個人のものか、どちらか片方（orders_owner_one）は変えない
--   ・個人の注文は、入金を確認した瞬間に**本人の席が立つ**（pay_solo_seat）
--     コードを配る・引き換える、という手順そのものを無くす。
--     席は1つ。二度呼ばれても増やさない
--   ・受講の記録（enrollments）は、その席に紐づける。修了証の門番
--     （certificates_require_paid）は席→注文→入金済みを見るので、そのまま通る
--   ・会社を作らない。名簿にも載らない。修了証は運営の名義で出る（今までどおり）
--
-- ── 変えないこと ──
--   ・redeem_seat（コードを打って引き換える）は会社の席のまま。
--     個人の席はコードを打たないので通らなくてよい
--   ・実務トレーニングの個人の注文（pay_solo_order）はそのまま
-- ═══════════════════════════════════════════════════════════

-- 席は会社しか買えない、をやめる
alter table public.orders drop constraint if exists orders_seat_is_company;

-- ── 個人の受講コードの注文の入金を確認する ─────────
-- 入金を立てて、そのまま本人の席を立て、受講の記録に紐づける。
-- 3つに分けると、片方だけ通ったときに
-- 「払ったのに開かない」「開いているのに未入金」が起きる。
create or replace function public.pay_solo_seat(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v        public.orders;
  v_seat   uuid;
  v_code   text;
  v_enroll uuid;
begin
  select * into v from public.orders where id = p_order for update;
  if v.id is null then
    return false;
  end if;
  if v.user_id is null then
    raise exception '個人の注文ではありません';
  end if;
  if v.kind <> 'seat' then
    raise exception 'この注文は受講コードのものではありません';
  end if;
  if v.course_id is null then
    raise exception 'この注文には講座がありません';
  end if;
  if v.status = 'cancelled' then
    raise exception '取り消された注文です';
  end if;

  if v.status <> 'paid' then
    update public.orders
       set status = 'paid', paid_at = now()
     where id = p_order;
  end if;

  -- 席は1つ。**二度呼ばれても増やさない**（Stripe の知らせは二度来ることがある）
  select id into v_seat from public.seats where order_id = p_order limit 1;
  if v_seat is null then
    v_code := public.gen_seat_code();
    insert into public.seats (order_id, code, used_by, used_at)
    values (p_order, v_code, v.user_id, now())
    returning id into v_seat;
  else
    update public.seats
       set used_by = v.user_id, used_at = now()
     where id = v_seat and used_by is null;
  end if;

  -- その講座の受講に付ける。無ければ作る（redeem_seat と同じ）
  v_enroll := public.enrollment_for(v.user_id, v.course_id);
  update public.enrollments
     set seat_id = v_seat
   where id = v_enroll and seat_id is null;

  return true;
end $$;

revoke all on function public.pay_solo_seat(uuid) from public, anon, authenticated;
grant execute on function public.pay_solo_seat(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0039'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
