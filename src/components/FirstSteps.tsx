"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMe, readMe, sameMe, type Me } from "@/lib/me";
import { guideFor, nowStep, showGuide, type Step } from "@/lib/onboarding";

/* はじめて使う人への道のり。ホームのいちばん上に出す。

   なぜ一覧で見せるか、いつ消すかは src/lib/onboarding.ts に書いてある。

   開け閉めは <details> で、**開いた状態で出す**。
   閉じて出すと、初めての人は開かずに通り過ぎる。
   一度読めば畳めるので、邪魔になったら閉じられる。 */

/** 太字（**…**）だけ効かせる。案内文の中で1か所だけ強めたいことがある */
function bold(t: string) {
  return t.split(/\*\*(.+?)\*\*/g).map((s, i) =>
    i % 2 ? <strong key={i} className="text-txt">{s}</strong> : <span key={i}>{s}</span>,
  );
}

function Row({ s, n }: { s: Step; n: number }) {
  const mark =
    s.state === "done" ? "✓" : s.state === "now" ? `${n}` : `${n}`;
  const ring =
    s.state === "done"
      ? "border-grn text-grn"
      : s.state === "now"
        ? "border-yel bg-yel text-bg"
        : "border-line text-dim2";
  const body = (
    <>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${ring}`}
      >
        {mark}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[13px] font-bold ${
            s.state === "todo" ? "text-dim2" : "text-txt"
          }`}
        >
          {s.t}
        </span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-dim">{bold(s.d)}</span>
      </span>
    </>
  );
  /* いまやることだけ押せるようにする。先の段を押せると、
     順番を飛ばして「開かない」と詰まる */
  return s.state === "now" && s.href ? (
    <Link href={s.href} className="flex gap-2.5 py-2 no-underline" data-testid="step-now">
      {body}
    </Link>
  ) : (
    <div className="flex gap-2.5 py-2">{body}</div>
  );
}

/* 立場は HomeCards も聞いている。loadMe が行きかけの1本を分け合うので、
   ここで聞いても往復は増えない（src/lib/me.ts）。

   ── なぜ講座の札より上に出すか ──
   初めての人がまずやるのは、大きく出ている講座の札を押すこと。
   ところが受講コードが無いと、その先で断られる。
   断られてから道のりを見せても遅い。押す前に置く。 */
export function FirstSteps() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    const kept = readMe();
    if (kept) setMe(kept);
    void loadMe().then((fresh) => {
      if (!alive) return;
      if (!fresh?.userId) { setMe(null); return; }
      if (!sameMe(kept, fresh)) setMe(fresh);
    });
    return () => { alive = false; };
  }, []);

  if (!showGuide(me)) return null;
  const { title, lead, steps } = guideFor(me!);
  const now = nowStep(steps);
  return (
    <details
      open
      className="rounded-xl border border-yel bg-[#1A1F14] p-4"
      data-testid="first-steps"
    >
      <summary className="cursor-pointer list-none">
        <span className="text-[11px] font-extrabold tracking-widest text-yel">{title}</span>
        <span className="mt-1 block text-[15px] font-black text-txt">
          {now ? `つぎは「${now.t}」です` : "はじめかた"}
        </span>
        <span className="mt-1 block text-[11.5px] text-dim2">{lead}（押すと閉じます）</span>
      </summary>
      <div className="mt-3 border-t border-line pt-1">
        {steps.map((s, i) => (
          <Row key={s.t} s={s} n={i + 1} />
        ))}
      </div>
    </details>
  );
}
