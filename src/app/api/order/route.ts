import { randomUUID } from "node:crypto";
import { groupAmounts, normalizeCouponCode, spreadDiscount } from "@/lib/coupon";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { issueSeats, listSeats, seatCounts } from "@/lib/seats";
import { heldCourseIds } from "@/lib/held";
import { findCourse, readyCourses } from "@/content/courses";
import { dueDateStr, quote } from "@/lib/pricing";
import { unitPrice } from "@/lib/price.server";
import { notify } from "@/lib/notify.server";
import { companyAdmins, membershipEnabled, openContract, ticketBalance } from "@/lib/membership.server";
import { addNotices } from "@/lib/notice.server";

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
  /** ticket は法人会員のチケット（0040）。税抜のぶんを残高から引く。請求書は出ない */
  method?: "card" | "invoice" | "ticket";
  /** 協力会社のぶんを代理店のチケットで買う（docs/122）。method は ticket だけ */
  forCompanyId?: string;
  billTo?: string;
  note?: string;
  /** クーポン。無ければ、いつもどおりの値段 */
  code?: unknown;
};

type Ticket = { contractId: string; kind: string; total: number; expiring: number; nextExpire: string | null };

/** 協力会社（docs/122）。代理店（kind=agency）の下に付いた会社。代理店のチケットで受講コードを買ってやれる */
async function childrenOf(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  ticket: Ticket | null,
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  if (!ticket || ticket.kind !== "agency") return [];
  const { data, error } = await supabase.from("companies").select("id, name").eq("parent_id", companyId).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id as string, name: (c.name as string) ?? "" }));
}

/** その事業者の有効な契約と、チケットの残高。無ければ null。
    読めなかったら null にせず投げる（「残高 0」に化けると、払えるのに札が消える） */
async function ticketFor(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  companyId: string,
): Promise<Ticket | null> {
  if (!membershipEnabled()) return null;
  const open = await openContract(supabase, companyId);
  if (!open.ok) throw new Error(open.reason);
  const c = open.contract;
  if (!c || c.status !== "active") return null;
  const bal = await ticketBalance(supabase, c.id as string);
  if (!bal.ok) throw new Error(bal.reason);
  return { contractId: c.id as string, kind: (c.kind as string) ?? "member", ...bal.balance };
}

