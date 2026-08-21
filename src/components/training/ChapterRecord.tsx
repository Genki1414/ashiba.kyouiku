"use client";

import { useEffect, useState } from "react";
import { readRecord } from "@/lib/trainingRecord";
import { bestOf, countOf, lastOf, rankLabel, type Record_ } from "@/training/record";
import type { ChapterId } from "@/training/chapters";
import { isPass, mmss } from "@/training/score";

/* 章の一覧に出す「前回の成績」。
   端末に残した記録から作るので、読み込んだあとに出す。 */

export function ChapterRecord({ ch }: { ch: ChapterId }) {
  const [rec, setRec] = useState<Record_ | null>(null);
  useEffect(() => setRec(readRecord()), []);
  if (!rec) return null;

  const last = lastOf(rec, ch);
  if (!last) {
    return <div className="mt-2 text-[11.5px] text-dim2">まだ通していない</div>;
  }
  const best = bestOf(rec, ch)!;
  const n = countOf(rec, ch);
  const rk = rankLabel(ch, last.skill);
  const bk = rankLabel(ch, best.skill);
  const pass = isPass(last.skill);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]" data-record={ch}>
      <span className="text-dim">前回</span>
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[12px] font-extrabold ${
          pass ? "bg-yel text-bg" : "bg-red text-txt"
        }`}
        data-record-rank={rk.r}
      >
        {rk.r}
      </span>
      <span className={pass ? "text-txt" : "text-ng-tx"}>{rk.t}</span>
      <span className="font-mono text-dim">技能 {last.skill}</span>
      <span className="font-mono text-dim">{mmss(last.sec)}</span>
      {n > 1 && (
        <span className="text-dim2">
          {n}回　最高 {bk.r}
        </span>
      )}
      {last.errs.length > 0 && (
        <span className="text-dim2">言われた {last.errs.length}回</span>
      )}
    </div>
  );
}
