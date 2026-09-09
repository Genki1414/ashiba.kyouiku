-- ═══════════════════════════════════════════════════════════
-- 0034 LINE の紐付けを、店ごとに持つ
--
-- げんきさんの報告（2026-09-09）「設定が帰ってこない」。
--
-- ── 何が起きていたか ──
-- 足場屋革命-教育と特別教育ドットコムは、**別のLINE公式アカウント**で、
-- **別のプロバイダー**にある。LINE の利用者番号はプロバイダーごとに
-- 決まるので、**同じ人でも、店が違えば番号が違う。**
--
-- ところが 0033 では users.line_user_id という**1つの欄**に入れていた。
-- 二つの店を使う人（運営がまさにそう）が両方でログインすると、
-- あとから入った店の番号で**上書きされる。**
--   ・先に入れた店では、知らせが届かなくなる（番号が合わない）
--   ・その店のトークで「設定」と送っても、誰か分からず黙る
--
-- 上書きは静かに起きる。画面には何も出ない。**いちばん困る出方**をする。
--
-- ── どう直すか ──
-- 人と店の組で1行にする。1人が店の数だけ番号を持てる。
--
-- ── 決めたこと ──
-- ・**1つの店の中では、1つの番号は1人にだけ**（unique）。
--   ここが緩いと、よその人の受講記録に入れてしまう
-- ・**本人には触らせない。**RLS は誰にも開けない（service_role だけ）。
--   触れると、まだ誰も使っていない番号を自分に付けて、
--   あとからその番号で来た人を乗っ取れる
-- ・users.line_user_id は**消さない。**0033 で入った行があるかもしれず、
--   消すと何があったのか追えなくなる。これから先は読まない
--   （次に LINE でログインした時に、こちらへ入り直る）
-- ═══════════════════════════════════════════════════════════

create table if not exists public.line_links (
  -- この仕組みの利用者
  user_id      uuid not null references public.users (id) on delete cascade,
  -- どの店か（src/content/brand.ts の id。ashibaya / tokubetsu）
  brand        text not null,
  -- その店のプロバイダーでの LINE 利用者番号
  line_user_id text not null,
  created_at   timestamptz not null default now(),
  -- 1人につき、1店1つ
  primary key (user_id, brand),
  -- 1店の中では、1つの番号は1人にだけ
  constraint line_links_brand_line_key unique (brand, line_user_id)
);

-- 番号から人を引く（届いたものが誰からか調べるとき）
create index if not exists line_links_line_idx
  on public.line_links (brand, line_user_id);

-- ── 誰にも開けない ─────────────────────────
-- 番号は、本人にも要らない（画面には出さない。運営の画面にだけ出す）。
-- 付け外しはサーバ（service_role）だけ。service_role は RLS を通らない。
alter table public.line_links enable row level security;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0034'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
