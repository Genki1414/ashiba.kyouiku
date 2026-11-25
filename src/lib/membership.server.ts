import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, DEFAULT_PLANS, jstDate, type Plan } from "./membership";
import { getServiceClient } from "./supabase/server";

/* 会員制度の、サーバだけの部分。

   ── 出すかどうかは環境変数で決める（指示書 §17）──
   「本番環境へのデプロイは確認・承認後に実施すること」。
   このリポジトリは push したものがそのまま本番に出る。
   だから、作った画面と口は **MEMBERSHIP_ENABLED=1 のときだけ**開く。
   付けないあいだは、LP も申込みも運営の札も、無いのと同じ（404）。
   データベースの表（0040）は先に入っていてよい。使わなければ何も起きない。 */

export const membershipEnabled = (): boolean => {
  const v = (process.env.MEMBERSHIP_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
};

/** 画面に出す形へ */
export function planOf(r: Record<string, unknown>): Plan {
  return {
    id: r.id as string,
    kind: (r.kind as "member" | "agency") ?? "member",
    name: (r.name as string) ?? "",
    monthlyFee: Number(r.monthly_fee) || 0,
    ticketAmount: Number(r.ticket_amount) || 0,
    ticketMonths: Number(r.ticket_months) || 12,
    public: r.public !== false,
    sortOrder: Number(r.sort_order) || 0,
    note: (r.note as string) ?? "",
  };
}

/** プランを読む。読めなかったら理由を返す（「0件」に化けさせない。docs/100） */
export async function listPlans(
  supabase: SupabaseClient,
  opts: { kind?: "member" | "agency"; all?: boolean } = {},
): Promise<{ ok: true; plans: Plan[] } | { ok: false; reason: string }> {
  let q = supabase
    .from("plans")
    .select("id, kind, name, monthly_fee, ticket_amount, ticket_months, public, sort_order, note")
    .order("sort_order", { ascending: true });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (!opts.all) q = q.eq("public", true);
  const { data, error } = await q;
  if (error) return { ok: false, reason: error.message };
  return { ok: true, plans: (data ?? []).map((r) => planOf(r as Record<string, unknown>)) };
}

export type Balance = { total: number; expiring: number; nextExpire: string | null };

/** チケットの残高（SQL の ticket_balance） */
export async function ticketBalance(
  supabase: SupabaseClient,
  contractId: string,
): Promise<{ ok: true; balance: Balance } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc("ticket_balance", { p_contract: contractId });
  if (error) return { ok: false, reason: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { total: number | null; expiring: number | null; next_expire: string | null }
    | undefined;
  return {
    ok: true,
    balance: {
      total: Number(row?.total) || 0,
      expiring: Number(row?.expiring) || 0,
      nextExpire: row?.next_expire ?? null,
    },
  };
}

/** その事業者の、いま開いている契約（入金待ち・有効・停止中のどれか）。無ければ null */
export async function openContract(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ ok: true; contract: Record<string, unknown> | null } | { ok: false; reason: string }> {
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id, company_id, plan_id, kind, status, method, started_on, ends_on, next_due_on, referrer_id, note, created_at, ended_at",
    )
    .eq("company_id", companyId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, reason: error.message };
  return { ok: true, contract: (data as Record<string, unknown>) ?? null };
}

/** 運営の操作ログ。失敗しても処理は通す（ログが本体ではない） */
export async function adminLog(
  supabase: SupabaseClient,
  actor: string,
  action: string,
  target: string | null,
  detail: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  const { error } = await supabase.from("admin_logs").insert({
    actor,
    action,
    target,
    before: detail.before ?? null,
    after: detail.after ?? null,
  });
  if (error) console.error("admin_logs に残せません:", error.message);
}

/* ── 月次：次の月の入金行を起こす ──

   有効な契約の next_due_on（翌月1日）が **10日以内**に来るものに、
   その月の入金行を起こす（open_contract_payment。もうあれば何もしない）。
   請求書はこれが元。運営が「相手に知らせる」を押して送る。
   前払いなので、月が替わる前に請求書が出ていないと払えない。

   Vercel Cron（/api/cron/members）と、運営の画面の「今月分を起こす」の両方から呼ぶ。 */
export async function openDuePayments(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ ok: true; opened: number; contracts: number } | { ok: false; reason: string }> {
  const until = addDays(jstDate(now), 10);
  const { data, error } = await supabase
    .from("contracts")
    .select("id, next_due_on")
    .eq("status", "active")
    .not("next_due_on", "is", null)
    .lte("next_due_on", until);
  if (error) return { ok: false, reason: error.message };
  let opened = 0;
  for (const c of data ?? []) {
    const month = `${String(c.next_due_on).slice(0, 7)}-01`;
    const { data: before } = await supabase
      .from("contract_payments")
      .select("id")
      .eq("contract_id", c.id as string)
      .eq("period_month", month)
      .maybeSingle();
    if (before) continue;
    const { error: e } = await supabase.rpc("open_contract_payment", { p_contract: c.id, p_month: month });
    if (e) {
      console.error("入金行を起こせません:", c.id, e.message);
      continue;
    }
    opened++;
  }
  return { ok: true, opened, contracts: (data ?? []).length };
}

/** LP に出すプラン。データベースを読めなければ seed と同じ既定値（console.error を残す）。
    LP は登録前の人が読むので、読めないからと空にはしない（値段が無い案内は案内ではない）。
    運営が画面で直した額は、読めているときだけ出る */
export async function plansForLp(kind: "member" | "agency"): Promise<{ plans: Plan[]; live: boolean }> {
  const fallback = DEFAULT_PLANS.filter((p) => p.kind === kind).map((p, i) => ({ ...p, id: `default-${kind}-${i}` }));
  const supabase = getServiceClient();
  if (!supabase) return { plans: fallback, live: false };
  const r = await listPlans(supabase, { kind });
  if (!r.ok) {
    console.error("LP のプランを読めません:", r.reason);
    return { plans: fallback, live: false };
  }
  return { plans: r.plans.length ? r.plans : fallback, live: r.plans.length > 0 };
}
