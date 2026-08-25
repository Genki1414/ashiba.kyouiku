-- ═══════════════════════════════════════════════════════════
-- 0010 受講中の照合に「別人」を足す
--
-- これまでの照合は、明るさとばらつきしか見ていなかった。
-- 手でレンズを塞いでも通ってしまうので、学習済みのモデルで
-- 顔そのものを見るようにした（端末の中で動く。映像は送らない）。
--
-- 見分けが付くようになった分、理由がひとつ増える。
--   not_me … 受講の準備で登録した人と違う
--
-- 記録するのは「外れた理由」だけ。
-- 顔の画像も特徴量も、これまでどおりサーバへは送らない。
-- ═══════════════════════════════════════════════════════════

alter type public.verify_reason add value if not exists 'not_me';

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0010'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
