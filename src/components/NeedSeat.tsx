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
        特別教育（学科）と実務トレーニングは、受講コードを引き換えた人だけが受けられます。
        コードは、会社の教育担当者が人数ぶん申し込んで配ります。
        {company ? `（いまの所属：${company}）` : ""}
      </p>

      <div className="mt-5 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-relaxed text-dim">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim2">コードは2種類あります</div>
        <div className="mt-2">
          <span className="font-black text-txt">受講コード（12文字）</span>
          <br />
          1人1つ。これを入れると受講できます。
        </div>
        <div className="mt-2.5">
          <span className="font-black text-txt">参加コード（8文字）</span>
          <br />
          会社の名簿に入るだけのもの。これだけでは受講できません。
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
      <Link href="/" className="mt-5 block text-center text-[12.5px] text-dim2 no-underline">
        ← ホームへ
      </Link>
    </main>
  );
}
