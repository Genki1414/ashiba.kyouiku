"use client";

import { useMemo } from "react";
import { buildDemo } from "@/training/ch2/demo";
import { Board } from "@/components/training/ch2/Board";
import { DemoShell } from "@/components/training/DemoShell";

/* 第2章の通し見学。
   盤面は遊ぶときと同じもの。手順は工程キューを実際に判定へ通して作っている。 */

export function Demo2Client() {
  const steps = useMemo(() => buildDemo(), []);

  return (
    <DemoShell
      sub="組立の通し見学"
      title="第2章の手順を最後まで見る"
      steps={steps}
      goal="/training/ch2"
      goalLabel="第2章をやる"
      board={(i) => (
        <Board
          s={steps[i].state}
          cur={null}
          mood="normal"
          tuto={false}
          still
          onTapPost={() => {}}
          onTapSpan={() => {}}
        />
      )}
    />
  );
}
