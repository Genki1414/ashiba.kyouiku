import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { dueDate, quote } from "@/lib/pricing";
import { trainPrice } from "@/lib/price.server";
import { trainFor } from "@/lib/trainingGate";

/* 実務トレーニング（第2章から先）を、本人が申し込む。

   教育担当者を通さない。会社に言いにくい人もいるし、
   一人親方や、これから入る人もいる。

   請求書払いだけ。カード払いはまだ通していない。
   個人宛の請求書を出せないと、経費で落とす人が買えないので、
   宛名と宛先をここで受け取る（空なら登録した氏名を使う）。

   受講コード（席）は会社しか買えない。修了証は事業者の名簿に
   紐づくものなので、個人で持たせない（DB 側でも止めてある）。

   金額はサーバで計算する。画面から送られてきた金額は見ない。 */

type Body = { billTo?: string; billAddr?: string; note?: string };

const clip = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const [{ data: me }, { data: orders }, may] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, amount, unit_price, method, status, due_date, paid_at, bill_to, created_at")
      .eq("user_id", user.id)
      .eq("kind", "training")
      .order("created_at", { ascending: false }),
    trainFor(supabase, user.id),
  ]);

  return NextResponse.json({
    ok: true,
    name: (me?.name as string) ?? "",
    /* 単価はサーバだけが持つ。画面で計算させると、
       見せる金額と請求する金額が食い違う */
    unitPrice: trainPrice(),
    /* もう使えるか（買う前に「もう使えます」と分かるように） */
    already: may.ok,
    by: may.ok ? may.by : null,
    orders: orders ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  /* もう使える人には売らない（二重に払わせない） */
  const may = await trainFor(supabase, user.id);
  if (may.ok) {
    return NextResponse.json(
      { ok: false, reason: "もう第2章から先が開いています。申し込みは要りません。" },
      { status: 409 },
    );
  }

  /* 払っていない申し込みが残っていれば、それを返す。
     押すたびに注文が増えると、どれを払えばよいか分からなくなる */
  const { data: open } = await supabase
    .from("orders")
    .select("id, amount, due_date, bill_to, created_at")
    .eq("user_id", user.id)
    .eq("kind", "training")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (open?.id) {
    return NextResponse.json({ ok: true, order: open, already: true });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const { data: me } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const price = trainPrice();
  const q = quote(1, price);
  if (!q) {
    return NextResponse.json({ ok: false, reason: "金額を出せませんでした。" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      kind: "training",
      /* 1人ぶん。実務トレーニングは人に付く */
      seats: 1,
      unit_price: price,
      amount: q.total,
      method: "invoice",
      status: "pending",
      due_date: dueDate(new Date()).toISOString().slice(0, 10),
      /* 宛名。空なら登録した氏名。個人宛の請求書に載る */
      bill_to: clip(b.billTo, 100) ?? ((me?.name as string) || null),
      bill_addr: clip(b.billAddr, 200),
      note: clip(b.note, 200),
    })
    .select("id, amount, due_date, bill_to, created_at")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, order: data });
}
