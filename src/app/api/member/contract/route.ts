import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify.server";
import { BRAND } from "@/content/brand";
import { REF_COOKIE, monthStart, normalizeRefCode } from "@/lib/membership";
import {
  issuePaymentInvoice,
  listPlans,
  membershipEnabled,
  openContract,
  planOf,
  ticketBalance,
} from "@/lib/membership.server";

/* 法人会員（0040・docs/120）。事業者の教育担当者だけ。

   GET  … いまの契約・チケットの残高・付与と消費の履歴・月々の入金・選べるプラン
   POST … 申し込む。契約を立て（入金待ち）、初月の入金行を起こす。
          **入金を確認するのは運営**（/api/owner/members の paid）。
          それまでチケットは付かない（払わずに使えてしまう）。

   金額は全部サーバ（SQL の open_contract_payment が plans から取る）。
   画面から送られてきた額は見ない。

   ── 紹介コード ──
   /ref?code=… で来た人はクッキーに乗っている。申込みの画面でも打てる。
   承認済みの営業パートナーのコードだけ通す。**自分のコードは通さない**
   （自分の会社を自分で紹介して報酬を取る道を作らない）。 */


const closed = () => NextResponse.json({ ok: false, reason: "準備中です。" }, { status: 404 });

export async function GET() {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの画面です。" }, { status: 403 });
  }

  const [plans, open, store] = await Promise.all([
    listPlans(supabase, { kind: "member" }),
    openContract(supabase, admin.companyId),
    cookies(),
  ]);
  if (!plans.ok) return NextResponse.json({ ok: false, reason: `プランを読めませんでした（${plans.reason}）` }, { status: 500 });
  if (!open.ok) return NextResponse.json({ ok: false, reason: `契約を読めませんでした（${open.reason}）` }, { status: 500 });
  const refCode = normalizeRefCode(store.get(REF_COOKIE)?.value);

  const base = {
    ok: true,
    company: admin.companyName,
    plans: plans.plans,
    refCode,
  };
  const c = open.contract;
  if (!c) {
    return NextResponse.json({
      ...base,
      contract: null,
      balance: { total: 0, expiring: 0, nextExpire: null },
      lots: [],
      txns: [],
      payments: [],
    });
  }

  const cid = c.id as string;
  const [{ data: plan, error: pErr }, bal, { data: lots, error: lErr }, { data: txns, error: tErr }, { data: pays, error: payErr }] =
    await Promise.all([
      supabase
        .from("plans")
        .select("id, kind, name, monthly_fee, ticket_amount, ticket_months, public, sort_order, note")
        .eq("id", c.plan_id as string)
        .maybeSingle(),
      ticketBalance(supabase, cid),
      supabase
        .from("ticket_lots")
        .select("id, amount, remaining, granted_at, expires_at")
        .eq("contract_id", cid)
        .order("expires_at", { ascending: true }),
      supabase
        .from("ticket_txns")
        .select("id, kind, amount, order_id, note, created_at")
        .eq("contract_id", cid)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("contract_payments")
        .select("id, period_month, net, tax, amount, ticket_amount, method, status, due_on, invoiced_at, paid_at")
        .eq("contract_id", cid)
        .order("period_month", { ascending: false }),
    ]);
  const err = pErr ?? lErr ?? tErr ?? payErr;
  if (err) return NextResponse.json({ ok: false, reason: `契約の中身を読めませんでした（${err.message}）` }, { status: 500 });
  if (!bal.ok) return NextResponse.json({ ok: false, reason: `残高を読めませんでした（${bal.reason}）` }, { status: 500 });

  return NextResponse.json({
    ...base,
    contract: {
      id: cid,
      kind: c.kind as string,
      status: c.status as string,
      method: c.method as string,
      startedOn: (c.started_on as string) ?? null,
      endsOn: (c.ends_on as string) ?? null,
      nextDueOn: (c.next_due_on as string) ?? null,
      cancelRequestedOn: (c.cancel_requested_on as string) ?? null,
      createdAt: c.created_at as string,
      plan: plan ? planOf(plan as Record<string, unknown>) : null,
    },
    balance: bal.balance,
    lots: (lots ?? []).map((l) => ({
      id: l.id as string,
      amount: Number(l.amount) || 0,
      remaining: Number(l.remaining) || 0,
      grantedAt: l.granted_at as string,
      expiresAt: l.expires_at as string,
    })),
    txns: (txns ?? []).map((t) => ({
      id: t.id as string,
      kind: t.kind as string,
      amount: Number(t.amount) || 0,
      orderId: (t.order_id as string) ?? null,
      note: (t.note as string) ?? "",
      at: t.created_at as string,
    })),
    payments: (pays ?? []).map((p) => ({
      id: p.id as string,
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
    })),
  });
}

type Body = { action?: unknown; planId?: unknown; code?: unknown; note?: unknown };

