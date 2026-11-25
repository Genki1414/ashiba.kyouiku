import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { addNotices } from "@/lib/notice.server";
import { TERMS, commissionOf, mrrOf, normalizeRefCode } from "@/lib/membership";
import {
  adminLog,
  listPlans,
  membershipEnabled,
  planOf,
  runDaily,
} from "@/lib/membership.server";

/* 本部の「会員と報酬」（0040・docs/120）。運営だけ。

   GET  … 契約・入金・パートナー・報酬・目標と、いまの数字（MRR など）
   POST … 入金の確認／請求の起票／契約の変更／パートナーの承認／紹介元の変更／
          プランの編集／目標の編集／月次処理／報酬の支払い済み

   ── 数字の決め方 ──
   MRR   … 有効（active）な契約の月額（税抜）の合計。入金待ちは入れない
   ARR   … MRR × 12
   報酬  … 確定は commissions の行（入金のあった分）だけ。
           見込みは、有効な契約の月額 × 紹介元の率（まだ入金していない月のぶん）
   純売上 … MRR − その月に発生する報酬の見込み

   ── 二重に数えない・二度付けない ──
   入金の確認は SQL（pay_contract_payment）。もう paid なら何もしない。
   返金・取消も SQL。ここでは状態を直接書き換えない。 */

const closed = () => NextResponse.json({ ok: false, reason: "準備中です。" }, { status: 404 });

