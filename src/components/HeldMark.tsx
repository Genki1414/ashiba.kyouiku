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
/* ── 札に出す1つの印（2026-09-09）──

   げんきさん「講座一覧にも受講可能、受講中表示。
   受講可能 受講コード保有中だが開いて無い場合」

   出すのは**1つだけ。**3つ並ぶと、どれが今の話か分からなくなる。
   強いほうから決める。

     取得済   … もう受けなくてよい（いちばん強い）
     受講中   … 開いている。押せば続きから
     受講可能 … 受講コードは配られているが、まだ開いていない

   **受講可能がいちばん効く。**配られたことに気づかないままの人が出る。
   一覧に出ていれば、押せばよいと分かる。 */
type Mark = { t: string; cls: string; id: string } | null;

const markOf = (
  courseId: string,
  me: { held?: string[]; learning?: string[]; owned?: string[] } | null,
): Mark => {
  if (!me) return null;
  if (me.held?.includes(courseId)) {
    return { t: "取得済", cls: "border-grn text-grn", id: "course-held" };
  }
  if (me.learning?.includes(courseId)) {
    return { t: "受講中", cls: "border-cyan text-cyan", id: "course-learning" };
  }
  if (me.owned?.includes(courseId)) {
    return { t: "受講可能", cls: "border-yel text-yel", id: "course-owned" };
  }
  return null;
};

export function HeldMark({ courseId }: { courseId: string }) {
  const [mark, setMark] = useState<Mark>(null);
  useEffect(() => {
    let alive = true;
    /* まず前に聞いた答えで描く。そのうしろで聞き直す */
    setMark(markOf(courseId, readMe()));
    void loadMe().then((me) => { if (alive && me) setMark(markOf(courseId, me)); });
    return () => { alive = false; };
  }, [courseId]);
  if (!mark) return null;
  return (
    <span
      className={`ml-2 rounded border px-1.5 py-0.5 text-[10.5px] font-bold tracking-normal ${mark.cls}`}
      data-testid={mark.id}
    >
      {mark.t}
    </span>
  );
}

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
