import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { issueSeats } from "@/lib/seats";

/* Stripe からの知らせ。ここだけが「入金済み」を立てる。

   画面から「払いました」と言われても信じない。
   Stripe の署名を確かめたものだけを通す。 */

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabase = getServiceClient();
  if (!stripe || !secret || !supabase) {
    return NextResponse.json({ ok: false, reason: "not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    /* 署名が合わない。誰かが偽って叩いている */
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const session = event.data.object as {
    id: string;
    payment_status?: string;
    metadata?: { order_id?: string } | null;
    client_reference_id?: string | null;
  };
  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: true, skipped: "unpaid" });
  }

  const orderId = session.metadata?.order_id ?? session.client_reference_id ?? "";
  const { data: order } = await supabase
    .from("orders")
    .select("id, seats, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: true, skipped: "no order" });
  }
  /* 同じ知らせが二度来ても、席を二重に配らない */
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, already: true });
  }

  await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_session_id: session.id })
    .eq("id", order.id as string);

  const made = await issueSeats(supabase, order.id as string, order.seats as number);
  return NextResponse.json({ ok: true, seatsIssued: made });
}
