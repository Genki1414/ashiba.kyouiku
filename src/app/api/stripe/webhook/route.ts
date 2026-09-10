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

  /* ── 読めなかったことを「無い」に化けさせない（2026-09-11）──

     ここは**お金の入口**。Stripe は 200 を受け取ると、その知らせを
     二度と送ってこない。だから読み書きに失敗したまま 200 を返すと、
     **カードは切れているのに入金が立たず、受講コードも出ない。**
     しかも記録に何も残らないので、あとから誰も気づけない。

     失敗したら 5xx を返す。Stripe は失敗を見ると、時間を空けて
     何度でも送り直してくれる。そのあいだに直せばよい。
     （docs/100「読めなかったを0件に化けさせない」と同じ話が、
       いちばん高いところに残っていた） */
  const orderId = session.metadata?.order_id ?? session.client_reference_id ?? "";
  const { data: order, error: readErr } = await supabase
    .from("orders")
    .select("id, seats, status, group_id")
    .eq("id", orderId)
    .maybeSingle();
  if (readErr) {
    console.error("stripe webhook 注文を読めない", orderId, readErr.message);
    return NextResponse.json(
      { ok: false, reason: "注文を読めませんでした。あとで送り直してください。" },
      { status: 503 },
    );
  }
  if (!order) {
    /* 本当に無い。よその決済か、消された注文。送り直させても同じなので 200 */
    console.error("stripe webhook 注文が無い", orderId);
    return NextResponse.json({ ok: true, skipped: "no order" });
  }

  /* 申込みまるごと入金にする。カードは1回で切ってあるので（checkout）、
     ここで一部だけ立てると、払ったのに受講コードの出ない講座が残る（0029） */
  const group = session.metadata?.group_id ?? (order.group_id as string) ?? (order.id as string);

  /* 同じ知らせが二度来ても、席を二重に配らない。
     **「入金待ちのものだけ」を立てる**ので、後から来た方は0件になる */
  const { data: won, error: payErr } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_session_id: session.id })
    .eq("group_id", group)
    .eq("status", "pending")
    .select("id, seats");
  if (payErr) {
    /* **立てられなかった。**ここで 200 を返すと、払ったのに未入金のまま残る */
    console.error("stripe webhook 入金を立てられない", group, payErr.message);
    return NextResponse.json(
      { ok: false, reason: "入金を記録できませんでした。あとで送り直してください。" },
      { status: 503 },
    );
  }
  if (!won?.length) {
    /* 0件は正しいこともある。同じ知らせが二度来た（もう立っている）ときと、
       取り消されているとき。**入金待ちが残っていないか**で見分ける */
    const { data: still, error: stillErr } = await supabase
      .from("orders")
      .select("id")
      .eq("group_id", group)
      .eq("status", "pending")
      .limit(1);
    /* **見分けが付かなかったら、成功にしない。**
       ここで 200 を返すと、直したかったことがそのまま起きる */
    if (stillErr || still?.length) {
      console.error("stripe webhook 入金待ちが残ったまま立たなかった", group, stillErr?.message ?? "");
      return NextResponse.json(
        { ok: false, reason: "入金を記録できませんでした。あとで送り直してください。" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, already: true });
  }

  let made = 0;
  for (const r of won) made += await issueSeats(supabase, r.id as string, r.seats as number);
  /* 立てたのに1枚も出せていない。**払ったのに受講できない**ので、そう言う。

     **要る枚数で見る。**「0件だから失敗」にすると、席を出さない
     申込み（実務トレーニングの利用権など）で送り直しが終わらなくなる。
     席を作る所は、すでにある枚数を数えてから足すので、
     送り直しても二重には出ない */
  const want = won.reduce((n, r) => n + ((r.seats as number) ?? 0), 0);
  if (want > 0 && made === 0) {
    console.error("stripe webhook 受講コードを出せなかった", group, want);
    return NextResponse.json(
      { ok: false, reason: "受講コードを発行できませんでした。あとで送り直してください。" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, seatsIssued: made, orders: won.length });
}
