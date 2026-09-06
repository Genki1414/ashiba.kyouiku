import Link from "next/link";
import {
  KIND_TEXT,
  hoursText,
  kindOf,
  totalNoteOf,
  type CourseMeta,
} from "@/content/courses";

/* 一覧に出す講座の札。

   出す場所が2つある（一覧の上のほうと、「その他特別教育」を開いた中）。
   同じ見た目でなければ、同じ物には見えない。だから1か所に置く。

   前は2か所に同じものを書いていた。片方だけ直すと、
   開く前と開いたあとで札の形が変わる。 */

export function CourseCard({ c }: { c: CourseMeta }) {
  return (
    <Link
      href={`/edu/${c.id}`}
      className="block rounded-xl border border-yel bg-panel p-4 no-underline"
      data-testid="course-card"
    >
      {/* 種類は講座から出す。「特別教育（学科）」で決め打ちにしていたので、
          職長教育のカードにも特別教育と出ていた */}
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

/** まだ受けられない講座。押しても中へ入れないことを、見た目で分ける */
export function CourseSoon({ c }: { c: CourseMeta }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3.5" data-testid="course-soon">
      <div className="text-[13.5px] font-bold text-dim">{c.name}</div>
      <div className="mt-0.5 text-[11px] text-dim2">準備中</div>
    </div>
  );
}
