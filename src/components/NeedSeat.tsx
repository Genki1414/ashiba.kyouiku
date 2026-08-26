import Link from "next/link";

/* 受講コードが無い人に出す画面。

   ただ断るのではなく、何を持っていれば開くのか、
   どこで手に入るのかまで書く。現場で聞ける相手は教育担当者なので、
   そこへ行き着くように書く。 */

export function NeedSeat({ why, company }: { why: "signin" | "seat"; company: string }) {
  if (why === "signin") {
    return (
      <main className="px-5 py-10" data-testid="need-seat">
        <div className="tape -mx-5 mb-6" />
        <h1 className="text-[19px] font-black">ログインが要ります</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-dim">
          受講の記録を、誰のものとして残すかを決めるためです。
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
    <main className="px-5 py-10" data-testid="need-seat">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">受講コードが要ります</div>
      <h1 className="mt-2 text-[20px] font-black leading-snug">
        受講コードを入れると
        <br />
        ここから先が開きます
      </h1>
      <p className="mt-4 text-[13px] leading-relaxed text-dim">
        特別教育（学科）は、受講コードを引き換えた人だけが受けられます。
        コードは、会社の教育担当者が人数ぶん申し込んで配ります。
        {company ? `（いまの所属：${company}）` : ""}
      </p>

      {/* 参加コード（8文字）のことは、ここには書かない。
         受講する人にとっては、入れても教材が開かないコードでしかない。
         2種類あると書くと、8文字の方を試して「開かない」と詰まる。
         配るのは担当者の側なので、案内は担当者の画面にだけ置く */}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim2">受講コードとは</div>
        <div className="mt-2">
          <span className="font-black text-txt">12文字のコード</span>（例 ABCD-2345-6789）
          <br />
          1人に1つ。これを入れると、特別教育（学科）が開きます。
        </div>
      </div>

      <Link
        href="/join"
        className="mt-5 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        data-testid="need-seat-join"
      >
        受講コードを入れる
      </Link>
      <Link
        href="/admin"
        className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        data-testid="need-seat-admin"
      >
        教育担当者の方はこちら（申込み）
      </Link>
      {/* 実務トレーニングは別の売り物。第1章はコードが無くても遊べる。
         ここで断られた人に、いま出来ることが何も無いと、そのまま閉じられる */}
      <Link
        href="/training"
        className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        data-testid="need-seat-train"
      >
        実務トレーニングの第1章は、コード無しで遊べます
      </Link>
      <Link href="/" className="mt-5 block text-center text-[12.5px] text-dim2 no-underline">
        ← ホームへ
      </Link>
    </main>
  );
}
