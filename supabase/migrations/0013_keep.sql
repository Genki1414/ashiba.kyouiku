-- ═══════════════════════════════════════════════════════════
-- 0013 受けた記録は消さない
--
-- 特別教育を行っているのは、この仕組みの運営（東北三上機材株式会社）です。
-- 修了証もその名義で出しています。
-- ということは、**記録を保存する義務はこの仕組みの側にあります**。
-- 受講者の勤め先が変わっても、受講コードを取り消しても、
-- 記録そのものは残っていなければなりません。
--
-- 0012 までの作りでは、受講コードの引き換えを取り消したときに
-- 視聴記録・試験・実務・照合ログを消していました。
-- 「買い直した席で法定時間を引き継がせない」ためでしたが、
-- 消してしまうと、行った教育の記録が残りません。
--
-- そこで、消すのをやめて **閉じる** ことにします。
--   ・取り消した受講は closed_at が入り、そこで終わり
--   ・同じ人が同じ講座をもう一度受けると、新しい受講が始まる（0から）
--   ・閉じた受講の記録は、そのまま残る
-- ═══════════════════════════════════════════════════════════

alter table public.enrollments
  add column if not exists closed_at timestamptz;

-- 開いている受講は、1人1講座につき1件。閉じたものは何件でも残せる
drop index if exists public.enrollments_one_per_user_course_idx;
create unique index if not exists enrollments_open_one_idx
  on public.enrollments (user_id, course_id) where closed_at is null;
create index if not exists enrollments_closed_idx
  on public.enrollments (user_id, course_id, closed_at);

-- ── 受講を1件だけ用意する（閉じたものは数えない）──
create or replace function public.enrollment_for(p_user uuid, p_course text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.courses where id = p_course) then
    raise exception 'その講座はありません（%）', p_course;
  end if;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course and closed_at is null;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.enrollments (user_id, course_id, company_id, started_at)
       select p_user, p_course, u.company_id, now()
         from public.users u where u.id = p_user
  on conflict do nothing;

  select id into v_id from public.enrollments
   where user_id = p_user and course_id = p_course and closed_at is null;
  return v_id;
end $$;

revoke all on function public.enrollment_for(uuid, text) from public, anon, authenticated;
grant execute on function public.enrollment_for(uuid, text) to service_role;

-- ── 受講コードの引き換えを取り消す ──────────
-- 席を未使用に戻し、その席で受けていた受講を閉じる。
-- 記録は消さない。次に受けるときは、新しい受講が0から始まる。
create or replace function public.release_seat(p_seat uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.enrollments
     set closed_at = now(), seat_id = null
   where seat_id = p_seat and closed_at is null;

  update public.seats
     set used_by = null, used_at = null
   where id = p_seat;
end $$;

revoke all on function public.release_seat(uuid) from public, anon, authenticated;
grant execute on function public.release_seat(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0013'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