export async function GET() {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  const owner = await currentOwner();
  if (!owner) return NextResponse.json({ ok: false, reason: "運営だけの画面です。" }, { status: 403 });

  const [plans, cs, ps, sps, rf, cm, po, tg, lg] = await Promise.all([
    listPlans(supabase, { all: true }),
    supabase
      .from("contracts")
      .select("id, company_id, plan_id, kind, status, method, started_on, ends_on, next_due_on, cancel_requested_on, referrer_id, note, created_at, ended_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("contract_payments")
      .select("id, contract_id, period_month, net, tax, amount, ticket_amount, method, status, due_on, invoiced_at, paid_at, refunded_at")
      .order("period_month", { ascending: false }),
    supabase
      .from("sales_partners")
      .select("id, user_id, name, kind, status, code, rate, contact, note, approved_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("referrals").select("company_id, partner_id, code_used, source, locked_at"),
    supabase
      .from("commissions")
      .select("id, payment_id, partner_id, contract_id, period_month, base_net, rate, amount, kind, status, payout_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("commission_payouts").select("id, partner_id, period_month, total, status, paid_at").order("created_at", { ascending: false }),
    supabase.from("targets").select("deadline, mrr_min, mrr_goal, net_goal, partners_goal, contracts_goal").eq("id", 1).maybeSingle(),
    supabase.from("admin_logs").select("id, actor, action, target, after, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (!plans.ok) return NextResponse.json({ ok: false, reason: `プランを読めませんでした（${plans.reason}）` }, { status: 500 });
  const err = cs.error ?? ps.error ?? sps.error ?? rf.error ?? cm.error ?? po.error ?? tg.error ?? lg.error;
  if (err) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          `会員の表を読めませんでした（${err.message}）。` +
          "データベースの版が古いときは、Supabase の SQL Editor に supabase/apply-all.sql を貼って実行してください。",
      },
      { status: 500 },
    );
  }

  const contracts = cs.data ?? [];
  const partners = sps.data ?? [];
  const companyIds = [...new Set(contracts.map((c) => c.company_id as string))];
  const userIds = [...new Set(partners.map((p) => p.user_id as string))];
  const [{ data: cos, error: coErr }, { data: us, error: uErr }, bals] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    userIds.length
      ? supabase.from("users").select("id, email, name").in("id", userIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    Promise.all(
      contracts
        .filter((c) => c.status !== "ended")
        .map(async (c) => {
          const { data, error } = await supabase.rpc("ticket_balance", { p_contract: c.id });
          if (error) throw new Error(error.message);
          const r = (Array.isArray(data) ? data[0] : data) as { total: number; expiring: number; next_expire: string | null } | undefined;
          return [c.id as string, { total: Number(r?.total) || 0, expiring: Number(r?.expiring) || 0, nextExpire: r?.next_expire ?? null }] as const;
        }),
    ).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
  ]);
  if (coErr || uErr) return NextResponse.json({ ok: false, reason: `名前を読めませんでした（${(coErr ?? uErr)?.message}）` }, { status: 500 });
  if (bals instanceof Error) return NextResponse.json({ ok: false, reason: `残高を読めませんでした（${bals.message}）` }, { status: 500 });
  const balance = new Map(bals);
  const coName = new Map((cos ?? []).map((c) => [c.id as string, (c.name as string) ?? ""]));
  const user = new Map((us ?? []).map((u) => [u.id as string, u as Record<string, unknown>]));
  const plan = new Map(plans.plans.map((p) => [p.id, p]));
  const partner = new Map(partners.map((p) => [p.id as string, p as Record<string, unknown>]));
  const refOf = new Map((rf.data ?? []).map((r) => [r.company_id as string, r as Record<string, unknown>]));

  const payments = (ps.data ?? []).map((p) => ({
    id: p.id as string,
    contractId: p.contract_id as string,
    periodMonth: p.period_month as string,
    net: Number(p.net) || 0,
    tax: Number(p.tax) || 0,
    amount: Number(p.amount) || 0,
    ticketAmount: Number(p.ticket_amount) || 0,
    method: p.method as string,
    status: p.status as string,
    dueOn: (p.due_on as string) ?? null,
    invoicedAt: (p.invoiced_at as string) ?? null,
    paidAt: (p.paid_at as string) ?? null,
    refundedAt: (p.refunded_at as string) ?? null,
  }));
  const paysOf = new Map<string, typeof payments>();
  for (const p of payments) {
    const a = paysOf.get(p.contractId) ?? [];
    a.push(p);
    paysOf.set(p.contractId, a);
  }

  const outContracts = contracts.map((c) => {
    const pl = plan.get(c.plan_id as string) ?? null;
    const ref = refOf.get(c.company_id as string);
    const sp = ref ? partner.get(ref.partner_id as string) : null;
    return {
      id: c.id as string,
      companyId: c.company_id as string,
      company: coName.get(c.company_id as string) ?? "",
      kind: c.kind as string,
      status: c.status as string,
      method: c.method as string,
      startedOn: (c.started_on as string) ?? null,
      endsOn: (c.ends_on as string) ?? null,
      nextDueOn: (c.next_due_on as string) ?? null,
      cancelRequestedOn: (c.cancel_requested_on as string) ?? null,
      note: (c.note as string) ?? "",
      createdAt: c.created_at as string,
      plan: pl,
      referrer: sp ? { id: sp.id as string, name: sp.name as string, code: sp.code as string, locked: !!ref?.locked_at } : null,
      balance: balance.get(c.id as string) ?? { total: 0, expiring: 0, nextExpire: null },
      payments: paysOf.get(c.id as string) ?? [],
    };
  });

  const commissions = (cm.data ?? []).map((x) => ({
    id: x.id as string,
    paymentId: (x.payment_id as string) ?? null,
    partnerId: x.partner_id as string,
    contractId: (x.contract_id as string) ?? null,
    periodMonth: x.period_month as string,
    baseNet: Number(x.base_net) || 0,
    rate: Number(x.rate) || 0,
    amount: Number(x.amount) || 0,
    kind: x.kind as string,
    status: x.status as string,
    payoutId: (x.payout_id as string) ?? null,
    at: x.created_at as string,
  }));

  /* パートナーごとの数字。確定（commissions）と見込み（有効な契約 × 率）は分けて出す */
  const active = outContracts.filter((c) => c.status === "active");
  const outPartners = partners.map((p) => {
    const u = user.get(p.user_id as string);
    const mine = commissions.filter((x) => x.partnerId === p.id);
    const referred = active.filter((c) => c.referrer?.id === p.id);
    const rate = Number(p.rate) || 0;
    return {
      id: p.id as string,
      userId: p.user_id as string,
      email: (u?.email as string) ?? "",
      name: (p.name as string) ?? "",
      kind: (p.kind as string) ?? "individual",
      status: p.status as string,
      code: p.code as string,
      rate,
      contact: (p.contact as string) ?? "",
      note: (p.note as string) ?? "",
      approvedAt: (p.approved_at as string) ?? null,
      createdAt: p.created_at as string,
      contracts: outContracts.filter((c) => c.referrer?.id === p.id).length,
      activeContracts: referred.length,
      /* 確定（入金のあった分）。未払いと支払い済み */
      confirmed: mine.filter((x) => x.status === "confirmed").reduce((n, x) => n + x.amount, 0),
      paid: mine.filter((x) => x.status === "paid").reduce((n, x) => n + x.amount, 0),
      /* 見込み。来月以降、いまの契約が払い続けたときの月あたり */
      expectedMonthly: referred.reduce((n, c) => n + commissionOf(c.plan?.monthlyFee ?? 0, rate), 0),
    };
  });

  const mrr = mrrOf(active.map((c) => c.plan?.monthlyFee ?? 0));
  const expectedCommission = active.reduce((n, c) => {
    const sp = c.referrer ? partner.get(c.referrer.id) : null;
    return n + (sp && sp.status === "approved" ? commissionOf(c.plan?.monthlyFee ?? 0, Number(sp.rate) || 0) : 0);
  }, 0);

  return NextResponse.json({
    ok: true,
    plans: plans.plans,
    contracts: outContracts,
    partners: outPartners,
    commissions,
    payouts: (po.data ?? []).map((x) => ({
      id: x.id as string,
      partnerId: x.partner_id as string,
      periodMonth: x.period_month as string,
      total: Number(x.total) || 0,
      status: x.status as string,
      paidAt: (x.paid_at as string) ?? null,
    })),
    targets: {
      deadline: (tg.data?.deadline as string) ?? "2027-01-31",
      mrrMin: Number(tg.data?.mrr_min) || 0,
      mrrGoal: Number(tg.data?.mrr_goal) || 0,
      netGoal: Number(tg.data?.net_goal) || 0,
      partnersGoal: Number(tg.data?.partners_goal) || 0,
      contractsGoal: Number(tg.data?.contracts_goal) || 0,
    },
    dashboard: {
      mrr,
      arr: mrr * 12,
      /* 純売上の見込み。MRR から、その月に出る報酬を引く */
      net: mrr - expectedCommission,
      expectedCommission,
      activeContracts: active.length,
      pendingContracts: outContracts.filter((c) => c.status === "pending").length,
      approvedPartners: outPartners.filter((p) => p.status === "approved").length,
      pendingPartners: outPartners.filter((p) => p.status === "pending").length,
      pendingPayments: payments.filter((p) => p.status === "pending").length,
      confirmedUnpaid: commissions.filter((x) => x.status === "confirmed").reduce((n, x) => n + x.amount, 0),
      paidCommissions: commissions.filter((x) => x.status === "paid").reduce((n, x) => n + x.amount, 0),
      /* 現金で入った会費（税込）。返金は引かない（返金は入金行の状態で分かる） */
      cashIn: payments.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount, 0),
    },
    logs: (lg.data ?? []).map((l) => ({
      id: l.id as string,
      actor: (l.actor as string) ?? "",
      action: l.action as string,
      target: (l.target as string) ?? "",
      after: l.after ?? null,
      at: l.created_at as string,
    })),
  });
}

type Body = {
  action?: string;
  paymentId?: string;
  contractId?: string;
  companyId?: string;
  partnerId?: string | null;
  planId?: string;
  month?: string;
  status?: string;
  rate?: number;
  reason?: string;
  note?: string;
  plan?: {
    id?: string; kind?: string; name?: string; monthlyFee?: number; ticketAmount?: number;
    ticketMonths?: number; public?: boolean; sortOrder?: number; note?: string;
  };
  targets?: { deadline?: string; mrrMin?: number; mrrGoal?: number; netGoal?: number; partnersGoal?: number; contractsGoal?: number };
};

const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
};
const bad = (reason: string, status = 400) => NextResponse.json({ ok: false, reason }, { status });

