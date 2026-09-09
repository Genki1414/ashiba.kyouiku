-- ═══════════════════════════════════════════════════════════
-- 0031 受講コードを指して、その人に配る
--
-- 0028 で「担当者が人と講座を選べば、その場で席が渡る」を入れた。
-- 席は**空いているものから自動で1枚**選んでいた。
--
-- げんきさんの依頼（2026-09-09）。
--   「担当者の受講コード画面からコードを配れるようにしたい」
--
-- 受講コードの一覧には、コードが1枚ずつ並んでいる。そこに「配る」を
-- 置くなら、**押したそのコードが渡らないとおかしい。**
-- 「EQ37 の札で配ったのに、相手には EPB7 が渡った」となると、
-- 担当者が口頭で確かめられなくなる。
--
-- だから assign_seat に「どのコードか」を渡せるようにする（p_code）。
-- 渡さなければ今までどおり、空いているものから自動で選ぶ。
-- 名簿の「席を配る」はそのまま動く。
--
-- 引数が増えるので、古い形（4つ）は消してから作り直す。
-- 消さないと、同じ名前の関数が2本並ぶ（呼ぶ側が迷う）。
--
-- もう1つ（同じ日の依頼）。
--   「取得済の資格には受講コード配布不可」
-- 修了証が出ている講座の席を、同じ人にもう一度渡すと、席が1枚無駄になる。
-- 席が渡ったあとに修了証が出るので、たいていは「もう渡っている」で
-- 止まるが、席を戻した（取り消した）あとは enrollments.seat_id が空に
-- 戻るので、そこを見るだけでは通ってしまう。修了証そのものを見る。
-- よそで取った資格（held_quals）は、講座との対応が画面側の一覧に
-- あるので、画面のサーバ側（/api/admin/assign）が見る。
-- ═══════════════════════════════════════════════════════════

drop function if exists public.assign_seat(uuid, uuid, text, uuid);

create or replace function public.assign_seat(
  p_company uuid, p_user uuid, p_course text, p_admin uuid,
  p_code text default null
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

  -- **取得済みの講座には渡さない。**修了証（取り消していないもの）が
  -- 出ている人に席を渡しても、受けるものが無い。席が1枚無駄になる
  if exists (
    select 1 from public.certificates c
    join public.enrollments e on e.id = c.enrollment_id
     where e.user_id = p_user and e.course_id = p_course
       and c.revoked_at is null
  ) then
    raise exception 'その人は、この講座の修了証を取得済みです。取得済みの資格に受講コードは配れません';
  end if;

  -- 同じ講座の席を二重に渡さない。
  -- 渡すと席が1枚無駄になり、名簿にも同じ講座が2つ並ぶ
  if exists (
    select 1 from public.enrollments
     where user_id = p_user and course_id = p_course and seat_id is not null
  ) then
    raise exception 'その人には、もうこの講座の席が渡っています';
  end if;

  -- 自社が買った、その講座の、まだ使っていない席。
  -- **コードを指されたら、その1枚だけ。**指されなければ古いものから。
  -- **期限切れは配らない**（渡した先で開かない）
  select s.* into v_seat
    from public.seats s
    join public.orders o on o.id = s.order_id
   where o.company_id = p_company
     and o.course_id = p_course
     and s.used_by is null
     and (s.expires_at is null or s.expires_at >= now())
     and (p_code is null or s.code = p_code)
   -- 古い注文から順に使う。seats に日付は無いので、注文の日付で見る。
   -- 同じ注文の中では、コード順（毎回同じ順で出るように）
   order by o.created_at, s.code
   for update of s skip locked
   limit 1;

  if v_seat.id is null then
    if p_code is not null then
      -- 指したコードが配れない理由は4つある（よその会社・別の講座・
      -- 使用済み・期限切れ）。どれかは言わない。
      -- **よその会社のコードを打って「別の講座です」と返すと、
      -- そのコードが在ることを教えてしまう**
      raise exception 'その受講コードは配れません（使用済みか、期限切れか、この講座のものではありません）';
    end if;
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

revoke all on function public.assign_seat(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_seat(uuid, uuid, text, uuid, text) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0031'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
