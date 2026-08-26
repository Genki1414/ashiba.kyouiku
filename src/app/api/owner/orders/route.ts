import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner, ownerEmails } from "@/lib/owner";
import { currentUser } from "@/lib/supabase/session";
import { issueSeats } from "@/lib/seats";
import { seller } from "@/content/legal";

/* 運営（売っている側）の画面。すべての事業者の注文を見て、
   請求書払いの入金を確認する。

   誰が運営かは環境変数 OWNER_EMAILS で決める（src/lib/owner.ts）。
   データベースに持たせない。担当者の画面から昇格する道を作らないため。 */

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    /* なぜ開けないかが分かるようにする。
       自分のメールを自分に見せるだけなので、漏れる先は無い */
    const me = await currentUser();
    const n = ownerEmails().length;
    return NextResponse.json(
      {
        ok: false,
        reason: !me
          ? "ログインしてください。"
          : n === 0
            ? "運営がまだ決まっていません。Vercel の環境変数 OWNER_EMAILS に、運営のメールを入れてください。"
            : `いまログインしているのは ${me.email} です。この住所が OWNER_EMAILS に入っていません（いま${n}件）。住所を足すか、入っている住所でログインし直してください。`,
        email: me?.email ?? null,
        owners: n,
      },
      { status: 403 },
    );
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, company_id, seats, unit_price, amount, method, status, due_date, paid_at, bill_to, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = [...new Set((orders ?? []).map((o) => o.company_id as string))];
  const orderIds = (orders ?? []).map((o) => o.id as string);

  /* 会社の名前と席は、どちらも注文から引ける。まとめて聞く。
     席は注文で絞る。絞らないと、売れば売るほど全件を読むことになる */
  const [{ data: cos }, { data: seats }] = await Promise.all([
    ids.length
      ? supabase.from("companies").select("id, name, trial").in("id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    orderIds.length
      ? supabase.from("seats").select("order_id, used_by").in("order_id", orderIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const nameOf = new Map((cos ?? []).map((c) => [c.id as string, c.name as string]));
  const used = new Map<string, { total: number; used: number }>();
  for (const s of seats ?? []) {
    const k = s.order_id as string;
    const v = used.get(k) ?? { total: 0, used: 0 };
    v.total++;
    if (s.used_by) v.used++;
    used.set(k, v);
  }

  return NextResponse.json({
    ok: true,
    owner,
    /* 請求書を書くときに要る。画面から写せるように、ここで返す */
    invoiceNo: seller().invoiceNo,
    companies: cos ?? [],
    orders: (orders ?? []).map((o) => ({
      ...o,
      company: nameOf.get(o.company_id as string) ?? "",
      seatsIssued: used.get(o.id as string)?.total ?? 0,
      seatsUsed: used.get(o.id as string)?.used ?? 0,
    })),
  });
}

type Body =
  | { action: "paid"; orderId: string }
  | { action: "cancel"; orderId: string }
  | { action: "trial"; companyId: string; trial: boolean };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "運営だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Partial<Body>;

  if (b.action === "trial" && "companyId" in b && b.companyId) {
    const { error } = await supabase
      .from("companies")
      .update({ trial: b.trial === true })
      .eq("id", b.companyId);
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = ("orderId" in b ? b.orderId : "") ?? "";
  if (!id) {
    return NextResponse.json({ ok: false, reason: "注文が分かりません。" }, { status: 400 });
  }
  const { data: order } = await supabase
    .from("orders")
    .select("id, seats, status, method")
    .eq("id", id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: false, reason: "その注文がありません。" }, { status: 404 });
  }

  if (b.action === "cancel") {
    if (order.status === "paid") {
      return NextResponse.json(
        { ok: false, reason: "入金済みの注文は取り消せません。返金は Stripe 側で。" },
        { status: 409 },
      );
    }
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  /* 入金を確認した（請求書払い）。カード払いは webhook が立てるので、ここでは触らない */
  if (order.status === "paid") return NextResponse.json({ ok: true, already: true });
  if (order.method === "card") {
    return NextResponse.json(
      { ok: false, reason: "カード払いの入金は Stripe からの知らせで立ちます。" },
      { status: 409 },
    );
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  /* 請求書払いは申込みのときに配っているが、足りなければ足す */
  const { count } = await supabase
    .from("seats")
    .select("id", { count: "exact", head: true })
    .eq("order_id", id);
  const short = (order.seats as number) - (count ?? 0);
  const made = short > 0 ? await issueSeats(supabase, id, short) : 0;
  return NextResponse.json({ ok: true, seatsIssued: made });
}
