import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { issueSeats, listSeats, seatCounts } from "@/lib/seats";
import { dueDate, quote } from "@/lib/pricing";
import { unitPrice } from "@/lib/price.server";

/* 申込み。教育担当者だけ。

   ・カード … 注文を作ってから Stripe の支払い画面へ送る（/api/stripe/checkout）
   ・請求書 … 注文を作り、受講コードはすぐ配る。入金確認は運営が押す

   金額はサーバで計算する。画面から送られてきた金額は見ない。 */

type Body = { seats?: number; method?: "card" | "invoice"; billTo?: string; note?: string };

export async function GET() {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの画面です。" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, seats, unit_price, amount, method, status, due_date, paid_at, created_at")
    .eq("company_id", admin.companyId)
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o) => o.id as string);
  const counts = await seatCounts(supabase, ids);
  const paidIds = (orders ?? []).filter((o) => o.status === "paid").map((o) => o.id as string);
  const paid = await seatCounts(supabase, paidIds);
  /* コードの文字そのもの。数だけ返しても、担当者は受講者に配れない */
  const codes = await listSeats(
    supabase,
    (orders ?? []).map((o) => ({ id: o.id as string, status: o.status as string })),
  );

  return NextResponse.json({
    ok: true,
    company: admin.companyName,
    /* 単価はサーバだけが持つ（SEAT_UNIT_PRICE は NEXT_PUBLIC_ ではない）。
       画面で計算させると、見せる金額と請求する金額が食い違う */
    unitPrice: unitPrice(),
    orders: orders ?? [],
    seats: { total: counts.total, used: counts.used, paid: paid.total },
    codes,
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const method = b.method === "card" ? "card" : "invoice";
  const q = quote(Number(b.seats), unitPrice());
  if (!q) {
    return NextResponse.json({ ok: false, reason: "人数を確かめてください。" }, { status: 400 });
  }

  const now = new Date();
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      company_id: admin.companyId,
      seats: q.seats,
      unit_price: q.unitPrice,
      amount: q.total,
      method,
      status: "pending",
      due_date: method === "invoice" ? dueDate(now).toISOString().slice(0, 10) : null,
      ordered_by: admin.userId,
      bill_to: (b.billTo ?? "").trim() || null,
      note: (b.note ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error || !order) {
    return NextResponse.json({ ok: false, reason: error?.message ?? "作れません" }, { status: 500 });
  }

  /* 請求書払いは、入金前でも受講コードを配る（受講は始められる）。
     修了証は入金が済むまで出ない */
  const made = method === "invoice" ? await issueSeats(supabase, order.id as string, q.seats) : 0;

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    method,
    quote: q,
    seatsIssued: made,
  });
}
