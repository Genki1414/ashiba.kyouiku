-- ═══════════════════════════════════════════════════════════
-- 0017 実務トレーニングの利用権
--
-- 第1章は、ログインすれば誰でも遊べる（試し）。
-- 第2章から先は、利用権を持っている人だけ。
--
-- 特別教育（学科）とは別の売り物にする。
-- 学科は「1人1枚の席」で、修了証が出る決まりのもの。
-- 実務トレーニングは修了証の要件ではないので、席とは分ける。
--
-- 決めたこと
--   ・利用権は**人**に付く。会社ではない
--     教育担当者を通さずに、本人が買えるようにするため。
--     会社を移っても持っていける（自分で買ったものだから）
--   ・付け方は3つ。いまは owner だけが動く
--       owner … 本部が手で付ける（振込を確認して付ける。いま使う道）
--       card  … カード払いが通ったら、webhook が付ける
--       code  … 会社がまとめて買って配る（受講コードと同じ形）
--   ・取り消せる。間違えて付けたときに戻せないと困る
--   ・無償利用の事業者に在籍している人は、利用権が無くても全部使える
--     （そちらは entitle 側で見る。ここには行を作らない）
-- ═══════════════════════════════════════════════════════════

create table if not exists public.training_access (
  user_id    uuid primary key references public.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.users (id) on delete set null,
  -- owner / card / code のどれで付いたか
  source     text not null default 'owner',
  -- 振込の日付・注文番号など。あとで突き合わせるため
  note       text,
  constraint training_access_source
    check (source in ('owner', 'card', 'code'))
);

alter table public.training_access enable row level security;

-- 自分のぶんは見える（画面に「使えます」と出すため）
drop policy if exists training_access_select_own on public.training_access;
create policy training_access_select_own on public.training_access
  for select using (user_id = auth.uid());

-- いま在籍している人のぶんは、その会社からも見える。
-- 担当者が「誰が使えるか」を把握できないと、配る判断ができない
drop policy if exists training_access_select_company on public.training_access;
create policy training_access_select_company on public.training_access
  for select using (
    exists (
      select 1 from public.memberships m
       where m.user_id = public.training_access.user_id
         and m.company_id = public.current_company_id()
         and m.approved_at is not null
         and m.left_at is null
    )
  );

-- ── 付ける ─────────────────────────────────
-- 何度押しても増えない。付け直すと、いつ・誰が・何でが上書きになる。
create or replace function public.grant_training(
  p_user uuid, p_by uuid, p_source text, p_note text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.users where id = p_user) then
    return false;
  end if;

  insert into public.training_access (user_id, granted_by, source, note)
  values (p_user, p_by, coalesce(nullif(btrim(p_source), ''), 'owner'), p_note)
  on conflict (user_id) do update
     set granted_at = now(),
         granted_by = excluded.granted_by,
         source     = excluded.source,
         note       = excluded.note;
  return true;
end $$;

revoke all on function public.grant_training(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_training(uuid, uuid, text, text) to service_role;

-- ── 取り消す ───────────────────────────────
-- 間違えて付けたときに戻せないと困る。
-- 遊んだ記録（training_attempts）は消さない。受けた事実は残す。
create or replace function public.revoke_training(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.training_access where user_id = p_user;
end $$;

revoke all on function public.revoke_training(uuid) from public, anon, authenticated;
grant execute on function public.revoke_training(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0017'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
