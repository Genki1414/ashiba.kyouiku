"use client";

import { useState } from "react";
import { Overlay } from "./Overlay";

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
   （断りの理由は、呼んだ側が画面の上に出す）。

   ── どこにでも付ける（げんきさん 2026-09-10）──
     「請求書払いで申し込む とか、ほとんどのユーザーが行う操作全般
       なんだけど、確認表示や完了表示のポップアップがない。
       ユーザーが操作を行う部分を全て洗い出して、
       全てに確認表示・完了表示のポップアップを付ける」

   はじめは担当者の付け外しだけだった。申し込む・配る・外す・送る・
   登録する・発行する——**決める操作は、全部これを通す。**
   押した瞬間に効く釦は、押し間違いに気づく間が無い。
   終わったことが出ないと、効いたか分からず二度押す。

   通さないもの（通すと受講の邪魔になる）
   ・確認問題の答え・視聴の進み・実務トレーニングの手
   ・さがす・絞る（読むだけ）
   ・ログイン（そのものが画面）

   after は「閉じる」を押したあとにやること（画面を移す・読み直す）。
   終わった画面を見せてから移すために、閉じるまで待つ。 */

export type RunResult = boolean | { done?: string; doneBody?: React.ReactNode };

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
  /** 終わったときの補足。次に何をすればいいか */
  doneBody?: React.ReactNode;
  /** 実際にやる。true なら「終わった」に進む。
      終わった字を結果で変えたいときは、{ done, doneBody } を返す
      （申込みの「請求書は1通にまとめます」など、返事を見ないと書けないもの） */
  run: () => Promise<RunResult>;
  /** 終わって「閉じる」を押したあとにやること（画面を移す・読み直す） */
  after?: () => void;
};

export function AskDone({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  /* run が返してきた、終わった字の上書き */
  const [over, setOver] = useState<{ done?: string; doneBody?: React.ReactNode }>({});

  if (!ask) return null;

  const close = () => {
    const fin = done;
    setDone(false);
    setBusy(false);
    setOver({});
    onClose();
    /* 終わったあとの「閉じる」でだけ。やめたときには動かさない */
    if (fin) ask.after?.();
  };

  const go = async () => {
    setBusy(true);
    try {
      const r = await ask.run();
      if (r === false) { close(); return; }
      if (typeof r === "object") setOver(r);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 print:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      data-testid="ask-done"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5">
        {done ? (
          <>
            <div className="text-[15px] font-black text-grn" data-testid="ask-done-done">
              {over.done ?? ask.done}
            </div>
            {(over.doneBody ?? ask.doneBody) && (
              <div className="mt-2 text-[12.5px] leading-relaxed text-dim" data-testid="ask-done-body">
                {over.doneBody ?? ask.doneBody}
              </div>
            )}
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
    </Overlay>
  );
}
