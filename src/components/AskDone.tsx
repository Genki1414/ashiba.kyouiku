"use client";

import { useState } from "react";

/* 「確かめる → やる → 終わったと出す」の3つを1つにした札。

   げんきさん（2026-09-09）
     「外す、担当者にするをタップした場合には
       確認画面表示→完了表示 ポップアップで」

   ── なぜ要るか ──
   名簿の押す所は、指が触れただけでも効く大きさで並んでいる。
   **教育担当者の付け外しは、押し間違えると現場が止まる。**
   外した人しか担当者が居なければ、その会社は誰も名簿を開けなくなる。

   終わったことも出す。押したあと画面が静かに書き換わるだけだと、
   効いたのかどうか分からず、もう一度押す人が出る。

   ── 使い方 ──
   ask（何を確かめるか）を渡すと出る。null なら出ない。
   run が true を返したら「終わった」に変わる。false なら閉じる
   （断りの理由は、呼んだ側が画面の上に出す）。 */

export type Ask = {
  /** 見出し。「◯◯さんを教育担当者から外しますか」 */
  title: string;
  /** どうなるか。押す前に、起きることを書く */
  body: React.ReactNode;
  /** 押す所の字。「外す」「担当者にする」 */
  yes: string;
  /** 危ない向きなら赤くする */
  danger?: boolean;
  /** 終わったときに出す字 */
  done: string;
  /** 実際にやる。true なら「終わった」に進む */
  run: () => Promise<boolean>;
};

export function AskDone({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!ask) return null;

  const close = () => { setDone(false); setBusy(false); onClose(); };

  const go = async () => {
    setBusy(true);
    try {
      const ok = await ask.run();
      if (ok) setDone(true);
      else close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 print:hidden"
      data-testid="ask-done"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5">
        {done ? (
          <>
            <div className="text-[15px] font-black text-grn" data-testid="ask-done-done">
              {ask.done}
            </div>
            <button
              onClick={close}
              className="mt-4 w-full rounded-lg border border-yel bg-yel p-3 text-[14px] font-extrabold text-bg"
              data-testid="ask-done-close"
            >
              閉じる
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[16px] font-black" data-testid="ask-done-title">{ask.title}</h2>
            <div className="mt-2 text-[12.5px] leading-relaxed text-dim">{ask.body}</div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void go()}
                disabled={busy}
                className={`flex-1 rounded-lg border p-3 text-[14px] font-extrabold disabled:opacity-50 ${
                  ask.danger ? "border-red text-ng-tx" : "border-yel bg-yel text-bg"
                }`}
                data-testid="ask-done-yes"
              >
                {busy ? "…" : ask.yes}
              </button>
              <button
                onClick={close}
                disabled={busy}
                className="rounded-lg border border-line px-4 py-3 text-[13px] text-dim disabled:opacity-50"
                data-testid="ask-done-no"
              >
                やめる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
