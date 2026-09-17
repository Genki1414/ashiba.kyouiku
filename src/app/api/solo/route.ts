import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { findCourse, readyCourses } from "@/content/courses";
import { unitPrice } from "@/lib/price.server";
import { dueDateStr, quote } from "@/lib/pricing";
import { groupAmounts, normalizeCouponCode } from "@/lib/coupon";
import { learnFor } from "@/lib/entitleQuery";
import { courseMarks } from "@/lib/held";
import { hasStripe } from "@/lib/stripe";
import { notify } from "@/lib/notify.server";

/* ひとりで受ける（0039）。本人が、自分の受講コードを申し込む。

   げんきさん（2026-09-17）「利用者が増えない。会社登録が邪魔してる気がする」

   ── なぜ要るか ──
   投稿を見て来る人は1人。これまでは受講コードを会社しか買えなかったので、
   会社を登録して自分を教育担当者にし、人数ぶん申し込み、出たコードを
   自分に配って引き換える、という7段の道を歩かせていた。
   会社の話が出た時点で「うちの話じゃない」と閉じる。

   ── どう変えたか ──
   会社を作らない。担当者も名簿も無い。
   注文は個人の形（user_id・kind='seat'。実務トレーニングの個人注文と同じ）。
   入金を確認した瞬間に**本人の席が立つ**（pay_solo_seat）。
   コードを配る・打つ、という手順そのものが無い。

   ── 変わらないこと ──
   ・金額はサーバで計算する。画面から送られてきた金額は見ない
   ・受講コードは、ここでも入金の前には立てない
   ・クーポンは使える（use_coupon に会社は渡さない。個人の利用として記録する）
   ・カード払いは鍵が入っている店だけ（hasStripe）。無ければ請求書払い */

type Body = {
  courseId?: string;
  billTo?: string;
  billAddr?: string;
  note?: string;
  code?: string;
  method?: string;
};

const clip = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