export async function POST(req: NextRequest) {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  const owner = await currentOwner();
  if (!owner) return bad("運営だけの操作です。", 403);

  const b = (await req.json().catch(() => ({}))) as Body;
  const action = String(b.action ?? "");
  const log = (target: string | null, detail: { before?: unknown; after?: unknown } = {}) =>
    adminLog(supabase, owner, action, target, detail);

  switch (action) {
    /* ── 入金 ── */
    case "paid": {
      const id = String(b.paymentId ?? "").trim();
      if (!id) return bad("入金行が分かりません。");
      const { data, error } = await supabase.rpc("pay_contract_payment", { p_payment: id, p_by: owner, p_external: null });
      if (error) return bad(error.message, 409);
      if (data !== true) return bad("その入金行がありません。", 404);
      await log(id);
      /* 会社の担当者に知らせる（チケットが付いた）。残せなくても入金の確認は通す（知らせは飾り） */
      const { data: p, error: pErr } = await supabase.from("contract_payments").select("contract_id").eq("id", id).maybeSingle();
      const { data: c, error: cErr } = p
        ? await supabase.from("contracts").select("company_id").eq("id", p.contract_id as string).maybeSingle()
        : { data: null, error: null };
      const { data: admins, error: aErr } = c
        ? await supabase.from("users").select("id").eq("company_id", c.company_id as string).eq("role", "admin")
        : { data: [] as { id: string }[], error: null };
      const nErr = pErr ?? cErr ?? aErr;
      if (nErr) console.error("チケットの知らせの宛先を読めません:", nErr.message);
      else await addNotices((admins ?? []).map((a) => a.id as string), "tickets");
      return NextResponse.json({ ok: true });
    }
    case "invoiced": {
      const id = String(b.paymentId ?? "").trim();
      if (!id) return bad("入金行が分かりません。");
      const { error } = await supabase
        .from("contract_payments").update({ invoiced_at: new Date().toISOString() }).eq("id", id).is("invoiced_at", null);
      if (error) return bad(error.message, 500);
      await log(id);
      return NextResponse.json({ ok: true });
    }
    case "cancel_payment": {
      const id = String(b.paymentId ?? "").trim();
      if (!id) return bad("入金行が分かりません。");
      const { data, error } = await supabase
        .from("contract_payments").update({ status: "cancelled" }).eq("id", id).eq("status", "pending").select("id");
      if (error) return bad(error.message, 500);
      if (!data?.length) return bad("入金待ちの行だけ取り消せます。", 409);
      await log(id);
      return NextResponse.json({ ok: true });
    }
    case "refund": {
      const id = String(b.paymentId ?? "").trim();
      if (!id) return bad("入金行が分かりません。");
      const { error } = await supabase.rpc("refund_contract_payment", { p_payment: id, p_by: owner, p_note: String(b.note ?? "") });
      if (error) return bad(error.message, 409);
      await log(id, { after: { note: b.note ?? "" } });
      return NextResponse.json({ ok: true });
    }
    case "open": {
      /* その契約に、月の入金行を起こす。月を渡さなければ next_due_on の月 */
      const id = String(b.contractId ?? "").trim();
      if (!id) return bad("契約が分かりません。");
      const { data: c, error: cErr } = await supabase.from("contracts").select("next_due_on, status").eq("id", id).maybeSingle();
      if (cErr) return bad(cErr.message, 500);
      if (!c) return bad("その契約がありません。", 404);
      const month = /^\d{4}-\d{2}/.test(String(b.month ?? "")) ? `${String(b.month).slice(0, 7)}-01` : c.next_due_on ? `${String(c.next_due_on).slice(0, 7)}-01` : null;
      if (!month) return bad("月が分かりません。");
      const { data, error } = await supabase.rpc("open_contract_payment", { p_contract: id, p_month: month });
      if (error) return bad(error.message, 409);
      await log(id, { after: { month } });
      return NextResponse.json({ ok: true, paymentId: data as string, month });
    }
    case "month_open": {
      /* 日次処理を手で回す（cron と同じ：失効・自動更新・解約の終了・滞納の停止・翌月の起票） */
      const r = await runDaily(supabase);
      if (!r.ok) return bad(r.reason, 500);
      await log(null, { after: r });
      return NextResponse.json({ ok: true, opened: r.opened, contracts: r.contracts, expired: r.expired, renewed: r.renewed, ended: r.ended, suspended: r.suspended });
    }
    case "expire": {
      const { data, error } = await supabase.rpc("expire_tickets");
      if (error) return bad(error.message, 500);
      await log(null, { after: { expired: data } });
      return NextResponse.json({ ok: true, expired: Number(data) || 0 });
    }

    /* ── 契約 ── */
    case "contract_status": {
      const id = String(b.contractId ?? "").trim();
      const st = String(b.status ?? "");
      if (!id) return bad("契約が分かりません。");
      if (!["active", "suspended", "ended"].includes(st)) return bad("状態が分かりません。");
      /* 終了は SQL（end_contract）。残りのチケットの失効と入金待ちの取消を一度にやる */
      if (st === "ended") {
        const { data: expired, error } = await supabase.rpc("end_contract", { p_contract: id, p_by: owner, p_note: String(b.note ?? "") });
        if (error) return bad(error.message, 409);
        await log(id, { after: { status: "ended", expired: Number(expired) || 0, note: b.note ?? "" } });
        return NextResponse.json({ ok: true, expired: Number(expired) || 0 });
      }
      const { data: before, error: bErr } = await supabase.from("contracts").select("status").eq("id", id).maybeSingle();
      if (bErr) return bad(bErr.message, 500);
      if (!before) return bad("その契約がありません。", 404);
      if (before.status === "ended") return bad("終了した契約は変えられません。", 409);
      /* 入金待ちを手で有効にはしない（入金の確認を通す） */
      if (before.status === "pending" && st === "active") return bad("入金を確認すると有効になります。", 409);
      const patch: Record<string, unknown> = { status: st };
      if (st === "ended") patch.ended_at = new Date().toISOString();
      if (b.note) patch.note = String(b.note);
      const { error } = await supabase.from("contracts").update(patch).eq("id", id);
      if (error) return bad(error.message, 500);
      await log(id, { before: { status: before.status }, after: { status: st, note: b.note ?? "" } });
      return NextResponse.json({ ok: true });
    }
    case "cancel": {
      /* 解約の申し出（運営が代わりに受けた）。終了日は翌月末。終了そのものは cron（daily） */
      const id = String(b.contractId ?? "").trim();
      if (!id) return bad("契約が分かりません。");
      const { data: endsOn, error } = await supabase.rpc("cancel_contract", { p_contract: id, p_by: owner });
      if (error) return bad(error.message, 409);
      await log(id, { after: { endsOn } });
      return NextResponse.json({ ok: true, endsOn: endsOn as string });
    }
    case "contract_plan": {
      const id = String(b.contractId ?? "").trim();
      const planId = String(b.planId ?? "").trim();
      if (!id || !planId) return bad("契約とプランを選んでください。");
      const [{ data: c, error: cErr }, { data: pl, error: pErr }] = await Promise.all([
        supabase.from("contracts").select("plan_id, kind, status").eq("id", id).maybeSingle(),
        supabase.from("plans").select("id, kind").eq("id", planId).maybeSingle(),
      ]);
      if (cErr || pErr) return bad((cErr ?? pErr)!.message, 500);
      if (!c || !pl) return bad("契約かプランがありません。", 404);
      if (c.status === "ended") return bad("終了した契約は変えられません。", 409);
      if (c.kind !== pl.kind) return bad("種類の違うプランには変えられません。", 409);
      /* 変わるのは次に起こす入金行から。もう起こした月はそのまま */
      const { error } = await supabase.from("contracts").update({ plan_id: planId }).eq("id", id);
      if (error) return bad(error.message, 500);
      await log(id, { before: { planId: c.plan_id }, after: { planId } });
      return NextResponse.json({ ok: true });
    }
    case "referrer": {
      /* 紹介元の変更。理由を必ず残す（referral_changes） */
      const companyId = String(b.companyId ?? "").trim();
      const to = b.partnerId ? String(b.partnerId).trim() : null;
      const reason = String(b.reason ?? "").trim();
      if (!companyId) return bad("会社が分かりません。");
      if (!reason) return bad("理由を書いてください。");
      const { data: cur, error: rErr } = await supabase.from("referrals").select("partner_id").eq("company_id", companyId).maybeSingle();
      if (rErr) return bad(rErr.message, 500);
      const from = (cur?.partner_id as string) ?? null;
      if (from === to) return bad("いまと同じです。", 409);
      if (to) {
        const { data: sp, error: spErr } = await supabase.from("sales_partners").select("id").eq("id", to).maybeSingle();
        if (spErr) return bad(spErr.message, 500);
        if (!sp) return bad("そのパートナーがありません。", 404);
        const { error } = await supabase
          .from("referrals")
          .upsert({ company_id: companyId, partner_id: to, code_used: null, source: "manual" }, { onConflict: "company_id" });
        if (error) return bad(error.message, 500);
      } else {
        const { error } = await supabase.from("referrals").delete().eq("company_id", companyId);
        if (error) return bad(error.message, 500);
      }
      /* 契約の referrer_id もそろえる（開いている契約） */
      await supabase.from("contracts").update({ referrer_id: to }).eq("company_id", companyId).neq("status", "ended");
      const { error: hErr } = await supabase
        .from("referral_changes")
        .insert({ company_id: companyId, from_partner: from, to_partner: to, reason, changed_by: owner });
      if (hErr) console.error("紹介元の変更を残せません:", hErr.message);
      await log(companyId, { before: { partnerId: from }, after: { partnerId: to, reason } });
      return NextResponse.json({ ok: true });
    }

    /* ── パートナー ── */
    case "partner_status": {
      const id = String(b.partnerId ?? "").trim();
      const st = String(b.status ?? "");
      if (!id) return bad("パートナーが分かりません。");
      if (!["pending", "approved", "suspended"].includes(st)) return bad("状態が分かりません。");
      const { data: before, error: bErr } = await supabase.from("sales_partners").select("status, approved_at").eq("id", id).maybeSingle();
      if (bErr) return bad(bErr.message, 500);
      if (!before) return bad("そのパートナーがありません。", 404);
      const patch: Record<string, unknown> = { status: st };
      if (st === "approved" && !before.approved_at) patch.approved_at = new Date().toISOString();
      const { error } = await supabase.from("sales_partners").update(patch).eq("id", id);
      if (error) return bad(error.message, 500);
      await log(id, { before: { status: before.status }, after: { status: st } });
      return NextResponse.json({ ok: true });
    }
    case "partner_rate": {
      const id = String(b.partnerId ?? "").trim();
      const rate = int(b.rate);
      if (!id) return bad("パートナーが分かりません。");
      if (rate === null || rate < 0 || rate > 100) return bad("率は 0〜100 の整数で。");
      const { data: before, error: bErr } = await supabase.from("sales_partners").select("rate").eq("id", id).maybeSingle();
      if (bErr) return bad(bErr.message, 500);
      if (!before) return bad("そのパートナーがありません。", 404);
      /* 変わるのは次の入金から。もう確定した報酬は変えない */
      const { error } = await supabase.from("sales_partners").update({ rate }).eq("id", id);
      if (error) return bad(error.message, 500);
      await log(id, { before: { rate: before.rate }, after: { rate } });
      return NextResponse.json({ ok: true });
    }
    case "partner_code": {
      /* コードの付け直し（読み違えが多いなど）。古いコードの URL は使えなくなる */
      const id = String(b.partnerId ?? "").trim();
      const code = normalizeRefCode(b.note);
      if (!id) return bad("パートナーが分かりません。");
      if (!code) return bad("コードは英大文字と数字（0・1・I・O 以外）で 6〜10 文字。");
      const { error } = await supabase.from("sales_partners").update({ code }).eq("id", id);
      if (error) return bad(/unique|duplicate/i.test(error.message) ? "そのコードはもう使われています。" : error.message, 409);
      await log(id, { after: { code } });
      return NextResponse.json({ ok: true });
    }
    case "payout": {
      /* その月の確定分を「支払い済み」にする。1パートナー・1月で1行 */
      const id = String(b.partnerId ?? "").trim();
      const month = /^\d{4}-\d{2}/.test(String(b.month ?? "")) ? `${String(b.month).slice(0, 7)}-01` : "";
      if (!id || !month) return bad("パートナーと月を選んでください。");
      const { data: rows, error: rErr } = await supabase
        .from("commissions").select("id, amount").eq("partner_id", id).eq("period_month", month).eq("status", "confirmed");
      if (rErr) return bad(rErr.message, 500);
      if (!rows?.length) return bad("その月に未払いの確定分がありません。", 409);
      const total = rows.reduce((n, r) => n + (Number(r.amount) || 0), 0);
      const { data: pay, error: pErr } = await supabase
        .from("commission_payouts")
        .insert({ partner_id: id, period_month: month, total, status: "paid", paid_at: new Date().toISOString(), note: String(b.note ?? "") || null })
        .select("id").single();
      if (pErr || !pay) return bad(pErr?.message ?? "作れません", 500);
      const { error: uErr } = await supabase
        .from("commissions").update({ status: "paid", payout_id: pay.id })
        .in("id", rows.map((r) => r.id as string));
      if (uErr) return bad(uErr.message, 500);
      await log(id, { after: { month, total, count: rows.length } });
      return NextResponse.json({ ok: true, total, count: rows.length });
    }

    /* ── プラン ── */
    case "plan_save": {
      const p = b.plan ?? {};
      const kind = p.kind === "agency" ? "agency" : "member";
      const name = String(p.name ?? "").trim();
      const fee = int(p.monthlyFee);
      const ticket = int(p.ticketAmount);
      const months = int(p.ticketMonths ?? 12);
      const sort = int(p.sortOrder ?? 0) ?? 0;
      if (!name) return bad("プランの名前を書いてください。");
      if (fee === null || fee < 0) return bad("月額は 0 以上の整数で。");
      if (ticket === null || ticket < 0) return bad("チケットは 0 以上の整数で。");
      /* 6か月を超えると前払式支払手段の届出・供託の対象になる（docs/121）。SQL の check でも止まる */
      if (months === null || months < 1 || months > TERMS.ticketMonthsMax) return bad(`有効期間は 1〜${TERMS.ticketMonthsMax} か月（資金決済法の届出不要の範囲）。`);
      const row = { kind, name, monthly_fee: fee, ticket_amount: ticket, ticket_months: months, public: p.public !== false, sort_order: sort, note: String(p.note ?? "").trim() || null };
      if (p.id) {
        const { data: before, error: bErr } = await supabase.from("plans").select("*").eq("id", String(p.id)).maybeSingle();
        if (bErr) return bad(bErr.message, 500);
        const { data, error } = await supabase.from("plans").update(row).eq("id", String(p.id)).select("*").single();
        if (error) return bad(error.message, 500);
        await log(String(p.id), { before: before ? planOf(before as Record<string, unknown>) : null, after: planOf(data as Record<string, unknown>) });
        return NextResponse.json({ ok: true, plan: planOf(data as Record<string, unknown>) });
      }
      const { data, error } = await supabase.from("plans").insert(row).select("*").single();
      if (error) return bad(error.message, 500);
      await log(data.id as string, { after: planOf(data as Record<string, unknown>) });
      return NextResponse.json({ ok: true, plan: planOf(data as Record<string, unknown>) });
    }

    /* ── 目標 ── */
    case "targets": {
      const t = b.targets ?? {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (t.deadline && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline)) patch.deadline = t.deadline;
      for (const [k, col] of [["mrrMin", "mrr_min"], ["mrrGoal", "mrr_goal"], ["netGoal", "net_goal"], ["partnersGoal", "partners_goal"], ["contractsGoal", "contracts_goal"]] as const) {
        const v = t[k];
        if (v === undefined) continue;
        const n = int(v);
        if (n === null || n < 0) return bad("目標は 0 以上の整数で。");
        patch[col] = n;
      }
      const { data: before, error: bErr } = await supabase.from("targets").select("*").eq("id", 1).maybeSingle();
      if (bErr) return bad(bErr.message, 500);
      const { error } = await supabase.from("targets").upsert({ id: 1, ...patch }, { onConflict: "id" });
      if (error) return bad(error.message, 500);
      await log("targets", { before, after: patch });
      return NextResponse.json({ ok: true });
    }
    default:
      return bad("操作が分かりません。");
  }
}