export async function POST(req: NextRequest) {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as Body;

  /* ── 解約の申し出（docs/121）── 終了は申し出の月の翌月末。以後の会費は請求しない。
     払った月のチケットは失効日まで使える。終了そのものは日次処理（cron）が行う */
  if (b.action === "cancel") {
    const open = await openContract(supabase, admin.companyId);
    if (!open.ok) return NextResponse.json({ ok: false, reason: `契約を読めませんでした（${open.reason}）` }, { status: 500 });
    if (!open.contract) return NextResponse.json({ ok: false, reason: "契約がありません。" }, { status: 404 });
    const { data: endsOn, error } = await supabase.rpc("cancel_contract", { p_contract: open.contract.id, p_by: admin.userId });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, endsOn: endsOn as string });
  }

  const planId = String(b.planId ?? "").trim();
  if (!planId) return NextResponse.json({ ok: false, reason: "プランを選んでください。" }, { status: 400 });

  const { data: plan, error: pErr } = await supabase
    .from("plans")
    .select("id, kind, name, monthly_fee, ticket_amount, ticket_months, public")
    .eq("id", planId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, reason: `プランを読めませんでした（${pErr.message}）` }, { status: 500 });
  if (!plan || plan.public === false) {
    return NextResponse.json({ ok: false, reason: "そのプランは選べません。" }, { status: 400 });
  }

  /* 開いている契約が1つでもあれば、2つ目は作らない（SQL の一意索引でも止まる） */
  const open = await openContract(supabase, admin.companyId);
  if (!open.ok) return NextResponse.json({ ok: false, reason: `契約を読めませんでした（${open.reason}）` }, { status: 500 });
  if (open.contract) {
    return NextResponse.json({ ok: false, reason: "すでに契約があります。" }, { status: 409 });
  }

  /* 紹介コード。画面で打ったもの → 無ければクッキー */
  const store = await cookies();
  const code = normalizeRefCode(b.code) || normalizeRefCode(store.get(REF_COOKIE)?.value);
  let referrerId: string | null = null;
  let refNg = "";
  if (code) {
    const { data: sp, error: sErr } = await supabase
      .from("sales_partners")
      .select("id, user_id, status")
      .eq("code", code)
      .maybeSingle();
    if (sErr) return NextResponse.json({ ok: false, reason: `紹介コードを読めませんでした（${sErr.message}）` }, { status: 500 });
    if (!sp || sp.status !== "approved") refNg = "その紹介コードは使えません。";
    else if (sp.user_id === admin.userId) refNg = "自分の紹介コードは使えません。";
    else referrerId = sp.id as string;
  }
  if (refNg) return NextResponse.json({ ok: false, reason: refNg }, { status: 409 });

  const { data: made, error } = await supabase
    .from("contracts")
    .insert({
      company_id: admin.companyId,
      plan_id: plan.id,
      kind: plan.kind,
      status: "pending",
      method: "invoice",
      brand: BRAND.id,
      referrer_id: referrerId,
      note: String(b.note ?? "").trim() || null,
      created_by: admin.userId,
    })
    .select("id")
    .single();
  if (error || !made) {
    const stale = /relation .*contracts|does not exist/.test(error?.message ?? "");
    return NextResponse.json(
      {
        ok: false,
        reason:
          (error?.message ?? "作れません") +
          (stale ? "（データベースの版が古いようです。Supabase の SQL Editor に supabase/apply-all.sql を貼って実行してください）" : ""),
      },
      { status: 500 },
    );
  }
  const contractId = made.id as string;

  /* 紹介元。**契約が立った時点で1件。**あとから変えるのは運営（理由を残す） */
  if (referrerId) {
    const { error: rErr } = await supabase
      .from("referrals")
      .upsert(
        { company_id: admin.companyId, partner_id: referrerId, code_used: code, source: b.code ? "code" : "url" },
        { onConflict: "company_id", ignoreDuplicates: true },
      );
    if (rErr) console.error("紹介元を残せません:", rErr.message);
  }

  /* 初月の入金行。前払いなので、申し込んだ月が初月 */
  const { data: paymentId, error: oErr } = await supabase.rpc("open_contract_payment", {
    p_contract: contractId,
    p_month: monthStart(),
  });
  if (oErr) {
    /* 入金行が無いと請求書が出ない。契約だけ残すと「申し込んだのに請求が来ない」になるので、下げる */
    await supabase.from("contracts").delete().eq("id", contractId);
    return NextResponse.json({ ok: false, reason: `請求を起こせませんでした（${oErr.message}）` }, { status: 500 });
  }

  /* 請求書はその場で出る（docs/122）。担当者に「請求書が届いています」 */
  await issuePaymentInvoice(supabase, paymentId as string);
  await notify("contract");

  return NextResponse.json({
    ok: true,
    contractId,
    paymentId: paymentId as string,
    plan: { id: plan.id as string, name: plan.name as string, monthlyFee: Number(plan.monthly_fee) || 0 },
    referred: !!referrerId,
  });
}
