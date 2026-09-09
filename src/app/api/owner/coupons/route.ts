import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { currentUser } from "@/lib/supabase/session";
import { normalizeCouponCode } from "@/lib/coupon";

/* クーポンと、紹介してくれた人への広告費（0032）。本部だけ。

   ── 何を出すか ──
   げんきさんの依頼（2026-09-09）。
     「どのクーポンが利用されて、どのくらいの売上になってるかも把握したい」
     「広告費としてクーポン利用売上の何%かを支払いしようと思ってる」

   だから1枚ごとに「使われた回数・割引後の税抜売上・広告費」を出す。
   **入金済みと入金待ちを分ける。**まだ振り込まれていない申込みのぶんまで
   広告費を払うと、取り消されたときに払い過ぎになる。

   金額はぜんぶ税抜。広告費の元が税抜だから、並べて見えた方が確かめやすい。 */

type Use = {
  coupon_id: string;
  group_id: string;
  company_id: string | null;
  gross: number;
  discount: number;
  net: number;
  reward_rate: number;
  reward: number;
  used_at: string;
};

const stale = (m: string) =>
  `${m}（データベースの版が古いときは、Supabase の SQL Editor に supabase/apply-all.sql を貼って実行してください）`;

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  if (!(await currentOwner())) {
    return NextResponse.json({ ok: false, reason: "本部だけの画面です。" }, { status: 403 });
  }

  const [cs, ps, us] = await Promise.all([
    supabase
      .from("coupons")
      .select("id, code, name, percent_off, amount_off, partner_id, reward_rate, starts_at, expires_at, max_uses, company_uses, active, note, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("partners").select("id, name, contact, active").order("name"),
    supabase
      .from("coupon_uses")
      .select("coupon_id, group_id, company_id, gross, discount, net, reward_rate, reward, used_at")
      .order("used_at", { ascending: false }),
  ]);
  /* 読めなかったことを「0件」に化けさせない（docs/100） */
  const err = cs.error ?? ps.error ?? us.error;
  if (err) {
    return NextResponse.json({ ok: false, reason: stale(err.message) }, { status: 500 });
  }

  const uses = (us.data ?? []) as Use[];
  const groups = [...new Set(uses.map((u) => u.group_id))];

  /* その申込みが入金済みか、取り消されたか。注文の行を見る。
     行は講座ごとに分かれているが、入金も取り消しも申込みまるごと */
  const state = new Map<string, "paid" | "pending" | "cancelled">();
  if (groups.length) {
    const { data: os, error } = await supabase
      .from("orders")
      .select("group_id, status")
      .in("group_id", groups);
    if (error) {
      return NextResponse.json({ ok: false, reason: stale(error.message) }, { status: 500 });
    }
    for (const o of os ?? []) {
      const g = o.group_id as string;
      const s = o.status as string;
      const now = state.get(g);
      /* 1行でも入金待ちなら入金待ち。全部が取り消しのときだけ取り消し */
      if (s === "pending") state.set(g, "pending");
      else if (s === "paid" && now !== "pending") state.set(g, "paid");
      else if (!now) state.set(g, "cancelled");
    }
  }

  /* 会社の名前。「どこが使ったか」が分からないと、紹介の裏が取れない */
  const companyIds = [...new Set(uses.map((u) => u.company_id).filter(Boolean))] as string[];
  const { data: cos } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const coName = new Map((cos ?? []).map((c) => [c.id as string, c.name as string]));

  const zero = () => ({ uses: 0, net: 0, discount: 0, reward: 0 });
  const list = (cs.data ?? []).map((c) => {
    const mine = uses.filter((u) => u.coupon_id === c.id);
    const paid = zero();
    const pending = zero();
    for (const u of mine) {
      const st = state.get(u.group_id) ?? "cancelled";
      if (st === "cancelled") continue;
      const box = st === "paid" ? paid : pending;
      box.uses += 1;
      box.net += u.net ?? 0;
      box.discount += u.discount ?? 0;
      box.reward += u.reward ?? 0;
    }
    return {
      id: c.id as string,
      code: c.code as string,
      name: c.name as string,
      percentOff: (c.percent_off as number) ?? null,
      amountOff: (c.amount_off as number) ?? null,
      partnerId: (c.partner_id as string) ?? null,
      rewardRate: (c.reward_rate as number) ?? 0,
      startsAt: (c.starts_at as string) ?? null,
      expiresAt: (c.expires_at as string) ?? null,
      maxUses: (c.max_uses as number) ?? null,
      companyUses: (c.company_uses as number) ?? null,
      active: !!c.active,
      note: (c.note as string) ?? "",
      paid,
      pending,
      /* 明細。誰がいつ使ったか。**取り消したものも出す**（消えると調べられない） */
      rows: mine.slice(0, 50).map((u) => ({
        groupId: u.group_id,
        company: u.company_id ? (coName.get(u.company_id) ?? "（削除された事業者）") : "個人",
        net: u.net ?? 0,
        discount: u.discount ?? 0,
        reward: u.reward ?? 0,
        rate: u.reward_rate ?? 0,
        usedAt: u.used_at,
        status: state.get(u.group_id) ?? "cancelled",
      })),
    };
  });

  /* 支払い先ごとの合計。**払う相手ごとに1つの数字**が要る */
  const partners = (ps.data ?? []).map((p) => {
    const mine = list.filter((c) => c.partnerId === p.id);
    return {
      id: p.id as string,
      name: p.name as string,
      contact: (p.contact as string) ?? "",
      active: !!p.active,
      coupons: mine.length,
      paid: {
        uses: mine.reduce((n, c) => n + c.paid.uses, 0),
        net: mine.reduce((n, c) => n + c.paid.net, 0),
        reward: mine.reduce((n, c) => n + c.paid.reward, 0),
      },
      pending: {
        uses: mine.reduce((n, c) => n + c.pending.uses, 0),
        net: mine.reduce((n, c) => n + c.pending.net, 0),
        reward: mine.reduce((n, c) => n + c.pending.reward, 0),
      },
    };
  });

  return NextResponse.json({ ok: true, list, partners });
}

