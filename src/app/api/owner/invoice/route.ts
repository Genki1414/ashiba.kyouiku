import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { seller, bankReady } from "@/content/legal";
import { TAX_RATE } from "@/lib/pricing";
import { findCourse } from "@/content/courses";

/* 請求書に載せる中身（本部だけ）。

   金額はデータベースの注文から取る。画面から送られてきた数は見ない。
   税は注文の金額から割り戻す（注文を作ったときの計算と食い違わないように）。 */

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの画面です。" }, { status: 403 });
  }

  const id = (req.nextUrl.searchParams.get("orderId") ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "注文が分かりません。" }, { status: 400 });
  }

  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, company_id, user_id, kind, course_id, seats, unit_price, amount, method, status, due_date, paid_at, bill_to, bill_addr, note, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) {
    return NextResponse.json({ ok: false, reason: "その注文がありません。" }, { status: 404 });
  }

  /* 宛名。決めてあればそれを使い、無ければ会社名か本人の名前 */
  let to = (o.bill_to as string) ?? "";
  if (!to && o.company_id) {
    const { data: c } = await supabase
      .from("companies")
      .select("name")
      .eq("id", o.company_id as string)
      .maybeSingle();
    to = (c?.name as string) ?? "";
  }
  if (!to && o.user_id) {
    const { data: u } = await supabase
      .from("users")
      .select("name")
      .eq("id", o.user_id as string)
      .maybeSingle();
    to = (u?.name as string) ?? "";
  }

  const amount = (o.amount as number) ?? 0;
  /* 税込から割り戻す。注文を作ったときの計算と食い違わせない */
  const net = Math.round(amount / (1 + TAX_RATE));
  const tax = amount - net;

  const course = findCourse((o.course_id as string) ?? "");
  const what =
    o.kind === "training"
      ? "実務トレーニング 利用権（第2章以降）"
      : `${course?.short ?? "特別教育"} 受講コード`;

  const s = seller();
  return NextResponse.json({
    ok: true,
    order: {
      id: o.id as string,
      /* 請求書番号。注文の頭8文字で足りる（通し番号は要らない） */
      no: `${String(o.id).slice(0, 8).toUpperCase()}`,
      to,
      addr: (o.bill_addr as string) ?? "",
      what,
      qty: (o.seats as number) ?? 1,
      unit: (o.unit_price as number) ?? 0,
      net,
      tax,
      amount,
      taxRate: TAX_RATE,
      due: (o.due_date as string) ?? null,
      at: (o.created_at as string) ?? null,
      paidAt: (o.paid_at as string) ?? null,
      status: (o.status as string) ?? "pending",
      note: (o.note as string) ?? "",
      solo: !!o.user_id,
    },
    seller: {
      name: s.name,
      ceo: s.ceo,
      address: s.address,
      tel: s.tel,
      email: s.email,
      invoiceNo: s.invoiceNo,
      /* 振込先。そろっていなければ返さない。
         中途半端に出すと、振り込めないのに振り込めるように見える */
      bank: bankReady(s.bank) ? s.bank : null,
    },
  });
}
