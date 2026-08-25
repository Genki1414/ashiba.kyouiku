-- ═══════════════════════════════════════════════════════════
-- 0014 事業者を作った人の在籍
--
-- 事業者を作ると users.company_id は書いていたが、
-- 在籍（memberships）が立っていなかった。
-- そのため、
--   ・作った本人が自分の名簿に出ない
--   ・在籍で見る決まり（無償利用の判定）から漏れる
-- という形になっていた。
--
-- 作る側（/api/admin/setup）は join_company を通すように直した。
-- ここでは、それより前に作られた事業者ぶんを埋める。
--
-- 0012 の埋め戻しと同じ形。何度流しても増えない。
-- ═══════════════════════════════════════════════════════════

insert into public.memberships (user_id, company_id, approved_at)
select u.id, u.company_id, now()
  from public.users u
 where u.company_id is not null
   and not exists (
     select 1 from public.memberships m
      where m.user_id = u.id and m.left_at is null
   );

-- 事業者を作った人が、users.company_id ごと抜けていた場合の受け皿。
-- companies.created_by は残っているので、そこから起こす。
-- すでに在籍しているなら触らない（よその会社に移っている人を戻さない）。
insert into public.memberships (user_id, company_id, approved_at)
select c.created_by, c.id, now()
  from public.companies c
 where c.created_by is not null
   and not exists (
     select 1 from public.memberships m
      where m.user_id = c.created_by and m.left_at is null
   );

update public.users u
   set company_id = m.company_id
  from public.memberships m
 where m.user_id = u.id
   and m.approved_at is not null
   and m.left_at is null
   and u.company_id is distinct from m.company_id;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0014'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