/* 作る・止める。本部だけ。

   作るときに決めるのは、値引きの形（率か定額）、支払い先、広告費の率、
   期限、使える回数の5つ。あとから直すのは「止める・戻す」だけにしてある。
   率を書き換えても、**すでに使われたぶんの広告費は動かない**
   （使った時の率を記録に焼き付けてある）。 */
type Body = {
  action?: unknown;
  /* クーポン */
  code?: unknown; name?: unknown; percentOff?: unknown; amountOff?: unknown;
  partnerId?: unknown; rewardRate?: unknown; expiresAt?: unknown;
  maxUses?: unknown; companyUses?: unknown; note?: unknown;
  id?: unknown; active?: unknown;
  /* 支払い先 */
  contact?: unknown;
};

const int = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as Body;
  const action = typeof b.action === "string" ? b.action : "";

  if (action === "partner") {
    const name = (typeof b.name === "string" ? b.name : "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, reason: "支払い先の名前を入れてください。" }, { status: 400 });
    }
    const { error } = await supabase.from("partners").insert({
      name,
      contact: (typeof b.contact === "string" ? b.contact : "").trim() || null,
    });
    if (error) return NextResponse.json({ ok: false, reason: stale(error.message) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle") {
    const id = (typeof b.id === "string" ? b.id : "").trim();
    if (!id) return NextResponse.json({ ok: false, reason: "どのクーポンか分かりません。" }, { status: 400 });
    const { error } = await supabase.from("coupons").update({ active: b.active === true }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, reason: stale(error.message) }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  /* 作る */
  const code = normalizeCouponCode(typeof b.code === "string" ? b.code : "");
  const name = (typeof b.name === "string" ? b.name : "").trim();
  const percentOff = int(b.percentOff);
  const amountOff = int(b.amountOff);
  if (!code || code.length < 3) {
    return NextResponse.json({ ok: false, reason: "クーポンの文字を3字以上で入れてください。" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, reason: "クーポンの名前を入れてください。" }, { status: 400 });
  }
  /* **率と定額を両方入れさせない。**どちらで引いたのか分からなくなる */
  if ((percentOff === null) === (amountOff === null)) {
    return NextResponse.json(
      { ok: false, reason: "率（◯%引き）か、定額（◯円引き）の、どちらか一方を入れてください。" },
      { status: 400 },
    );
  }
  if (percentOff !== null && percentOff > 100) {
    return NextResponse.json({ ok: false, reason: "率は100%までです。" }, { status: 400 });
  }
  const rewardRate = Number(b.rewardRate);
  if (!Number.isFinite(rewardRate) || rewardRate < 0 || rewardRate > 100) {
    return NextResponse.json({ ok: false, reason: "広告費の率は0〜100の間で入れてください。" }, { status: 400 });
  }
  const partnerId = (typeof b.partnerId === "string" ? b.partnerId : "").trim() || null;
  if (rewardRate > 0 && !partnerId) {
    /* 払う先が無いのに率だけ入っていると、あとで誰に払うのか分からなくなる */
    return NextResponse.json(
      { ok: false, reason: "広告費を出すなら、支払い先を選んでください。" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("coupons").insert({
    code,
    name,
    percent_off: percentOff,
    amount_off: amountOff,
    partner_id: partnerId,
    reward_rate: Math.floor(rewardRate),
    expires_at: (typeof b.expiresAt === "string" && b.expiresAt.trim())
      ? new Date(`${b.expiresAt}T23:59:59+09:00`).toISOString()
      : null,
    max_uses: int(b.maxUses),
    company_uses: int(b.companyUses),
    note: (typeof b.note === "string" ? b.note : "").trim() || null,
    created_by: (await currentUser())?.id ?? null,
  });
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json(
      { ok: false, reason: dup ? `${code} は、もう作ってあります。` : stale(error.message) },
      { status: dup ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, code });
}
