import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { currentUser } from "@/lib/supabase/session";
import { seller } from "@/content/legal";
import { membershipEnabled } from "@/lib/membership.server";
import { monthLabel } from "@/lib/membership";

/* 営業パートナーの報酬の支払明細（docs/122）。

   ?payoutId=… … 1件の支払（commission_payouts）と、その中の報酬の行。
                  見られるのは本部と、そのパートナー本人
   ?month=YYYY-MM&format=csv … その月に確定・支払済みの報酬を全パートナーぶん CSV で。本部だけ
   ?payoutId=…&format=csv  … その支払の行を CSV で

   振込先は本部にだけ返す（本人は /partner で見られる） */

const closed = () => NextResponse.json({ ok: false, reason: "準備中です。" }, { status: 404 });
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csvOf = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export async function GET(req: NextRequest) {
  if (!membershipEnabled()) return closed();
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  const owner = await currentOwner();
  const me = owner ? null : await currentUser();
  if (!owner && !me) return NextResponse.json({ ok: false, reason: "ログインしてください。" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const format = q.get("format") === "csv" ? "csv" : "json";
  const payoutId = (q.get("payoutId") ?? "").trim();
  const month = /^\d{4}-\d{2}/.test(q.get("month") ?? "") ? `${(q.get("month") ?? "").slice(0, 7)}-01` : "";

  /* ── 月まとめの CSV（本部） ── */
  if (!payoutId && month) {
    if (!owner) return NextResponse.json({ ok: false, reason: "本部だけの口です。" }, { status: 403 });
    const { data: rows, error } = await supabase
      .from("commissions")
      .select("id, partner_id, contract_id, period_month, base_net, rate, amount, kind, status, payout_id, created_at")
      .eq("period_month", month)
      .neq("status", "void")
      .order("partner_id");
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    const pids = [...new Set((rows ?? []).map((r) => r.partner_id as string))];
    const cids = [...new Set((rows ?? []).map((r) => r.contract_id as string).filter(Boolean))];
    const [{ data: sps, error: sErr }, { data: cts, error: cErr }, { data: banks, error: bErr }] = await Promise.all([
      pids.length ? supabase.from("sales_partners").select("id, name, kind, code").in("id", pids) : Promise.resolve({ data: [], error: null }),
      cids.length ? supabase.from("contracts").select("id, company_id").in("id", cids) : Promise.resolve({ data: [], error: null }),
      pids.length ? supabase.from("partner_bank").select("partner_id, bank_name, branch, acct_type, acct_no, holder, tax_note").in("partner_id", pids) : Promise.resolve({ data: [], error: null }),
    ]);
    const err = sErr ?? cErr ?? bErr;
    if (err) return NextResponse.json({ ok: false, reason: err.message }, { status: 500 });
    const coIds = [...new Set((cts ?? []).map((c) => c.company_id as string))];
    const { data: cos, error: coErr } = coIds.length
      ? await supabase.from("companies").select("id, name").in("id", coIds)
      : { data: [], error: null };
    if (coErr) return NextResponse.json({ ok: false, reason: coErr.message }, { status: 500 });
    const sp = new Map((sps ?? []).map((s) => [s.id as string, s as Record<string, unknown>]));
    const bank = new Map((banks ?? []).map((b) => [b.partner_id as string, b as Record<string, unknown>]));
    const coOf = new Map((cts ?? []).map((c) => [c.id as string, (cos ?? []).find((x) => x.id === c.company_id)?.name ?? ""]));
    const out: unknown[][] = [[
      "対象月", "パートナー", "区分", "紹介コード", "紹介先", "税抜会費", "率(%)", "報酬", "種類", "状態", "支払ID",
      "銀行", "支店", "種別", "口座番号", "名義", "インボイス等",
    ]];
    for (const r of rows ?? []) {
      const s = sp.get(r.partner_id as string) ?? {};
      const b = bank.get(r.partner_id as string) ?? {};
      out.push([
        monthLabel(r.period_month as string), s.name, s.kind === "corp" ? "法人" : "個人", s.code, coOf.get(r.contract_id as string) ?? "",
        r.base_net, r.rate, r.amount, r.kind === "adjust" ? "調整" : "発生", r.status === "paid" ? "支払済" : "確定", r.payout_id ?? "",
        b.bank_name, b.branch, b.acct_type, b.acct_no, b.holder, b.tax_note,
      ]);
    }
    return new NextResponse(csvOf(out), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="commissions-${month.slice(0, 7)}.csv"` },
    });
  }

  if (!payoutId) return NextResponse.json({ ok: false, reason: "支払か月が分かりません。" }, { status: 400 });

  /* ── 1件の支払 ── */
  const { data: po, error: poErr } = await supabase
    .from("commission_payouts").select("id, partner_id, period_month, total, status, paid_at, note, created_at").eq("id", payoutId).maybeSingle();
  if (poErr) return NextResponse.json({ ok: false, reason: poErr.message }, { status: 500 });
  if (!po) return NextResponse.json({ ok: false, reason: "その支払がありません。" }, { status: 404 });
  const { data: sp, error: spErr } = await supabase
    .from("sales_partners").select("id, user_id, name, kind, code, rate, contact").eq("id", po.partner_id as string).maybeSingle();
  if (spErr || !sp) return NextResponse.json({ ok: false, reason: spErr?.message ?? "パートナーがありません。" }, { status: 500 });
  if (!owner && sp.user_id !== me?.id) return NextResponse.json({ ok: false, reason: "その明細は見られません。" }, { status: 403 });

  const [{ data: rows, error: rErr }, { data: bank, error: bErr }] = await Promise.all([
    supabase.from("commissions").select("id, contract_id, period_month, base_net, rate, amount, kind, status, created_at").eq("payout_id", payoutId).order("created_at"),
    owner ? supabase.from("partner_bank").select("bank_name, branch, acct_type, acct_no, holder, tax_note").eq("partner_id", sp.id as string).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const err = rErr ?? bErr;
  if (err) return NextResponse.json({ ok: false, reason: err.message }, { status: 500 });
  const cids = [...new Set((rows ?? []).map((r) => r.contract_id as string).filter(Boolean))];
  const { data: cts, error: cErr } = cids.length ? await supabase.from("contracts").select("id, company_id").in("id", cids) : { data: [], error: null };
  if (cErr) return NextResponse.json({ ok: false, reason: cErr.message }, { status: 500 });
  const coIds = [...new Set((cts ?? []).map((c) => c.company_id as string))];
  const { data: cos, error: coErr } = coIds.length ? await supabase.from("companies").select("id, name").in("id", coIds) : { data: [], error: null };
  if (coErr) return NextResponse.json({ ok: false, reason: coErr.message }, { status: 500 });
  const coOf = new Map((cts ?? []).map((c) => [c.id as string, (cos ?? []).find((x) => x.id === c.company_id)?.name ?? ""]));

  const items = (rows ?? []).map((r) => ({
    id: r.id as string,
    company: coOf.get(r.contract_id as string) ?? "",
    periodMonth: r.period_month as string,
    baseNet: Number(r.base_net) || 0,
    rate: Number(r.rate) || 0,
    amount: Number(r.amount) || 0,
    kind: r.kind as string,
  }));

  if (format === "csv") {
    const out: unknown[][] = [["対象月", "紹介先", "税抜会費", "率(%)", "報酬", "種類"]];
    for (const it of items) out.push([monthLabel(it.periodMonth), it.company, it.baseNet, it.rate, it.amount, it.kind === "adjust" ? "調整" : "発生"]);
    out.push(["合計", "", "", "", Number(po.total) || 0, ""]);
    return new NextResponse(csvOf(out), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="payout-${String(po.id).slice(0, 8)}.csv"` },
    });
  }

  const s = seller();
  return NextResponse.json({
    ok: true,
    payout: {
      id: po.id as string,
      no: `P${String(po.id).slice(0, 7).toUpperCase()}`,
      periodMonth: po.period_month as string,
      total: Number(po.total) || 0,
      status: po.status as string,
      paidAt: (po.paid_at as string) ?? null,
      note: (po.note as string) ?? "",
      createdAt: po.created_at as string,
    },
    partner: { name: sp.name as string, kind: sp.kind as string, code: sp.code as string, rate: Number(sp.rate) || 0, contact: owner ? (sp.contact as string) ?? "" : "" },
    bank: bank
      ? { bankName: bank.bank_name as string, branch: bank.branch as string, acctType: bank.acct_type as string, acctNo: bank.acct_no as string, holder: bank.holder as string, taxNote: (bank.tax_note as string) ?? "" }
      : null,
    items,
    seller: { name: s.name, address: s.address, tel: s.tel, email: s.email, invoiceNo: s.invoiceNo },
  });
}
