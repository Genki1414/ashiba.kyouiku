import Link from "next/link";
import { getCurriculum } from "@/lib/curriculum";
import { AccountBar } from "@/components/AccountBar";
import { currentAdmin } from "@/lib/admin";

export default async function Home() {
  const cur = await getCurriculum();
  /* 教育担当者にだけ、担当者の画面への入口を出す */
  const admin = await currentAdmin();
  return (
    <main>
      <div className="tape" />
      <AccountBar />
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

        {admin && (
          <Link
            href="/admin"
            className="block rounded-xl border border-line bg-panel p-5 no-underline"
            data-testid="home-admin"
          >
            <div className="text-[11px] font-extrabold tracking-widest text-grn">教育担当者</div>
            <div className="mt-1 text-[17px] font-black text-txt">受講の進み具合と修了証</div>
            <div className="mt-2 text-[12px] leading-relaxed text-dim">
              誰がどこまで進んだかを見て、修了証を出す。
              <br />
              {admin.companyName}
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
