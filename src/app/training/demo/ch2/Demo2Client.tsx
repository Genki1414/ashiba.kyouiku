"use client";

import { useMemo } from "react";
import { buildDemo } from "@/training/ch2/demo";
import { initialState } from "@/training/ch2/state";
import { Board } from "@/components/training/ch2/Board";
import { BeltZoom, BraceZoom, RailZoom, WJackZoom } from "@/components/training/ch2/Parts";
import { DemoShell } from "@/components/training/DemoShell";

/* 第2章の通し見学。
   盤面は遊ぶときと同じもの。手順は工程キューを実際に判定へ通して作っている。

   場面（安全帯・手摺・筋交・壁当てジャッキ）は、見学でも
   遊ぶときと同じ部品を出して操作してもらう。
   ここは見ているだけでは身につかないため。 */

export function Demo2Client() {
  const steps = useMemo(() => buildDemo(), []);

  return (
    <DemoShell
      sub="組立の通し見学"
      title="第2章の手順を最後まで見る"
      steps={steps}
      goal="/training/ch2"
      goalLabel="第2章をやる"
      board={(i, sceneOpen) => (
        <Board
          /* 場面を操作している間は、まだ手を打つ前の姿を出す */
          s={sceneOpen ? (steps[i - 1]?.state ?? initialState()) : steps[i].state}
          cur={null}
          mood="normal"
          tuto={false}
          still
          fit
          onTapPost={() => {}}
          onTapSpan={() => {}}
        />
      )}
      overlay={(i, done) => {
        const sc = steps[i].scene;
        if (!sc) return null;
        /* 見学なので、間違えても減点しない。部品が自分で理由を出す */
        const noop = () => {};
        if (sc.type === "belt") return <BeltZoom mode={sc.mode} onClear={done} onFoul={noop} />;
        if (sc.type === "rail") return <RailZoom onClear={done} onFoul={noop} />;
        if (sc.type === "brace") return <BraceZoom onClear={done} onFoul={noop} />;
        return <WJackZoom onClear={done} onFoul={noop} />;
      }}
    />
  );
}
