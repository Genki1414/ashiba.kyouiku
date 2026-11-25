import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { notify } from "@/lib/notify.server";
import { siteUrl } from "@/lib/siteUrl";
import { commissionOf, makeRefCode, refUrl } from "@/lib/membership";
import { membershipEnabled } from "@/lib/membership.server";

/* 営業パートナー（0040・docs/120）。ログインしている本人だけ。

   GET  … 自分の登録・紹介コードと URL・紹介した会社・報酬（確定と見込み）・振込先
   POST … register（登録。承認待ちで立つ）／update（名前・連絡先）／bank（振込先）

   ── 見せるもの・見せないもの ──
   ・紹介した会社の名前と契約の状態は見せる（報酬の根拠。無いと確認できない）
   ・会社の担当者の氏名・メール・受講者の名簿は見せない
   ・**振込先は本人と運営だけ。**ほかの口（/api/owner/members 以外）からは返さない
   ・確定（commissions の行）と見込み（有効な契約 × 率）は、別の数字として返す。
     足して1つにしない（払われる額だと思われる） */

const closed = () => NextResponse.json({ ok: false, reason: "準備中です。" }, { status: 404 });

export async function GET() {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  const me = supabase ? await currentUser() : null;
  if (!supabase || !me) return NextResponse.json({ ok: false, reason: "ログインしてください。" }, { status: 401 });

  const { data: sp, error: sErr } = await supabase
    .from("sales_partners")
    .select("id, name, kind, status, code, rate, contact, note, approved_at, created_at")
    .eq("user_id", me.id)
    .maybeSingle();
  if (sErr) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          `登録を読めませんでした（${sErr.message}）。` +
          "データベースの版が古いときは、Supabase の SQL Editor に supabase/apply-all.sql を貼って実行してください。",
      },
      { status: 500 },
    );
  }
  const site = siteUrl();
  if (!sp) {
    return NextResponse.json({ ok: true, partner: null, bank: null, referrals: [], commissions: [], payouts: [], totals: null, url: "" });
  }
  const pid = sp.id as string;
  const [{ data: bank, error: bErr }, { data: refs, error: rErr }, { data: cms, error: cErr }, { data: pays, error: pErr }] = await Promise.all([
    supabase.from("partner_bank").select("bank_name, branch, acct_type, acct_no, holder, tax_note").eq("partner_id", pid).maybeSingle(),
    supabase.from("referrals").select("company_id, source, locked_at, created_at").eq("partner_id", pid),
    supabase
      .from("commissions")
      .select("id, contract_id, period_month, base_net, rate, amount, kind, status, created_at")
      .eq("partner_id", pid)
      .order("period_month", { ascending: false }),
    supabase.from("commission_payouts").select("id, period_month, total, status, paid_at").eq("partner_id", pid).order("period_month", { ascending: false }),
  ]);
  const err = bErr ?? rErr ?? cErr ?? pErr;
  if (err) return NextResponse.json({ ok: false, reason: `中身を読めませんでした（${err.message}）` }, { status: 500 });

  const companyIds = (refs ?? []).map((r) => r.company_id as string);
  const [{ data: cos, error: coErr }, { data: cts, error: ctErr }] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    companyIds.length
      ? supabase
          .from("contracts")
          .select("id, company_id, plan_id, status, started_on, next_due_on, created_at")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);
  if (coErr || ctErr) return NextResponse.json({ ok: false, reason: `紹介した会社を読めませんでした（${(coErr ?? ctErr)?.message}）` }, { status: 500 });
  const planIds = [...new Set((cts ?? []).map((c) => c.plan_id as string))];
  const { data: pls, error: plErr } = planIds.length
    ? await supabase.from("plans").select("id, name, monthly_fee").in("id", planIds)
    : { data: [] as Record<string, unknown>[], error: null };
  if (plErr) return NextResponse.json({ ok: false, reason: `プランを読めませんでした（${plErr.message}）` }, { status: 500 });
  const plan = new Map((pls ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  const coName = new Map((cos ?? []).map((c) => [c.id as string, (c.name as string) ?? ""]));
  /* 会社ごとに、いちばん新しい契約 */
  const latest = new Map<string, Record<string, unknown>>();
  for (const c of cts ?? []) if (!latest.has(c.company_id as string)) latest.set(c.company_id as string, c as Record<string, unknown>);

  const rate = Number(sp.rate) || 0;
  const referrals = (refs ?? []).map((r) => {
    const c = latest.get(r.company_id as string);
    const pl = c ? plan.get(c.plan_id as string) : null;
    return {
      companyId: r.company_id as string,
      company: coName.get(r.company_id as string) ?? "",
      source: r.source as string,
      since: r.created_at as string,
      contract: c
        ? {
            status: c.status as string,
            plan: (pl?.name as string) ?? "",
            monthlyFee: Number(pl?.monthly_fee) || 0,
            startedOn: (c.started_on as string) ?? null,
            nextDueOn: (c.next_due_on as string) ?? null,
            /* この契約が払い続けたとき、月にいくら入るか（見込み） */
            expectedMonthly: c.status === "active" ? commissionOf(Number(pl?.monthly_fee) || 0, rate) : 0,
          }
        : null,
    };
  });
  const commissions = (cms ?? []).map((x) => ({
    id: x.id as string,
    contractId: (x.contract_id as string) ?? null,
    company: coName.get(((cts ?? []).find((c) => c.id === x.contract_id)?.company_id as string) ?? "") ?? "",
    periodMonth: x.period_month as string,
    baseNet: Number(x.base_net) || 0,
    rate: Number(x.rate) || 0,
    amount: Number(x.amount) || 0,
    kind: x.kind as string,
    status: x.status as string,
    at: x.created_at as string,
  }));
  const confirmed = commissions.filter((x) => x.status === "confirmed").reduce((n, x) => n + x.amount, 0);
  const paid = commissions.filter((x) => x.status === "paid").reduce((n, x) => n + x.amount, 0);
  const expectedMonthly = referrals.reduce((n, r) => n + (r.contract?.expectedMonthly ?? 0), 0);

  return NextResponse.json({
    ok: true,
    partner: {
      id: pid,
      name: (sp.name as string) ?? "",
      kind: (sp.kind as string) ?? "individual",
      status: sp.status as string,
      code: sp.code as string,
      rate,
      contact: (sp.contact as string) ?? "",
      approvedAt: (sp.approved_at as string) ?? null,
      createdAt: sp.created_at as string,
    },
    url: refUrl(site, sp.code as string),
    bank: bank
      ? {
          bankName: (bank.bank_name as string) ?? "",
          branch: (bank.branch as string) ?? "",
          acctType: (bank.acct_type as string) ?? "普通",
          acctNo: (bank.acct_no as string) ?? "",
          holder: (bank.holder as string) ?? "",
          taxNote: (bank.tax_note as string) ?? "",
        }
      : null,
    referrals,
    commissions,
    payouts: (pays ?? []).map((p) => ({
      id: p.id as string,
      periodMonth: p.period_month as string,
      total: Number(p.total) || 0,
      status: p.status as string,
      paidAt: (p.paid_at as string) ?? null,
    })),
    /* 確定と見込みは別の数字。足さない */
    totals: { confirmed, paid, expectedMonthly, activeContracts: referrals.filter((r) => r.contract?.status === "active").length },
  });
}

type Body = {
  action?: string;
  name?: unknown; kind?: unknown; contact?: unknown;
  bankName?: unknown; branch?: unknown; acctType?: unknown; acctNo?: unknown; holder?: unknown; taxNote?: unknown;
};
const str = (v: unknown, max = 100) => String(v ?? "").trim().slice(0, max);
const bad = (reason: string, status = 400) => NextResponse.json({ ok: false, reason }, { status });

export async function POST(req: NextRequest) {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  const me = supabase ? await currentUser() : null;
  if (!supabase || !me) return bad("ログインしてください。", 401);
  const b = (await req.json().catch(() => ({}))) as Body;

  const { data: cur, error: cErr } = await supabase.from("sales_partners").select("id, status").eq("user_id", me.id).maybeSingle();
  if (cErr) return bad(cErr.message, 500);

  if (b.action === "register") {
    if (cur) return bad("もう登録があります。", 409);
    const name = str(b.name);
    const kind = b.kind === "corp" ? "corp" : "individual";
    const contact = str(b.contact, 200);
    if (!name) return bad("名前（会社名か氏名）を書いてください。");
    if (!contact) return bad("連絡先を書いてください。");
    /* コードはまれにぶつかる。ぶつかったら取り直す */
    for (let t = 0; t < 5; t++) {
      const code = makeRefCode();
      const { data, error } = await supabase
        .from("sales_partners")
        .insert({ user_id: me.id, name, kind, status: "pending", code, contact })
        .select("id, code")
        .single();
      if (!error && data) {
        await notify("partner");
        return NextResponse.json({ ok: true, id: data.id as string, code: data.code as string });
      }
      if (!/code/.test(error?.message ?? "")) return bad(error?.message ?? "作れません", 500);
    }
    return bad("コードを作れませんでした。もう一度お試しください。", 500);
  }

  if (!cur) return bad("まだ登録がありません。", 404);

  if (b.action === "update") {
    const patch: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = str(b.name);
      if (!name) return bad("名前を書いてください。");
      patch.name = name;
    }
    if (b.contact !== undefined) patch.contact = str(b.contact, 200);
    if (!Object.keys(patch).length) return bad("変える所がありません。");
    const { error } = await supabase.from("sales_partners").update(patch).eq("id", cur.id as string);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "bank") {
    const acctType = ["普通", "当座", "貯蓄"].includes(String(b.acctType)) ? String(b.acctType) : "普通";
    const row = {
      partner_id: cur.id as string,
      bank_name: str(b.bankName),
      branch: str(b.branch),
      acct_type: acctType,
      acct_no: str(b.acctNo, 20).replace(/[^\d]/g, ""),
      holder: str(b.holder),
      tax_note: str(b.taxNote, 200) || null,
    };
    if (!row.bank_name || !row.branch || !row.acct_no || !row.holder) return bad("銀行名・支店・口座番号・名義を書いてください。");
    const { error } = await supabase.from("partner_bank").upsert(row, { onConflict: "partner_id" });
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return bad("操作が分かりません。");
}
