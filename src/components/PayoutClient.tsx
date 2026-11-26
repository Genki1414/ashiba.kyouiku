"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { yen } from "@/lib/pricing";
import { monthLabel, ymd } from "@/lib/membership";

/* 営業パートナーの報酬の支払明細（docs/122）。本部と本人が見る。印刷して渡せる。
   請求書（InvoiceClient）と同じ紙の決まり（.paper／.noprint は globals.css） */

type Loaded = {
  payout: { id: string; no: string; periodMonth: string; total: number; status: string; paidAt: string | null; note: string; createdAt: string };
  partner: { name: string; kind: string; code: string; rate: number; contact: string };
  bank: { bankName: string; branch: string; acctType: string; acctNo: string; holder: string; taxNote: string } | null;
  items: { id: string; company: string; periodMonth: string; baseNet: number; rate: number; amount: number; kind: string }[];
  seller: { name: string; address: string; tel: string; email: string; invoiceNo: string };
};

export function PayoutClient({ payoutId, mine = false }: { payoutId: string; mine?: boolean }) {
  const [st, setSt] = useState<Loaded | null>(null);
  const [ng, setNg] = useState("");
  const back = mine ? "/partner" : "/owner";
  useEffect(() => {
    fetch(`/api/owner/payout?payoutId=${encodeURIComponent(payoutId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setSt(j as Loaded) : setNg(j?.reason ?? "画面を表示できません。")))
      .catch(() => setNg("接続できません。"));
  }, [payoutId]);

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href={back} className="backlink text-[13px] text-dim no-underline">← 戻る</Link>
        <p className="mt-3 text-[13px] text-dim" data-testid="payout-ng">{ng}</p>
      </main>
    );
  }
  if (!st) return null;
  const { payout: p, partner: sp, seller: s } = st;
  return (
    <>
      <style>{`
        @media print {
          .paper { background: #fff !important; color: #000 !important; border: none !important; padding: 0 !important; margin: 0 !important; font-size: 12px !important; break-inside: avoid; }
          .paper * { color: #000 !important; border-color: #999 !important; }
          .sheet { padding: 0 !important; }
        }
      `}</style>
      <main className="sheet px-5 py-6 pb-12">
        <div className="noprint">
          <Link href={back} className="backlink text-[13px] text-dim no-underline">{mine ? "← 営業パートナー" : "← 本部"}</Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-[16px] font-black">報酬支払明細</h1>
            <a href={`/api/owner/payout?payoutId=${encodeURIComponent(payoutId)}&format=csv`} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-[12px] text-dim no-underline" data-testid="payout-csv">CSV</a>
            <button onClick={() => window.print()} className="rounded-lg border border-yel px-3 py-1.5 text-[12px] text-yel" data-testid="payout-print">印刷 / PDF にする</button>
          </div>
        </div>

        <div className="paper mt-4 rounded-xl border border-line bg-panel p-6 text-[13px] leading-relaxed" data-testid="payout">
          <div className="text-center text-[20px] font-black tracking-[6px]">報酬支払明細書</div>
          <div className="mt-5 flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="border-b border-line pb-1 text-[16px] font-bold" data-testid="payout-to">{sp.name} {sp.kind === "corp" ? "御中" : "様"}</div>
              <div className="mt-1 text-[12px]">紹介コード {sp.code}</div>
            </div>
            <div className="text-right text-[11.5px]">
              <div>明細番号　{p.no}</div>
              <div>発行日　{ymd(p.createdAt)}</div>
              <div>対象月　{monthLabel(p.periodMonth)}</div>
            </div>
          </div>
          <div className="mt-5 text-[12.5px]">下記のとおり報酬をお支払いします（{p.status === "paid" ? `${ymd(p.paidAt)} お支払い` : "お支払い予定"}）。</div>
          <div className="mt-2 border-y-2 border-line py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-[12px]">お支払金額</span>
              <span className="ml-auto text-[24px] font-black" data-testid="payout-total">{yen(p.total)}</span>
            </div>
            <div className="mt-0.5 text-right text-[11px]">（消費税込み・源泉徴収なし）</div>
          </div>
          <table className="mt-4 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-1.5 font-normal">紹介先</th>
                <th className="whitespace-nowrap py-1.5 text-right font-normal">税抜会費</th>
                <th className="whitespace-nowrap py-1.5 text-right font-normal">率</th>
                <th className="whitespace-nowrap py-1.5 text-right font-normal">報酬</th>
              </tr>
            </thead>
            <tbody>
              {st.items.map((it) => (
                <tr key={it.id} className="border-b border-line" data-testid="payout-item">
                  <td className="py-2">{it.company}{it.kind === "adjust" ? "（調整）" : ""}</td>
                  <td className="whitespace-nowrap py-2 text-right">{yen(it.baseNet)}</td>
                  <td className="whitespace-nowrap py-2 text-right">{it.rate}%</td>
                  <td className="whitespace-nowrap py-2 text-right">{yen(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.note && <div className="mt-3 text-[12px]">備考　{p.note}</div>}
          {st.bank && (
            <div className="mt-4 border border-line p-3 text-[12.5px] leading-[1.8]" data-testid="payout-bank">
              <div className="mb-1 text-[11px] tracking-[2px]">お振込先（ご登録の口座）</div>
              <div>{st.bank.bankName}　{st.bank.branch}</div>
              <div>{st.bank.acctType}　{st.bank.acctNo}　{st.bank.holder}</div>
              {st.bank.taxNote && <div className="text-[11.5px]">{st.bank.taxNote}</div>}
            </div>
          )}
          <div className="mt-8 text-[12px] leading-[1.9]">
            <div className="text-[14px] font-bold">{s.name}</div>
            {s.address && <div>{s.address}</div>}
            {s.tel && <div>TEL {s.tel}</div>}
            {s.email && <div>{s.email}</div>}
            {s.invoiceNo && <div className="mt-1">適格請求書発行事業者 登録番号　{s.invoiceNo}</div>}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed">
            報酬は紹介先の月額会費（税抜）に率を掛けた額です。振込手数料は当社負担。源泉徴収は行っていませんので、税務申告はご自身でお願いします。
          </div>
        </div>
      </main>
    </>
  );
}
