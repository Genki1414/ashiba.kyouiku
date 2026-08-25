-- ═══════════════════════════════════════════════════════════
-- 参加の申し込みが出ないときに、どこで食い違っているかを見る
--
-- Supabase の SQL Editor に貼って実行してください。
-- 会社が2つあって、受講者が別の会社に申し込んでいる、というのが
-- いちばん多い食い違いです。
-- ═══════════════════════════════════════════════════════════

-- ① 事業者の一覧。同じ名前が2つ並んでいたら、それが原因
select c.id,
       c.name        as 事業者名,
       c.join_code   as 参加コード,
       c.trial       as 無償利用,
       (select count(*) from public.users u where u.company_id = c.id)        as いまの所属,
       (select count(*) from public.memberships m
         where m.company_id = c.id and m.approved_at is not null and m.left_at is null) as 在籍,
       (select count(*) from public.memberships m
         where m.company_id = c.id and m.approved_at is null and m.left_at is null)     as 申し込み,
       (select count(*) from public.enrollments e where e.company_id = c.id)  as 受講,
       c.created_at
  from public.companies c
 order by c.created_at;

-- ② 人ごとの状態。誰がどの会社に、どの状態で紐付いているか
select u.name                          as 氏名,
       u.email,
       u.role,
       coalesce(cu.name, '（なし）')    as いまの所属,
       coalesce(cm.name, '（なし）')    as 在籍の相手,
       case
         when m.id is null            then '紐付けなし'
         when m.left_at is not null   then '抜けた'
         when m.approved_at is null   then '申し込み中'
         else '在籍中'
       end                             as 状態,
       m.requested_at, m.approved_at, m.left_at
  from public.users u
  left join public.companies  cu on cu.id = u.company_id
  left join public.memberships m  on m.user_id = u.id and m.left_at is null
  left join public.companies  cm on cm.id = m.company_id
 order by u.created_at;

-- ③ 教育担当者が見ている会社（この人の company_id が名簿の元になる）
select u.name as 担当者, u.email, u.company_id, c.name as 見ている事業者
  from public.users u
  left join public.companies c on c.id = u.company_id
 where u.role = 'admin';
