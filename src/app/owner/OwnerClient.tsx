"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loading } from "@/components/Loading";
import { Btn } from "@/components/ui/Btn";
import { yen } from "@/lib/pricing";
import { LedgerClient } from "./LedgerClient";
import { RetentionClient } from "./RetentionClient";

/* 本部の画面。二つある。

   ① 申込みと入金 … 売った先の注文を見て、請求書払いの入金を確認する
   ② 事業者と記録 … 事業者の一覧と、受講記録の元帳（辞めた人もふくむ）
   ③ 保存期間　　 … 3年を過ぎた記録の、個人の部分を消す

   ②が要るのは、特別教育を行っているのがこの仕組みだから。
   受講の記録は3年保存する決まりで、受講した人が辞めても、
   会社が使うのをやめても、こちら側に残らないと示せない。

   受講する会社の教育担当者とは別。
   誰が本部かは環境変数 OWNER_EMAILS で決めてある。 */

type Order = {
  id: string;
  company: string;
  company_id: string;
  seats: number;
  amount: number;
  method: "card" | "invoice";
  status: "pending" | "paid" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  bill_to: string | null;
  note: string | null;
  created_at: string;
  seatsIssued: number;
  seatsUsed: number;
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function OwnerClient() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ng, setNg] = useState("");
  const [hint, setHint] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "ledger" | "keep">("orders");
  /* 請求書に載せる登録番号。書くときに毎回どこかから探すことになるので、
     入金待ちの並びのすぐ上に出しておく */
  const [invoiceNo, setInvoiceNo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/orders", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setNg(j.reason ?? "開けません。");
        /* 直し方が分かるように、環境変数の名前も出す */
        setHint(j.email ? "Vercel → Settings → Environment Variables → OWNER_EMAILS" : "");
        return;
      }
      setOrders(j.orders ?? []);
      setInvoiceNo(j.invoiceNo ?? "");
      setNg("");
    } catch {
      setNg("つながりません。");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const post = async (body: unknown) => {
    setNote("");
    const res = await fetch("/api/owner/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) setNote(j.reason ?? "できませんでした。");
    return !!j.ok;
  };

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[18px] font-black">本部の画面</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim" data-testid="owner-ng">{ng}</p>
        {hint && (
          <p className="mt-3 rounded-lg border border-line bg-panel px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-dim2">
            {hint}
          </p>
        )}
      </main>
    );
  }
  /* 読み終わるまで真っ暗にしない。押したのに何も出ないと、
     同じ待ち時間でもずっと遅く感じる */
  if (!orders) return <Loading title="本部の画面" back="/" rows={4} />;

  const waiting = orders.filter((o) => o.status === "pending" && o.method === "invoice");
  const sold = orders.filter((o) => o.status === "paid");
  const yenSum = sold.reduce((s, o) => s + o.amount, 0);

  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <h1 className="mt-2 text-[18px] font-black">本部の画面</h1>

      {/* 申込みと入金／事業者と記録 */}
      <div className="mt-3 flex gap-2" data-testid="owner-tabs">
        {([
          ["orders", "申込みと入金"],
          ["ledger", "事業者と記録"],
          ["keep", "保存期間"],
        ] as const).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
              tab === k ? "border-yel bg-[#1A1F14] text-yel" : "border-line text-dim2"
            }`}
            data-testid="owner-tab"
          >
            {t}
          </button>
        ))}
      </div>

      {note && <div className="mt-3 text-[12px] text-red">{note}</div>}

      {tab === "ledger" && <LedgerClient onNote={setNote} />}
      {tab === "keep" && <RetentionClient onNote={setNote} />}

      {tab === "orders" && (
      <>
      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="owner-totals">
        {[
          { t: "入金待ち", v: String(waiting.length), y: waiting.length > 0 },
          { t: "入金済み", v: String(sold.length), y: false },
          { t: "売上（税込）", v: yen(yenSum), y: false },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-panel px-2 py-3 text-center">
            <div className="text-[10.5px] text-dim">{x.t}</div>
            <div className={`text-[15px] font-black ${x.y ? "text-yel" : ""}`}>{x.v}</div>
          </div>
        ))}
      </div>

      {/* 請求書を書くときに要るもの。無ければ何も出さない（免税事業者） */}
      {invoiceNo && (
        <div className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-[11.5px] text-dim2"
          data-testid="owner-invoice-no">
          請求書に載せる登録番号　<span className="font-mono text-txt">{invoiceNo}</span>
        </div>
      )}

      {!orders.length && (
        <p className="mt-6 text-[13px] leading-relaxed text-dim">まだ申込みがありません。</p>
      )}

      <div className="mt-5 grid gap-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-panel p-4" data-testid="owner-order">
            <div className="flex items-baseline gap-2">
              <div className="min-w-0 flex-1 truncate text-[14.5px] font-black">{o.company}</div>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10.5px] ${
                  o.status === "paid"
                    ? "border-grn text-grn"
                    : o.status === "cancelled"
                      ? "border-line text-dim2"
                      : "border-yel text-yel"
                }`}
              >
                {o.status === "paid" ? "入金済み" : o.status === "cancelled" ? "取消" : "入金待ち"}
              </span>
            </div>
            <div className="mt-1 text-[12.5px]">
              {o.seats}名　{yen(o.amount)}　
              <span className="text-dim">{o.method === "card" ? "カード" : "請求書"}</span>
            </div>
            <div className="mt-0.5 text-[11.5px] text-dim2">
              {day(o.created_at)} 申込
              {o.due_date && o.status === "pending" ? `　支払期限 ${day(o.due_date)}` : ""}
              {o.paid_at ? `　${day(o.paid_at)} 入金` : ""}
              <br />
              受講コード {o.seatsIssued}枚（使用 {o.seatsUsed}）
              {o.bill_to ? <><br />請求先 {o.bill_to}</> : null}
              {o.note ? <><br />連絡 {o.note}</> : null}
            </div>

            {o.status === "pending" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg border border-line p-2 text-[12px] text-dim"
                  data-testid="owner-cancel"
                  onClick={async () => {
                    setBusy(o.id);
                    if (await post({ action: "cancel", orderId: o.id })) await load();
                    setBusy(null);
                  }}
                >
                  取り消す
                </button>
                {o.method === "invoice" ? (
                  <Btn
                    tone="y"
                    dis={busy === o.id}
                    testid="owner-paid"
                    onClick={async () => {
                      setBusy(o.id);
                      if (await post({ action: "paid", orderId: o.id })) await load();
                      setBusy(null);
                    }}
                  >
                    {busy === o.id ? "…" : "入金を確認した"}
                  </Btn>
                ) : (
                  <div className="rounded-lg border border-line p-2 text-center text-[11.5px] text-dim2">
                    カードの入金は自動
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 無償利用の切り替えは「事業者と記録」へ移した。
          注文のある事業者しか出せず、まだ買っていない先を
          無償利用に立てられなかったため */}
      </>
      )}
    </main>
  );
}
