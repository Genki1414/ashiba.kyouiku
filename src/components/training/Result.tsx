"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { isPass, mmss, rankOf, summarize, type Score } from "@/training/score";
import { chapterLabel, chapterOf, type ChapterId } from "@/training/chapters";
import { saveAttempt } from "@/lib/trainingRecord";
import { Boss } from "./Characters";
import { Btn } from "@/components/ui/Btn";
import { SFX } from "@/lib/sfx";

/* プロトタイプの Result をそのまま移したもの。
   段位・SCORE・最大コンボ・技能点と、親方に言われたことの一覧を出す。 */

export function Result({
  ch,
  tutorial,
  sk,
  r,
  onRetry,
  extra,
}: {
  ch: ChapterId;
  tutorial: boolean;
  /** 手摺先行工法で組んだか（第1章だけ） */
  sk?: boolean;
  r: Score;
  onRetry: () => void;
  extra?: React.ReactNode; // 章ごとの追記（第3章の指摘回数など）
}) {
  const saved = useRef(false);
  useEffect(() => {
    SFX.fanfare();
    /* 通し終えた記録を端末に残す。二度書かないよう一度だけ */
    if (saved.current) return;
    saved.current = true;
    saveAttempt(ch, r, { tutorial, sk });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chapter = chapterLabel(ch);
  const lowText = chapterOf(ch)?.lowText ?? "まだ任せられん";
  const rk = rankOf(r.skill, lowText);
  const pass = isPass(r.skill);
  const u = summarize(r.errs);

  return (
    <main className="px-5 py-5">
      <div
        className={`rounded-xl border bg-panel p-5 text-center ${pass ? "border-grn" : "border-red"}`}
        data-testid="result"
      >
        <div className="text-[11px] tracking-[3px] text-dim">{chapter}</div>
        <div className="my-2.5 flex items-center justify-center gap-4">
          <div
            className={`rank font-mono text-[62px] font-extrabold leading-none ${pass ? "text-yel" : "text-red"}`}
            data-testid="result-rank"
          >
            {rk.r}
          </div>
          <div className="text-left">
            <div className="text-[15px] font-black">{rk.t}</div>
            <div className="mt-0.5 text-[11px] text-dim">{pass ? "合格" : "不合格 — 再受講"}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["SCORE", r.score],
            ["最大コンボ", r.best],
            ["技能", r.skill],
          ] as const).map(([t, v]) => (
            <div key={t} className="rounded-lg bg-panel2 px-1 py-2.5">
              <div className="text-[9px] tracking-[1px] text-dim">{t}</div>
              <div className="font-mono text-[17px] font-bold text-yel">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-2.5 text-[11px] text-dim">
          タイム {mmss(r.sec)}
          {r.hints > 0 && `　／　手順書 ${r.hints}回`}
          　／　親方に聞いた {r.asks}回
        </div>
      </div>

      {extra}

      {u.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-[11px] tracking-[2px] text-yel">親方に言われたこと</div>
          {u.map((e, i) => (
            <div key={i} className="mb-2 rounded-lg border border-line bg-panel px-3.5 py-3">
              <div className="text-[12px] font-extrabold text-red">
                {e.tag}
                {e.n > 1 && ` ×${e.n}`}
              </div>
              <div className="mt-1 text-[13px] font-bold leading-snug">{e.message}</div>
              {e.why && <div className="mt-1 text-[12.5px] leading-relaxed text-dim">{e.why}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-grn bg-panel p-3.5">
          <Boss size={44} />
          <div className="text-[13px] leading-relaxed text-grn">一度も怒られんかったな。上出来じゃ。</div>
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Btn tone="y" onClick={onRetry} testid="result-retry">
          もう一度やる
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
