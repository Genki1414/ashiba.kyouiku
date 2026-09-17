"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Loading } from "@/components/Loading";
import { TAX_RATE, yen } from "@/lib/pricing";
import { discountOf, type CouponRule } from "@/lib/coupon";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* ひとりで受ける（0039）。

   げんきさん（2026-09-17）「利用者が増えない。会社登録が邪魔してる気がする」

   会社を登録しない。担当者も名簿も出さない。
   講座を選ぶ → 払う → 受ける、の3つだけ。
   お振込みの確認後（カードならその場で）、受講コードを打たずに
   そのまま講座が開く（サーバが本人の席を立てる）。

   値段はサーバが返す（/api/solo）。画面で計算した額は請求に使わない。
   クーポンの確かめ（/api/coupon）も、本当に引くのは申し込むとき。 */

type Course = { id: string; name: string; short: string; unitPrice: number };
type Pending = {
  id: string;
  course_id: string;
  amount: number;
  due_date: string | null;
  bill_to: string | null;
  method: string;
};
type St = {
  name: string;
  card: boolean;
  courses: Course[];
  learning: string[];
  pending: Pending[];
};
type Made = { orderId: string; method: string; amount: number; due: string | null; courseId: string };

const day = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function SoloClient() {
  const [st, setSt] = useState<St | null>(null);
  const [courseId, setCourseId] = useState("");
  const [billTo, setBillTo] = useState("");
  const [billAddr, setBillAddr] = useState("");
  const [method, setMethod] = useState<"invoice" | "card">("invoice");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<(CouponRule & { name: string }) | null>(null);
  const [couponNg, setCouponNg] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const madeRef = useRef<Made | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/solo", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "画面を表示できません。");
        setSt({ name: "", card: false, courses: [], learning: [], pending: [] });
        return;
      }
      const s: St = {
        name: j.name ?? "",
        card: !!j.card,
        courses: Array.isArray(j.courses) ? j.courses : [],
        learning: Array.isArray(j.learning) ? j.learning : [],
        pending: Array.isArray(j.pending) ? j.pending : [],
      };
      setSt(s);
      /* 講座は、断りの画面などから渡されたものを既定にする。無ければ先頭 */
      const want = new URLSearchParams(window.location.search).get("courseId") ?? "";
      setCourseId((cur) => cur || (s.courses.some((c) => c.id === want) ? want : (s.courses[0]?.id ?? "")));
      setBillTo((cur) => cur || s.name);
    } catch {
      setNote("接続できません。");
      setSt({ name: "", card: false, courses: [], learning: [], pending: [] });
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    /* カード会社から戻ってきたとき。入金の反映は Stripe の知らせで立つので、
       ここでは「受け付けた」とだけ言う（/order と同じ） */
    if (params.get("paid")) setNote("お支払いを受け付けました。入金の反映まで少々お待ちください。反映すると、ホームのお知らせに「受講できるようになりました」と出ます。");
    if (params.get("cancelled")) setNote("お支払いを中止しました。申込みは入金待ちのまま残っています。");
  }, [load]);

  const course = st?.courses.find((c) => c.id === courseId) ?? null;

  /* クーポンを確かめる。本当に引くのは申し込むとき（サーバ） */
  const checkCoupon = async () => {
    if (!course) return;
    setCouponNg("");
    if (!code.trim()) { setCoupon(null); return; }
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, items: [{ courseId: course.id, seats: 1 }] }),
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
      setCoupon(null);
      setCouponNg("接続できません。");
    }
  };

  const send = async (): Promise<RunResult> => {
    if (!course) return false;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/solo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId: course.id, billTo, billAddr, method, code: coupon ? code : "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込めませんでした。");
        return false;
      }
      const m: Made = { orderId: j.orderId, method: j.method ?? method, amount: j.amount ?? 0, due: j.due ?? null, courseId: course.id };
      madeRef.current = m;
      if (m.method === "card") {
        /* カード会社の画面へ。戻り先は /solo?paid=… */
        const r2 = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: m.orderId }),
        });
        const j2 = await r2.json().catch(() => ({}));
        if (!r2.ok || !j2.ok || !j2.url) {
          setNote(j2.reason ?? "カード決済の画面を用意できませんでした。請求書払いをお選びください。");
          /* 注文は入金待ちで残っている。次に開いたときに出る */
          return false;
        }
        window.location.href = j2.url as string;
        return { done: "お支払い画面へ移ります", doneBody: "カード会社の画面が開きます。そのままお進みください。" };
      }
      return true;
    } catch {
      setNote("接続できません。電波の届く場所で、もう一度お試しください。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askGo = () => {
    if (!course) return;
    setAsk({
      title: method === "card" ? "カードで支払いますか" : "請求書払いで申し込みますか",
      body: (
        <>
          <div>{course.name}　1名分</div>
          <div className="mt-1">{yen(total)}（税込）{coupon ? `　クーポン「${coupon.name}」適用` : ""}</div>
          <div className="mt-1">宛名　{billTo || st?.name || "（未入力）"}</div>
          <div className="mt-2">
            {method === "card"
              ? "カード会社の画面に移ります。お支払いの確認後、そのまま受講できます。"
              : "請求書をお送りします。お振込みの確認後、そのまま受講できます。受講コードを打つ必要はありません。"}
          </div>
        </>
      ),
      yes: method === "card" ? "支払いへ進む" : "申し込む",
      run: send,
      done: "申し込みました",
      doneBody: "請求書はホームの「請求書が届いています」からも開けます。お振込みの確認後に、この講座が開きます。",
    });
  };

  if (!st) return <Loading title="ひとりで受ける" rows={4} />;

  const unit = course?.unitPrice ?? 0;
  const off = coupon && course ? discountOf(coupon, unit) : 0;
  const net = Math.max(0, unit - off);
  const tax = Math.floor(net * TAX_RATE);
  const total = net + tax;
  const pendingHere = course ? st.pending.find((p) => p.course_id === course.id) ?? null : null;
  const learningHere = !!course && st.learning.includes(course.id);

  const legal = (
    <p className="mt-6 text-[11px] leading-relaxed text-dim2">
      お申込みの前に{" "}
      <Link href="/legal/tokushoho" className="text-cyan no-underline">特定商取引法に基づく表記</Link>・
      <Link href="/legal/terms" className="text-cyan no-underline">利用規約</Link>・
      <Link href="/legal/privacy" className="text-cyan no-underline">個人情報の取扱い</Link>{" "}
      をご確認ください。受講コードは発行から1年で失効し、発行後の返金はできません。
    </p>
  );

  if (made) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">申し込みました</h1>
        <div className="mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="solo-done">
          <div className="text-[13px] leading-relaxed text-txt">
            {st.courses.find((c) => c.id === made.courseId)?.name ?? "講座"}　1名分
          </div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-dim">
            金額　{yen(made.amount)}（税込）
            {made.method === "invoice" && (
              <>
                <br />
                支払期限　{day(made.due) || "請求書の発行から1週間"}
              </>
            )}
            <br />
            <span className="text-dim2">
              お振込みの確認後、この講座がそのまま開きます。受講コードを打つ必要はありません。
            </span>
          </div>
        </div>
        <Link
          href={`/invoice/${made.orderId}`}
          className="mt-4 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
          data-testid="solo-invoice"
        >
          請求書を見る
        </Link>
        <Link href="/" className="mt-4 block text-center text-[12.5px] text-dim2 no-underline">
          ← ホームへ
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <div className="mt-2 text-[11px] font-extrabold tracking-[2px] text-yel">会社の登録は要りません</div>
      <h1 className="mt-1 text-[20px] font-black leading-snug">ひとりで受ける</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        講座を選んで申し込みます。お振込みの確認後（カード払いならその場で）、
        受講コードを打たずに、そのまま講座が開きます。
      </p>

      {note && (
        <div className="mt-4 rounded-lg border border-line bg-panel px-3.5 py-3 text-[12.5px] leading-relaxed text-dim" data-testid="solo-note">
          {note}
        </div>
      )}

      {!st.courses.length ? (
        <div className="mt-5 text-[13px] text-dim" data-testid="solo-ng">受けられる講座がありません。</div>
      ) : (
        <>
          <label className="mb-1 mt-5 block text-[11px] tracking-[2px] text-dim">講座</label>
          <select
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setCoupon(null); setCouponNg(""); }}
            className="w-full rounded-lg border border-line bg-panel px-3 py-3 text-[14px]"
            data-testid="solo-course"
          >
            {st.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {learningHere ? (
            <div className="mt-4 rounded-xl border border-grn bg-panel p-4" data-testid="solo-already">
              <div className="text-[13px] font-bold text-grn">この講座は、もう受講できます</div>
              <Link
                href={`/edu/${course!.id}`}
                className="mt-3 block rounded-lg border border-yel bg-yel p-3 text-center text-[14px] font-extrabold text-bg no-underline"
              >
                講座を開く
              </Link>
            </div>
          ) : pendingHere ? (
            <div className="mt-4 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="solo-pending">
              <div className="text-[13px] font-bold text-txt">この講座は、申込み済みです（入金待ち）</div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-dim">
                金額　{yen(pendingHere.amount)}（税込）
                {pendingHere.due_date && <>　支払期限　{day(pendingHere.due_date)}</>}
                <br />
                お振込みの確認後、そのまま開きます。
              </div>
              <Link
                href={`/invoice/${pendingHere.id}`}
                className="mt-3 block rounded-lg border border-yel bg-yel p-3 text-center text-[14px] font-extrabold text-bg no-underline"
              >
                請求書を見る
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-line bg-panel p-4">
                <div className="flex items-baseline gap-2 text-[13px]">
                  <span className="text-dim">金額（1名分）</span>
                  <span className="ml-auto text-[20px] font-black" data-testid="solo-price">{yen(total)}</span>
                </div>
                <div className="mt-0.5 text-right text-[11.5px] text-dim2">
                  {yen(unit)}（税抜）
                  {off > 0 ? `　− 値引き ${yen(off)}` : ""}
                  ＋ 消費税 {yen(tax)}
                </div>
              </div>

              <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">クーポン（お持ちの方）</label>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setCoupon(null); setCouponNg(""); }}
                  placeholder="クーポンコード"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2.5 font-mono text-[14px]"
                  data-testid="solo-coupon"
                />
                <button
                  onClick={() => void checkCoupon()}
                  disabled={!code.trim()}
                  className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12.5px] text-dim disabled:opacity-50"
                  data-testid="solo-coupon-go"
                >
                  確かめる
                </button>
              </div>
              {coupon && (
                <div className="mt-1 text-[12px] text-grn" data-testid="solo-coupon-ok">
                  「{coupon.name}」を適用します
                </div>
              )}
              {couponNg && (
                <div className="mt-1 text-[12px] text-red" data-testid="solo-coupon-ng">{couponNg}</div>
              )}

              <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">請求書の宛名</label>
              <input
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                placeholder="お名前（会社名でも構いません）"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13.5px]"
                data-testid="solo-billto"
              />
              <div className="mt-1 text-[11px] text-dim2">経費で落とす場合は、会社名を入れてください。</div>

              <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">送り先（任意）</label>
              <textarea
                value={billAddr}
                onChange={(e) => setBillAddr(e.target.value)}
                rows={2}
                placeholder="郵送が要る場合の住所"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13px]"
                data-testid="solo-billaddr"
              />
              <div className="mt-1 text-[11px] text-dim2">空のままなら、画面で請求書を開けます。</div>

              {/* 支払い方法。カードは鍵が入っている店だけ出す */}
              <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">お支払い</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMethod("invoice")}
                  className={`rounded-lg border p-3 text-[13px] font-bold ${method === "invoice" ? "border-yel text-txt" : "border-line text-dim"}`}
                  data-testid="solo-method-invoice"
                >
                  請求書払い
                  <span className="block text-[11px] font-normal text-dim2">銀行振込・確認後に開く</span>
                </button>
                {st.card && (
                  <button
                    onClick={() => setMethod("card")}
                    className={`rounded-lg border p-3 text-[13px] font-bold ${method === "card" ? "border-yel text-txt" : "border-line text-dim"}`}
                    data-testid="solo-method-card"
                  >
                    カード払い
                    <span className="block text-[11px] font-normal text-dim2">その場で開く</span>
                  </button>
                )}
              </div>

              <div className="mt-5">
                <Btn tone="y" dis={busy || !course} onClick={askGo} testid="solo-go">
                  {busy ? "送っています…" : method === "card" ? "カードで支払う" : "請求書払いで申し込む"}
                </Btn>
              </div>
              {legal}
            </>
          )}
        </>
      )}

      {/* 会社で受ける道も残す。担当者に配ってもらう人は、こちら */}
      <Link
        href="/join"
        className="mt-6 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        data-testid="solo-join"
      >
        会社から受講コードをもらう方は、こちら
      </Link>

      {/* 終わった札を閉じてから「申し込みました」の画面に移す（/train と同じ）。
          先に移すと、札ごと消えて終わったことが出ない */}
      {ask && (
        <AskDone ask={ask}
          onClose={() => {
            setAsk(null);
            if (madeRef.current) setMade(madeRef.current);
          }}
        />
      )}
    </main>
  );
}
