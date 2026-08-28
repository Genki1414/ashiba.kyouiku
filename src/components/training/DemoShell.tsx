"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Boss } from "./Characters";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { seeDemo } from "@/lib/trainingRecord";
import type { ChapterId } from "@/training/chapters";

/* 通し見学の枠。第2章・第3章で共通。
   手を出さずに、手順を1手ずつ見ていく。
   各手に「なぜそうするのか」が付く（HANDOFF.md 4章）。 */

export type ShellStep = { n: number; t: string; why: string };

export function DemoShell({
  ch,
  title,
  sub,
  steps,
  board,
  overlay,
  hasScene,
  goal,
  goalLabel,
}: {
  /** どの章の見学か。見たことを残すのに使う */
  ch: ChapterId;
  title: string;
  sub: string;
  steps: ShellStep[];
  /** i 手目の盤面。その手の場面をまだやっていない間は、手を打つ前の姿を出す
      （やる前から出来上がりが見えていると、何をする場面なのか分からない） */
  board: (i: number, before: boolean) => React.ReactNode;
  /** i 手目で開く場面。無ければ null を返す。
      遊ぶときと同じ部品をそのまま出し、操作してもらう */
  overlay?: (i: number, done: () => void) => React.ReactNode | null;
  /** i 手目に場面があるか。あるとき「やってみる」を出す */
  hasScene?: (i: number) => boolean;
  /** 見終えたあとの行き先 */
  goal: string;
  goalLabel: string;
}) {
  const [i, setI] = useState(0);
  /* 場面を開いているか／その手の場面をもう済ませたか。
     いきなり場面から始めると何をしている所か分からないので、
     まず手順と「なぜ」を出す。そのうえで、やらないと次の手へは進めない */
  const [sceneOpen, setSceneOpen] = useState(false);
  const [sceneDone, setSceneDone] = useState(false);
  const step = steps[i];
  const last = i >= steps.length - 1;

  /* 見学を開いたことを残す。担当者は「手順を最後まで見たか」を知りたい。
     開き直すたびに1回。同じ画面で二度書かないよう、一度だけ */
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    seeDemo(ch, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 最後の手まで来たら「見終えた」。
     行き先のボタンを押さずに閉じる人もいるので、押した時ではなく
     最後の手に着いた時に残す */
  const done = useRef(false);
  useEffect(() => {
    if (!last || done.current) return;
    done.current = true;
    seeDemo(ch, true);
  }, [last, ch]);

  const go = (d: number) => {
    setI((v) => Math.max(0, Math.min(steps.length - 1, v + d)));
    setSceneOpen(false);
    setSceneDone(false);
  };

  if (!step) return null;

  const closeScene = () => { setSceneOpen(false); setSceneDone(true); };
  const scene = sceneOpen ? overlay?.(i, closeScene) : null;
  /* まだやっていない場面がある手。やる前は、手を打つ前の姿を出す */
  const todo = !!hasScene?.(i) && !sceneDone;
  const before = todo;

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
      <div className="min-h-0 flex-1 overflow-hidden bg-[#0C1015]">{board(i, before)}</div>

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

        {/* なぜそうするのかは、いつも出しておく（隠さない） */}
        <div className="mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3" data-testid="demo-why">
          <div className="mb-1 text-[10.5px] font-bold tracking-widest text-yel">なぜそうするのか</div>
          <div className="text-[13px] leading-relaxed text-yel">{step.why}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn dis={i === 0} onClick={() => go(-1)} testid="demo-prev">
            ← 前の手
          </Btn>
          {/* 操作してもらう手は、やらないと次へ進めない */}
          {todo ? (
            <Btn tone="y" onClick={() => setSceneOpen(true)} testid="demo-try">
              この場面をやる →
            </Btn>
          ) : last ? (
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

        {/* もう一度やりたいとき */}
        {hasScene?.(i) && sceneDone && (
          <button
            onClick={() => setSceneOpen(true)}
            className="mt-2 w-full rounded-lg border border-line p-2 text-[12px] text-dim"
            data-testid="demo-again"
          >
            この場面をもう一度やる
          </button>
        )}
      </div>

      {/* 場面。遊ぶときと同じものを、そのまま操作してもらう */}
      {scene && <SceneFrame onSkip={() => setSceneOpen(false)}>{scene}</SceneFrame>}
    </main>
  );
}

/* 場面を置く枠。上に細い帯を作って、そこに「戻る」を出す。
   戻っても、その手をやったことにはしない（やらないと次へは進めない）。
   帯の中に置かないと、場面が自分で出している文字（いまの高さなど）に重なる。

   場面は position:absolute / fixed で inset:0 に広がるので、
   下の枠に transform を掛けて「ここが画面」ということにしている。 */
export function SceneFrame({ children, onSkip }: { children: React.ReactNode; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-[#0C1015]">
      {/* スマホの幅に絞る。広い画面で絵が引き伸ばされないように */}
      <div className="flex w-full max-w-md flex-col">
        <div className="flex flex-none justify-end border-b border-line bg-bg px-2 py-1">
          <button
            onClick={onSkip}
            className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-dim"
            data-testid="demo-skip-scene"
          >
            ← 戻る
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ transform: "translateZ(0)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
