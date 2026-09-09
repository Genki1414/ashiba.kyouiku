"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMe, readMe, sameMe, type Me } from "@/lib/me";
import { BRAND } from "@/content/brand";

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
      if (!alive) return;
      /* 聞けなかった（ログインが切れた・圏外）。覚えは前の話なので下げる。
         下げないと、前の人の請求書の金額と番号が出たままになる */
      if (!fresh?.userId) {
        setMe(null);
        return;
      }
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
  /* 届いている請求書は、**「はじめかた」のすぐ下**に出す（BillCard）。
     いちばん急ぐ用なので、ここ（画面の下のほう）では遅い
     （げんきさん 2026-09-09） */

  if (me.member === "pending") {
    cards.push(
      <Link
        key="pending"
        href="/join"
        className="block rounded-xl border border-yel bg-[#1A1F14] p-4 no-underline"
        data-testid="home-pending"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-yel">承認待ち</div>
        <div className="mt-1 text-[15px] font-black text-txt">会社からの承認をお待ちください</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          お申し込みは届いています。教育担当者が承認すると、名簿に登録され受講できるようになります。
          <br />
          お急ぎの場合は担当者にご連絡ください。受講コード（12文字）を受け取れば、
          承認を待たずに受講を始められます。
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
          自分の会社を検索して申し込みます。まだ登録のない会社は、その場で登録できます。
          会社とつながっていないと、名簿に登録されず、修了証も発行できません。
        </div>
      </Link>,
    );
  }

  /* **すでに受けている人が、ほかの講座も受けたいとき。**

     73講座あるのに、席を1つ持っている人には /join への案内がどこにも
     出ていなかった。「次はこれも受けたい」と思っても行き先が無い。
     受講リクエストの仕組みは前からあるのに、**入口が
     「席が無い人」にしか出ていなかった**（下の home-seat）。

     **両方の店で出す。**はじめは特別教育ドットコムだけにしたが、
     講座が73本あるのは足場屋革命も同じで、足場を受けた人が石綿を
     受けたいときに行き先が無いのは変わらなかった（げんきさん 2026-09-07）。

     担当者本人には出さない。自分に頼むことになる（担当者は申込みの札が出る）。 */
  if (me.canLearn && me.member === "active" && !me.admin) {
    cards.push(
      <Link
        key="request"
        href="/join"
        className="block rounded-xl border border-line bg-panel p-4 no-underline"
        data-testid="home-request"
      >
        <div className="text-[11px] font-extrabold tracking-widest text-cyan">ほかの講座も</div>
        <div className="mt-1 text-[15px] font-black text-txt">受けたい講座をリクエストする</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">
          受けたい講座を選んで送ると、会社の教育担当者に届きます。
          担当者が受講コードを用意すると、次に開いたときからその講座が出ます。
          <br />
          受講コード（12文字）を受け取っているときは、そのまま入れても始められます。
        </div>
      </Link>,
    );
  }

  /* 受講コードの札は、在籍していて、**受け取る側の人**にだけ出す。

     承認待ちの人には、先に承認が要ることを上で出してある。
     教育担当者と本部には出さない（げんきさん 2026-09-09「受講するにはは必要か？」）。
     配る側なので、自分の受講コードは名簿から自分に配れる。
     ここに出ていると、毎日開くたびに用の無い札を1枚めくることになる */
  if (!me.canLearn && me.member === "active" && !me.admin && !me.owner) {
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
          {/* 実務トレーニングは足場屋革命だけの売り物。
              売っていない店で勧めると、あの店の利用規約が対象にして
              いないものへ連れて行くことになる（2026-09-08） */}
          {BRAND.training && (
            <>
              <br />
              実務トレーニングの第1章は、コードが無くても遊べます。
            </>
          )}
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
        <div className="text-[11px] font-extrabold tracking-widest text-grn">受講管理</div>
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
        <div className="text-[11px] font-extrabold tracking-widest text-cyan">運営管理</div>
        <div className="mt-1 text-[17px] font-black text-txt">申込みと入金／事業者と記録</div>
        <div className="mt-2 text-[12px] leading-relaxed text-dim">
          売った先の注文と入金。事業者ごとの受講記録（辞めた人もふくむ）。
        </div>
      </Link>,
    );
  }

  return <>{cards}</>;
}
