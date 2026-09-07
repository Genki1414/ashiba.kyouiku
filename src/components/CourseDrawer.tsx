import type { CourseMeta } from "@/content/courses";
import { OtherCourses } from "./OtherCourses";

/* 講座の一覧を、押して開く形で出す。

   特別教育ドットコムは73講座を平らに並べる店なので、そのまま出すと
   開いた瞬間に札が73枚ぶん縦に伸びる。**開いてすぐ読むものが、
   ずっと下の「はじめかた」やお知らせより先に画面を埋めてしまう。**
   だから足場屋革命の「その他特別教育」と同じように、押して開く。

   開け閉めは <details> でやる。JavaScript が動かなくても開くし、
   キーボードでも開ける。圏外で開いた人が詰まらない。

   **札を並べるのは OtherCourses。ここでは並べない。**
   ここで並べると、探す窓が札の下に来る（一度やらかしている）。 */
export function CourseDrawer({
  title,
  ready = [],
  soon = [],
}: {
  /** 開く前に出る見出し */
  title: string;
  ready?: CourseMeta[];
  soon?: CourseMeta[];
}) {
  const n = ready.length;
  if (!n && !soon.length) return null;
  return (
    <details className="group rounded-xl border border-line bg-bg" data-testid="course-drawer">
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
        {title}
        <span className="text-[11.5px] font-normal text-dim">{n}件</span>
      </summary>
      <div className="px-4 pb-4">
        <OtherCourses ready={ready} soon={soon} />
      </div>
    </details>
  );
}
