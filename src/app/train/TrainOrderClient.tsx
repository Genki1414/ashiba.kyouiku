"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Loading } from "@/components/Loading";
import { TAX_RATE, yen } from "@/lib/pricing";

/* 実務トレーニング（第2章から先）を、本人が申し込む。

   教育担当者を通さない。会社に言いにくい人もいるし、
   一人親方や、これから入る人もいる。

   いまは請求書払いだけ。カード払いはまだ通していない。
   個人宛の請求書を出せないと、経費で落とす人が買えないので、
   宛名と宛先をここで受け取る。 */

type Order = {
  id: string;
  amount: number;
  due_date: string | null;
  bill_to: string | null;
  status?: string;
  paid_at?: string | null;
  created_at?: string;
};

const day = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function TrainOrderClient() {
  const [st, setSt] = useState<{
    name: string;
    unitPrice: number;
    already: boolean;
    by: string | null;
    orders: Order[];
  } | null>(null);
  const [billTo, setBillTo] = useState("");
  const [billAddr, setBillAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [made, setMade] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/train-order", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "開けません。");
        setSt({ name: "", unitPrice: 0, already: false, by: null, orders: [] });
        return;
      }
      setSt({
        name: j.name ?? "",
        unitPrice: j.unitPrice ?? 0,
        already: !!j.already,
        by: j.by ?? null,
        orders: j.orders ?? [],
      });
      if (!billTo) setBillTo(j.name ?? "");
    } catch {
      setNote("つながりません。");
      setSt({ name: "", unitPrice: 0, already: false, by: null, orders: [] });
    }
  }, [billTo]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/train-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ billTo, billAddr }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setNote(j.reason ?? "申し込めませんでした。");
        return;
      }
      setMade(j.order as Order);
      await load();
    } catch {
      setNote("つながりません。電波の届く所でもう一度。");
    } finally {
      setBusy(false);
    }
  };

  if (!st) return <Loading title="実務トレーニングの申し込み" rows={3} />;

  const tax = Math.floor(st.unitPrice * TAX_RATE);
  const total = st.unitPrice + tax;
  const pending = st.orders.find((o) => o.status === "pending");

  if (st.already) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/training" className="backlink text-[13px] text-dim no-underline">← 実務トレーニング</Link>
        <h1 className="mt-2 text-[18px] font-black">もう開いています</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim" data-testid="train-already">
          第2章から先は、いま使えます。
          {st.by === "trial" ? "（会社が無償利用の事業者のため）" : ""}
        </p>
        <Link
          href="/training"
          className="mt-6 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          章の一覧へ
        </Link>
      </main>
    );
  }

  if (made || pending) {
    const o = made ?? pending!;
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/training" className="backlink text-[13px] text-dim no-underline">← 実務トレーニング</Link>
        <h1 className="mt-2 text-[18px] font-black">申し込みました</h1>
        <div className="mt-3 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="train-order-done">
          <div className="text-[13px] leading-relaxed text-txt">
            請求書をお送りします。宛名は「{o.bill_to}」です。
          </div>
          <div className="mt-2 text-[12.5px] leading-relaxed text-dim">
            金額　{yen(o.amount)}（税込）
            <br />
            支払期限　{day(o.due_date)}
            <br />
            <span className="text-dim2">入金が確認できると、第2章から先が開きます。</span>
          </div>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-dim2">
          第1章は、いまも遊べます。
        </p>
        <Link
          href="/training/ch1"
          className="mt-4 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          第1章をやる
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 py-8 pb-12">
      <div className="tape -mx-5 mb-6" />
      <Link href="/training" className="backlink text-[13px] text-dim no-underline">← 実務トレーニング</Link>
      <h1 className="mt-2 text-[18px] font-black">第2章から先を開く</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
        第2章「高所作業」と第3章「火打とシート」が開きます。
        一度きりの申し込みで、あとから会社を移っても使えます。
      </p>

      <div className="mt-4 rounded-xl border border-line bg-panel p-4">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="text-dim">金額</span>
          <span className="ml-auto text-[20px] font-black" data-testid="train-price">{yen(total)}</span>
        </div>
        <div className="mt-0.5 text-right text-[11.5px] text-dim2">
          {yen(st.unitPrice)}（税抜）＋ 消費税 {yen(tax)}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-[11px] tracking-[2px] text-dim">請求書の宛名</label>
        <input
          value={billTo}
          onChange={(e) => setBillTo(e.target.value)}
          placeholder="お名前（会社名でも構いません）"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13.5px]"
          data-testid="train-billto"
        />
        <div className="mt-1 text-[11px] text-dim2">
          経費で落とす場合は、会社名を入れてください。
        </div>

        <label className="mb-1 mt-4 block text-[11px] tracking-[2px] text-dim">送り先（任意）</label>
        <textarea
          value={billAddr}
          onChange={(e) => setBillAddr(e.target.value)}
          rows={3}
          placeholder="郵送が要る場合の住所"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[13px]"
          data-testid="train-billaddr"
        />
        <div className="mt-1 text-[11px] leading-relaxed text-dim2">
          空のままなら、登録したメールにお送りします。
        </div>
      </div>

      <div className="mt-5">
        <Btn tone="y" dis={busy || !billTo.trim()} onClick={send} testid="train-order-go">
          {busy ? "申し込んでいます…" : "請求書払いで申し込む"}
        </Btn>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-dim2">
        申し込むと請求書をお送りします。入金が確認できると、第2章から先が開きます。
        <br />
        カード払いは、いま準備中です。
      </p>

      {note && <div className="mt-3 text-[12.5px] text-red" data-testid="train-order-note">{note}</div>}

      <div className="mt-8 rounded-xl border border-line bg-panel p-4 text-[11.5px] leading-relaxed text-dim2">
        実務トレーニングは、特別教育（学科）の修了証の要件ではありません。
        申し込まなくても、学科と修了証はそのまま進められます。
        <br />
        会社でまとめて申し込む場合は、教育担当者に聞いてください。
      </div>
    </main>
  );
}