export async function GET() {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの画面です。" }, { status: 403 });
  }

  /* ── 並べて聞く（2026-09-10）──
     げんきさん「受講コードを追加で申し込むがめちゃくちゃ遅い」。
     互いに要らないものを上から順に await していたので、
     Supabase まで9回ぶん順番待ちしていた。 */

  /* ── 受けたいと送られている数（講座ごと）──

     受講リクエスト（0025）は担当者の画面に出るが、**申込みの画面には
     出ていなかった。**担当者がここへ来る理由の多くは
     「送られてきたぶんを買う」なのに、何人ぶん要るのかを
     別の画面で数えて、覚えてから来ることになっていた
     （げんきさん 2026-09-09）。

     自社宛の、まだ対応していないものだけ。会社は画面から受け取らない
     （ログインしている担当者の会社を使う）。 */
  const [{ data: orders }, { data: reqs }, { data: mems }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, course_id, seats, unit_price, amount, method, status, due_date, paid_at, created_at")
      .eq("company_id", admin.companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("course_requests")
      .select("course_id")
      .eq("company_id", admin.companyId)
      .is("handled_at", null),
    /* ── 在籍している人（受講コードの一覧から「配る」相手を選ぶため）──
       承認済みで、辞めていない人だけ。よその人・辞めた人には配れない
       （assign_seat も同じことを見るが、そもそも選べない方がよい） */
    supabase
      .from("memberships")
      .select("user_id")
      .eq("company_id", admin.companyId)
      .not("approved_at", "is", null)
      .is("left_at", null),
  ]);

  const requests: Record<string, number> = {};
  for (const r of reqs ?? []) {
    const cid = r.course_id as string;
    if (cid) requests[cid] = (requests[cid] ?? 0) + 1;
  }

  const memberIds = [...new Set((mems ?? []).map((m) => m.user_id as string).filter(Boolean))];
  const ids = (orders ?? []).map((o) => o.id as string);
  const paidIds = (orders ?? []).filter((o) => o.status === "paid").map((o) => o.id as string);

  /* 人のぶんと、注文のぶんは、互いに要らない。同時に聞く */
  const [{ data: us }, heldBy, counts, paid, codes] = await Promise.all([
    memberIds.length
      ? supabase.from("users").select("id, name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    /* 取得済みの講座。**取得済みの資格には配れない**ので、「配る」の相手から外す
       （選べても assign が断るが、断られてから気づくより、先に分かる方がよい） */
    heldCourseIds(supabase, memberIds),
    seatCounts(supabase, ids),
    seatCounts(supabase, paidIds),
    /* コードの文字そのもの。数だけ返しても、担当者は受講者に配れない */
    listSeats(
      supabase,
      (orders ?? []).map((o) => ({
        id: o.id as string,
        status: o.status as string,
        course_id: o.course_id as string,
      })),
    ),
  ]);
  /* ── 法人会員のチケット（0040）──
     有効な契約があれば、残高を返す。画面はこれで「チケットで払う」を出す。
     制度を開けていない店・契約の無い会社には null（札そのものが出ない） */
  let ticket: Ticket | null = null;
  let children: { id: string; name: string }[] = [];
  try {
    ticket = await ticketFor(supabase, admin.companyId);
    children = await childrenOf(supabase, ticket, admin.companyId);
  } catch (e) {
    return NextResponse.json({ ok: false, reason: `チケットを読めませんでした（${e instanceof Error ? e.message : String(e)}）` }, { status: 500 });
  }

  const members = (us ?? [])
    .map((u) => ({
      id: u.id as string,
      name: ((u.name as string) ?? "").trim() || "（氏名未登録）",
      held: heldBy.get(u.id as string) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

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
    /* 在籍している人。受講コードの一覧の「配る」で選ぶ */
    members,
    /* 法人会員のチケット。無ければ null */
    ticket,
    /* 協力会社（代理店だけ）。選ぶと、その会社の受講コードを代理店のチケットで買う */
    children,
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
  const lines: { courseId: string; short: string; seats: number; unitPrice: number; subtotal: number; total: number }[] = [];
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
    lines.push({ courseId: course.id, short: course.short, seats: q.seats, unitPrice: q.unitPrice, subtotal: q.subtotal, total: q.total });
  }
  if (!lines.length) {
    return NextResponse.json({ ok: false, reason: "講座がありません。" }, { status: 400 });
  }

  const method = b.method === "card" ? "card" : b.method === "ticket" ? "ticket" : "invoice";
  const now = new Date();

  /* ── チケットで払う（0040）──
     法人会員の有効な契約が要る。残高の確認は SQL（spend_tickets）が行ロックの中でやる。
     ここで見るのは「契約があるか」だけ。見せるために残高も読む */
  let ticket: Ticket | null = null;
  if (method === "ticket") {
    if (!membershipEnabled()) {
      return NextResponse.json({ ok: false, reason: "チケットは使えません。" }, { status: 404 });
    }
    try {
      ticket = await ticketFor(supabase, admin.companyId);
    } catch (e) {
      return NextResponse.json({ ok: false, reason: `チケットを読めませんでした（${e instanceof Error ? e.message : String(e)}）` }, { status: 500 });
    }
    if (!ticket) {
      return NextResponse.json({ ok: false, reason: "有効な法人会員の契約がありません。" }, { status: 409 });
    }
  }

  /* ── 協力会社のぶん（docs/122）──
     代理店（kind=agency）の担当者が、自社の下に付いた会社の受講コードを、自社のチケットで買う。
     注文は**協力会社の注文**として立つ（company_id は協力会社）。受講コードは協力会社の担当者が配る。
     チケット以外の払い方では認めない（請求書の宛先が二重になる） */
  const forId = String(b.forCompanyId ?? "").trim();
  let targetCompany = { id: admin.companyId, name: admin.companyName };
  if (forId && forId !== admin.companyId) {
    if (method !== "ticket" || !ticket) {
      return NextResponse.json({ ok: false, reason: "協力会社のぶんはチケットでだけ申し込めます。" }, { status: 400 });
    }
    if (ticket.kind !== "agency") {
      return NextResponse.json({ ok: false, reason: "協力会社のぶんを申し込めるのは販売代理店の契約だけです。" }, { status: 403 });
    }
    const { data: child, error: chErr } = await supabase
      .from("companies").select("id, name, parent_id").eq("id", forId).maybeSingle();
    if (chErr) return NextResponse.json({ ok: false, reason: `協力会社を読めませんでした（${chErr.message}）` }, { status: 500 });
    if (!child || child.parent_id !== admin.companyId) {
      return NextResponse.json({ ok: false, reason: "その会社は自社の協力会社ではありません。" }, { status: 403 });
    }
    targetCompany = { id: child.id as string, name: (child.name as string) ?? "" };
  }
  /* 支払期限は請求書の発行から1週間（げんきさん 2026-09-11）。
     請求書は申し込んだその場で出るので、起点はここでよい。
     **日本の日付で切る**（dueDateStr）。世界標準時のまま切ると、
     朝9時前に申し込んだ人の期限が1日手前になる。
     カード払いはその場で払うので期限を持たない */
  const due = method === "invoice" ? dueDateStr(now) : null;
  /* ひとまとめの印。請求書と入金の確認は、これでまとめる。
     1講座だけでも group を作る。**例外を作らない**（0029） */
  const groupId = randomUUID();

  /* ── クーポン（0032）──

     **引くかどうかを決めるのは、ここではなく SQL（use_coupon）。**
     画面で見せた額をそのまま使うと、見てから申し込むまでの間に
     上限に達したクーポンが通ってしまう。使えるかを見て、記録するまでを
     ひとつの関数の中でやる。

     申込みまるごとに1枚。値引きは、このあと講座ごとの行に配る。 */
  const code = typeof b.code === "string" ? normalizeCouponCode(b.code) : "";
  const gross = lines.reduce((n, l) => n + l.subtotal, 0);
  let discount = 0;
  let couponId: string | null = null;
  let couponName = "";
  if (code) {
    const { data: cp, error: cErr } = await supabase.rpc("use_coupon", {
      p_code: code,
      p_group: groupId,
      p_company: admin.companyId,
      p_user: admin.userId,
      p_gross: gross,
    });
    if (cErr) {
      /* 断る理由は、そのまま画面に出す（期限切れ・回数など） */
      return NextResponse.json({ ok: false, reason: cErr.message }, { status: 409 });
    }
    const row = (Array.isArray(cp) ? cp[0] : cp) as
      | { coupon_id: string; name: string; discount: number }
      | undefined;
    discount = Number(row?.discount) || 0;
    couponId = row?.coupon_id ?? null;
    couponName = row?.name ?? "";
  }
  /* 値引きを講座ごとの行に配る。**行に配らないと、合計だけ安いのに
     明細を足すと合わない請求書になる** */
  const shares = spreadDiscount(lines.map((l) => l.subtotal), discount);
  /* 消費税は申込みまるごとで1回だけ端数を落とし、行に配る（インボイス制度。2026-09-11） */
  const money = groupAmounts(lines.map((l) => l.subtotal), shares);

  const { data: made, error } = await supabase
    .from("orders")
    .insert(
      lines.map((l, i) => ({
        company_id: targetCompany.id,
        group_id: groupId,
        course_id: l.courseId,
        seats: l.seats,
        unit_price: l.unitPrice,
        amount: money.amounts[i],
        method,
        status: "pending",
        due_date: due,
        ordered_by: admin.userId,
        bill_to: (b.billTo ?? "").trim() || (targetCompany.id !== admin.companyId ? `${targetCompany.name}（${admin.companyName} のチケット）` : null),
        note: (b.note ?? "").trim() || null,
        /* クーポンを使ったときだけ足す。**使っていない申込みは、
           版が古いデータベースでも今までどおり通る** */
        ...(couponId ? { coupon_id: couponId, discount: shares[i] } : {}),
        /* チケットで払うときだけ、契約を結ぶ（0040） */
        ...(ticket ? { contract_id: ticket.contractId } : {}),
      })),
    )
    .select("id, course_id, amount");
  if (error || !made?.length) {
    /* 注文を作れなかったのに、クーポンだけ使ったことにしない。
       **残り回数だけが減る**と、あとから理由が分からなくなる */
    if (couponId) {
      await supabase.rpc("release_coupon_use", { p_group: groupId });
    }
    /* データベースの版が古いと、ここで断られる（group_id の列が無い）。
       生の文言だけ出しても直し方が分からないので、足す。
       /setup の「データベースの版」でも同じことが分かる */
    const stale = /group_id|coupon_id|discount/.test(error?.message ?? "");
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

  /* ── チケットで払う（0040）──
     税抜の合計を残高から引く（spend_tickets。古いロットから、負にしない）。
     引けたら、その場で入金済みにして受講コードを立てる。
     **引けなければ注文を下げる。**注文だけ残すと、払っていない入金待ちが
     運営の画面に並び、請求書を送ってしまう */
  if (method === "ticket" && ticket) {
    const first = made[0].id as string;
    const { data: left, error: tErr } = await supabase.rpc("spend_tickets", {
      p_contract: ticket.contractId,
      p_amount: money.net,
      p_order: first,
      p_by: admin.userId,
    });
    if (tErr) {
      await supabase.from("orders").delete().eq("group_id", groupId);
      if (couponId) await supabase.rpc("release_coupon_use", { p_group: groupId });
      return NextResponse.json({ ok: false, reason: tErr.message }, { status: 409 });
    }
    const { error: uErr } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: now.toISOString() })
      .eq("group_id", groupId);
    if (uErr) {
      /* 引いたのに注文が立たない。引いたぶんを戻して断る（return_tickets は同じ注文を二度戻さない） */
      await supabase.rpc("return_tickets", { p_order: first, p_by: admin.userId });
      await supabase.from("orders").delete().eq("group_id", groupId);
      if (couponId) await supabase.rpc("release_coupon_use", { p_group: groupId });
      return NextResponse.json({ ok: false, reason: `注文を立てられませんでした（${uErr.message}）` }, { status: 500 });
    }
    let issued = 0;
    for (const [i, m] of made.entries()) {
      issued += await issueSeats(supabase, m.id as string, lines[i].seats);
    }
    /* 協力会社のぶんなら、その会社の担当者に「受講コードが出ました」（配るのはその担当者） */
    if (targetCompany.id !== admin.companyId) {
      await addNotices(await companyAdmins(supabase, targetCompany.id), "seat", { courseId: lines[0].courseId });
    }
    return NextResponse.json({
      ok: true,
      orderId: first,
      groupId,
      course: { id: made[0].course_id as string, short: lines[0].short },
      items: lines.map((l, i) => ({ courseId: l.courseId, short: l.short, seats: l.seats, amount: money.amounts[i] })),
      method,
      coupon: couponId ? { name: couponName, discount } : null,
      quote: { seats: lines.reduce((n, l) => n + l.seats, 0), total: money.amount },
      seatsIssued: issued,
      /* 引いた額（税抜）と、引いたあとの残高 */
      ticket: { spent: money.net, left: Number(left) || 0 },
    });
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
    items: lines.map((l, i) => ({
      courseId: l.courseId,
      short: l.short,
      seats: l.seats,
      amount: money.amounts[i],
    })),
    method,
    /* 使ったクーポン。画面で「◯◯で 2,250円引きました」と出す */
    coupon: couponId ? { name: couponName, discount } : null,
    quote: {
      seats: lines.reduce((n, l) => n + l.seats, 0),
      total: money.amount,
    },
    seatsIssued: 0,
  });
}
