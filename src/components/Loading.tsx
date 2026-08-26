import Link from "next/link";

/* 読み込み中の枠。

   読み終わるまで何も出さないと、押したあと画面が真っ暗になる。
   実際の待ち時間が同じでも、そのほうがずっと遅く感じる。
   見出しと戻り道だけ先に出して、中身の場所は灰色の帯で取っておく。

   帯の数と高さは、本物とだいたい同じにしてある。
   合っていないと、出てきたときに画面が跳ねる。 */

export function Loading({
  title,
  back = "/",
  rows = 3,
}: {
  title: string;
  /** 戻り道。押した先が違えばここを変える */
  back?: string;
  /** 灰色の帯を何本置くか */
  rows?: number;
}) {
  return (
    <main className="px-5 py-8" data-testid="loading">
      <div className="tape -mx-5 mb-6" />
      <Link href={back} className="backlink text-[13px] text-dim no-underline">
        ← ホーム
      </Link>
      <h1 className="mt-2 text-[18px] font-black">{title}</h1>
      <div className="mt-4 grid gap-3" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-line bg-panel"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <div className="mt-4 text-center text-[12px] text-dim2">読み込んでいます…</div>
    </main>
  );
}
