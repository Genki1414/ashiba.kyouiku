"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STEPS } from "@/training/catalog/demoSteps";
import { scenesOf } from "@/training/catalog/demoScenes";
import { Ch1Scene } from "@/components/training/ch1/Scene";
import { DemoBoard } from "@/components/training/DemoBoard";
import { DemoArt } from "@/components/training/DemoArt";
import { Boss } from "@/components/training/Characters";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { SceneFrame } from "@/components/training/DemoShell";
import { seeDemo } from "@/lib/trainingRecord";

/* 通し見学。15手を順に見る。
   全15手に「なぜそうするのか」を出す（HANDOFF.md 4章）。
   画面内に収める作り（HANDOFF.md 2章）。

   操作してもらう場面（ジャッキ・離れ・水平・内柱）は、見学でも
   遊ぶときと同じ部品を出す。見ているだけでは身につかないため、
   その手は必ずやってもらう（やらないと次の手へ進めない）。
   ただし見学なので、間違えても点は引かない。 */

export function DemoClient() {
  const [i, setI] = useState(0);
  /* 場面を開いているか／その手の場面を、いくつ目まで操作したか。
     いきなり場面から始めると何をしている所か分からないので、
     まず手順と「なぜ」を出す。そのうえで、やらないと次の手へは進めない */
  const [open, setOpen] = useState(false);
  const [sceneDone, setSceneDone] = useState(false);
  const [si, setSi] = useState(0);
  const step = STEPS[i];
  const last = i >= STEPS.length - 1;

  /* 見学を開いたこと・見終えたことを残す。
     担当者は「手順を最後まで見たか」を知りたい。
     行き先のボタンを押さずに閉じる人もいるので、
     押した時ではなく最後の手に着いた時に残す（DemoShell と同じ） */
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    seeDemo("ch1", false);
  }, []);
  const done = useRef(false);
  useEffect(() => {
    if (!last || done.current) return;
    done.current = true;
    seeDemo("ch1", true);
  }, [last]);

  const scenes = scenesOf(step.n);
  const scene = open && si < scenes.length ? scenes[si] : null;
  /* まだやっていない場面がある手は、手を打つ前の姿を出す */
  const before = scenes.length > 0 && !sceneDone;

  const go = (d: number) => {
    setI((v) => Math.max(0, Math.min(STEPS.length - 1, v + d)));
    setOpen(false);
    setSceneDone(false);
    setSi(0);
  };

  return (
    <main className="relative flex h-dvh flex-col" data-testid="demo1">
      {/* 見出し */}
      <div className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="backlink-bar text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">組立の通し見学</div>
          <div className="truncate text-[14px] font-extrabold">第1章の手順を最後まで見る</div>
        </div>
        <div className="font-mono text-[12px] text-yel">
          {step.n}
          <span className="text-dim">/{STEPS.length}</span>
        </div>
      </div>
      <Bar v={i + 1} max={STEPS.length} />

      {/* 盤面。拡大図がある手は、上に拡大図（42%）・下に平面図（58%）で重ねる
          （プロトタイプと同じ配分。横に並べると狭い画面で両方とも小さくなる） */}
      <div className="min-h-0 flex-1 overflow-hidden bg-[#0C1015]">
        {step.art ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 border-b border-line" style={{ height: "42%" }}>
              <DemoArt kind={step.art} />
            </div>
            <div className="min-h-0" style={{ height: "58%" }}>
              <DemoBoard upTo={before ? i - 1 : i} spot={step.spot} />
            </div>
          </div>
        ) : (
          <DemoBoard upTo={before ? i - 1 : i} spot={step.spot} />
        )}
      </div>

      {/* 説明 */}
      <div className="flex-none overflow-y-auto border-t border-line bg-bg px-4 pb-4 pt-3" style={{ maxHeight: "46vh" }}>
        <div className="flex items-start gap-3">
          <Boss size={38} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-black leading-snug">
              <span className="mr-2 font-mono text-yel">{String(step.n).padStart(2, "0")}</span>
              {step.t}
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-dim">{step.d}</div>
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
          {before ? (
            <Btn tone="y" onClick={() => { setSi(0); setOpen(true); }} testid="demo-try">
              この場面をやる →
            </Btn>
          ) : last ? (
            <Link
              href="/training/ch1"
              className="rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
            >
              第1章をやる
            </Link>
          ) : (
            <Btn tone="y" onClick={() => go(1)} testid="demo-next">
              次の手 →
            </Btn>
          )}
        </div>

        {scenes.length > 0 && sceneDone && (
          <button
            onClick={() => { setSi(0); setOpen(true); }}
            className="mt-2 w-full rounded-lg border border-line p-2 text-[12px] text-dim"
            data-testid="demo-again"
          >
            この場面をもう一度やる
          </button>
        )}

        <Link
          href="/training/catalog?back=/training/demo"
          className="mt-2 block rounded-lg border border-line p-2.5 text-center text-[12.5px] text-cyan no-underline"
        >
          資材を見る
        </Link>
      </div>

      {/* 場面。遊ぶときと同じものを、そのまま操作してもらう。
          見学なので減点はしない（部品が自分で理由を出す）。
          どうしても進めないときのために逃げ道を出しておく */}
      {scene && (
        <SceneFrame onSkip={() => setOpen(false)}>
          <Ch1Scene
            scene={scene}
            onDone={() => setSi((v) => { const n = v + 1; if (n >= scenes.length) setSceneDone(true); return n; })}
            onFoul={() => {}}
            onPenalty={() => {}}
          />
        </SceneFrame>
      )}
    </main>
  );
}
