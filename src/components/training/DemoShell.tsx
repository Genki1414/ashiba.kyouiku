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
  overlay,
  goal,
  goalLabel,
}: {
  title: string;
  sub: string;
  steps: ShellStep[];
  /** i 手目の盤面。scene が開いているあいだは、まだ手を打つ前の姿を出す */
  board: (i: number, sceneOpen: boolean) => React.ReactNode;
  /** i 手目で開く場面。無ければ null を返す。
      遊ぶときと同じ部品をそのまま出し、操作してもらう */
  overlay?: (i: number, done: () => void) => React.ReactNode | null;
  /** 見終えたあとの行き先 */
  goal: string;
  goalLabel: string;
}) {
  const [i, setI] = useState(0);
  const [why, setWhy] = useState(false);
  /* その手の場面を、まだ操作していないか */
  const [sceneOpen, setSceneOpen] = useState(true);
  const step = steps[i];
  const last = i >= steps.length - 1;

  const go = (d: number) => {
    setI((v) => Math.max(0, Math.min(steps.length - 1, v + d)));
    setWhy(false);
    setSceneOpen(true);
  };

  if (!step) return null;

  const scene = sceneOpen ? overlay?.(i, () => setSceneOpen(false)) : null;

  return (
    <main className="relative flex h-dvh flex-col" data-testid="demo">
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

      {/* 盤面。はみ出しは切る（切らないと下の説明に絵が重なる） */}
      <div className="min-h-0 flex-1 overflow-hidden bg-[#0C1015]">{board(i, !!scene)}</div>

      <div
        className="flex-none overflow-y-auto border-t border-line bg-bg px-4 pb-4 pt-3"
        style={{ maxHeight: "44vh" }}
        data-testid="demo-panel"
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

      {/* 場面。遊ぶときと同じものを、そのまま操作してもらう */}
      {scene && <SceneFrame onSkip={() => setSceneOpen(false)}>{scene}</SceneFrame>}
    </main>
  );
}

/* 場面を置く枠。上に細い帯を作って、そこに逃げ道を出す。
   帯の中に置かないと、場面が自分で出している文字（いまの高さなど）に重なる。

   場面は position:absolute / fixed で inset:0 に広がるので、
   下の枠に transform を掛けて「ここが画面」ということにしている。 */
export function SceneFrame({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]">
      <div className="flex flex-none justify-end border-b border-line bg-bg px-2 py-1">
        <button
          onClick={onSkip}
          className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-dim"
          data-testid="demo-skip-scene"
        >
          この場面をとばす
        </button>
      </div>
      <div className="relative min-h-0 flex-1" style={{ transform: "translateZ(0)" }}>
        {children}
      </div>
    </div>
  );
}
