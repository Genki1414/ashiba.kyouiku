import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { findCourse, readyCourses } from "@/content/courses";
import { unitPrice } from "@/lib/price.server";
import { normalizeCouponCode } from "@/lib/coupon";

/* クーポンが使えるか、いくら引けるかを先に見せる。**記録はしない。**

   打ってすぐ「2,250円引き」と出ないと、押してみるまで分からない。
   ただし、ここで見せた額をそのまま請求に使ってはいけない。
   **本当に引くのは申し込むとき**（/api/order が use_coupon を呼ぶ）。
   見てから申し込むまでの間に、上限に達することがある。

   金額は画面から受け取らない。講座と人数だけ受け取って、
   単価はサーバが持っているものを使う。受け取ると、
   安い金額を送って値引きだけ大きく見せられる。 */

type Item = { courseId?: unknown; seats?: unknown };
type Body = { code?: unknown; items?: Item[] };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const code = typeof b.code === "string" ? normalizeCouponCode(b.code) : "";
  if (!code) {
    return NextResponse.json({ ok: false, reason: "クーポンを入れてください。" }, { status: 400 });
  }

  /* 割引前の税抜。講座ごとの単価で足す */
  let gross = 0;
  for (const it of Array.isArray(b.items) ? b.items : []) {
    const course = findCourse(typeof it?.courseId === "string" ? it.courseId : "") ?? null;
    const seats = Number(it?.seats);
    if (!course || !Number.isInteger(seats) || seats < 1) continue;
    gross += unitPrice(course.id) * seats;
  }
  if (gross <= 0) {
    return NextResponse.json(
      { ok: false, reason: "先に講座と人数を選んでください。" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("coupon_check", {
    p_code: code,
    p_company: admin.companyId,
    p_gross: gross,
  });
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          `クーポンを読めませんでした（${error.message}）。` +
          "データベースの版が古いときは、Supabase の SQL Editor に " +
          "supabase/apply-all.sql を貼って実行してください。",
      },
      { status: 500 },
    );
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; reason: string | null; coupon_id: string | null; name: string | null; discount: number }
    | undefined;
  if (!row?.ok) {
    /* 断る理由は、そのまま画面に出す。次にやることが分かる文になっている */
    return NextResponse.json(
      { ok: false, reason: row?.reason ?? "そのクーポンは使えません。" },
      { status: 409 },
    );
  }

  const discount = Number(row.discount) || 0;

  /* ── 値引きの決まりも返す ──
     人数を変えたときに、画面がその場で計算し直せるようにする。
     返さないと、5名で見た値引きが10名に変えても そのまま残り、
     **申し込むまで違う額を見せることになる**（本当に引く額はサーバが決める）。
     率（10%）を見せて困ることは無い。値引きの額はもともと見せている */
  const { data: c } = await supabase
    .from("coupons")
    .select("percent_off, amount_off")
    .eq("id", row.coupon_id ?? "")
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    code,
    name: row.name ?? "",
    percentOff: (c?.percent_off as number) ?? null,
    amountOff: (c?.amount_off as number) ?? null,
    gross,
    discount,
    /* 広告費（reward_rate）は返さない。**買う側に見せる話ではない** */
    net: gross - discount,
    courses: readyCourses().length,
  });
}
