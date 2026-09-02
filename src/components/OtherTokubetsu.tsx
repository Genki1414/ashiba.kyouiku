"use client";

import { TOKUBETSU, isReady } from "@/content/tokubetsu";
import { OtherCourses } from "./OtherCourses";

/* 「その他特別教育」の開け閉め。**ホームと講座の一覧の両方で使う。**

   ── なぜホームにも置くか ──
   はじめ、講座の一覧（/edu）だけに置いていた。
   ところが**ホームの札は各講座へ直接飛ぶ**（/edu/ashiba）ので、
   一覧そのものに辿り着く道がどこにも無かった。
   置いたのに、誰にも見えていなかった。

   人が見ているのはホーム。だからホームに置く。

   開け閉めは <details> でやる。JavaScript が動かなくても開くし、
   キーボードでも開ける。圏外で開いた人が詰まらない。 */

export function OtherTokubetsu() {
  const n = TOKUBETSU.filter((t) => !isReady(t)).length;
  if (!n) return null;
  return (
    <details className="group rounded-xl border border-line bg-bg" data-testid="course-other">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 p-4 text-[14px] font-black text-txt"
        data-testid="course-other-open"
      >
        {/* 押せることが見た目で分かるように印を出す。
            list-none で既定の三角を消しているので、無いと
            ただの見出しにしか見えない */}
        <span
          className="inline-block text-[11px] text-yel transition-transform group-open:rotate-90"
          aria-hidden
        >
          ▶
        </span>
        その他特別教育
        <span className="text-[11.5px] font-normal text-dim">{n}件</span>
      </summary>
      <div className="px-4 pb-4">
        <OtherCourses />
      </div>
    </details>
  );
}
