import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { listSeats, seatCounts } from "@/lib/seats";
import { findCourse, readyCourses } from "@/content/courses";
import { dueDate, quote } from "@/lib/pricing";
import { unitPrice } from "@/lib/price.server";
import { notify } from "@/lib/notify.server";

/* 申込み。教育担当者だけ。

   ・カード … 注文を作ってから Stripe の支払い画面へ送る（/api/stripe/checkout）
   ・請求書 … 注文を作り、受講コードはすぐ配る。入金確認は運営が押す

   金額はサーバで計算する。画面から送られてきた金額は見ない。 */

/** 申し込む中身。**講座ごとに人数を持つ。**

    `items` がまとめ申込み。`courseId`/`seats` は1講座だけの古い形で、
    受け続ける（画面が新しくなっても、古い呼び方で壊さない）。 */
type Item = { courseId?: string; seats?: number };
type Body = {
  items?: Item[];
  courseId?: string;
  seats?: number;
  method?: "card" | "invoice";
  billTo?: string;
  note?: string;
};

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

  /* ── 受けたいと送られている数（講座ごと）──

     受講リクエスト（0025）は担当者の画面に出るが、**申込みの画面には
     出ていなかった。**担当者がここへ来る理由の多くは
     「送られてきたぶんを買う」なのに、何人ぶん要るのかを
     別の画面で数えて、覚えてから来ることになっていた
     （げんきさん 2026-09-09）。

     自社宛の、まだ対応していないものだけ。会社は画面から受け取らない
     （ログインしている担当者の会社を使う）。 */
  const { data: reqs } = await supabase
    .from("course_requests")
    .select("course_id")
    .eq("company_id", admin.companyId)
    .is("handled_at", null);
  const requests: Record<string, number> = {};
  for (const r of reqs ?? []) {
    const cid = r.course_id as string;
    if (cid) requests[cid] = (requests[cid] ?? 0) + 1;
  }

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
    /* 講座ごとの「受けたいと送られている数」。
       0の講座は入れない（画面で 0件 と出しても意味が無い） */
    requests,
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
  /* まとめ申込み。1講座だけの古い呼び方も、1件の申込みとして受ける */
  const raw: Item[] = Array.isArray(b.items) && b.items.length
    ? b.items
    : [{ courseId: b.courseId, seats: b.seats }];

  /* 受講コードは講座ごと。行も講座ごとに立てる。

     **同じ講座を2行に分けない。**分けると受講コードの束が2つに割れ、
     担当者が「足場の10枚」を数えるのに2か所を足すことになる */
  const seen = new Set<string>();
  const lines: { courseId: string; short: string; seats: number; unitPrice: number; total: number }[] = [];
  for (const it of raw) {
    const course = findCourse(it?.courseId) ?? (raw.length === 1 ? readyCourses()[0] : null);
    if (!course) {
      return NextResponse.json({ ok: false, reason: "講座が分かりません。" }, { status: 400 });
    }
    if (seen.has(course.id)) {
      return NextResponse.json(
        { ok: false, reason: `${course.short}が2回入っています。` },
        { status: 400 },
      );
    }
    seen.add(course.id);
    const q = quote(Number(it?.seats), unitPrice(course.id));
    if (!q) {
      return NextResponse.json(
        { ok: false, reason: `${course.short}の人数を確かめてください。` },
        { status: 400 },
      );
    }
    lines.push({ courseId: course.id, short: course.short, seats: q.seats, unitPrice: q.unitPrice, total: q.total });
  }
  if (!lines.length) {
    return NextResponse.json({ ok: false, reason: "講座がありません。" }, { status: 400 });
  }

  const method = b.method === "card" ? "card" : "invoice";
  const now = new Date();
  const due = method === "invoice" ? dueDate(now).toISOString().slice(0, 10) : null;
  /* ひとまとめの印。請求書と入金の確認は、これでまとめる。
     1講座だけでも group を作る。**例外を作らない**（0029） */
  const groupId = randomUUID();

  const { data: made, error } = await supabase
    .from("orders")
    .insert(
      lines.map((l) => ({
        company_id: admin.companyId,
        group_id: groupId,
        course_id: l.courseId,
        seats: l.seats,
        unit_price: l.unitPrice,
        amount: l.total,
        method,
        status: "pending",
        due_date: due,
        ordered_by: admin.userId,
        bill_to: (b.billTo ?? "").trim() || null,
        note: (b.note ?? "").trim() || null,
      })),
    )
    .select("id, course_id, amount");
  if (error || !made?.length) {
    /* データベースの版が古いと、ここで断られる（group_id の列が無い）。
       生の文言だけ出しても直し方が分からないので、足す。
       /setup の「データベースの版」でも同じことが分かる */
    const stale = /group_id/.test(error?.message ?? "");
    return NextResponse.json(
      {
        ok: false,
        reason:
          (error?.message ?? "作れません") +
          (stale
            ? "（データベースの版が古いようです。Supabase の SQL Editor に supabase/apply-all.sql を貼って実行してください）"
            : ""),
      },
      { status: 500 },
    );
  }

  /* 運営に知らせる。**申込み1件につき1回。**講座の数だけ鳴らすと、
     3講座まとめて頼まれただけで3回鳴り、そのうち誰も見なくなる */
  await notify("order");

  /* 受講コードは、ここでは作らない。
     入金を確認してから作る（本部の画面の「入金を確認した」）。

     前は申込みと同時に配っていたが、請求書に
     「お振込みの確認後、受講コードを発行します」と書いてあるのに
     先に配ってしまうと、払わずに受講できる。
     カード払いは Stripe からの知らせで作る（/api/stripe/webhook）。 */
  /* 請求書は group で1枚。**どの行を開いても同じ1枚が出る**ので、
     返すのは先頭の行の番号でよい（/invoice/<orderId>） */
  const first = made[0];
  return NextResponse.json({
    ok: true,
    orderId: first.id,
    groupId,
    course: { id: first.course_id as string, short: lines[0].short },
    items: lines.map((l) => ({ courseId: l.courseId, short: l.short, seats: l.seats, amount: l.total })),
    method,
    quote: {
      seats: lines.reduce((n, l) => n + l.seats, 0),
      total: lines.reduce((n, l) => n + l.total, 0),
    },
    seatsIssued: 0,
  });
}
