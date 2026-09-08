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
    metadata?: { order_id?: string; group_id?: string } | null;
    client_reference_id?: string | null;
  };
  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: true, skipped: "unpaid" });
  }

  const orderId = session.metadata?.order_id ?? session.client_reference_id ?? "";
  const { data: order } = await supabase
    .from("orders")
    .select("id, seats, status, group_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: true, skipped: "no order" });
  }

  /* 申込みまるごと入金にする。カードは1回で切ってあるので（checkout）、
     ここで一部だけ立てると、払ったのに受講コードの出ない講座が残る（0029） */
  const group = session.metadata?.group_id ?? (order.group_id as string) ?? (order.id as string);

  /* 同じ知らせが二度来ても、席を二重に配らない。
     **「入金待ちのものだけ」を立てる**ので、後から来た方は0件になる */
  const { data: won } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_session_id: session.id })
    .eq("group_id", group)
    .eq("status", "pending")
    .select("id, seats");
  if (!won?.length) {
    return NextResponse.json({ ok: true, already: true });
  }

  let made = 0;
  for (const r of won) made += await issueSeats(supabase, r.id as string, r.seats as number);
  return NextResponse.json({ ok: true, seatsIssued: made, orders: won.length });
}
