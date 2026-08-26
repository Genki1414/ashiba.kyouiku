import Link from "next/link";

/* 第2章から先は、利用権を持っている人だけ。

   ただ断るのではなく、
   ・第1章はいま遊べること
   ・どうすれば先が開くか
   を書く。現場で聞ける相手は教育担当者なので、そこへも行き着くようにする。 */

export function NeedTrain({ why }: { why: "free" | "signin" }) {
  if (why === "signin") {
    return (
      <main className="px-5 py-10" data-testid="need-train">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[19px] font-black">ログインが要ります</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          成績を、誰のものとして残すかを決めるためです。
        </p>
        <Link
          href="/login"
          className="mt-6 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        >
          ログインする
        </Link>
      </main>
    );
  }

  return (
    <main className="px-5 py-10" data-testid="need-train">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">第2章から先</div>
      <h1 className="mt-2 text-[20px] font-black leading-snug">
        ここから先は
        <br />
        まだ開いていません
      </h1>
      <p className="mt-4 text-[13px] leading-relaxed text-dim">
        第1章「段取りと根がらみ」は、いつでも遊べます。
        資材カタログと通し見学も同じです。
        <br />
        第2章から先（高所作業・火打とシート）は、別に申し込みが要ります。
      </p>

      <div className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim2">先を開くには</div>
        会社の教育担当者に聞いてください。
        まとめて申し込むこともできますし、自分ひとりぶんでも申し込めます。
        <br />
        <span className="text-dim2">
          実務トレーニングは、特別教育（学科）の修了証の要件ではありません。
          先に開かなくても、学科と修了証はそのまま進められます。
        </span>
      </div>

      <Link
        href="/training/ch1"
        className="mt-5 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        data-testid="need-train-ch1"
      >
        第1章をやる
      </Link>
      <Link
        href="/training"
        className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
      >
        章の一覧へ
      </Link>
    </main>
  );
}
