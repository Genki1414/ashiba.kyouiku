import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { getStripe, siteUrl } from "@/lib/stripe";

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
    .select("id, company_id, seats, amount, status, method")
    .eq("id", (orderId ?? "").trim())
    .maybeSingle();
  if (!order || order.company_id !== admin.companyId) {
    return NextResponse.json({ ok: false, reason: "その注文がありません。" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: false, reason: "もう入金済みです。" }, { status: 409 });
  }

  const base = siteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    /* 日本の会社が買うので、領収に要る情報を取っておく */
    billing_address_collection: "required",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: order.amount as number,
          product_data: {
            name: "足場の特別教育（学科）受講コード",
            description: `${order.seats}名ぶん・税込`,
          },
        },
      },
    ],
    /* どの注文の支払いかを、戻ってきたときに突き合わせる */
    client_reference_id: order.id as string,
    metadata: { order_id: order.id as string },
    success_url: `${base}/order?paid=${order.id}`,
    cancel_url: `${base}/order?cancelled=${order.id}`,
  });

  await supabase
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id as string);

  return NextResponse.json({ ok: true, url: session.url });
}
