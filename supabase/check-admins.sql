-- ═══════════════════════════════════════════════════════════
-- 0021 を流したあとの確認
--
-- 0021 は「会社を移ったら教育担当者ではなくなる」ようにしたもの。
-- 流したときに、取り違えていた担当者（自分が作った会社ではないのに
-- 担当者になっていた人）が降ります。
--
-- 降ろす条件は安全側に寄せてあります。
--   ・その会社を作った本人（companies.created_by）は降ろさない
--   ・その会社に在籍している人も降ろさない
-- どちらでもない人だけが降ります。
--
-- Supabase の SQL Editor に貼って実行してください。
-- ═══════════════════════════════════════════════════════════

-- ① いま誰が教育担当者か
select u.name                                as 氏名,
       u.email,
       coalesce(c.name, '（所属なし）')       as 事業者,
       case when c.created_by = u.id
            then '作った本人' else '指名された人' end as 立場,
       case when exists (
              select 1 from public.memberships m
               where m.user_id = u.id and m.company_id = u.company_id
                 and m.approved_at is not null and m.left_at is null)
            then '在籍あり' else '★在籍なし（要確認）' end as 在籍
  from public.users u
  left join public.companies c on c.id = u.company_id
 where u.role = 'admin'
 order by c.name, u.name;

-- ② 版が 0021 になっているか
select public.schema_version() as 版;

-- ③ 担当者が1人も居ない事業者があると、その会社は名簿を見られません。
--    出てきたら、その会社の誰かを担当者にしてください
--    （その会社の担当者が /admin から「この人を教育担当者にする」）。
select c.name as 担当者が居ない事業者,
       (select count(*) from public.memberships m
         where m.company_id = c.id and m.approved_at is not null and m.left_at is null) as 在籍
  from public.companies c
 where not exists (
   select 1 from public.users u
    where u.company_id = c.id and u.role = 'admin')
 order by c.created_at;
