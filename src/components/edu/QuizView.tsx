"use client";
import { useState } from "react";
import type { Lesson } from "@/types/curriculum";
import { Btn } from "@/components/ui/Btn";
import { hm } from "@/components/ui/format";

/* 確認問題。全問正解で onAllCorrect（合格の最終判定はサーバ側）。
   規定時間に達するまでこの画面自体が出ない（LessonClient 側で制御）。 */
export function QuizView({
  lesson,
  passed,
  passError,
  watchedSec,
  needSec,
  onAllCorrect,
  onBackToNarr,
}: {
  lesson: Lesson;
  passed: boolean;
  passError: string | null;
  watchedSec: number;
  needSec: number;
  onAllCorrect: () => void;
  onBackToNarr: () => void;
}) {
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const quiz = lesson.quiz;

  return (
    <div className="px-4 py-4">
      <div className={`mb-2 text-[11px] tracking-[2px] ${passed ? "text-grn" : "text-yel"}`}>
        確認問題 {passed ? "／ 全問正解" : `（${qi + 1}/${quiz.length}）`}
      </div>

      {passed ? (
        <div className="rounded-xl border border-grn bg-panel p-4 text-[14px] leading-relaxed text-grn">
          この単元は修了しました。視聴時間 {hm(watchedSec)}（規定 {hm(needSec)}）。
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-panel p-3.5">
          <div className="mb-3 text-[15px] font-extrabold leading-snug">{quiz[qi].q}</div>
          <div className="grid gap-2">
            {quiz[qi].a.map((a, i) => (
              <button
                key={i}
                data-quiz-opt
                onClick={() => {
                  if (i === quiz[qi].ok) {
                    setWrong(null);
                    if (qi + 1 >= quiz.length) onAllCorrect();
                    else setQi(qi + 1);
                  } else {
                    setWrong(i);
                  }
                }}
                className={`rounded-lg border p-3 text-left text-[14px] font-bold ${
                  wrong === i ? "border-red bg-ng-bg text-ng-tx" : "border-line bg-panel2 text-txt"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          {wrong !== null && (
            <div className="mt-2.5 text-[13px] leading-relaxed text-ng-tx">{quiz[qi].why}</div>
          )}
        </div>
      )}

      {passError && (
        <div className="mt-3 rounded-lg border border-red bg-ng-bg px-3 py-2.5 text-[13px] leading-relaxed text-ng-tx">
          {passError}
        </div>
      )}

      <Btn onClick={onBackToNarr} className="mt-3.5 text-[13px] font-normal text-dim">
        解説に戻る
      </Btn>
    </div>
  );
}
