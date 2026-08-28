import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { currentAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/session";
import { maySeeInvoice } from "@/lib/invoiceAccess";
import { seller, bankReady } from "@/content/legal";
import { TAX_RATE } from "@/lib/pricing";
import { findCourse } from "@/content/courses";

/* 請求書に載せる中身。

   見られるのは、本部と、買った側（その事業者の担当者・個人）だけ。
   よその会社の請求書には宛名も金額も載っているので、
   番号さえ分かれば開ける、という形にしてはいけない。

   金額はデータベースの注文から取る。画面から送られてきた数は見ない。
   税は注文の金額から割り戻す（注文を作ったときの計算と食い違わないように）。 */

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }

  const id = (req.nextUrl.searchParams.get("orderId") ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "注文が分かりません。" }, { status: 400 });
  }

  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, company_id, user_id, kind, course_id, seats, unit_price, amount, method, status, due_date, paid_at, invoiced_at, bill_to, bill_addr, note, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) {
    return NextResponse.json({ ok: false, reason: "その注文がありません。" }, { status: 404 });
  }

  /* 誰として見ているか。本部でなければ、買った側かどうかを見る */
  const owner = await currentOwner();
  const me = owner ? null : await currentUser();
  const admin = owner ? null : await currentAdmin();
  const may = maySeeInvoice(
    { company_id: (o.company_id as string) ?? null, user_id: (o.user_id as string) ?? null },
    owner
      ? { owner: true }
      : { owner: false, companyId: admin?.companyId ?? null, userId: me?.id ?? "" },
  );
  if (!may.ok) {
    return NextResponse.json({ ok: false, reason: may.reason }, { status: 403 });
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
      /* 送ってあるか。買った側の画面では、これがあるものだけ知らせる */
      invoicedAt: (o.invoiced_at as string) ?? null,
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

/* 送ったことにする。本部だけ。
   何度押しても、はじめに送った日時のまま（送り直しで日付が動かない） */
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as { orderId?: string };
  const id = (b.orderId ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "注文が分かりません。" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("mark_invoiced", { p_order: id });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, invoicedAt: data as string });
}
