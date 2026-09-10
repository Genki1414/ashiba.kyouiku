"use client";

import { useState } from "react";

/* 押すと写す札（2026-09-10）。

   げんきさん「クーポン画面でクーポンコードのコピー」。

   クーポンのコードは、LINE や電話で相手に伝えるもの。
   打ち直すと必ず間違える（O と 0、I と 1）。

   ── ここに1つだけ置く理由 ──
   同じものが AppCode（ホーム画面のアプリに入るコード）にもあった。
   2か所に書くと、片方だけ直したときに、押しても何も起きない札が残る。

   ── 写せないことがある ──
   古いブラウザや、安全な接続でない場所では clipboard が無い。
   そのときは**黙って失敗させない。**選んで写してもらう案内を出す。 */

export function CopyBtn({
  text,
  label = "コピー",
  done = "コピーしました",
  className = "",
  testId,
}: {
  /** 写す中身 */
  text: string;
  /** ふだんの字 */
  label?: string;
  /** 写せたときの字 */
  done?: string;
  className?: string;
  testId?: string;
}) {
  const [state, setState] = useState<"" | "ok" | "ng">("");

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setState("ok");
    } catch {
      setState("ng");
    }
    window.setTimeout(() => setState(""), 2200);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] ${
        state === "ok"
          ? "border-grn text-grn"
          : state === "ng"
            ? "border-org text-org"
            : "border-line text-dim"
      } ${className}`}
      data-testid={testId}
      aria-label={`${label}（${text}）`}
    >
      {state === "ok" ? done : state === "ng" ? "長押しで選んでください" : label}
    </button>
  );
}
