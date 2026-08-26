"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMe, readMe, sameMe, type Me } from "@/lib/me";

/* ホームの出し分け。

   この教材は外販するので、人によって出すものが違う。
   ・まだどこの事業者にも属していない人 … 会社をさがして申し込んでもらう
   ・教育担当者 … 担当者の画面への入口

   ホームを静的なまま置いておきたいので、ここから聞く（AccountBar と同じ）。
   前に聞いた答えを覚えてあるので、2回目からは押した瞬間に出る。
   帯と札で2回聞きに行かないよう、行きかけの1本を分け合う（src/lib/me.ts）。 */

export function HomeCards() {
  /* 描き始めは、前に聞いた答え。立場はそう変わらないので、
     まずそれで描いてしまう。特別教育と実務は作り置きで即出るのに、
     ここだけ一拍おいて出てくるのが、開くたびに気になる */
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    const kept = readMe();
    if (kept) setMe(kept);

    void loadMe().then((fresh) => {
      if (!alive || !fresh) return;
      if (!sameMe(kept, fresh)) setMe(fresh);
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

  /* 申し込んだが、まだ許可が下りていない。
     ここを「会社とつなぐ」と出すと、押しても同じ画面に戻るだけで、
     自分が進んだのかどうか分からない */
  if (me.member === "pending") {
    cards.push(
      <Link
        key="pending"
        href="/join"
        className="block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
        data-testid="home-pending"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-yel">許可待ち</div>
        <div className="mt-1 text-[15px] font-black text-txt">会社の返事を待っています</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          申し込みは届いています。会社の教育担当者が許可すると、名簿に入って受講できるようになります。
          <br />
          急ぐときは担当者にひとこと言ってください。受講コード（12文字）を渡してもらえれば、
          許可を待たずに始められます。
        </div>
      </Link>,
    );
  }

  if (me.member === "none") {
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
          自分の会社をさがして申し込みます。まだこの仕組みを使っていない会社なら、
          そこから登録もできます。つながっていないと、名簿に載らず、修了証も出せません。
        </div>
      </Link>,
    );
  }

  /* 受講コードの札は、在籍している人にだけ出す。
     許可待ちの人には、先に許可が要ることを上で出してある */
  if (!me.canLearn && me.member === "active") {
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
          特別教育（学科）は、受講コード（12文字）を入れると開きます。
          会社の教育担当者から受け取ってください。
          <br />
          実務トレーニングの第1章は、コードが無くても遊べます。
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
