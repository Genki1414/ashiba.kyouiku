"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ホームの出し分け。

   この教材は外販するので、人によって出すものが違う。
   ・まだどこの事業者にも属していない人 … 会社をさがして申し込んでもらう
   ・教育担当者 … 担当者の画面への入口

   ホームを静的なまま置いておきたいので、ここから聞く（AccountBar と同じ）。 */

type Me = { admin: boolean; owner: boolean; needsJoin: boolean; canLearn: boolean; company: string };

export function HomeCards() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.ok)
          setMe({
            admin: !!j.admin,
            owner: !!j.owner,
            needsJoin: !!j.needsJoin,
            /* 古い応答（canLearn が無い）は、止めずに通す */
            canLearn: j.canLearn !== false,
            company: j.company ?? "",
          });
      })
      .catch(() => {
        /* 圏外・未設定。何も出さない */
      });
    return () => { alive = false; };
  }, []);

  if (!me) return null;

  const cards = [];

  /* マイページ。所属を外す・氏名を直す・進み具合を見るのはここから。
     ログインしている人には必ず出す（入口が無いと辿り着けない） */
  cards.push(
    <Link
      key="me"
      href="/me"
      className="block rounded-xl border border-line bg-panel p-4 no-underline"
      data-testid="home-me"
    >
      <div className="text-[11px] font-extrabold tracking-widest text-dim">マイページ</div>
      <div className="mt-1 text-[15px] font-black text-txt">
        {me.company ? me.company : "会社とつながっていません"}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-dim">
        受講の進み具合、修了証、氏名の直し、所属の紐付けはここから。
      </div>
    </Link>,
  );

  if (me.needsJoin) {
    cards.push(
      <Link
        key="join"
        href="/join"
        className="block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
        data-testid="home-join"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-yel">はじめに</div>
        <div className="mt-1 text-[15px] font-black text-txt">会社とつなぐ</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          自分の会社をさがして申し込むか、担当者から渡されたコードを入れてください。
          つながっていないと、名簿に載らず、修了証も出せません。
        </div>
      </Link>,
    );
  }

  if (!me.canLearn && !me.needsJoin) {
    cards.push(
      <Link
        key="seat"
        href="/join"
        className="block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
        data-testid="home-seat"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-yel">受講するには</div>
        <div className="mt-1 text-[15px] font-black text-txt">受講コードを入れる</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          学科と実務トレーニングは、受講コード（12文字）を入れると開きます。
          会社の教育担当者から受け取ってください。
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
        <div className="text-[11px] font-extrabold tracking-widest text-cyan">本部</div>
        <div className="mt-1 text-[17px] font-black text-txt">申込みと入金／事業者と記録</div>
        <div className="mt-2 text-[12px] leading-relaxed text-dim">
          売った先の注文と入金。事業者ごとの受講記録（辞めた人もふくむ）。
        </div>
      </Link>,
    );
  }

  return <>{cards}</>;
}
