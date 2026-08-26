-- ═══════════════════════════════════════════════════════════
-- 0016 3年たった記録の、個人の部分を消せるようにする
--
-- 特別教育を行ったときは、受講者・科目等の記録を作成して
-- 3年間保存する決まり（安衛則 第38条）。
-- 教育を行っているのはこの仕組みなので、保存するのもこちら。
--
-- 一方で、要らなくなった個人情報は消すのが筋（個人情報保護法）。
-- 3年を過ぎたら、**個人の部分だけ**消せるようにする。
--
-- 決めたこと
--   ・自動では消さない。本部が、誰が消えるかを見てから押す
--     決まりの記録を、気づかないうちに消してはいけない
--   ・消すのは人ごと。その人の受講記録が**全部**3年より前のときだけ
--     よその会社でまだ1年目の受講が残っていたら、消せない
--   ・在籍しているうちは消さない。まだ働いている人だから
--   ・残すもの … 受講の記録（単元・時間・試験）、修了証の番号と日付
--     消すもの … 氏名・メール・生年月日、顔の照合ログ、自己申告の資格
--
--   修了証の番号を残すのは、元請や監督署が番号で照会するため。
--   照会の画面は前から名前を伏せ字にしてあるので、番号だけで足りる。
--   「何人に受けさせたか」も、名前を消しても数えられる。
-- ═══════════════════════════════════════════════════════════

-- いつ消したか。消した人をもう一度数えないための印でもある
alter table public.users add column if not exists erased_at timestamptz;
create index if not exists users_erased_idx on public.users (erased_at);

-- ── 個人の部分を消す ───────────────────────
-- 消せるかどうかの見極め（3年たっているか・在籍していないか）は
-- 呼ぶ側で行う。ここは「消す」だけを受け持つ。
-- ただし、在籍している人だけは念のためここでも止める。
-- 押し間違いで、いま働いている人の名前が消えると取り返しがつかない。
create or replace function public.erase_learner(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.users where id = p_user;
  if v_name is null then
    return false;
  end if;

  if exists (
    select 1 from public.memberships m
     where m.user_id = p_user and m.approved_at is not null and m.left_at is null
  ) then
    raise exception 'まだ事業者に在籍している人は消せません';
  end if;

  -- 顔の照合ログ。誰がいつ止まったかは、個人の記録そのもの
  delete from public.verify_logs v
   using public.enrollments e
   where v.enrollment_id = e.id and e.user_id = p_user;

  -- よそで取った資格（自己申告）
  delete from public.held_quals where user_id = p_user;

  -- 氏名・メール・生年月日。受講の記録そのものは残す
  update public.users
     set name       = '（削除済み）',
         email      = null,
         birth_date = null,
         erased_at  = now()
   where id = p_user;

  return true;
end $$;

revoke all on function public.erase_learner(uuid) from public, anon, authenticated;
grant execute on function public.erase_learner(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0016'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
