import Link from "next/link";
import { COURSES, textOf } from "@/content/courses";
import { loadedCourses } from "@/lib/curriculum";
import { AccountBar } from "@/components/AccountBar";
import { HomeCards } from "@/components/HomeCards";

/* ここはサーバ側で誰かを見ていない（立場ごとの出し分けは HomeCards が
   あとから聞きに行く）。作り置きにしておけば、開いた瞬間に出る */
export const revalidate = 3600;

export default async function Home() {
  /* 特別教育は種類が増えていく。受けられるものを並べる */
  const ready = await loadedCourses();
  const soon = COURSES.filter((c) => !c.ready);
  return (
    <main>
      <div className="tape" />
      <AccountBar />
      <div className="px-5 pt-10 pb-6">
        <div className="text-[11px] tracking-[3px] text-yel font-extrabold">ASHIBAYA KAKUMEI</div>
        <h1 className="mt-2 text-[22px] font-black leading-snug">足場屋革命</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          特別教育・職長教育と、実務トレーニング。
          <br />
          労働安全衛生法にもとづく学科と、組む手順の練習。
        </p>
      </div>

      <div className="grid gap-3 px-5 pb-10">
        {ready.map((c) => (
          <Link
            key={c.id}
            href={`/edu/${c.id}`}
            className="block rounded-xl border border-yel bg-panel p-5 no-underline"
            data-testid="home-course"
          >
            {/* 札は講座の種類から出す。決め打ちにすると、
               職長教育に「特別教育」と書いた札が付く */}
            <div className="text-[11px] font-extrabold tracking-widest text-yel">
              {textOf(c).label}
            </div>
            <div className="mt-1 text-[17px] font-black leading-snug text-txt">{c.name}</div>
            <div className="mt-2 text-[12px] leading-relaxed text-dim">
              {c.basis}
              <br />
              学科 計{Math.round(c.totalMin / 60)}時間
            </div>
          </Link>
        ))}

        <Link
          href="/training"
          className="block rounded-xl border border-line bg-panel p-5 no-underline"
        >
          <div className="text-[11px] font-extrabold tracking-widest text-cyan">実務トレーニング</div>
          <div className="mt-1 text-[17px] font-black text-txt">足場を組むゲーム</div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">
            作業員を動かして足場を組む。手を間違えると親方に叱られる。
            <br />
            第1章 段取りと根がらみ／第2章 高所作業／第3章 火打とシート
          </div>
        </Link>

        {/* これから増える講座。何が来るのかが分かるように名前だけ出す */}
        {!!soon.length && (
          <div className="rounded-xl border border-line bg-bg p-4" data-testid="home-soon">
            <div className="text-[11px] tracking-[2px] text-dim">これから増える講座</div>
            <ul className="mt-1.5 grid gap-1 text-[12.5px] leading-relaxed text-dim2">
              {soon.map((c) => (
                <li key={c.id}>・{c.name}（準備中）</li>
              ))}
            </ul>
          </div>
        )}

        {/* 立場によって出すもの（会社とつなぐ／教育担当者／運営）*/}
        <HomeCards />
      </div>

      {/* 売るために要る表記。買う前に読めるところに置く */}
      <div className="border-t border-line px-5 py-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11.5px]">
          <Link href="/legal/tokushoho" className="text-dim no-underline">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/terms" className="text-dim no-underline">
            利用規約
          </Link>
          <Link href="/legal/privacy" className="text-dim no-underline">
            個人情報の取扱い
          </Link>
        </div>
      </div>
    </main>
  );
}
