-- apply-all.sql は、動いている本番に**もう一度流せる**か。
--
-- げんきさんの本番（2026-09-09、0034 を流したとき）
--   ERROR: 23505: could not create unique index "enrollments_one_per_user_idx"
--   DETAIL: Key (user_id)=(337a…) is duplicated.
--
-- ── なぜ落ちたか ──
-- 0004 が作る「1人1件」の索引は、0011 で外している
-- （講座が増えると成り立たないため）。
-- apply-all.sql は 0001 から順に流し直すので、0011 まで進んだ本番では
-- **0004 で作り直そうとして、いまのデータに弾かれる。**
-- 2つ以上の講座を受けている人が1人でも居れば、必ずここで止まる。
--
-- このファイルの約束は「何度実行しても壊れない」こと。
-- 約束が守られているかを、ここで確かめる。
--
-- 流し方（新しいデータベースに）
--   00-supabase-shim.sql → apply-all.sql → このファイル → apply-all.sql（2回目）
--   2回目が最後まで通れば通過。version が 0034 になる。

select set_config('test.role', 'service_role', false);

do $$
declare
  u uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  n int;
begin
  insert into public.companies (id, name) values (c, '二講座の会社');
  -- auth.users に入れると public.users の行が自動でできる（0004 の仕掛け）
  insert into auth.users (id) values (u);
  update public.users set company_id = c, name = '二講座の人', email = 'two@example.jp'
   where id = u;

  -- **本番で実際に居た形。**席なしで、2つの講座を受けている人
  insert into public.enrollments (user_id, course_id) values (u, 'ashiba'), (u, 'shokucho');

  select count(*) into n
    from public.enrollments where user_id = u and seat_id is null;
  if n < 2 then
    raise exception '種を作れていない（%件）', n;
  end if;
  raise notice 'expected: 席なしの受講が%件ある人を作った。この状態で apply-all.sql をもう一度流す', n;
end $$;