const PENDING_COLS = "id, course_id, amount, due_date, bill_to, method, status, created_at";

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが必要です。" }, { status: 403 });
  }

  const [meRes, pendRes, marks] = await Promise.all([
    supabase.from("users").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select(PENDING_COLS)
      .eq("user_id", user.id)
      .eq("kind", "seat")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    courseMarks(supabase, user.id),
  ]);
  /* 宛名の既定値は添え物。読めなくても画面は出す */
  if (meRes.error) console.error("solo 氏名を読めない", meRes.error.message);
  /* 払っていない申込みは、二重に申し込ませないための本体。読めなかったら言う */
  if (pendRes.error) {
    return NextResponse.json(
      { ok: false, reason: `申込みを確かめられませんでした（${pendRes.error.message}）` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    name: (meRes.data?.name as string) ?? "",
    card: hasStripe(),
    /* 単価はサーバだけが持つ。画面で計算させると、見せる金額と請求する金額が食い違う */
    courses: readyCourses().map((c) => ({
      id: c.id,
      name: c.name,
      short: c.short,
      unitPrice: unitPrice(c.id),
    })),
    /* もう開いている講座（買う前に「もう受講できます」と分かるように） */
    learning: marks.learning,
    pending: pendRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが必要です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const course = findCourse(b.courseId);
  if (!course || !course.ready) {
    return NextResponse.json({ ok: false, reason: "講座が分かりません。" }, { status: 400 });
  }

  /* もう受けられる人には売らない（二重に払わせない） */
  const may = await learnFor(supabase, user.id, course.id);
  if (may.ok) {
    return NextResponse.json(
      { ok: false, reason: `${course.short}は、もう受講できます。申し込みは要りません。` },
      { status: 409 },
    );
  }

  /* 払っていない申込みが残っていれば、それを返す。
     押すたびに注文が増えると、どれを払えばよいか分からなくなる */
  const { data: open, error: openErr } = await supabase
    .from("orders")
    .select(PENDING_COLS)
    .eq("user_id", user.id)
    .eq("kind", "seat")
    .eq("course_id", course.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (openErr) {
    return NextResponse.json(
      { ok: false, reason: `申込みを確かめられませんでした（${openErr.message}）` },
      { status: 500 },
    );
  }
  if (open?.id) {
    return NextResponse.json({ ok: true, orderId: open.id, method: open.method, amount: open.amount, due: open.due_date, already: true });
  }

  const { data: me, error: meErr } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  if (meErr) console.error("solo 宛名の氏名を読めない", meErr.message);

  const price = unitPrice(course.id);
  const q = quote(1, price);
  if (!q) {
    return NextResponse.json({ ok: false, reason: "金額を出せませんでした。" }, { status: 500 });
  }

  /* カードは鍵が入っている店だけ。無ければ黙って請求書払いにせず、そう言う */
  let method: "card" | "invoice" = "invoice";
  if (b.method === "card") {
    if (!hasStripe()) {
      return NextResponse.json(
        { ok: false, reason: "カード払いはまだ使えません。請求書払いをお選びください。" },
        { status: 503 },
      );
    }
    method = "card";
  }
  const now = new Date();
  const due = method === "invoice" ? dueDateStr(now) : null;
  const groupId = randomUUID();

  /* クーポン（0032）。会社は無いので渡さない。個人の利用として記録する。
     引くかどうかを決めるのは SQL（use_coupon）。/api/order と同じ */
  const code = typeof b.code === "string" ? normalizeCouponCode(b.code) : "";
  let discount = 0;
  let couponId: string | null = null;
  let couponName = "";
  if (code) {
    const { data: cp, error: cErr } = await supabase.rpc("use_coupon", {
      p_code: code,
      p_group: groupId,
      p_company: null,
      p_user: user.id,
      p_gross: q.subtotal,
    });
    if (cErr) {
      return NextResponse.json({ ok: false, reason: cErr.message }, { status: 409 });
    }
    const row = (Array.isArray(cp) ? cp[0] : cp) as
      | { coupon_id: string; name: string; discount: number }
      | undefined;
    discount = Number(row?.discount) || 0;
    couponId = row?.coupon_id ?? null;
    couponName = row?.name ?? "";
  }
  /* 消費税は申込みまるごとで1回（インボイス制度）。行は1つ */
  const money = groupAmounts([q.subtotal], [discount]);

  const { data: made, error } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      kind: "seat",
      course_id: course.id,
      group_id: groupId,
      /* 1人ぶん。ひとりで受けるので、増やせない */
      seats: 1,
      unit_price: q.unitPrice,
      amount: money.amount,
      method,
      status: "pending",
      due_date: due,
      ordered_by: user.id,
      /* 宛名。空なら登録した氏名。個人宛の請求書に載る */
      bill_to: clip(b.billTo, 100) ?? ((me?.name as string) || null),
      bill_addr: clip(b.billAddr, 200),
      note: clip(b.note, 200),
      ...(couponId ? { coupon_id: couponId, discount } : {}),
    })
    .select("id, amount, due_date, method")
    .single();
  if (error || !made) {
    /* 注文を作れなかったのに、クーポンだけ使ったことにしない（/api/order と同じ） */
    if (couponId) await supabase.rpc("release_coupon_use", { p_group: groupId });
    const stale = /orders_seat_is_company|pay_solo_seat/.test(error?.message ?? "");
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

  /* 運営に知らせる。会社の申込みと同じ口 */
  await notify("order");

  /* 席はここでは立てない。入金を確認したとき（運営の画面・Stripe の知らせ）に
     pay_solo_seat が本人の席を立てる */
  return NextResponse.json({
    ok: true,
    orderId: made.id,
    groupId,
    method,
    amount: made.amount,
    due: made.due_date,
    coupon: couponId ? { name: couponName, discount } : null,
  });
}
