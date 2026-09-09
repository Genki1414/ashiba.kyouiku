"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { yen } from "@/lib/pricing";

/* 請求書の一覧（買った側）。

   げんきさん（2026-09-09）「請求書を発行すると過去の請求書が見れなくなるから、
   請求書ページ作って残して」。
   ホームの札は「払っていないもの」しか出さないので、払った瞬間に
   請求書を開く道が消えていた。経理に出すのは払ったあと。

   1回の申込みが1件。中に講座ごとの明細（足場3名 23,100円…）。
   請求書は運営が出してはじめて開ける。出ていないものは、そう言う。 */

type Entry = {
  id: string; groupId: string; createdAt: string; method: string;
  status: "pending" | "paid" | "cancelled"; seats: number; amount: number;
  items: { courseId: string; short: string; seats: number; amount: number }[];
  invoicedAt: string | null; paidAt: string | null;
};

const STATUS: Record<Entry["status"], { t: string; c: string }> = {
  pending: { t: "入金待ち", c: "border-yel text-yel" },
  paid: { t: "入金済み", c: "border-grn text-grn" },
  cancelled: { t: "取消", c: "border-line text-dim2" },
};

const day = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export function InvoicesClient() {
  const [list, setList] = useState<Entry[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [ng, setNg] = useState("");

  useEffect(() => {
    fetch("/api/invoices", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) { setNg(j?.reason ?? "画面を表示できません。"); return; }
        setList(Array.isArray(j.list) ? j.list : []);
        setAdmin(!!j.admin);
      })
      .catch(() => setNg("接続できません。電波の届く場所で、もう一度お試しください。"));
  }, []);

  /* 担当者は申込みの画面へ、個人はホームへ戻る */
  const back = admin ? "/order" : "/";
  const backLabel = admin ? "← 申込み" : "← ホーム";

  return (
    <main className="px-5 py-8" data-testid="invoices">
      <div className="tape -mx-5 mb-6" />
      <Link href={back} className="backlink text-[13px] text-dim no-underline">{backLabel}</Link>
      <h1 className="mt-2 text-[19px] font-black">請求書の一覧</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-dim">
        これまでの申込みと請求書の一覧です。お支払い後も、こちらから開けます。
      </p>

      {ng && (
        <div className="mt-4 rounded-lg border border-red p-3 text-[12.5px] leading-relaxed text-red" data-testid="invoices-ng">
          {ng}
        </div>
      )}

      {list && !list.length && !ng && (
        <div className="mt-4 rounded-xl border border-line bg-panel p-4 text-[12.5px] text-dim" data-testid="invoices-empty">
          申込みはまだありません。
        </div>
      )}

      {!!list?.length && (
        <div className="mt-4 grid gap-2.5">
          {list.map((e) => (
            <div key={e.groupId} className="rounded-xl border border-line bg-panel p-4" data-testid="invoice-row">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-dim">{day(e.createdAt)} 申込</span>
                <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10.5px] ${STATUS[e.status].c}`}>
                  {STATUS[e.status].t}
                </span>
              </div>
              {/* 講座ごとの明細。1回の申込みに何が入っているかを、開かずに分かるように */}
              <div className="mt-2 grid gap-0.5 text-[12.5px]" data-testid="invoice-row-items">
                {e.items.map((it, i) => (
                  <div key={`${it.courseId}-${i}`} className="flex">
                    <span>{it.short}　{it.seats}名</span>
                    <span className="ml-auto text-dim">{yen(it.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-baseline border-t border-line pt-1.5">
                <span className="text-[11.5px] text-dim">合計（税込）</span>
                <span className="ml-auto text-[15px] font-black" data-testid="invoice-row-total">{yen(e.amount)}</span>
              </div>
              <div className="mt-1 text-[11px] text-dim2">
                {e.method === "card" ? "カード払い" : "請求書払い"}
                {e.paidAt ? `　${day(e.paidAt)} 入金` : ""}
              </div>

              {e.method === "card" ? (
                /* カードは請求書を出さない（カード会社の明細が控えになる） */
                <div className="mt-2 text-[11.5px] text-dim2">カード払いのため、請求書の発行はありません。</div>
              ) : e.invoicedAt ? (
                <Link
                  href={`/invoice/${e.id}`}
                  className="mt-2 block rounded-lg border border-yel px-3 py-2 text-center text-[12.5px] font-bold text-yel no-underline"
                  data-testid="invoice-row-open"
                >
                  請求書を表示（{day(e.invoicedAt)} 発行）
                </Link>
              ) : e.status === "cancelled" ? null : (
                /* 出ていないものは出ていないと言う。押しても開かないリンクを置かない */
                <div className="mt-2 rounded-lg border border-line px-3 py-2 text-[11.5px] text-dim" data-testid="invoice-row-wait">
                  請求書は未発行です。発行されると、こちらから開けます。
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
