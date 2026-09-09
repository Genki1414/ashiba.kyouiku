"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { MAX_SEATS, TAX_RATE, quote, yen } from "@/lib/pricing";
import { discountOf } from "@/lib/coupon";
import { showSeatCode } from "@/training/joinCode";

/* 申込みの画面。教育担当者だけ。

   人数を決めて、カードか請求書かを選ぶ。
   金額はサーバでもう一度計算する。ここに出るのは目安。 */

type CourseTab = { id: string; short: string; name: string; unitPrice: number };

type Order = {
  id: string;
  course_id: string;
  seats: number;
  unit_price: number;
  amount: number;
  method: "card" | "invoice";
  status: "pending" | "paid" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

type Code = {
  code: string;
  orderId: string;
  status: Order["status"];
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  certified: boolean;
  courseId: string;
};

type Loaded = {
  company: string;
  /* 単価はサーバから受け取る。ここで計算すると請求額と食い違う */
  unitPrice: number;
  orders: Order[];
  seats: { total: number; used: number; paid: number };
  /** 講座ごとの受講リクエストの数。まだ対応していないもの */
  requests?: Record<string, number>;
  /** 在籍している人。受講コードの一覧の「配る」で選ぶ */
  members?: { id: string; name: string; held?: string[] }[];
  /* 受講コードの文字そのもの。これが無いと担当者は配れない */
  codes: Code[];
  /* 受講コードは1講座ぶん。どの講座を買うかを選ぶ */
  courses: CourseTab[];
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

const STATUS: Record<Order["status"], string> = {
  pending: "入金待ち",
  paid: "入金済み",
  cancelled: "取消",
};

export function OrderClient() {
  const params = useSearchParams();
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState<string>("");
  const [note, setNote] = useState<string>("");
  /* **講座ごとの人数。**まとめて申し込めるようにしたので、
     「選んでいる講座1つ」ではなく「講座 → 人数」で持つ（0029）。

     初期値は1名。10人ぶんが入っていると、そのまま押した人が
     10人ぶん申し込むことになる。足す側の操作は取り返しがつくが、
     多い数で申し込んでしまうのは請求に効く */
  const [picked, setPicked] = useState<Record<string, number>>({});
  /* 講座が73本あるので、絞れないと目当ての1本に届かない */
  const [q2, setQ2] = useState("");
  const [ready, setReady] = useState(false);
  const [billTo, setBillTo] = useState("");
  const [memo, setMemo] = useState("");
  /* クーポン（0032）。打った文字と、確かめた結果 */
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<
    { name: string; percentOff: number | null; amountOff: number | null } | null
  >(null);
  const [couponNg, setCouponNg] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canCard, setCanCard] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/order", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "画面を表示できません。");
        return;
      }
      setSt({
        company: j.company ?? "",
        unitPrice: Number(j.unitPrice) || 0,
        orders: j.orders ?? [],
        seats: j.seats,
        codes: j.codes ?? [],
        courses: j.courses ?? [],
        /* 受けたいと送られている数（講座ごと）。
           **ここで拾い忘れると、札が1つも出ない。**
           返す側にあっても、組み立て直すここで落ちる（2026-09-09） */
        requests: j.requests ?? {},
        /* 配る相手。同じく、ここで拾わないと「配る」が1つも出ない */
        members: Array.isArray(j.members) ? j.members : [],
      });
      setNg("");
    } catch {
      setNg("接続できません。電波の届く場所で、もう一度お試しください。");
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/stripe/checkout", { method: "POST", body: "{}" })
      .then((r) => setCanCard(r.status !== 503))
      .catch(() => setCanCard(false));
  }, [load]);

  useEffect(() => {
    if (params.get("paid")) setNote("お支払いを受け付けました。入金の反映まで少々お待ちください。");
    if (params.get("cancelled")) setNote("お支払いを中止しました。申込みは入金待ちのまま残っています。");
  }, [params]);

  /* 講座は、担当者の画面から渡されたものを既定にする。無ければ先頭。

     受講リクエストの一覧から来たときは、席の数も一緒に渡ってくる
     （その講座に何人が「受けたい」と送っているか）。入れておけば、
     数え直さずにそのまま申し込める。**あとから直せる**ように、
     ここでは入れるだけで、押さえつけはしない（受けない人も混じる） */
  useEffect(() => {
    if (ready || !st?.courses.length) return;
    const want = params.get("courseId");
    const c = st.courses.find((x) => x.id === want);
    const n = Number(params.get("seats"));
    const seats = Number.isInteger(n) && n >= 1 && n <= MAX_SEATS ? n : 1;
    /* 講座を渡されていれば、それだけを選んだ状態で開く。
       渡されていなければ**何も選ばない。**先頭を勝手に選ぶと、
       まとめ申込みでは「押したつもりのない講座」が混じる */
    setPicked(c ? { [c.id]: seats } : {});
    setReady(true);
  }, [st, params, ready]);


  /* ── クーポン（0032）──
     打ってすぐ「2,250円引き」と出ないと、押してみるまで分からない。
     ただし**ここで見せた額は、そのまま請求に使わない。**
     本当に引くのは申し込むとき（サーバが use_coupon を呼ぶ）。
     見てから申し込むまでの間に、上限に達することがある */
  const checkCoupon = async () => {
    const items = Object.entries(picked)
      .filter(([, n]) => n > 0)
      .map(([courseId, seats]) => ({ courseId, seats }));
    if (!items.length) { setCouponNg("先に講座と人数をお選びください。"); return; }
    setCouponBusy(true);
    setCouponNg("");
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, items }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setCoupon(null);
        setCouponNg(j.reason ?? "このクーポンはご利用いただけません。");
        return;
      }
      setCoupon({
        name: j.name ?? "",
        percentOff: (j.percentOff as number) ?? null,
        amountOff: (j.amountOff as number) ?? null,
      });
    } catch {
      setCouponNg("接続できません。電波の届く場所で、もう一度お試しください。");
    } finally {
      setCouponBusy(false);
    }
  };

  const order = async (method: "card" | "invoice") => {
    /* 送るのは「講座と人数」の並び。**画面で金額は作らない**
       （サーバがもう一度計算する。見せる額と請求する額を食い違わせない） */
    const items = Object.entries(picked)
      .filter(([, n]) => n > 0)
      .map(([courseId, seats]) => ({ courseId, seats }));
    if (!items.length) {
      setNote("受講する講座をお選びください。");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, method, billTo, note: memo, code: coupon ? code : "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込みできませんでした。");
        /* クーポンで断られたなら、見せていた値引きも下ろす。
           残すと、通らなかった額のまま申し込んだように見える */
        if (res.status === 409) { setCoupon(null); setCouponNg(j.reason ?? ""); }
        return;
      }
      const cp = j.coupon as { name?: string; discount?: number } | null;
      if (method === "invoice") {
        /* ここは太字にできない（そのまま文字として出る）ので、
           記号を書かない。**1枚** と書いたら、画面に ** が出た */
        setNote(
          items.length > 1
            ? `${items.length}講座を申し込みました。請求書は1通にまとめてお送りします。` +
                "お振込みの確認後、受講コードを発行します。"
            : "お申し込みを受け付けました。請求書をお送りします。" +
                "お振込みの確認後、受講コードを発行します。",
        );
        if (cp?.discount) {
          setNote((n) => `${n}（${cp.name || "クーポン"}で ${yen(cp.discount ?? 0)}を適用しました）`);
        }
        setPicked({});
        setCode("");
        setCoupon(null);
        await load();
        return;
      }
      const pay = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: j.orderId }),
      });
      const p = await pay.json().catch(() => ({}));
      if (!pay.ok || !p.url) {
        setNote(p.reason ?? "お支払い画面を開けませんでした。");
        await load();
        return;
      }
      window.location.href = p.url as string;
    } finally {
      setBusy(false);
    }
  };

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">申込み</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="order-ng">{ng}</p>
      </main>
    );
  }
  if (!st) return null;

  /* 単価はサーバの値で計算する。実際に請求されるのと同じ額を見せるため */
  /* 単価は講座ごとに違う。**行ごとに計算して足す。**
     1つの単価でまとめて掛けると、講座ごとに値段が違うのに合わなくなる */
  const rows = st.courses
    .filter((c) => picked[c.id] > 0)
    .map((c) => ({ c, seats: picked[c.id], q: quote(picked[c.id], c.unitPrice) }))
    .filter((r) => r.q);
  const sum = {
    seats: rows.reduce((n, r) => n + r.seats, 0),
    subtotal: rows.reduce((n, r) => n + r.q!.subtotal, 0),
    tax: rows.reduce((n, r) => n + r.q!.tax, 0),
    total: rows.reduce((n, r) => n + r.q!.total, 0),
  };
  /* クーポンの値引き（0032）。**税は値引きしたあとにかかる。**
     値引きを講座ごとの行に配るのはサーバ（src/lib/coupon.ts の spreadDiscount）。
     ここは見積りに出すだけなので、合計だけで足りる */
  /* **人数を変えたら、値引きもその場で変わる。**押したときの額を
     そのまま持っていると、5名で見た値引きが10名でも残る。
     式は SQL（use_coupon）と同じもの（src/lib/coupon.ts） */
  const off = coupon ? discountOf(coupon, sum.subtotal) : 0;
  const net2 = sum.subtotal - off;
  const tax2 = Math.floor(net2 * TAX_RATE);

  /* 届いている受講リクエストの数。講座ごと */
  const req = st.requests ?? {};
  const reqTotal = Object.values(req).reduce((n, v) => n + v, 0);

  /* 絞り込み。名前でも、正式名称でも当たるようにする */
  const key = q2.trim().toLowerCase();
  const hit = key
    ? st.courses.filter((c) => `${c.name}${c.short}`.toLowerCase().includes(key))
    : st.courses;
  /* **リクエストのある講座を上に出す。**73本あるので、下に埋もれると
     札を付けても見えない。多い順（要る人数が多い講座から片づく） */
  const list = [
    ...hit.filter((c) => req[c.id] > 0).sort((a, b) => req[b.id] - req[a.id]),
    ...hit.filter((c) => !req[c.id]),
  ];

  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/admin" className="backlink text-[13px] text-dim no-underline">← 教育担当者の画面</Link>
      <h1 className="mt-2 text-[18px] font-black">受講コードを申し込む</h1>
      <p className="mt-1 text-[12px] text-dim">{st.company}</p>

      {/* いま持っている席 */}
      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="order-seats">
        {[
          { t: "発行済み", v: st.seats.total },
          { t: "利用済み", v: st.seats.used },
          { t: "入金済み", v: st.seats.paid },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10.5px] text-dim">{x.t}</div>
            <div className="text-[19px] font-black">{x.v}</div>
          </div>
        ))}
      </div>

      {note && <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3 text-[12.5px] leading-relaxed text-yel">{note}</div>}

      {/* 買った受講コード。ここに文字が出ないと受講者に配れない */}
      <CodeList codes={st.codes} courses={st.courses} members={st.members ?? []} onChange={load} />

      {/* 申し込む */}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4">
        {/* ── 受ける講座と人数 ──

            受講コードは講座ごとに出る。**まとめて申し込める**ようにした
            （げんきさん 2026-09-08）。「足場5人、石綿3人、酸欠2人」を
            3回に分けると請求書が3枚出て、振込も3回になり、
            1回でまとめて振り込まれると、どの請求書の入金か分からなくなる。

            申込みは1回・請求書は1枚・振込も1回にする（0029）。 */}
        <label className="mb-1 block text-[11px] tracking-[2px] text-dim">受ける講座と人数</label>

        {/* **受講リクエストが届いていることを、ここで知らせる。**
            担当者がこの画面へ来る理由の多くは「送られてきたぶんを買う」。
            出ていないと、担当者の画面で数えて覚えてから来ることになる
            （げんきさん 2026-09-09） */}
        {reqTotal > 0 && (
          <div
            className="mb-2 rounded-lg border border-cyan bg-[#0F1A1D] px-3.5 py-3 text-[12.5px] leading-relaxed text-cyan"
            data-testid="order-requests"
          >
            <span className="font-black">受講リクエストが届いています（{reqTotal}件）</span>
            <span className="mt-0.5 block text-[11.5px] text-dim">
              リクエストのある講座を上に出しています。押すと、その件数が人数に入ります。
            </span>
          </div>
        )}

        {/* 講座が73本ある。絞れないと目当ての1本まで指が届かない */}
        {st.courses.length > 8 && (
          <input
            value={q2}
            onChange={(e) => setQ2(e.target.value)}
            type="search"
            inputMode="search"
            placeholder="講座を検索（例：石綿、酸欠、フルハーネス）"
            className="mb-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13px]"
            data-testid="order-filter"
            aria-label="講座を検索"
          />
        )}

        <div className="mb-1 grid gap-1.5" data-testid="order-courses">
          {list.map((c) => {
            const n = picked[c.id] ?? 0;
            const on = n > 0;
            const set = (v: number) =>
              setPicked((m) => {
                const next = { ...m };
                /* 0にしたら消す。0のまま残すと、送る並びに
                   「0人の講座」が混じって、サーバに断られる */
                if (v <= 0) delete next[c.id];
                else next[c.id] = Math.min(MAX_SEATS, v);
                return next;
              });
            return (
              <div
                key={c.id}
                className={`rounded-lg border ${on ? "border-yel bg-[#1A1F14]" : "border-line"}`}
                data-testid="order-course"
              >
                <button
                  /* リクエストのある講座は、**その人数を入れる。**
                     1から数え直させない。あとから直せるので押さえつけにはならない */
                  onClick={() => set(on ? 0 : (req[c.id] || 1))}
                  className={`block w-full px-3 py-2.5 text-left text-[13px] ${on ? "text-yel" : "text-dim"}`}
                  data-testid="order-course-pick"
                  aria-pressed={on}
                >
                  {/* 選んであることが、色だけでなく字でも分かるようにする */}
                  <span className="mr-1.5 font-black">{on ? "✓" : "＋"}</span>
                  {c.name}
                  <span className="ml-1.5 text-[11.5px] text-dim2">{yen(c.unitPrice)}／人</span>
                  {/* **講座ごとの件数。**上の合計だけだと、どの講座に
                      何人ぶん要るのかが分からない */}
                  {req[c.id] > 0 && (
                    <span
                      className="ml-1.5 rounded border border-cyan px-1.5 py-0.5 text-[10.5px] text-cyan"
                      data-testid="order-course-req"
                    >
                      リクエスト{req[c.id]}件
                    </span>
                  )}
                </button>
                {on && (
                  <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                    <span className="shrink-0 text-[11px] tracking-[2px] text-dim">人数</span>
                    <button
                      className="h-9 w-9 shrink-0 rounded-lg border border-line text-[16px]"
                      onClick={() => set(n - 1)}
                      aria-label={`${c.short}の人数を減らす`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={MAX_SEATS}
                      value={n}
                      onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-center text-[16px] font-black"
                      data-testid="order-seats-input"
                      aria-label={`${c.short}の人数`}
                    />
                    <button
                      className="h-9 w-9 shrink-0 rounded-lg border border-line text-[16px]"
                      onClick={() => set(n + 1)}
                      aria-label={`${c.short}の人数を増やす`}
                    >
                      ＋
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!list.length && (
            <div className="rounded-lg border border-line bg-bg p-3 text-[12px] text-dim">
              「{q2}」に当たる講座がありませんでした。
            </div>
          )}
        </div>

        {/* 絞り込みで隠れている選択を、見失わせない。
            絞ったまま申し込むと、画面に出ていない講座まで買うことになる */}
        {rows.some((r) => !list.some((c) => c.id === r.c.id)) && (
          <div className="mt-1 text-[11.5px] leading-relaxed text-yel" data-testid="order-hidden">
            絞り込みで見えていない講座があります：
            {rows.filter((r) => !list.some((c) => c.id === r.c.id)).map((r) => `${r.c.short} ${r.seats}名`).join("・")}
          </div>
        )}

        {!!rows.length && (
          <div className="mt-3 rounded-lg border border-line bg-bg px-3.5 py-3 text-[12.5px] leading-[1.9]" data-testid="order-quote">
            {/* 講座ごとに1行。合計だけ出すと、どの講座を何人ぶん
                頼んだのかが、押す前に確かめられない */}
            {rows.map((r) => (
              <div key={r.c.id} className="flex justify-between">
                <span className="text-dim">
                  {r.c.short}　{r.seats}名 × {yen(r.c.unitPrice)}
                </span>
                <span>{yen(r.q!.subtotal)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-line pt-1">
              <span className="text-dim">小計</span><span>{yen(sum.subtotal)}</span>
            </div>
            {/* クーポンの値引き。**税は値引きしたあとにかかる** */}
            {!!off && (
              <div className="flex justify-between text-grn" data-testid="order-discount">
                <span>値引き{coupon?.name ? `（${coupon.name}）` : ""}</span>
                <span>-{yen(off)}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-dim">消費税</span><span>{yen(tax2)}</span></div>
            <div className="mt-1 flex justify-between border-t border-line pt-1 font-black">
              <span>合計（税込）{rows.length > 1 ? `　${rows.length}講座・${sum.seats}名` : ""}</span>
              <span className="text-yel">{yen(net2 + tax2)}</span>
            </div>
          </div>
        )}

        {/* ── クーポン ──
            紹介や業界団体から配ったもの。打って「確かめる」を押すと、
            いくら引けるかが上の見積りに出る */}
        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">クーポンコード（お持ちの方）</label>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setCoupon(null); setCouponNg(""); }}
            placeholder="お持ちの方のみ"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-[14px] uppercase"
            data-testid="order-coupon"
            aria-label="クーポン"
          />
          <button
            /* 使ったあとは「はずす」。押し間違えたときに戻せないと、
               打ち直すしかなくなる */
            onClick={() => {
              if (coupon) { setCoupon(null); setCouponNg(""); return; }
              void checkCoupon();
            }}
            disabled={!code.trim() || couponBusy}
            className="shrink-0 rounded-lg border border-cyan px-3 py-2.5 text-[12.5px] text-cyan disabled:opacity-50"
            data-testid="order-coupon-check"
          >
            {couponBusy ? "…" : coupon ? "解除" : "適用する"}
          </button>
        </div>
        {coupon && (
          <div className="mt-1 text-[11.5px] leading-relaxed text-grn" data-testid="order-coupon-ok">
            {coupon.name || "クーポン"}を適用しました。{yen(off)}引きになります。
          </div>
        )}
        {couponNg && (
          <div className="mt-1 text-[11.5px] leading-relaxed text-org" data-testid="order-coupon-ng">{couponNg}</div>
        )}

        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">請求先（未入力の場合は事業者名）</label>
        <input
          value={billTo}
          onChange={(e) => setBillTo(e.target.value)}
          placeholder="○○建設株式会社 経理部"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]"
          data-testid="order-billto"
        />
        <label className="mb-1 mt-3 block text-[11px] tracking-[2px] text-dim">連絡事項（任意）</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px]"
        />

        <div className="mt-4 grid gap-2">
          {/* 何も選んでいないうちは押せない。押せてしまうと、
              「申し込めませんでした」で止まるだけの一手が増える */}
          {canCard && (
            <Btn tone="y" dis={busy || !rows.length} onClick={() => order("card")} testid="order-card">
              {busy ? "…" : "カードで支払う"}
            </Btn>
          )}
          <Btn dis={busy || !rows.length} onClick={() => order("invoice")} testid="order-invoice">
            {busy ? "…" : "請求書払いで申し込む"}
          </Btn>
          {!rows.length && (
            <div className="text-center text-[11.5px] text-dim2" data-testid="order-none">
              受講する講座をお選びください。複数選択できます。
            </div>
          )}
        </div>
        <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
          申し込むと請求書をお送りします。
          <strong className="text-dim">お振込みの確認後に、受講コードを発行します。</strong>
          <br />
          支払期限は設けていません。確認は営業日に行うため、数日いただく場合があります。
        </div>
        <div className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-dim2">
          申し込むと{" "}
          <Link href="/legal/terms" className="text-cyan no-underline">利用規約</Link>{" "}
          と{" "}
          <Link href="/legal/privacy" className="text-cyan no-underline">個人情報の取扱い</Link>{" "}
          に同意したものとします。
          <br />
          <Link href="/legal/tokushoho" className="text-cyan no-underline">
            特定商取引法に基づく表記
          </Link>
        </div>
      </div>

      {/* これまでの申込み。**畳んでおく。**申込みが増えるほど下に伸びて、
          いちばん使う「申し込む」から遠ざかる（げんきさん 2026-09-09） */}
      {!!st.orders.length && (
        <details className="group mt-6 rounded-xl border border-line bg-bg" data-testid="order-history">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 p-4 text-[13px] font-black text-txt"
            data-testid="order-history-open"
          >
            <span className="inline-block text-[11px] text-yel transition-transform group-open:rotate-90" aria-hidden>
              ▶
            </span>
            これまでの申込み
            <span className="text-[11.5px] font-normal text-dim">{st.orders.length}件</span>
            {/* 請求書は、払ったあともここから開ける */}
            <Link href="/invoices" className="ml-auto text-[12px] text-cyan no-underline" data-testid="order-invoices-link">
              請求書の一覧
            </Link>
          </summary>
          <div className="grid gap-2 px-4 pb-4">
            {st.orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-line bg-panel p-3.5" data-testid="order-row">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-black">{o.seats}名</span>
                  <span className="text-[12.5px] text-dim">{yen(o.amount)}</span>
                  <span
                    className={`ml-auto rounded border px-1.5 py-0.5 text-[10.5px] ${
                      o.status === "paid"
                        ? "border-grn text-grn"
                        : o.status === "cancelled"
                          ? "border-line text-dim2"
                          : "border-yel text-yel"
                    }`}
                  >
                    {STATUS[o.status]}
                  </span>
                </div>
                <div className="mt-1 text-[11.5px] text-dim2">
                  {st.courses.length > 1 &&
                    `${st.courses.find((c) => c.id === o.course_id)?.short ?? o.course_id}　`}
                  {o.method === "card" ? "カード" : "請求書"}　{day(o.created_at)} 申込
                  {o.due_date && o.status === "pending" ? `　支払期限 ${day(o.due_date)}` : ""}
                  {o.paid_at ? `　${day(o.paid_at)} 入金` : ""}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}

/* 買った受講コードの一覧。

   数だけ出しても受講者に配れないので、コードの文字そのものを出す。
   紙に書き写すことがあるので 4桁ずつ区切って、読み違えの無い字だけで作ってある。
   まだ配っていないものが上に来る（次に配るのはそれなので）。 */
function CodeList({
  codes,
  courses,
  members,
  onChange,
}: {
  codes: Code[];
  courses: CourseTab[];
  /** 在籍している人。「配る」の相手。held はその人が取得済みの講座 */
  members: { id: string; name: string; held?: string[] }[];
  onChange: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string>("");
  /* 取り消しは戻せないので、二度押しにする */
  const [asking, setAsking] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  /* 「配る」を開いているコード。1枚ずつ（同時に2枚開くと、誰にどれか混ざる） */
  const [giving, setGiving] = useState<string>("");
  const [giveTo, setGiveTo] = useState<string>("");

  /* ── コードを指して、その人に配る（0031）──

     前は名簿の側にしか「席を配る」が無く、講座ごとに空いている席から
     自動で1枚選んでいた。ここ（受講コードの一覧）から配るときは、
     **押したそのコードが渡る。**渡ったコードは画面にも残るので、
     口頭で「EQ37 を渡した」と確かめられる。
     受け取った本人には知らせが届き、押すとその講座が開く（コードは打たない） */
  const give = async (c: Code) => {
    if (!giveTo) { setDone("配布する相手をお選びください。"); return; }
    setBusy(c.code);
    setDone("");
    try {
      const res = await fetch("/api/admin/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: giveTo, courseId: c.courseId, code: c.code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setDone(j.reason ?? "配布できませんでした。");
        return;
      }
      const who = members.find((m) => m.id === giveTo)?.name ?? "";
      const cs = courses.find((x) => x.id === c.courseId)?.short ?? "";
      setDone(`${who ? `${who}さんに` : "選択した方に"}${cs ? `${cs}の` : ""}受講コード ${showSeatCode(c.code)} を配布しました。ご本人に通知が届き、そのまま受講できます。`);
      setGiving("");
      setGiveTo("");
      await onChange();
    } finally {
      setBusy("");
    }
  };

  const free = codes.filter((c) => !c.usedAt);
  const used = codes.filter((c) => c.usedAt);
  if (!codes.length) return null;

  /* 未使用が先。多いときだけ畳む（20件までは、そのまま全部出す） */
  const all = [...free, ...used];
  const show = open ? all : all.slice(0, 20);

  const copy = async (text: string, label: string) => {
    const ok = await writeClipboard(text);
    setDone(ok ? `${label}をコピーしました。` : "この端末ではコピーできません。画面を見ながら書き写してください。");
  };

  /* 引き換えを取り消して、もう一度配れるようにする。
     受講の記録は消えない（その人が別のコードを入れれば続きから受けられる） */
  const release = async (code: string) => {
    setBusy(code);
    try {
      const res = await fetch("/api/admin/seat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setDone(j.reason ?? "取り消しできませんでした。");
        return;
      }
      setDone("利用を取り消しました。次回の受講は最初からになります（受講の記録は残ります）。このコードは再度配布できます。");
      setAsking("");
      await onChange();
    } finally {
      setBusy("");
    }
  };

  return (
    /* **畳んでおく。**コードは買うほど増える（100枚を超えることもある）ので、
       開いたままだと申込みの欄がずっと下に行く（げんきさん 2026-09-09） */
    <details className="group mt-5 rounded-xl border border-line bg-panel" data-testid="order-codes">
      <summary
        className="flex cursor-pointer list-none items-baseline gap-2 p-4 text-[13px] font-black text-txt"
        data-testid="order-codes-open"
      >
        <span className="inline-block text-[11px] not-italic text-yel transition-transform group-open:rotate-90" aria-hidden>
          ▶
        </span>
        受講コード
        <span className="ml-auto text-[12px] font-normal">
          <span className="font-black text-yel">未使用 {free.length}</span>
          <span className="text-dim2">　／　使用済み {used.length}</span>
        </span>
      </summary>
      <div className="px-4 pb-4">
      <p className="mt-1 text-[11.5px] leading-relaxed text-dim2">
        1名につき1つ配布してください。受講者は{" "}
        <Link href="/join" className="text-cyan no-underline">受講コードの入力画面</Link>{" "}
        から入力します。1つのコードは1名のみ利用できます。
      </p>

      {done && <div className="mt-2 text-[11.5px] leading-relaxed text-grn" data-testid="order-code-note">{done}</div>}

      <div className="mt-3 grid gap-1.5">
        {show.map((c) => (
          <div
            key={c.code}
            className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${
              c.usedAt ? "border-line bg-bg" : "border-yel bg-[#1A1F14]"
            }`}
            data-testid="order-code"
          >
            {/* 配る相手を選ぶ。札の中の下段いっぱいに出す（flex-wrap で折り返す） */}
            {giving === c.code && !c.usedAt && (
              <div className="order-last flex w-full items-center gap-2 border-t border-line pt-2" data-testid="order-code-give-to">
                <select
                  value={giveTo}
                  onChange={(e) => setGiveTo(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-txt"
                  data-testid="order-code-give-select"
                  aria-label="配布する相手"
                >
                  <option value="">配布する相手を選択</option>
                  {members.map((m) => {
                    /* **取得済みの資格には配れない。**外して見えなくすると
                       「あの人が居ない」になるので、名前は出して押せなくする */
                    const has = (m.held ?? []).includes(c.courseId);
                    return (
                      <option key={m.id} value={m.id} disabled={has} data-testid={has ? "order-code-give-held" : undefined}>
                        {m.name}{has ? "（取得済）" : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => void give(c)}
                  disabled={!giveTo || busy === c.code}
                  className="shrink-0 rounded-lg border border-grn bg-grn px-3 py-2 text-[12px] font-bold text-bg disabled:opacity-50"
                  data-testid="order-code-give-go"
                >
                  {busy === c.code ? "…" : "この相手に配布"}
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`font-mono text-[16px] font-black tracking-[2px] ${
                  c.usedAt ? "text-dim2 line-through" : "text-yel"
                }`}
              >
                {showSeatCode(c.code)}
              </div>
              {courses.length > 1 && (
                <div className="text-[10px] text-dim2">
                  {courses.find((x) => x.id === c.courseId)?.short ?? c.courseId}
                </div>
              )}
              <div className="mt-0.5 text-[10.5px] text-dim2">
                {c.usedAt
                  ? `${c.usedBy ?? "受講者"} が使用　${day(c.usedAt)}`
                  : c.status === "paid"
                    ? `未使用　期限 ${day(c.expiresAt) || "—"}`
                    : `未使用　期限 ${day(c.expiresAt) || "—"}`}
              </div>
            </div>
            {!c.usedAt ? (
              <span className="flex shrink-0 items-center gap-1.5">
                {/* 在籍者が居なければ「配る」は出さない。押しても選ぶ相手が無い */}
                {members.length > 0 && (
                  <button
                    onClick={() => { setGiving(giving === c.code ? "" : c.code); setGiveTo(""); setDone(""); }}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                      giving === c.code ? "border-grn bg-[#14201A] text-grn" : "border-grn text-grn"
                    }`}
                    data-testid="order-code-give"
                  >
                    配る
                  </button>
                )}
                <button
                  onClick={() => void copy(showSeatCode(c.code), "コード")}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-dim"
                  data-testid="order-code-copy"
                >
                  コピー
                </button>
              </span>
            ) : c.certified ? (
              /* 修了証を出した人の席は戻さない。戻すと席の無い修了証が残る */
              <span className="shrink-0 text-[10.5px] text-dim2">修了証あり</span>
            ) : asking === c.code ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => void release(c.code)}
                  className="rounded-lg border border-red px-2 py-1.5 text-[11px] text-ng-tx"
                  data-testid="order-code-release-yes"
                >
                  {busy === c.code ? "…" : "取り消す"}
                </button>
                <button
                  onClick={() => setAsking("")}
                  className="rounded-lg border border-line px-2 py-1.5 text-[11px] text-dim"
                >
                  やめる
                </button>
              </span>
            ) : (
              <button
                onClick={() => { setDone(""); setAsking(c.code); }}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-dim"
                data-testid="order-code-release"
              >
                取り消す
              </button>
            )}
          </div>
        ))}
      </div>

      {!open && all.length > show.length && (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 w-full rounded-lg border border-line p-2 text-[11.5px] text-dim2"
          data-testid="order-codes-more"
        >
          残り {all.length - show.length} 件を表示
        </button>
      )}

      {!!free.length && (
        <button
          onClick={() => void copy(free.map((c) => showSeatCode(c.code)).join("\n"), "未使用の受講コード")}
          className="mt-2 w-full rounded-lg border border-line p-2.5 text-[12px] text-dim"
          data-testid="order-codes-copyall"
        >
          未使用 {free.length} 件をまとめてコピー
        </button>
      )}

      <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
        ここに表示されている受講コードは、入金の確認が済んだものです。そのまま配布できます。
        <br />
        誤った方が入力した場合は「取り消す」で戻せます。
        <strong className="text-dim">取り消すと、その方の受講はそこで終了し、次回は最初からになります。</strong>
        受講コードを買い直して法定時間を引き継ぐことを防ぐためです。
        受講の記録そのものは削除されません（特別教育を実施しているのは当社のため、記録は当社に残ります）。
        修了証の発行後は戻せません（先に修了証を取り消してください）。
      </div>
      </div>
    </details>
  );
}

/* コードを写す。安全な接続でないと clipboard が使えない端末があるので、
   だめなときは昔ながらのやり方で写す。それも駄目なら false を返して、
   「書き取ってください」と出す（黙って失敗させない） */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 下のやり方を試す */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
