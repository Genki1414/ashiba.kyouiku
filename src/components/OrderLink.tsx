"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findCourse } from "@/content/courses";

/* 「教育担当者の方はこちら（申込み）」の行き先。

   ── なぜ直に申込みへ送るか ──
   前は /admin（担当者の画面）へ送っていた。
   ところが担当者があの画面で探すのは**申込みの入口**で、
   名簿や進み具合の中から見つけることになり、迷う
   （げんきさん 2026-09-08）。

   ここを押す人は、**いま断られた講座の受講コードが欲しい**と
   決まっている。だから申込みの画面へ直に送り、
   **その講座を選んだ状態**で開く。選び直させない。

   どの講座かは住所から取る（/edu/<講座>/…）。
   見張りはレイアウト（src/app/edu/layout.tsx）なので
   courseId を受け取れない。RequestCourse と同じやり方。 */
export function OrderLink() {
  const path = usePathname() ?? "";
  /* /edu/<courseId> … 以下に単元が続くこともある。2つ目だけ見る */
  const id = path.split("/").filter(Boolean)[1] ?? "";
  const course = findCourse(id);
  /* 目録に無い id なら、講座を決めずに申込みの画面へ */
  const href = course ? `/order?courseId=${encodeURIComponent(course.id)}` : "/order";
  return (
    <Link
      href={href}
      className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
      data-testid="need-seat-admin"
    >
      {/* 括弧の中に文をもう1つ入れると読みにくい。
          何をする札かを先に書いて、誰向けかを後ろに添える */}
      {course ? `${course.short}の受講コードを申し込む` : "受講コードを申し込む"}
      <span className="ml-1 text-[11.5px] text-dim2">（教育担当者の方）</span>
    </Link>
  );
}
