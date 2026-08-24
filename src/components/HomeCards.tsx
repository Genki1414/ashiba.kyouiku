"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ホームの出し分け。

   この教材は外販するので、人によって出すものが違う。
   ・まだどこの事業者にも属していない人 … 参加コードを入れてもらう
   ・教育担当者 … 担当者の画面への入口

   ホームを静的なまま置いておきたいので、ここから聞く（AccountBar と同じ）。 */

type Me = { admin: boolean; owner: boolean; needsJoin: boolean; company: string };

export function HomeCards() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok)
          setMe({ admin: !!j.admin, owner: !!j.owner, needsJoin: !!j.needsJoin, company: j.company ?? "" });
      })
      .catch(() => {
        /* 圏外・未設定。何も出さない */
      });
    return () => { alive = false; };
  }, []);

  if (!me) return null;

  const cards = [];

  if (me.needsJoin) {
    cards.push(
      <Link
        key="join"
        href="/join"
        className="block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
        data-testid="home-join"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-yel">はじめに</div>
        <div className="mt-1 text-[15px] font-black text-txt">参加コードを入れる</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          会社の教育担当者から渡された8文字を入れてください。
          入れないと、修了証をどの会社の名義で出すか決まりません。
        </div>
      </Link>,
    );
  }

  if (me.admin) {
    cards.push(
      <Link
        key="admin"
        href="/admin"
        className="block rounded-xl border border-line bg-panel p-5 no-underline"
        data-testid="home-admin"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-grn">教育担当者</div>
        <div className="mt-1 text-[17px] font-black text-txt">受講の進み具合と修了証</div>
        <div className="mt-2 text-[12px] leading-relaxed text-dim">
          誰がどこまで進んだかを見て、修了証を出す。
          <br />
          {me.company}
        </div>
      </Link>,
    );
  }

  if (me.owner) {
    cards.push(
      <Link
        key="owner"
        href="/owner"
        className="block rounded-xl border border-line bg-panel p-5 no-underline"
        data-testid="home-owner"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-cyan">運営</div>
        <div className="mt-1 text-[17px] font-black text-txt">申込みと入金</div>
        <div className="mt-2 text-[12px] leading-relaxed text-dim">
          売った先の注文をぜんぶ見る。請求書払いの入金を確認する。
        </div>
      </Link>,
    );
  }

  return <>{cards}</>;
}
