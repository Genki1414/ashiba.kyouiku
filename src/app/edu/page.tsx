import Link from "next/link";
import { redirect } from "next/navigation";
import { COURSES, splitMenu } from "@/content/courses";
import { loadedCourses } from "@/lib/curriculum";
import { OtherCourses } from "@/components/OtherCourses";
import { CourseDrawer } from "@/components/CourseDrawer";
import { HeldCount } from "@/components/HeldCount";
import { CourseCard, CourseSoon } from "@/components/CourseCard";
import { TOKUBETSU, isReady, tokubetsuOfCourse } from "@/content/tokubetsu";
import { BRAND } from "@/content/brand";

/* ── 作り置きにする（2026-09-10）──
   ここに出るものは、誰が見ても同じ（講座の名前・時間・根拠）。
   人によって違うのは札の「取得済」だけで、それは画面側が
   あとから /api/me に聞いて重ねる（HeldMark・HeldCount）。

   前は force-dynamic だったので、**押すたびにサーバで組み立て直していた。**
   作り置きにすると、押した瞬間に出る。中身を直したら1時間で入れ替わる
   （ホームと同じ。src/app/page.tsx） */
export const revalidate = 3600;

/* 講座の一覧。

   受けられるものが1つしか無いあいだは、一覧を挟まずそのまま中へ通す
   （余計な1手を増やさない）。

   特別教育は種類が増えていく。全部そのまま並べると、
   足場を受けに来た人が長い一覧から探すことになる。
   これから足す特別教育は「その他特別教育」を開いてから選ぶ
   （courses.ts の menu: "other"）。

   開け閉めは <details> でやる。JavaScript が動かなくても開くし、
   キーボードでも開ける。圏外で開いた人が詰まらない。 */

export default async function EduPage() {
  const ready = await loadedCourses();
  if (ready.length === 1) redirect(`/edu/${ready[0].id}`);

  const soon = COURSES.filter((c) => !c.ready);
  const r = splitMenu(ready);
  const s = splitMenu(soon);

  /* 特別教育ドットコムは業種を選ばない。足場を大きな札で上に置くと、
     塗装屋さんや解体屋さんには邪魔になるだけなので、**足場も含めて**
     全部を法令（目録）の号順に平らに並べ、探す窓ひとつで選んでもらう。
     ホーム（src/app/page.tsx）と同じ考え方。 */
  const byLaw = <T extends { id: string }>(list: T[]): T[] =>
    [...list].sort((a, b) =>
      (tokubetsuOfCourse(a.id)?.no ?? 0) - (tokubetsuOfCourse(b.id)?.no ?? 0));

  if (BRAND.flatList) {
    return (
      <main className="px-5 py-8" data-testid="course-list">
        <div className="tape -mx-5 mb-6" />
        <Link href="/" className="backlink text-[13px] text-dim no-underline">← ホーム</Link>
        <h1 className="mt-2 text-[19px] font-black">受ける講座</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          受ける講座を選んでください。修了証は講座ごとに出ます。
        </p>
        <div className="mt-5">
          <CourseDrawer title="受けられる講座" ready={byLaw(ready)} soon={byLaw(soon)} />
        </div>
      </main>
    );
  }
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
          <CourseCard key={c.id} c={c} />
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
            {/* 開く前に、自分がいくつ持っているかが分かるように
                （げんきさん 2026-09-10）。0件のときは出ない */}
            <HeldCount ids={r.other.map((c) => c.id)} />
          </summary>
          <div className="px-4 pb-4">
            {/* **探す所を、いちばん上に置く。**71講座がここに並ぶので、
                下に置くと71枚めくらないと窓に届かない。
                受けられる講座も、準備中も、まだ作っていない目録も、
                同じ窓で絞る（OtherCourses が3つとも受け持つ） */}
            <OtherCourses ready={r.other} soon={s.other} main={r.main} />
          </div>
        </details>
      )}

      {!!s.main.length && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] tracking-[2px] text-dim">これから増えるもの</div>
          <div className="grid gap-2">
            {s.main.map((c) => (
              <CourseSoon key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
