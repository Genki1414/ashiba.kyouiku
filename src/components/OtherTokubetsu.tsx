"use client";

import Link from "next/link";
import { KIND_TEXT, hoursText, kindOf, totalNoteOf, type CourseMeta } from "@/content/courses";
import { TOKUBETSU, isReady } from "@/content/tokubetsu";
import { OtherCourses } from "./OtherCourses";

/* 「その他特別教育」の開け閉め。**ホームと講座の一覧の両方で使う。**

   中身は2段になっている。
     ① もう受けられる講座（menu: "other"）… 押せる札
     ② まだ作っていない特別教育の目録 … 準備中

   ── なぜホームにも置くか ──
   はじめ、講座の一覧（/edu）だけに置いていた。
   ところが**ホームの札は各講座へ直接飛ぶ**（/edu/ashiba）ので、
   一覧そのものに辿り着く道がどこにも無かった。
   置いたのに、誰にも見えていなかった。

   ── ①を忘れると、同じことが起きる ──
   最初は②だけを出していたので、menu: "other" にした講座（石綿）が
   **ホームのどこにも出なかった。** 受けられるのに、行き着けない。
   受けられる札を先に、目録をそのあとに出す。

   開け閉めは <details> でやる。JavaScript が動かなくても開くし、
   キーボードでも開ける。圏外で開いた人が詰まらない。 */

function Card({ c }: { c: CourseMeta }) {
  return (
    <Link
      href={`/edu/${c.id}`}
      className="mb-2.5 block rounded-xl border border-yel bg-panel p-4 no-underline"
      data-testid="course-card"
    >
      <div className="text-[11px] font-extrabold tracking-widest text-yel">
        {KIND_TEXT[kindOf(c)].label}
      </div>
      <div className="mt-1 text-[16px] font-black leading-snug text-txt">{c.name}</div>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
        {c.basis}
        <br />
        {totalNoteOf(c)} {hoursText(c.totalMin)}
      </div>
    </Link>
  );
}

/** @param ready 受けられる「その他」の講座。サーバ側で教材の有無を見てから渡す */
export function OtherTokubetsu({ ready = [] }: { ready?: CourseMeta[] }) {
  const todo = TOKUBETSU.filter((t) => !isReady(t)).length;
  const n = ready.length + todo;
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
        {/* 受けられるものが先。目録の中に埋もれさせない */}
        {ready.map((c) => (
          <Card key={c.id} c={c} />
        ))}
        <OtherCourses />
      </div>
    </details>
  );
}
