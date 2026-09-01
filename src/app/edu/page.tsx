import Link from "next/link";
import { redirect } from "next/navigation";
import {
  COURSES,
  KIND_TEXT,
  hoursText,
  kindOf,
  menuOf,
  splitMenu,
  totalNoteOf,
  type CourseMeta,
} from "@/content/courses";
import { loadedCourses } from "@/lib/curriculum";
import { OtherCourses } from "./OtherCourses";
import { TOKUBETSU, isReady } from "@/content/tokubetsu";

export const dynamic = "force-dynamic";

/* 講座の一覧。

   受けられるものが1つしか無いあいだは、一覧を挟まずそのまま中へ通す
   （余計な1手を増やさない）。

   特別教育は種類が増えていく。全部そのまま並べると、
   足場を受けに来た人が長い一覧から探すことになる。
   これから足す特別教育は「その他特別教育」を開いてから選ぶ
   （courses.ts の menu: "other"）。

   開け閉めは <details> でやる。JavaScript が動かなくても開くし、
   キーボードでも開ける。圏外で開いた人が詰まらない。 */

function Card({ c }: { c: CourseMeta }) {
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

function Soon({ c }: { c: CourseMeta }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3.5" data-testid="course-soon">
      <div className="text-[13.5px] font-bold text-dim">{c.name}</div>
      <div className="mt-0.5 text-[11px] text-dim2">準備中</div>
    </div>
  );
}

export default async function EduPage() {
  const ready = await loadedCourses();
  if (ready.length === 1) redirect(`/edu/${ready[0].id}`);

  const soon = COURSES.filter((c) => !c.ready);
  const r = splitMenu(ready);
  const s = splitMenu(soon);
  /* 「その他特別教育」の中身。
     講座として作ったもの（menu: "other"）に加えて、
     **まだ作っていない特別教育の目録**も並べる。

     並べておかないと「足場だけの会社」と思われて終わる。
     石綿も粉じんも酸欠も、同じ現場で要る（src/content/tokubetsu.ts）。 */
  const todo = TOKUBETSU.filter((t) => !isReady(t)).length;
  const others = r.other.length + s.other.length + todo;

  return (
    <main className="px-5 py-8" data-testid="course-list">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      {/* 特別教育だけを出しているわけではない（職長教育もここに並ぶ） */}
      <h1 className="mt-2 text-[19px] font-black">受ける講座</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-dim">
        受ける講座を選んでください。修了証は講座ごとに出ます。
      </p>

      <div className="mt-5 grid gap-2.5">
        {r.main.map((c) => (
          <Card key={c.id} c={c} />
        ))}
      </div>

      {others > 0 && (
        <details className="group mt-3 rounded-xl border border-line bg-bg" data-testid="course-other">
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
            <span className="text-[11.5px] font-normal text-dim">{others}件</span>
          </summary>
          <div className="grid gap-2.5 px-4 pb-4">
            {r.other.map((c) => (
              <Card key={c.id} c={c} />
            ))}
            {s.other.map((c) => (
              <Soon key={c.id} c={c} />
            ))}
            {/* 法令で定められている特別教育の目録。探す所も、ここに置く */}
            <OtherCourses />
          </div>
        </details>
      )}

      {!!s.main.length && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] tracking-[2px] text-dim">これから増えるもの</div>
          <div className="grid gap-2">
            {s.main.map((c) => (
              <Soon key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
