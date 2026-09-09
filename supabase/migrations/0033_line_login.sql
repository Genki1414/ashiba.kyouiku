-- ═══════════════════════════════════════════════════════════
-- 0033 LINE でログインできるようにする（下ごしらえ）
--
-- げんきさんの依頼（2026-09-09）。
--   「LINEで出来る方が利用率上がるよね」「LINEでログインかな」
--
-- ── なぜ要るか ──
-- 現場の職人は、メールを持っていない人・使っていない人が多い。
-- メールとパスワードで入る形は、そこで止まる。
-- パスワードを忘れたときの決め直しも、メールが読めないと詰む。
--
-- ── ここで足すもの ──
-- LINE の利用者番号（sub）を、この仕組みの利用者に結ぶ列。
-- **同じ人が2つの入り口（メールと LINE）から来ても、1人にまとめる**
-- ためのもの。分かれると、受講の記録も修了証も分かれてしまう。
--
-- ── 決めたこと ──
-- ・**1つの LINE 番号は、1人にだけ結ぶ**（unique）。
--   結び直しが起きると、よその人の受講記録に入れてしまう
-- ・番号そのものは公開しない。画面には出さない（本人にも要らない）
-- ・LINE の表示名は**修了証に使わない。**本名とは限らないため。
--   氏名はこれまでどおりマイページで入れてもらう
-- ═══════════════════════════════════════════════════════════

alter table public.users add column if not exists line_user_id text;

-- 1つの LINE 番号は1人にだけ。空は何人居てもよい
create unique index if not exists users_line_user_id_key
  on public.users (line_user_id) where line_user_id is not null;

-- ── 本人には書き換えさせない ───────────────
-- 0003 で「所属と権限は変更できません」を入れてある。同じ考えで、
-- **LINE の番号も本人には触らせない。**触れると、まだ誰も使っていない
-- 番号を自分に付けて、あとからその番号で入ってきた人を乗っ取れる。
-- 付け外しはサーバ（service_role）だけ。
create or replace function public.guard_users_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
    raise exception '所属と権限は変更できません';
  end if;
  if new.line_user_id is distinct from old.line_user_id then
    raise exception 'LINE の紐付けは変更できません';
  end if;
  return new;
end $$;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0033'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
