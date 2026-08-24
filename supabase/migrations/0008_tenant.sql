-- 0008_tenant.sql
-- 外販（複数の事業者が同じ仕組みを使う）を前提にした直し。
--
-- ① 事業者ごとに参加コードを持たせる。受講者はコードで自分の事業者に入る
-- ② 登録しただけの人を、どこかの事業者へ勝手に入れない
-- ③ 証明番号を、番号が尽きても衝突しない形にする
--
-- 0007 までは「1社で使う」前提が残っていた。そのまま外販すると
-- ・他社の受講者が自社の名簿に混ざる
-- ・2社目の教育担当者が決められない
-- ・同じ月に1万件を超えると修了証が発行できなくなる

-- ── ① 参加コードと、事業者を作った人 ──────
alter table public.companies
  add column if not exists join_code  text,
  add column if not exists created_by uuid references public.users (id) on delete set null;

create unique index if not exists companies_join_code_idx
  on public.companies (join_code) where join_code is not null;

comment on column public.companies.join_code is
  '受講者が自分の事業者に入るための合言葉。教育担当者が配る';
comment on column public.companies.responsible_name is
  '教育実施責任者。修了証にこの名前が載る';

-- すでにある事業者にも参加コードを配っておく（画面から押さなくてよいように）。
-- 紙に書いて渡すので、読み違えやすい字（0/1/O/I/L）は使わない。
create or replace function public.gen_join_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(
           substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 8)
$$;

do $$
declare
  r record;
  c text;
begin
  for r in select id from public.companies where join_code is null loop
    -- まれにぶつかる。ぶつかったら取り直す
    for i in 1..10 loop
      c := public.gen_join_code();
      begin
        update public.companies set join_code = c where id = r.id;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end $$;

-- ── ② 登録した人は、どこにも属さない状態から始める ──
-- 0007 では「事業者が1社だけならそこへ入れる」としていたが、
-- 外販だと2社目以降で他社の名簿に混ざる。所属は参加コードで決める。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '（氏名未登録）'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ③ 証明番号 ─────────────────────────────
-- もとは受講IDから4桁を作っていたので、同じ月に1万件を超えると必ずぶつかる。
-- ぶつかると cert_no の一意制約で発行が止まる（＝出せなくなる）。
-- 通し番号にして、ぶつからないようにする。
create sequence if not exists public.cert_no_seq start 1;

create or replace function public.next_cert_no()
returns text language sql volatile security definer set search_path = public as $$
  select 'AT-' || to_char(now() at time zone 'Asia/Tokyo', 'YYYYMM')
      || '-' || lpad(nextval('public.cert_no_seq')::text, 5, '0')
$$;

revoke all on function public.next_cert_no() from public, anon, authenticated;
grant execute on function public.next_cert_no() to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0008'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
