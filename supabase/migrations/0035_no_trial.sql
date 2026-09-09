-- ═══════════════════════════════════════════════════════════
-- 0035 無償利用を撤廃する
--
-- げんきさんの依頼（2026-09-09）「無償利用は撤廃する」。
--
-- ── 何だったか ──
-- companies.trial（0009）を立てた事業者は、在籍している人が
-- **受講コードなしで学科も実務トレーニングも全部開けた。**
-- 試用・社内利用のための仕組みだったが、やめる。
-- 下見をさせたい相手にも、受講コードを配る形にそろえる。
--
-- ── ここで直すもの ──
-- 修了証の見張り（certificates_require_paid）に、
-- 「席が無くても、無償利用の事業者なら出す」という抜け道があった。
-- **画面側で無償利用を見なくしても、この抜け道は残る。**
-- 席の無い受講に修了証を挿し込めば、そのまま通ってしまう。
--
-- 席が無ければ、もう出せない。
--
-- ── 列は消さない ──
-- companies.trial は残す。**過去にどこを無償にしたかの記録**であり、
-- 消すと後から追えなくなる。読む所はもう無い（コードからも外した）。
--
-- ── 直近の講座しばりは 0011 のまま ──
-- 「その受講コードは別の講座のものです」は 0011 で入れてある。
-- ここでは触らない。
-- ═══════════════════════════════════════════════════════════

create or replace function public.certificates_require_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seat    uuid;
  v_course  text;
  v_status  public.order_status;
  v_ocourse text;
begin
  select e.seat_id, e.course_id into v_seat, v_course
    from public.enrollments e where e.id = new.enrollment_id;

  -- 席が無ければ出せない。**無償利用の抜け道は無くした（0035）**
  if v_seat is null then
    raise exception '受講コードがありません。申込みと入金を確かめてください';
  end if;

  select o.status, o.course_id into v_status, v_ocourse
    from public.seats  s
    join public.orders o on o.id = s.order_id
   where s.id = v_seat;

  if v_status is null then
    raise exception '受講コードに紐づく注文がありません';
  end if;
  if v_ocourse is distinct from v_course then
    raise exception 'その受講コードは別の講座のものです';
  end if;
  if v_status <> 'paid' then
    raise exception '未入金の注文です。修了証は発行できません';
  end if;
  return new;
end $$;

comment on column public.companies.trial is
  '無償利用（撤廃。0035 以降どこからも読まない。過去の記録として残す）';

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0035'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
