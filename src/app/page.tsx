import Link from "next/link";
import { getCurriculum } from "@/lib/curriculum";

export default async function Home() {
  const cur = await getCurriculum();
  return (
    <main>
      <div className="tape" />
      <div className="px-5 pt-10 pb-6">
        <div className="text-[11px] tracking-[3px] text-yel font-extrabold">ASHIBA TRAINING</div>
        <h1 className="mt-2 text-[22px] font-black leading-snug">足場の教育アプリ</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          労働安全衛生法にもとづく特別教育（学科6時間）と、実務トレーニング。
        </p>
      </div>

      <div className="grid gap-3 px-5 pb-10">
        <Link
          href="/edu"
          className="block rounded-xl border border-yel bg-panel p-5 no-underline"
        >
          <div className="text-[11px] font-extrabold tracking-widest text-yel">特別教育（学科）</div>
          <div className="mt-1 text-[17px] font-black text-txt">{cur.meta.title}</div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">
            {cur.meta.basis}
            <br />
            4科目13単元・計{Math.round(cur.meta.total_min / 60)}時間
          </div>
        </Link>

        <div className="rounded-xl border border-line bg-panel p-5 opacity-60">
          <div className="text-[11px] font-extrabold tracking-widest text-dim">実務トレーニング</div>
          <div className="mt-1 text-[17px] font-black text-txt">足場を組むゲーム</div>
          <div className="mt-2 text-[12px] leading-relaxed text-dim">フェーズ5で実装（準備中）</div>
        </div>
      </div>
    </main>
  );
}
