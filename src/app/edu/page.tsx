import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSES } from "@/content/courses";
import { loadedCourses } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

/* 講座（特別教育）の一覧。

   特別教育は種類が増えていく。受けられるものが1つしか無いあいだは、
   一覧を挟まずそのまま中へ通す（余計な1手を増やさない）。 */

export default async function EduPage() {
  const ready = await loadedCourses();
  if (ready.length === 1) redirect(`/edu/${ready[0].id}`);

  const soon = COURSES.filter((c) => !c.ready);

  return (
    <main className="px-5 py-8" data-testid="course-list">
      <div className="tape -mx-5 mb-6" />
      <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
      <h1 className="mt-2 text-[19px] font-black">特別教育</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-dim">
        受ける講座を選んでください。修了証は講座ごとに出ます。
      </p>

      <div className="mt-5 grid gap-2.5">
        {ready.map((c) => (
          <Link
            key={c.id}
            href={`/edu/${c.id}`}
            className="block rounded-xl border border-yel bg-panel p-4 no-underline"
            data-testid="course-card"
          >
            <div className="text-[11px] font-extrabold tracking-widest text-yel">特別教育（学科）</div>
            <div className="mt-1 text-[16px] font-black leading-snug text-txt">{c.name}</div>
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-dim">
              {c.basis}
              <br />
              学科 {Math.floor(c.totalMin / 60)}時間
            </div>
          </Link>
        ))}
      </div>

      {!!soon.length && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] tracking-[2px] text-dim">これから増えるもの</div>
          <div className="grid gap-2">
            {soon.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-bg p-3.5" data-testid="course-soon">
                <div className="text-[13.5px] font-bold text-dim">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-dim2">準備中</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
