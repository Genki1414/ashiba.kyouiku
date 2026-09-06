-- ═══════════════════════════════════════════════════════════
-- 本番の Supabase に流すもの その2（2026年9月7日）
--
-- Supabase の SQL Editor に、このファイルを丸ごと貼って Run。
--
-- 中身は一つだけ
--   0028 席を、教育担当者が直接配る（受講コードを打たせない）
--
-- **9月6日のぶん（honban-2026-09-06.sql）を先に流してあること。**
-- まだなら、そちらを先に。版が 0027 になっていれば済んでいます。
--
-- **何度流しても同じ結果になります。**関数は「あれば作り直す」だけ。
-- **人のデータには触りません。**表も列も作らず、消す文もありません。
--
-- 最後に確かめの select が出ます。版 0028 と出れば流し終わりです。
-- ═══════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════
-- 0028 席を、教育担当者が直接配る
--
-- いままで、席（受講コード）を人に渡す道は1本だけだった。
--   担当者がコードの文字を伝える → 受講者が /join で打ち込む
--
-- 誰に受けさせるかが決まっているとき、この打ち込みは要らない手間で、
-- しかも間違いのもとになる。12文字を口頭やLINEで伝えると、
-- 打ち間違い・伝え間違いが出る。出れば「開かない」と言われて、
-- 担当者がもう一度調べることになる。
--
-- **受講リクエストから買った席は、送ってきた本人に配るのが決まっている。**
-- そこを人の手で突き合わせる意味は無い。
--
-- 決めたこと
--   ・担当者が「この人に、この講座の席」を選べば、その場で渡る
--   ・**渡せるのは、自社に在籍している人だけ**（よその人・辞めた人には渡せない）
--   ・渡すのは、自社が買った、その講座の、まだ使っていない席
--   ・**同じ講座の席を二重に渡さない**
--   ・渡したら、その人のその講座の受講リクエストは対応済みになる
--     （担当者が別に閉じ直さなくてよい）
--
-- **受講コードの方式は残す。** 無くさない。
--   ・その場に居ない人、まだ名簿に入っていない人には、コードを渡すしかない
--   ・画面が動かないときの逃げ道になる
-- 取り消しは、いままでどおり releaseSeat（受講コードを未使用に戻す）を使う。
-- ═══════════════════════════════════════════════════════════

-- ── 席を配る（教育担当者）─────────────────
-- 配れた席のコードを返す。画面に「◯◯さんに配りました」と出すため。
create or replace function public.assign_seat(
  p_company uuid, p_user uuid, p_course text, p_admin uuid
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_seat   public.seats;
  v_enroll uuid;
  v_seat_now uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません';
  end if;

  -- **在籍していない人には渡せない。**
  -- よその会社の人や、辞めた人に渡ると、席が戻らないまま消える。
  if not exists (
    select 1 from public.memberships
     where user_id = p_user and company_id = p_company
       and approved_at is not null and left_at is null
  ) then
    raise exception 'その人は、この事業者に在籍していません';
  end if;

  -- 同じ講座の席を二重に渡さない。
  -- 渡すと席が1枚無駄になり、名簿にも同じ講座が2つ並ぶ
  if exists (
    select 1 from public.enrollments
     where user_id = p_user and course_id = p_course and seat_id is not null
  ) then
    raise exception 'その人には、もうこの講座の席が渡っています';
  end if;

  -- 自社が買った、その講座の、まだ使っていない席。古いものから。
  -- **期限切れは配らない**（渡した先で開かない）
  select s.* into v_seat
    from public.seats s
    join public.orders o on o.id = s.order_id
   where o.company_id = p_company
     and o.course_id = p_course
     and s.used_by is null
     and (s.expires_at is null or s.expires_at >= now())
   -- 古い注文から順に使う。seats に日付は無いので、注文の日付で見る。
   -- 同じ注文の中では、コード順（毎回同じ順で出るように）
   order by o.created_at, s.code
   for update of s skip locked
   limit 1;

  if v_seat.id is null then
    raise exception 'その講座の、空いている席がありません';
  end if;

  update public.seats
     set used_by = p_user, used_at = now()
   where id = v_seat.id;

  v_enroll := public.enrollment_for(p_user, p_course);
  update public.enrollments
     set seat_id = v_seat.id,
         -- 受けた当時の会社。人が抜けても、記録はこの会社に残る
         company_id = p_company
   where id = v_enroll and seat_id is null;

  -- 入らなかったら（間に別の席が入った）、席を戻して知らせる
  select seat_id into v_seat_now from public.enrollments where id = v_enroll;
  if v_seat_now is distinct from v_seat.id then
    update public.seats set used_by = null, used_at = null where id = v_seat.id;
    raise exception 'その人には、もうこの講座の席が渡っています';
  end if;

  -- 頼まれていたぶんは、渡した時点で片付いたことにする。
  -- 担当者に「対応済みにする」をもう一度押させない
  update public.course_requests
     set handled_at = now(), handled_by = p_admin
   where user_id = p_user and course_id = p_course and handled_at is null
     and company_id = p_company;

  return v_seat.code;
end $$;

revoke all on function public.assign_seat(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.assign_seat(uuid, uuid, text, uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0028'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;


commit;

-- ═══════════════════════════════════════════════════════════
-- 確かめ
-- ═══════════════════════════════════════════════════════════
select '版' as なに, public.schema_version() as いま, '0028' as あるべき
union all
select '席を配る関数',
  (to_regprocedure('public.assign_seat(uuid,uuid,text,uuid)') is not null)::text, 'true'
union all
select '担当者だけが呼べる',
  (not has_function_privilege('authenticated','public.assign_seat(uuid,uuid,text,uuid)','execute'))::text, 'true'
union all
select '受講コードの道も残っている',
  (to_regprocedure('public.redeem_seat(text,uuid)') is not null)::text, 'true';
