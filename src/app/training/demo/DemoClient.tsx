"use client";

import { useState } from "react";
import Link from "next/link";
import { STEPS } from "@/training/catalog/demoSteps";
import { DemoBoard } from "@/components/training/DemoBoard";
import { DemoArt } from "@/components/training/DemoArt";
import { Boss } from "@/components/training/Characters";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";

/* 通し見学。手を出さずに15手を順に見る。
   全15手に「なぜそうするのか」を出す（HANDOFF.md 4章）。
   画面内に収める作り（HANDOFF.md 2章）。 */

export function DemoClient() {
  const [i, setI] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const step = STEPS[i];
  const last = i >= STEPS.length - 1;

  const go = (d: number) => {
    setI((v) => Math.max(0, Math.min(STEPS.length - 1, v + d)));
    setShowWhy(false);
  };

  return (
    <main className="flex h-dvh flex-col">
      {/* 見出し */}
      <div className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="p-1 text-[16px] text-dim no-underline">
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
      <div className="min-h-0 flex-1 bg-[#0C1015]">
        {step.art ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 border-b border-line" style={{ height: "42%" }}>
              <DemoArt kind={step.art} />
            </div>
            <div className="min-h-0" style={{ height: "58%" }}>
              <DemoBoard upTo={i} spot={step.spot} />
            </div>
          </div>
        ) : (
          <DemoBoard upTo={i} spot={step.spot} />
        )}
      </div>

      {/* 説明 */}
      <div className="flex-none overflow-y-auto border-t border-line px-4 pb-4 pt-3" style={{ maxHeight: "46vh" }}>
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

        {showWhy ? (
          <div className="fade mt-3 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3">
            <div className="mb-1 text-[10.5px] font-bold tracking-widest text-yel">なぜそうするのか</div>
            <div className="text-[13px] leading-relaxed text-yel">{step.why}</div>
          </div>
        ) : (
          <button
            onClick={() => setShowWhy(true)}
            className="mt-3 w-full rounded-lg border border-yel/50 p-2.5 text-[12.5px] font-bold text-yel"
          >
            なぜそうするのか
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn dis={i === 0} onClick={() => go(-1)}>
            ← 前の手
          </Btn>
          {last ? (
            <Link
              href="/training/ch1"
              className="rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
            >
              第1章をやる
            </Link>
          ) : (
            <Btn tone="y" onClick={() => go(1)}>
              次の手 →
            </Btn>
          )}
        </div>

        <Link
          href="/training/catalog?back=/training/demo"
          className="mt-2 block rounded-lg border border-line p-2.5 text-center text-[12.5px] text-cyan no-underline"
        >
          資材を見る
        </Link>
      </div>
    </main>
  );
}
