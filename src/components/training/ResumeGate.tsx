"use client";

import Link from "next/link";
import { mmss } from "@/training/score";
import { savedAt, type Saved } from "@/training/resume";
import { chapterLabel, type ChapterId } from "@/training/chapters";
import { Btn } from "@/components/ui/Btn";

/* 途中で閉じた続きがあるときに出す画面。
   何がどこまで残っているかを見せてから選ばせる。 */

export function ResumeGate<S>({
  ch,
  saved,
  where,
  note,
  onResume,
  onFresh,
}: {
  ch: ChapterId;
  saved: Saved<S>;
  /** どこまで進んでいるか。章ごとに言い方が違うので文字で受け取る */
  where: string;
  /** 章ごとの断り書き（第3章のシートなど） */
  note?: string;
  onResume: () => void;
  onFresh: () => void;
}) {
  return (
    <main className="px-5 py-8" data-testid="resume-gate">
      <div className="tape -mx-5 mb-6" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">途中まで残っとる</div>
      <h1 className="mt-1.5 text-[19px] font-black leading-snug">{chapterLabel(ch)}</h1>

      <div className="mt-4 rounded-xl border border-line bg-panel p-4">
        <div className="text-[12px] text-dim">{savedAt(saved.at)} まで</div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["進み", where],
              ["技能", String(saved.score.skill)],
              ["タイム", mmss(saved.score.sec)],
            ] as const
          ).map(([t, v]) => (
            <div key={t} className="rounded-lg bg-panel2 px-1 py-2.5">
              <div className="text-[9px] tracking-[1px] text-dim">{t}</div>
              <div className="font-mono text-[16px] font-bold text-yel">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 text-[11.5px] text-dim">
          {saved.tutorial ? "チュートリアル" : "本番"}
          {saved.sk && "／先行手摺"}
          {saved.score.errs.length > 0 && `　言われた ${saved.score.errs.length}回`}
        </div>
        {note && <div className="mt-2.5 text-[11.5px] leading-relaxed text-dim2">{note}</div>}
      </div>

      <div className="mt-5 grid gap-2">
        <Btn tone="y" onClick={onResume} testid="resume-yes">
          続きからやる
        </Btn>
        <Btn onClick={onFresh} testid="resume-no">
          最初からやり直す
        </Btn>
        <Link
          href="/training"
          className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
        >
          章の一覧へ
        </Link>
      </div>
    </main>
  );
}
