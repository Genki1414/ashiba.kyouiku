"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { yen } from "@/lib/pricing";

/* 請求書。本部が開いて、印刷するか PDF にして送る。

   紙で出すものなので、画面の色（黒地）のままだと読めない。
   印刷のときだけ白地・黒字にする。

   個人宛にも出せるようにしてある。
   出せないと、経費で落とす人が買えない。 */

type Inv = {
  order: {
    id: string; no: string; to: string; addr: string; what: string;
    qty: number; unit: number; net: number; tax: number; amount: number;
    taxRate: number; due: string | null; at: string | null;
    paidAt: string | null; status: string; note: string; solo: boolean;
  };
  seller: {
    name: string; ceo: string; address: string; tel: string; email: string; invoiceNo: string;
  };
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

export function InvoiceClient({ orderId }: { orderId: string }) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [ng, setNg] = useState("");

  useEffect(() => {
    fetch(`/api/owner/invoice?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setInv(j as Inv) : setNg(j?.reason ?? "開けません。")))
      .catch(() => setNg("つながりません。"));
  }, [orderId]);

  if (ng) {
    return (
      <main className="px-5 py-8">
        <div className="tape -mx-5 mb-6" />
        <Link href="/owner" className="backlink text-[13px] text-dim no-underline">← 本部</Link>
        <p className="mt-3 text-[13px] text-dim">{ng}</p>
      </main>
    );
  }
  if (!inv) return null;

  const { order: o, seller: s } = inv;

  return (
    <>
      {/* 印刷のときだけ白地・黒字。画面のままだと紙で読めない */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .noprint { display: none !important; }
          .paper { background: #fff !important; color: #000 !important; border: none !important; }
          .paper * { color: #000 !important; border-color: #999 !important; }
        }
      `}</style>

      <main className="px-5 py-6 pb-12">
        <div className="noprint">
          <Link href="/owner" className="backlink text-[13px] text-dim no-underline">← 本部</Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-[16px] font-black">請求書</h1>
            <button
              onClick={() => window.print()}
              className="ml-auto rounded-lg border border-yel px-3 py-1.5 text-[12px] text-yel"
              data-testid="invoice-print"
            >
              印刷 / PDF にする
            </button>
          </div>
          {!s.ceo && (
            <div className="mt-2 rounded-lg border border-red p-2.5 text-[11.5px] text-red">
              事業者の情報がまだ空です。/setup で埋めてください。
            </div>
          )}
        </div>

        <div
          className="paper mt-4 rounded-xl border border-line bg-panel p-6 text-[13px] leading-relaxed"
          data-testid="invoice"
        >
          <div className="text-center text-[20px] font-black tracking-[6px]">請 求 書</div>

          <div className="mt-5 flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="border-b border-line pb-1 text-[16px] font-bold" data-testid="invoice-to">
                {o.to} 御中
              </div>
              {o.addr && <div className="mt-1 whitespace-pre-wrap text-[12px]">{o.addr}</div>}
            </div>
            <div className="text-right text-[11.5px]">
              <div>請求番号　{o.no}</div>
              <div>発行日　{day(o.at)}</div>
            </div>
          </div>

          <div className="mt-5 text-[12.5px]">下記のとおりご請求申し上げます。</div>

          <div className="mt-2 border-y-2 border-line py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-[12px]">ご請求金額</span>
              <span className="ml-auto text-[24px] font-black" data-testid="invoice-total">
                {yen(o.amount)}
              </span>
            </div>
            <div className="mt-0.5 text-right text-[11px]">（消費税込）</div>
          </div>

          {o.due && (
            <div className="mt-2 text-[12.5px]">
              お支払期限　<strong>{day(o.due)}</strong>
            </div>
          )}
          {o.paidAt && (
            <div className="mt-1 text-[12.5px]">{day(o.paidAt)} に入金を確認いたしました。</div>
          )}

          {/* 明細 */}
          <table className="mt-4 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-1.5 font-normal">品目</th>
                <th className="py-1.5 text-right font-normal">数量</th>
                <th className="py-1.5 text-right font-normal">単価</th>
                <th className="py-1.5 text-right font-normal">金額</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2">{o.what}</td>
                <td className="py-2 text-right">{o.qty}</td>
                <td className="py-2 text-right">{yen(o.unit)}</td>
                <td className="py-2 text-right">{yen(o.net)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-2 flex flex-col items-end gap-0.5 text-[12.5px]">
            <div>小計　{yen(o.net)}</div>
            <div>
              消費税（{Math.round(o.taxRate * 100)}%）　{yen(o.tax)}
            </div>
            <div className="mt-1 border-t border-line pt-1 text-[14px] font-black">
              合計　{yen(o.amount)}
            </div>
          </div>

          {o.note && <div className="mt-3 text-[12px]">備考　{o.note}</div>}

          {/* 発行者 */}
          <div className="mt-8 text-[12px] leading-[1.9]">
            <div className="text-[14px] font-bold">{s.name}</div>
            {s.ceo && <div>代表者　{s.ceo}</div>}
            {s.address && <div>{s.address}</div>}
            {s.tel && <div>TEL {s.tel}</div>}
            {s.email && <div>{s.email}</div>}
            {s.invoiceNo && (
              <div className="mt-1" data-testid="invoice-regno">
                適格請求書発行事業者 登録番号　{s.invoiceNo}
              </div>
            )}
          </div>

          <div className="mt-4 text-[11px] leading-relaxed">
            お振込先は別途ご案内いたします。振込手数料はお客様のご負担にてお願いいたします。
          </div>
        </div>
      </main>
    </>
  );
}
