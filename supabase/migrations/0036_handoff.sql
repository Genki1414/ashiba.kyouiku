-- ═══════════════════════════════════════════════════════════
-- 0036 ログインを、ホーム画面のアプリへ持ち込む
--
-- げんきさんの報告（2026-09-09）
--   「ホーム画面に追加したのに、ホーム画面に追加した所から
--     ログインするとネット版になる」
--
-- ── なぜ起きるか ──
-- LINEログインは access.line.me という**よそのサイト**へ一度出る。
-- iPhone のホーム画面アプリは、よそへ出た時点でブラウザに切り替わり、
-- そのまま戻ってこない。しかも**ホーム画面アプリとブラウザは
-- ログインの記憶が別**なので、ブラウザで入ってもアプリは入っていないまま。
--
-- パスワードの決め直しも、メールのリンクから戻るので同じことが起きる。
--
-- ── どうするか ──
-- ブラウザで入ったあと、**8文字の引き換えコード**を出す。
-- アプリでそれを打てば、アプリの側にログインが立つ。
--
-- ── 決めたこと ──
-- ・**1回きり。**使ったら消す。写真に撮られても、2回目は通らない
-- ・**5分で切れる。**画面を開きっぱなしにして、あとから使われない
-- ・**打ち間違えやすい字を使わない**（0/O、1/I/L を外した31字）。
--   受講コードと同じ字種（0009 の gen_code）
-- ・作り直すと、前のコードは消える。**同時に生きているのは1本だけ**
-- ・誰のものかはサーバだけが知る。コードから人を引けるのは service_role のみ
-- ═══════════════════════════════════════════════════════════

create table if not exists public.handoffs (
  -- 打ち込む8文字。大文字でそろえる
  code       text primary key,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists handoffs_user_idx on public.handoffs (user_id);

-- 誰にも開けない。付け外しはサーバ（service_role）だけ
alter table public.handoffs enable row level security;

-- ── 作る ───────────────────────────────────
-- 同じ人の古いコードは消す。**同時に生きているのは1本だけ。**
-- 何本も配ると、どれが有効か本人にも分からなくなる。
create or replace function public.make_handoff(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  i      int := 0;
begin
  if p_user is null then
    raise exception '誰のものか分かりません';
  end if;
  if not exists (select 1 from public.users where id = p_user) then
    raise exception 'その利用者がいません';
  end if;

  delete from public.handoffs where user_id = p_user;

  loop
    i := i + 1;
    -- 受講コードと同じ字種（0/O・1/I/L を外した31字）
    select string_agg(
             substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ',
                    1 + floor(random() * 31)::int, 1), '')
      into v_code
      from generate_series(1, 8);

    begin
      insert into public.handoffs (code, user_id, expires_at)
        values (v_code, p_user, now() + interval '5 minutes');
      return v_code;
    exception when unique_violation then
      -- ぶつかったら引き直す。31^8 なので、まず起きない
      if i > 5 then
        raise exception 'コードを作れませんでした';
      end if;
    end;
  end loop;
end $$;

-- ── 使う ───────────────────────────────────
-- **使ったら消す。**返すのは利用者の id だけ。
-- 切れていたら消したうえで断る（残しておく理由が無い）。
create or replace function public.use_handoff(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_row public.handoffs;
begin
  -- 掃除。切れたものを溜めない
  delete from public.handoffs where expires_at < now();

  select * into v_row from public.handoffs
   where code = upper(btrim(coalesce(p_code, '')))
   for update;

  if v_row.code is null then
    raise exception 'そのコードは使えません。作り直してください';
  end if;

  delete from public.handoffs where code = v_row.code;
  return v_row.user_id;
end $$;

revoke all on function public.make_handoff(uuid) from public, anon, authenticated;
revoke all on function public.use_handoff(text) from public, anon, authenticated;
grant execute on function public.make_handoff(uuid) to service_role;
grant execute on function public.use_handoff(text)  to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0036'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
