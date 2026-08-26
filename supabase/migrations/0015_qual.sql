-- ═══════════════════════════════════════════════════════════
-- 0015 よそで取った資格
--
-- 足場の職人が持っているものは、この仕組みの外で取ったものが多い。
-- 前の会社で受けた特別教育、教習機関で取った技能講習、免許。
--
-- 特別教育は「その業務に就かせる前に」行う決まりで、
-- すでに受けている人に受け直させる決まりではない。
-- ただ、事業者は「受けている」ことを確かめないと就かせられない。
-- 入ってきた人が何を持っているのか分からないと、
-- 受講コードを無駄に買うか、持っていない人を現場に出すことになる。
--
-- 決めたこと
--   ・本人がマイページから足す（自己申告）
--   ・現物（修了証）を見た会社が confirmed_at を立てる
--     自己申告のままでは「確かめた」ことにならない
--   ・見えるのは本人と、いま在籍している会社だけ
--   ・会社を移っても消さない。資格は人に付いてくるもの
--
-- この仕組みで出した修了証（certificates）とは別の表にする。
-- 混ぜると、こちらで出した記録と自己申告の区別が付かなくなる。
-- ═══════════════════════════════════════════════════════════

create table if not exists public.held_quals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  -- src/content/quals.ts の id。一覧に無いものは 'other'
  qual_id      text not null,
  -- 'other' のときの名前。本人が書く
  label        text,
  -- どこで受けたか（前の会社・教習機関）
  issuer       text,
  -- 取った日。分かる範囲で
  got_on       date,
  -- 修了証番号。分かれば
  cert_no      text,
  -- 会社が現物を見て確かめた
  confirmed_at timestamptz,
  confirmed_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 同じ資格を二重に足さない。'other' は名前が違えば何件でも
create unique index if not exists held_quals_one_idx
  on public.held_quals (user_id, qual_id) where qual_id <> 'other';
create index if not exists held_quals_user_idx on public.held_quals (user_id);

alter table public.held_quals enable row level security;

drop policy if exists held_quals_select_own on public.held_quals;
create policy held_quals_select_own on public.held_quals
  for select using (user_id = auth.uid());

-- いま在籍している人のぶんだけ、その会社から見える。
-- 抜けた人のぶんは見えない（資格は人に付いてくるもので、会社の記録ではない）
drop policy if exists held_quals_select_company on public.held_quals;
create policy held_quals_select_company on public.held_quals
  for select using (
    exists (
      select 1 from public.memberships m
       where m.user_id = public.held_quals.user_id
         and m.company_id = public.current_company_id()
         and m.approved_at is not null
         and m.left_at is null
    )
  );

-- ── 資格を足す ─────────────────────────────
-- 同じものが既にあれば、書き足すだけ（二重に増やさない）。
-- 中身を直すと、会社が確かめた印は落ちる。
-- 確かめたのは「そのとき見せられた紙」なので、書き換えたら確かめ直す。
create or replace function public.add_qual(
  p_user uuid, p_qual text, p_label text, p_issuer text,
  p_got date, p_cert text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(btrim(p_qual), '') = '' then
    raise exception '資格が選ばれていません';
  end if;
  if p_qual = 'other' and coalesce(btrim(p_label), '') = '' then
    raise exception 'その他を選んだときは、名前を書いてください';
  end if;

  if p_qual <> 'other' then
    select id into v_id from public.held_quals
     where user_id = p_user and qual_id = p_qual;
  end if;

  if v_id is not null then
    update public.held_quals
       set label = p_label, issuer = p_issuer, got_on = p_got, cert_no = p_cert,
           confirmed_at = null, confirmed_by = null
     where id = v_id;
    return v_id;
  end if;

  insert into public.held_quals (user_id, qual_id, label, issuer, got_on, cert_no)
  values (p_user, p_qual, p_label, p_issuer, p_got, p_cert)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.add_qual(uuid, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.add_qual(uuid, text, text, text, date, text) to service_role;

-- ── 資格を外す ─────────────────────────────
-- 自分のぶんだけ。間違えて足したときに戻せないと困る。
create or replace function public.drop_qual(p_user uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.held_quals where id = p_id and user_id = p_user;
end $$;

revoke all on function public.drop_qual(uuid, uuid) from public, anon, authenticated;
grant execute on function public.drop_qual(uuid, uuid) to service_role;

-- ── 現物を見て確かめた ─────────────────────
-- 押せるのは、その人がいま在籍している会社だけ。
-- 会社の番号を渡させて、在籍を数えてから立てる。
create or replace function public.confirm_qual(
  p_id uuid, p_company uuid, p_admin uuid, p_on boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.held_quals where id = p_id;
  if v_user is null then
    return false;
  end if;

  if not exists (
    select 1 from public.memberships m
     where m.user_id = v_user and m.company_id = p_company
       and m.approved_at is not null and m.left_at is null
  ) then
    raise exception '自社に在籍している人ではありません';
  end if;

  update public.held_quals
     set confirmed_at = case when p_on then now() else null end,
         confirmed_by = case when p_on then p_admin else null end
   where id = p_id;
  return true;
end $$;

revoke all on function public.confirm_qual(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.confirm_qual(uuid, uuid, uuid, boolean) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0015'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
