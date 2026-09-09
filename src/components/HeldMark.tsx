"use client";

import { useEffect, useState } from "react";
import { loadMe, readMe } from "@/lib/me";

/* 講座の札に付ける「取得済」。

   げんきさんの依頼（2026-09-09）「取得済みの資格は講座一覧にも取得済表示」。
   マイページには出ていたが、講座を選ぶ一覧には無く、
   持っている講座をもう一度押して、中で気づくことになっていた。

   一覧は作り置き（ホームも /edu も、誰が見ても同じ）なので、
   札そのものに人の情報は載せない。ここが後から /api/me に聞いて付ける。
   何枚あっても、聞きに行くのは1本（src/lib/me.ts が分け合う）。 */
export function HeldMark({ courseId }: { courseId: string }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let alive = true;
    const has = (ids?: string[]) => !!ids?.includes(courseId);
    /* まず前に聞いた答えで描く。そのうしろで聞き直す */
    setHeld(has(readMe()?.held));
    void loadMe().then((me) => { if (alive && me) setHeld(has(me.held)); });
    return () => { alive = false; };
  }, [courseId]);
  if (!held) return null;
  return (
    <span
      className="ml-2 rounded border border-grn px-1.5 py-0.5 text-[10.5px] font-bold tracking-normal text-grn"
      data-testid="course-held"
    >
      取得済
    </span>
  );
}

/* 講座を開いたときの「取得済みのため受講不要」（げんきさん 2026-09-09）。

   一覧の札には「取得済」と出るが、押して中に入ると何も出なかった。
   同じ特別教育を受け直す必要はないので、開いた所ではっきり書く。
   **受けられなくはしない。**受け直したい人（期間が空いた・自信が無い）を
   止める決まりは無い。 */
export function HeldNotice({ courseId }: { courseId: string }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let alive = true;
    const has = (ids?: string[]) => !!ids?.includes(courseId);
    setHeld(has(readMe()?.held));
    void loadMe().then((me) => { if (alive && me) setHeld(has(me.held)); });
    return () => { alive = false; };
  }, [courseId]);
  if (!held) return null;
  return (
    <div
      className="mt-3 rounded-xl border border-grn bg-[#14201A] p-3.5"
      data-testid="course-held-notice"
    >
      <div className="text-[13.5px] font-black text-grn">取得済みのため受講不要です</div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
        この特別教育は取得済みとして登録されています。同じ特別教育を受け直す必要はありません。
        もう一度受講することもできます。
      </div>
    </div>
  );
}
