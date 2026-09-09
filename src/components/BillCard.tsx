"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMe, readMe, type Me } from "@/lib/me";

/* 届いている請求書。**「はじめかた」のすぐ下に置く**（げんきさん 2026-09-09）。

   払ってもらわないと受講コードが出ない。いちばん急ぐ用なので、
   ほかの札（マイページ・担当者・本部）より上に出す。
   届いていない人には何も出さない。 */
export function BillCard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    /* 覚えているぶんで、まず描く。画面が一拍ずれない */
    setMe(readMe());
    let alive = true;
    void loadMe().then((fresh) => {
      if (!alive) return;
      /* ログインが切れていたら下げる。前の人の金額を残さない */
      setMe(fresh?.userId ? fresh : null);
    });
    return () => { alive = false; };
  }, []);

  const bills = me?.bills ?? [];
  if (!bills.length) return null;
  const total = bills.reduce((n, b) => n + (b.amount ?? 0), 0);

  return (
    <Link
      /* 2件以上なら一覧へ。1件目だけ開いて、2件目に気づかないと困る */
      href={bills.length > 1 ? "/invoices" : `/invoice/${bills[0].id}`}
      className="mb-4 block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
      data-testid="home-bill"
    >
      <div className="text-[11px] font-extrabold tracking-widest text-yel">請求書</div>
      <div className="mt-1 text-[15px] font-black text-txt">
        請求書が届いています
        {bills.length > 1 ? `（${bills.length}件）` : ""}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-dim">
        お振込みの金額は {total.toLocaleString("ja-JP")}円（税込）です。
        <br />
        お振込みの確認後、受講コードを発行します。
      </div>
    </Link>
  );
}
