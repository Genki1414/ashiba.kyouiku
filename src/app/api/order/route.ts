import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { listSeats, seatCounts } from "@/lib/seats";
import { findCourse, readyCourses } from "@/content/courses";
import { dueDate, quote } from "@/lib/pricing";
import { unitPrice } from "@/lib/price.server";

/* 申込み。教育担当者だけ。

   ・カード … 注文を作ってから Stripe の支払い画面へ送る（/api/stripe/checkout）
   ・請求書 … 注文を作り、受講コードはすぐ配る。入金確認は運営が押す

   金額はサーバで計算する。画面から送られてきた金額は見ない。 */

type Body = { courseId?: string; seats?: number; method?: "card" | "invoice"; billTo?: string; note?: string };

export async function GET() {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの画面です。" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, course_id, seats, unit_price, amount, method, status, due_date, paid_at, created_at")
    .eq("company_id", admin.companyId)
    .order("created_at", { ascending: false });

  const ids = (orders ?? []).map((o) => o.id as string);
  const counts = await seatCounts(supabase, ids);
  const paidIds = (orders ?? []).filter((o) => o.status === "paid").map((o) => o.id as string);
  const paid = await seatCounts(supabase, paidIds);
  /* コードの文字そのもの。数だけ返しても、担当者は受講者に配れない */
  const codes = await listSeats(
    supabase,
    (orders ?? []).map((o) => ({
      id: o.id as string,
      status: o.status as string,
      course_id: o.course_id as string,
    })),
  );

  return NextResponse.json({
    ok: true,
    company: admin.companyName,
    /* 単価はサーバだけが持つ（SEAT_UNIT_PRICE は NEXT_PUBLIC_ ではない）。
       画面で計算させると、見せる金額と請求する金額が食い違う */
    /* 講座ごとに値段が違う。1つだけ返すと、選び直したときに
       画面の金額が古いままになる。既定はいちばん上の講座 */
    unitPrice: unitPrice(readyCourses()[0]?.id),
    orders: orders ?? [],
    seats: { total: counts.total, used: counts.used, paid: paid.total },
    codes,
    /* 受講コードは講座ごと。どれを買うかを選んでもらう。
       単価もここで一緒に返す（画面では計算しない） */
    courses: readyCourses().map((c) => ({
      id: c.id,
      short: c.short,
      name: c.name,
      unitPrice: unitPrice(c.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  /* 受講コードは1講座ぶん。どの講座の席かをここで決める */
  const course = findCourse(b.courseId) ?? readyCourses()[0] ?? null;
  if (!course) {
    return NextResponse.json({ ok: false, reason: "講座がありません。" }, { status: 400 });
  }
  const method = b.method === "card" ? "card" : "invoice";
  const q = quote(Number(b.seats), unitPrice(course.id));
  if (!q) {
    return NextResponse.json({ ok: false, reason: "人数を確かめてください。" }, { status: 400 });
  }

  const now = new Date();
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      company_id: admin.companyId,
      course_id: course.id,
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

  /* 受講コードは、ここでは作らない。
     入金を確認してから作る（本部の画面の「入金を確認した」）。

     前は申込みと同時に配っていたが、請求書に
     「お振込みの確認後、受講コードを発行します」と書いてあるのに
     先に配ってしまうと、払わずに受講できる。
     カード払いは Stripe からの知らせで作る（/api/stripe/webhook）。 */
  return NextResponse.json({
    ok: true,
    orderId: order.id,
    course: { id: course.id, short: course.short },
    method,
    quote: q,
    seatsIssued: 0,
  });
}
