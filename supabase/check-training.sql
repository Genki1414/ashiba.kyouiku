-- ═══════════════════════════════════════════════════════════
-- 実務トレーニングの記録が、担当者の画面に出ないときに見る
--
-- Supabase の SQL Editor に貼って実行してください。
--
-- 担当者の画面（/admin）は、
--   「その会社の、閉じていない受講」に紐づく記録だけを出します。
-- 出ない理由は、だいたいこの3つです。
--   ① そもそも1行も入っていない（結果の画面まで行っていない）
--   ② 練習（tutorial）だけ通した
--   ③ 受講の company_id が、その会社になっていない
-- ═══════════════════════════════════════════════════════════

-- ① 誰が、いつ、どの章を通したか。新しい順
select u.name                      as 氏名,
       t.chapter                   as 章,
       case when t.tutorial then '練習' else '本番' end as 種別,
       t.skill                     as 技能点,
       t.passed                    as 合否,
       t.created_at                as 通した日時
  from public.training_attempts t
  join public.enrollments e on e.id = t.enrollment_id
  join public.users       u on u.id = e.user_id
 order by t.created_at desc
 limit 50;

-- ② 1行も出なければ、まだ届いていません。
--    結果の画面（段位が出るところ）まで行かないと記録されません。
--    途中で閉じた・戻ったときは残りません。

-- ③ 受講の紐づけ。company_id が空だと、担当者の画面に出ません
select u.name                       as 氏名,
       e.course_id                  as 講座,
       coalesce(c.name, '（なし）')  as 受講の会社,
       e.closed_at                  as 閉じた日時,
       (select count(*) from public.training_attempts t
         where t.enrollment_id = e.id and not t.tutorial) as 本番,
       (select count(*) from public.training_attempts t
         where t.enrollment_id = e.id and t.tutorial)     as 練習
  from public.enrollments e
  join public.users     u on u.id = e.user_id
  left join public.companies c on c.id = e.company_id
 order by u.name;

-- ④ ③で「受講の会社」が（なし）や別の会社になっていたら、直す。
--    受講は「そのとき所属していた会社」を持ちます。
--    転職前の記録は前の会社に残す決まりなので、
--    直すのは「空のまま作られてしまった」ときだけにしてください。
--
-- update public.enrollments e
--    set company_id = u.company_id
--   from public.users u
--  where u.id = e.user_id
--    and e.company_id is null
--    and u.company_id is not null;
