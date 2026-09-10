"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findCourse } from "@/content/courses";
import { loadMe, readMe } from "@/lib/me";

/* 取得済みの講座を開いたときに、受講を勧めない（げんきさん 2026-09-11）。

   「取得済みでも押すと講座リクエスト可能になるから、
     取得済み資格はタップで開いたら取得済みの為受講不要などと表示する」

   ── 何が起きていたか ──
   一覧には「取得済」と出ていた（HeldMark）。ところが押して開くと、
   受講コードが無いので断りの画面（NeedSeat）になり、そこには
   **受講リクエストを送る札**が出ていた。
   もう持っている資格を、会社の教育担当者に「受けたい」と頼めてしまう。
   担当者の側では、要らない受講コードを買う話になる。

   ── どこで止めるか ──
   断りの画面ごと差し替える。「コードを入れてください」も出さない。
   持っている人にとっては、コードの話そのものが要らない。

   ── 間違って登録していたら ──
   よそで取った資格は本人がマイページから登録する（0015）ので、
   押し間違いはあり得る。**黙って行き止まりにしない。**
   直す場所へ行けるようにしておく。

   ── どの講座かは、住所から取る ──
   RequestCourse と同じ。この画面が出るのは /edu/<講座>/… の下だけ。 */

export function HeldInstead({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  /* /edu/<courseId> … 以下に単元が続くこともある。2つ目だけ見る */
  const id = path.split("/").filter(Boolean)[1] ?? "";
  const course = findCourse(id);

  /* null は「まだ分からない」。覚えているぶんで先に決めるので、
     ふつうは断りの画面が一瞬出てから入れ替わる、が起きない */
  const [held, setHeld] = useState<boolean | null>(() => null);

  useEffect(() => {
    if (!course) return;
    const now = readMe();
    if (now) setHeld(!!now.held?.includes(course.id));
    let alive = true;
    void loadMe().then((m) => {
      if (alive && m) setHeld(!!m.held?.includes(course.id));
    });
    return () => { alive = false; };
  }, [course]);

  if (!course || !held) return <>{children}</>;

  return (
    <main className="px-5 py-10" data-testid="held-instead">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-grn">取得済み</div>
      <h1 className="mt-2 text-[20px] font-black leading-snug">
        この講座は取得済みです
        <br />
        受講の必要はありません
      </h1>
      <p className="mt-4 text-[13px] leading-relaxed text-dim">
        「{course.name}」は、取得済みの資格として登録されています。
        あらためて受講いただく必要はありません。
      </p>

      <div className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim">
        修了証や取得日は、マイページの「取得済みの資格」でご確認いただけます。
        <br />
        <span className="text-dim2">
          登録に間違いがある場合は、同じ場所から直せます。
        </span>
      </div>

      <Link
        href="/me"
        className="mt-5 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        data-testid="held-instead-me"
      >
        マイページで確認する
      </Link>
      <Link href="/" className="mt-5 block text-center text-[12.5px] text-dim2 no-underline">
        ← ホームへ
      </Link>
    </main>
  );
}
