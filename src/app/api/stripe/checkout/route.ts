import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { getStripe, siteUrl } from "@/lib/stripe";
import { orderLabel } from "@/lib/orderLabel";

/* カード払いの支払い画面を作る。

   金額はデータベースの注文から取る。画面から送られてきた金額は見ない。
   入金の反映は webhook でやる。ここでは払わせるだけ。 */

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }
  if (!stripe) {
    return NextResponse.json(
      { ok: false, reason: "カード払いはまだ使えません。請求書払いをお選びください。" },
      { status: 503 },
    );
  }

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  const { data: order } = await supabase
    .from("orders")
    .select("id, company_id, group_id, seats, amount, status, method, kind, course_id")
    .eq("id", (orderId ?? "").trim())
    .maybeSingle();
  if (!order || order.company_id !== admin.companyId) {
    return NextResponse.json({ ok: false, reason: "その注文がありません。" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: false, reason: "もう入金済みです。" }, { status: 409 });
  }

  /* ── 申込みまるごとで払う ──

     複数の講座をまとめて申し込めるので（0029）、1回の申込みが
     講座ごとの行に分かれている。**カードを切るのも1回。**
     行ごとにカード決済させると、途中でやめられたときに
     「足場だけ払って石綿は未払い」という半端な申込みが残る。 */
  const group = (order.group_id as string) ?? (order.id as string);
  const { data: rows } = await supabase
    .from("orders")
    .select("id, seats, amount, status, kind, course_id")
    .eq("group_id", group)
    .eq("company_id", admin.companyId)
    .order("created_at", { ascending: true });
  const lines = (rows ?? []).length ? rows! : [order];
  if (lines.some((r) => r.status === "paid")) {
    return NextResponse.json({ ok: false, reason: "もう入金済みです。" }, { status: 409 });
  }

  const base = siteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    /* 日本の会社が買うので、領収に要る情報を取っておく */
    billing_address_collection: "required",
    /* 講座ごとに1行。領収書にも講座ごとに並ぶ */
    line_items: lines.map((r) => ({
      quantity: 1,
      price_data: {
        currency: "jpy" as const,
        unit_amount: r.amount as number,
        product_data: {
          /* 品名は注文から作る。決め打ちにすると、
             職長を買った人の領収書に「足場の特別教育」と残る */
          name: orderLabel({
            kind: r.kind as string | null,
            courseId: r.course_id as string | null,
          }),
          description: `${r.seats}名分・税込`,
        },
      },
    })),
    /* どの申込みの支払いかを、戻ってきたときに突き合わせる。
       **group も渡す。**戻りで group の行を全部入金にするため */
    client_reference_id: order.id as string,
    metadata: { order_id: order.id as string, group_id: group },
    success_url: `${base}/order?paid=${order.id}`,
    cancel_url: `${base}/order?cancelled=${order.id}`,
  });

  await supabase
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id as string);

  return NextResponse.json({ ok: true, url: session.url });
}
