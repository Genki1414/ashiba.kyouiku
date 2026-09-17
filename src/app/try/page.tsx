import Link from "next/link";
import { readyCourses, textOf, totalNoteOf, hoursText } from "@/content/courses";
import { BRAND } from "@/content/brand";

/* 無料の1単元の入口（0039）。**ログインなし。**
   講座を選んで、その第1単元を見る（/edu/<講座>/try）。
   ログイン画面と断りの画面から来る。 */
export const metadata = { title: "講座を試す" };

export default function TryIndexPage() {
  const list = readyCourses();
  return (
    <main className="px-5 py-8 pb-12" data-testid="try-index">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-cyan">{BRAND.name}</div>
      <h1 className="mt-1.5 text-[20px] font-black">講座を試す</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        どの講座も、第1単元をログインなしで見られます。時間も合格も記録しません。
        気に入ったら、そのまま申し込めます。
      </p>
      <div className="mt-5 grid gap-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/edu/${c.id}/try`}
            className="block rounded-xl border border-line bg-panel p-4 no-underline"
            data-testid="try-course"
          >
            <div className="text-[11px] font-extrabold tracking-widest text-yel">{textOf(c).label}</div>
            <div className="mt-1 text-[15px] font-black leading-snug text-txt">{c.name}</div>
            <div className="mt-1 text-[12px] text-dim">
              {totalNoteOf(c)} 計{hoursText(c.totalMin)}　→ 第1単元を見る
            </div>
          </Link>
        ))}
      </div>
      <Link href="/login" className="mt-6 block text-center text-[12.5px] text-dim2 no-underline">
        ログイン／はじめて使う
      </Link>
    </main>
  );
}
