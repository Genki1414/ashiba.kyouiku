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

  const { data: o, error: oErr } = await supabase
    .from("orders")
    .select(
      "id, company_id, user_id, kind, course_id, group_id, seats, unit_price, amount, method, status, due_date, paid_at, invoiced_at, bill_to, bill_addr, note, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  /* 読めなかったことを「ありません」に化けさせない。
     版が古いだけなのに「その注文がありません」と出ると、
     消えたのかと思う（2026-09-09） */
  if (oErr) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          `注文を読めませんでした（${oErr.message}）。` +
          "データベースの版が古いときは、Supabase の SQL Editor に " +
          "supabase/apply-all.sql を貼って実行してください。",
      },
      { status: 500 },
    );
  }
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

  /* ── 同じ申込みの行を、ぜんぶ並べる ──

     講座ごとに1行だが、**申込みは1回で、振込も1回。**
     だから請求書は group ごとに1枚にして、講座ごとの行を並べ、
     合計をひとつ出す（0029）。

     3枚に分けると、1回でまとめて振り込まれたときに
     **どの請求書の入金か分からなくなる。** */
  const { data: rows } = await supabase
    .from("orders")
    .select("id, course_id, kind, seats, unit_price, amount, discount, coupon_id, created_at")
    .eq("group_id", (o.group_id as string) ?? (o.id as string))
    .order("created_at", { ascending: true });
  /* 版が古くて group_id がまだ無いときは、開いた1行だけで出す。
     ここで空にすると、**古い請求書が真っ白になる** */
  const group = (rows ?? []).length ? rows! : [o];

  const nameOf = (r: Record<string, unknown>) =>
    r.kind === "training"
      ? "実務トレーニング 利用権（第2章以降）"
      : `${findCourse((r.course_id as string) ?? "")?.short ?? "特別教育"} 受講コード`;

  const items = group.map((row) => {
    /* 開いた1行だけで出すとき（版が古い）と、group で引いたときで
       形が違う。読むときにそろえる */
    const r = row as Record<string, unknown>;
    const a = (r.amount as number) ?? 0;
    /* 税込から割り戻す。注文を作ったときの計算と食い違わせない */
    const after = Math.round(a / (1 + TAX_RATE));
    /* 値引き（0032）。明細に出すのは**値引き前**の額。
       値引きは1行にまとめて下に出す。行ごとに引いた額を並べると、
       「単価×数量」と行の金額が合わない請求書になる */
    const off = (r.discount as number) ?? 0;
    return {
      what: nameOf(r),
      qty: (r.seats as number) ?? 1,
      unit: (r.unit_price as number) ?? 0,
      net: after + off,
      tax: a - after,
      amount: a,
      discount: off,
    };
  });

  const amount = items.reduce((n, i) => n + i.amount, 0);
  /* 小計は値引き前（明細を足したもの）。
     **行ごとに割り戻してから足す。**合計から割り戻すと、
     行の税額を足したものと1円ずれることがある */
  const gross = items.reduce((n, i) => n + i.net, 0);
  const discount = items.reduce((n, i) => n + i.discount, 0);
  const net = gross - discount;
  const tax = amount - net;

  /* 使ったクーポンの名前。請求書に「値引き（◯◯協会）」と出す。
     **広告費は出さない。**買った側に見せる話ではない */
  let couponName = "";
  const couponId = (group as Record<string, unknown>[]).find((r) => r.coupon_id)?.coupon_id as
    | string
    | undefined;
  if (couponId) {
    const { data: cp } = await supabase
      .from("coupons")
      .select("name")
      .eq("id", couponId)
      .maybeSingle();
    couponName = (cp?.name as string) ?? "";
  }

  const what = items.length === 1
    ? items[0].what
    : `${items[0].what} ほか${items.length - 1}件`;

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
      /* 講座ごとの明細。**1講座だけの申込みでも1件入る**（例外を作らない） */
      items,
      qty: (o.seats as number) ?? 1,
      unit: (o.unit_price as number) ?? 0,
      /* 値引き前の小計と、値引き（0032）。値引きが無ければ 0 */
      gross,
      discount,
      couponName,
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
