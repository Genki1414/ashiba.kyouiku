-- ═══════════════════════════════════════════════════════════
-- 0021 会社を移ったら、教育担当者ではなくなる
--
-- 見つかった穴：
--   教育担当者かどうかは users.role='admin' と users.company_id で決めていた。
--   ところが会社を移す所（join_company / redeem_seat）は company_id だけ
--   書き換えて role をそのままにしていた。だから、
--
--     ① 新規登録して、適当な事業者を1つ作る（誰でもできる。role='admin' が付く）
--     ② よその会社の参加コード（8文字）か受講コード（12文字）を入れる
--     ③ その会社の教育担当者になってしまう
--
--   参加コードは一般の社員に配るもの。悪意が無くても、
--   自分の会社を作ってみた人が参加コードを入れた時点でこうなる。
--   なった人は、その会社の名簿・修了証の発行と取消・
--   その会社名義の発注・請求書まで見られる。
--
-- 直し方：
--   会社を移ったら role を降ろす。担当者は、移った先で
--   改めて指名してもらう（/api/admin/role）。
--   同じ会社に入り直したときは降ろさない（担当者が自分の受講コードを
--   引き換えただけで担当を外れる、というのは困る）。
-- ═══════════════════════════════════════════════════════════

create or replace function public.join_company(p_user uuid, p_company uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_now uuid;
begin
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'その事業者がありません';
  end if;

  -- いまの所属。移るのかどうかで、担当者を降ろすかが変わる
  select company_id into v_now from public.users where id = p_user;

  -- よその会社の在籍は閉じる（転職）。記録はその会社に残る
  update public.memberships
     set left_at = now()
   where user_id = p_user and company_id <> p_company
     and approved_at is not null and left_at is null;

  -- 申請中のものがあれば、それを許可する。無ければその場で入れる
  update public.memberships
     set approved_at = now()
   where user_id = p_user and company_id = p_company and left_at is null;

  if not found then
    insert into public.memberships (user_id, company_id, approved_at)
    values (p_user, p_company, now());
  end if;

  update public.users set company_id = p_company where id = p_user;

  -- ここが直したところ。**別の会社へ移ったときだけ**担当者を降ろす
  if v_now is distinct from p_company then
    update public.users set role = 'learner'
     where id = p_user and role = 'admin';
  end if;

  return p_company;
end $$;

revoke all on function public.join_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.join_company(uuid, uuid) to service_role;

-- ── 会社を抜けたら、担当者ではなくなる ──────
-- 抜けたあと company_id は空になるので currentAdmin は通らないが、
-- role を残しておくと、次にどこかへ入った瞬間に担当者に戻ってしまう。
create or replace function public.leave_company(p_user uuid, p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.memberships
     set left_at = now()
   where user_id = p_user and company_id = p_company and left_at is null;

  update public.users set company_id = null
   where id = p_user and company_id = p_company;

  update public.users set role = 'learner'
   where id = p_user and company_id is null and role = 'admin';
end $$;

revoke all on function public.leave_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_company(uuid, uuid) to service_role;

-- ── 取り違えを直す ──────────────────────────
-- すでに「作った会社と、いま居る会社が違う担当者」が居たら降ろす。
-- 自分の会社を作った人（companies.created_by）はそのまま。
update public.users u
   set role = 'learner'
 where u.role = 'admin'
   and u.company_id is not null
   and not exists (
     select 1 from public.companies c
      where c.id = u.company_id and c.created_by = u.id
   )
   -- その会社の担当者として、ほかに指名された形跡があるかは分からないので、
   -- 在籍していない担当者だけを降ろす（安全側）
   and not exists (
     select 1 from public.memberships m
      where m.user_id = u.id and m.company_id = u.company_id
        and m.approved_at is not null and m.left_at is null
   );

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0021'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
