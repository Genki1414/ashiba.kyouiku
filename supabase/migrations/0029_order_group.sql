-- ═══════════════════════════════════════════════════════════
-- 0029 複数の講座を、一度にまとめて申し込む
--
-- 注文は「1講座ぶん」で作ってある（orders.course_id は1つ）。
-- 受講コードは講座ごとに出るものなので、この形そのものは正しい。
--
-- ところが担当者は、まとめて頼みたい。
--   「足場5人、石綿3人、酸欠2人」
-- いまは3回申し込むことになる。**そして請求書が3枚出る。**
--
-- 請求書が3枚出ると、何が起きるか。
--   ・振込も3回になる（振込手数料も3回）
--   ・1回でまとめて振り込まれると、**どの請求書の入金か分からない**
--   ・本部の「入金を確認した」を3回押すことになり、押し忘れが出る
--     （押し忘れた講座だけ、受講コードが出ない）
--
-- だから **申込みをひとまとめにする印**を持たせる。
--   ・注文の行は今までどおり講座ごと（受講コードは講座ごとに出る）
--   ・同じ申込みで作った行は、同じ group_id を持つ
--   ・請求書は group ごとに1枚。講座ごとの行を並べて、合計をひとつ出す
--   ・入金の確認も group ごと。**振込は1回なので、立てるのも1回**
--
-- 1講座だけの申込みも、1行だけの group になる。**例外を作らない。**
-- 例外を作ると、請求書と入金確認に「group のとき／ないとき」の
-- 2本の道ができて、片方だけ直し忘れる。
-- ═══════════════════════════════════════════════════════════

alter table public.orders add column if not exists group_id uuid;

-- いまある注文は、それぞれが1行だけの申込み。
-- ここを埋めておかないと、古い請求書だけ開けなくなる。
update public.orders set group_id = id where group_id is null;

-- ── 入れ忘れを、仕組みで防ぐ ────────────────
-- 入れる道が増えたときに、group_id を書き忘れると
-- **その注文だけ請求書が出ない。**書き忘れても壊れないようにする。
create or replace function public.set_order_group()
returns trigger
language plpgsql
as $$
begin
  if new.group_id is null then
    new.group_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_group on public.orders;
create trigger orders_set_group
  before insert on public.orders
  for each row execute function public.set_order_group();

alter table public.orders alter column group_id set not null;

create index if not exists orders_group_id_idx on public.orders (group_id);

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0029'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
