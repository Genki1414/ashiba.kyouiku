"use client";

import { useState } from "react";
import Link from "next/link";
import { Boss } from "./Characters";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";

/* 通し見学の枠。第2章・第3章で共通。
   手を出さずに、手順を1手ずつ見ていく。
   各手に「なぜそうするのか」が付く（HANDOFF.md 4章）。 */

export type ShellStep = { n: number; t: string; why: string };

export function DemoShell({
  title,
  sub,
  steps,
  board,
  goal,
  goalLabel,
}: {
  title: string;
  sub: string;
  steps: ShellStep[];
  /** i 手目の盤面 */
  board: (i: number) => React.ReactNode;
  /** 見終えたあとの行き先 */
  goal: string;
  goalLabel: string;
}) {
  const [i, setI] = useState(0);
  const [why, setWhy] = useState(false);
  const step = steps[i];
  const last = i >= steps.length - 1;

  const go = (d: number) => {
    setI((v) => Math.max(0, Math.min(steps.length - 1, v + d)));
    setWhy(false);
  };

  if (!step) return null;

  return (
    <main className="flex h-dvh flex-col" data-testid="demo">
      <div className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="backlink-bar text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">{sub}</div>
          <div className="truncate text-[14px] font-extrabold">{title}</div>
        </div>
        <div className="font-mono text-[12px] text-yel" data-testid="demo-n">
          {step.n}
          <span className="text-dim">/{steps.length}</span>
        </div>
      </div>
      <Bar v={i + 1} max={steps.length} />

      <div className="min-h-0 flex-1 bg-[#0C1015]">{board(i)}</div>

      <div
        className="flex-none overflow-y-auto border-t border-line px-4 pb-4 pt-3"
        style={{ maxHeight: "44vh" }}
      >
        <div className="flex items-start gap-3">
          <Boss size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-black leading-snug" data-testid="demo-title">
              <span className="mr-2 font-mono text-yel">{String(step.n).padStart(2, "0")}</span>
              {step.t}
            </div>
          </div>
        </div>

        {why ? (
          <div className="fade mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3" data-testid="demo-why">
            <div className="mb-1 text-[10.5px] font-bold tracking-widest text-yel">なぜそうするのか</div>
            <div className="text-[13px] leading-relaxed text-yel">{step.why}</div>
          </div>
        ) : (
          <button
            onClick={() => setWhy(true)}
            className="mt-3 w-full rounded-lg border border-yel/50 p-2.5 text-[12.5px] font-bold text-yel"
            data-testid="demo-why-open"
          >
            なぜそうするのか
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn dis={i === 0} onClick={() => go(-1)} testid="demo-prev">
            ← 前の手
          </Btn>
          {last ? (
            <Link
              href={goal}
              className="rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
              data-testid="demo-goal"
            >
              {goalLabel}
            </Link>
          ) : (
            <Btn tone="y" onClick={() => go(1)} testid="demo-next">
              次の手 →
            </Btn>
          )}
        </div>
      </div>
    </main>
  );
}
