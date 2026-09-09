-- ═══════════════════════════════════════════════════════════
-- 0030 「請求書を出した」も、申込みまるごと
--
-- 0029 で、複数の講座を一度にまとめて申し込めるようにした。
-- 請求書は group ごとに1枚、入金の確認も group まるごと。
--
-- **ところが「送ったことにする」印（invoiced_at）だけ、行ごとのままだった。**
--
-- 何が起きたか（2026-09-09、げんきさんの実機）。
--   ・本部の画面に、1回の申込みが3枚のカードで並ぶ
--   ・そのうち1枚で「請求書を出す」を押した
--   ・請求書そのものは group で1枚なので、42,900円で出る
--   ・**ところが買った側のホームには「4,950円」と出た。**
--     押した1行だけに印が付き、知らせはその行だけを数えていた
--
-- 請求書は1枚なのだから、出したかどうかも1つ。
-- 同じ group の行に、まとめて印を付ける。
--
-- **日付は動かさない。**すでに送ってある行の invoiced_at は、
-- そのまま（coalesce）。送り直しで日付が動くと、
-- 「いつ送ったか」が変わってしまう。
-- ═══════════════════════════════════════════════════════════

create or replace function public.mark_invoiced(p_order uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_at    timestamptz;
begin
  select group_id into v_group from public.orders where id = p_order;
  if v_group is null then
    raise exception 'その注文がありません';
  end if;

  /* 申込みまるごとに印を付ける。すでに付いている行の日付は動かさない */
  update public.orders
     set invoiced_at = coalesce(invoiced_at, now())
   where group_id = v_group;

  /* 返すのは、その申込みでいちばん古い日付。
     画面には「いつ送ったか」を1つだけ出す */
  select min(invoiced_at) into v_at from public.orders where group_id = v_group;
  return v_at;
end $$;

revoke all on function public.mark_invoiced(uuid) from public, anon, authenticated;
grant execute on function public.mark_invoiced(uuid) to service_role;

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0030'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
