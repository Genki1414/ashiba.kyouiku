"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Btn } from "@/components/ui/Btn";
import { MAX_SEATS, quote, yen } from "@/lib/pricing";

/* 申込みの画面。教育担当者だけ。

   人数を決めて、カードか請求書かを選ぶ。
   金額はサーバでもう一度計算する。ここに出るのは目安。 */

type Order = {
  id: string;
  seats: number;
  unit_price: number;
  amount: number;
  method: "card" | "invoice";
  status: "pending" | "paid" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

type Loaded = {
  company: string;
  /* 単価はサーバから受け取る。ここで計算すると請求額と食い違う */
  unitPrice: number;
  orders: Order[];
  seats: { total: number; used: number; paid: number };
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
  const [seats, setSeats] = useState(10);
  const [billTo, setBillTo] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [canCard, setCanCard] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/order", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "開けません。");
        return;
      }
      setSt({
        company: j.company ?? "",
        unitPrice: Number(j.unitPrice) || 0,
        orders: j.orders ?? [],
        seats: j.seats,
      });
      setNg("");
    } catch {
      setNg("つながりません。電波の届く所でもう一度。");
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/stripe/checkout", { method: "POST", body: "{}" })
      .then((r) => setCanCard(r.status !== 503))
      .catch(() => setCanCard(false));
  }, [load]);

  useEffect(() => {
    if (params.get("paid")) setNote("お支払いを受け付けました。入金の反映まで少し待ってください。");
    if (params.get("cancelled")) setNote("お支払いをやめました。注文は入金待ちのまま残っています。");
  }, [params]);


  const order = async (method: "card" | "invoice") => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seats, method, billTo, note: memo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込めませんでした。");
        return;
      }
      if (method === "invoice") {
        setNote(`申し込みました。受講コードを${j.seatsIssued}枚お渡しします。請求書は運営から送ります。`);
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
        setNote(p.reason ?? "支払い画面を開けませんでした。");
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
  const q = quote(seats, st.unitPrice);

  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/admin" className="backlink text-[13px] text-dim no-underline">← 教育担当者の画面</Link>
      <h1 className="mt-2 text-[18px] font-black">受講コードを申し込む</h1>
      <p className="mt-1 text-[12px] text-dim">{st.company}</p>

      {/* いま持っている席 */}
      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="order-seats">
        {[
          { t: "配った数", v: st.seats.total },
          { t: "使った数", v: st.seats.used },
          { t: "入金済み", v: st.seats.paid },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10.5px] text-dim">{x.t}</div>
            <div className="text-[19px] font-black">{x.v}</div>
          </div>
        ))}
      </div>

      {note && <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3 text-[12.5px] leading-relaxed text-yel">{note}</div>}

      {/* 申し込む */}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4">
        <label className="mb-1 block text-[11px] tracking-[2px] text-dim">人数</label>
        <div className="flex items-center gap-2">
          <button
            className="h-11 w-11 shrink-0 rounded-lg border border-line text-[18px]"
            onClick={() => setSeats((n) => Math.max(1, n - 1))}
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={MAX_SEATS}
            value={seats}
            onChange={(e) => setSeats(Math.max(1, Math.min(MAX_SEATS, Number(e.target.value) || 1)))}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-center text-[18px] font-black"
            data-testid="order-seats-input"
          />
          <button
            className="h-11 w-11 shrink-0 rounded-lg border border-line text-[18px]"
            onClick={() => setSeats((n) => Math.min(MAX_SEATS, n + 1))}
          >
            ＋
          </button>
        </div>

        {q && (
          <div className="mt-3 rounded-lg border border-line bg-bg px-3.5 py-3 text-[12.5px] leading-[1.9]" data-testid="order-quote">
            <div className="flex justify-between"><span className="text-dim">単価（税抜）</span><span>{yen(q.unitPrice)}</span></div>
            <div className="flex justify-between"><span className="text-dim">小計</span><span>{yen(q.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-dim">消費税</span><span>{yen(q.tax)}</span></div>
            <div className="mt-1 flex justify-between border-t border-line pt-1 font-black">
              <span>合計（税込）</span><span className="text-yel">{yen(q.total)}</span>
            </div>
          </div>
        )}

        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">請求先（空なら事業者名）</label>
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
          {canCard && (
            <Btn tone="y" dis={busy} onClick={() => order("card")} testid="order-card">
              {busy ? "…" : "カードで払う"}
            </Btn>
          )}
          <Btn dis={busy} onClick={() => order("invoice")} testid="order-invoice">
            {busy ? "…" : "請求書で払う"}
          </Btn>
        </div>
        <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
          請求書払いは、申し込んだ時点で受講コードをお渡しします。受講は始められます。
          <br />
          <strong className="text-dim">修了証は入金の確認が済んでから</strong>出せるようになります。
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

      {/* これまでの申込み */}
      {!!st.orders.length && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] tracking-[2px] text-dim">これまでの申込み</div>
          <div className="grid gap-2">
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
                  {o.method === "card" ? "カード" : "請求書"}　{day(o.created_at)} 申込
                  {o.due_date && o.status === "pending" ? `　支払期限 ${day(o.due_date)}` : ""}
                  {o.paid_at ? `　${day(o.paid_at)} 入金` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
