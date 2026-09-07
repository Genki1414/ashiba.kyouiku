"use client";

import Link from "next/link";
import { useEffect } from "react";

/* 画面が落ちたとき。

   これが無いと Next の既定が出る。本番では英語で
   「Application error: a client-side exception has occurred」。
   何が起きたのか分からず、戻る所も無い。

   受講の途中で落ちても、進みは端末に残してある。
   もう一度開けば続きから始まるので、それを書く。
   （落ちた中身は画面に出さない。出しても現場では読めないし、
     中の作りが漏れる。console には残るので、こちらでは追える） */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("画面が落ちた", error);
  }, [error]);

  return (
    <main className="px-5 py-8" data-testid="apperror">
      <div className="tape -mx-5 mb-6" />
      <h1 className="text-[18px] font-black">うまく開けませんでした</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-dim">
        電波の届く所で、もう一度お試しください。
        受講の途中だった場合、進みは端末に残っています。開き直せば続きから始まります。
      </p>
      <div className="mt-6 grid gap-2.5">
        <button
          onClick={reset}
          data-testid="apperror-retry"
          className="w-full cursor-pointer rounded-lg border border-yel bg-yel p-3.5 text-[14px] font-extrabold text-bg"
        >
          もう一度ひらく
        </button>
        <Link
          href="/"
          data-testid="apperror-home"
          className="block w-full rounded-lg border border-line p-3.5 text-center text-[14px] font-extrabold text-txt no-underline"
        >
          ホームへ
        </Link>
      </div>
      {!!error.digest && (
        <p className="mt-6 text-[11px] text-dim2">
          お問い合わせのときは、この番号をお伝えください：{error.digest}
        </p>
      )}
    </main>
  );
}
