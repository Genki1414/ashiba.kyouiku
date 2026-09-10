"use client";

import { useEffect, useState } from "react";
import { loadMe, readMe } from "@/lib/me";

/* 畳んだ見出しに出す「◯件取得済み」。

   げんきさんの依頼（2026-09-10）。

   ── なぜ要るか ──
   特別教育ドットコムは73講座を畳んである。足場屋革命の
   「その他特別教育」も同じ。**開かないと、自分がどれを持っているかが
   分からない。**畳んだままだと「まだ何も取っていない人」と
   「もう20件取った人」の画面が、そっくり同じに見える。

   札そのものの「取得済」は HeldMark が出す。ここは、その数を
   開く前に見せるだけ。一覧は作り置きなので、人の情報は後から付ける
   （聞きに行くのは1本。src/lib/me.ts が分け合う）。

   0件のときは出さない。「0件取得済み」は、まだ何もしていない人に
   わざわざ「0」と言うだけになる。 */
export function HeldCount({ ids }: { ids: string[] }) {
  const [n, setN] = useState(0);
  /* 配列は描くたびに別物になるので、そのまま見張ると
     描き直すたびに聞きに行く。中身の字で見張る */
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    const want = new Set(key.split(","));
    const count = (held?: string[]) => (held ?? []).filter((id) => want.has(id)).length;
    /* まず前に聞いた答えで描く。そのうしろで聞き直す */
    setN(count(readMe()?.held));
    void loadMe().then((me) => { if (alive && me) setN(count(me.held)); });
    return () => { alive = false; };
  }, [key]);
  if (!n) return null;
  return (
    <span
      className="rounded border border-grn px-1.5 py-0.5 text-[10.5px] font-bold text-grn"
      data-testid="course-held-count"
    >
      {n}件取得済み
    </span>
  );
}
