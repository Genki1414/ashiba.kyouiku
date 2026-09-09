-- ═══════════════════════════════════════════════════════════
-- 0037 どの LINE と繋がっているかを、画面に出せるようにする
--
-- げんきさんの依頼（2026-09-10）
--   「LINE どのLINEアカウントと繋がってるか表示」
--
-- ── なぜ要るか ──
-- マイページには「つながっています」としか出ていなかった。
-- **スマホを持ち替えた人・複数のLINEを使い分けている人**には、
-- どれと繋がっているのか分からない。知らせが届かないときに、
-- 「そもそも別のLINEに繋いでいた」を疑えない。
--
-- ── 何を持つか ──
-- LINE の表示名。**番号は画面に出さない**（本人にも要らない。
-- 運営の画面にだけ出す。0034 で決めたとおり）。
--
-- ── 決めたこと ──
-- ・**修了証には使わない。**表示名は本名とは限らない（0033 からの決まり）。
--   氏名はマイページで入れてもらう
-- ・繋ぎ直したら、そのときの表示名で上書きする。
--   相手が名前を変えることもあるので、古い名前を持ち続けない
-- ・空でもよい。LINE が名前を返さないことがある
-- ═══════════════════════════════════════════════════════════

alter table public.line_links add column if not exists display_name text;

comment on column public.line_links.display_name is
  'LINE の表示名。どのLINEと繋がっているかを本人に見せるためだけに使う。修了証には使わない';

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0037'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
