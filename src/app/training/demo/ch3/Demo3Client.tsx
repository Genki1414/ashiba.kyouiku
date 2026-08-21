"use client";

import { useMemo } from "react";
import { buildDemo } from "@/training/ch3/demo";
import { Plan } from "@/components/training/ch3/Parts";
import { DemoSheet } from "@/components/training/DemoSheet";
import { DemoShell } from "@/components/training/DemoShell";

/* 第3章の通し見学。
   火打は平面図（遊ぶときと同じもの）、シートは見学用の立面で見せる。 */

export function Demo3Client() {
  const steps = useMemo(() => buildDemo(), []);

  return (
    <DemoShell
      sub="組立の通し見学"
      title="第3章の手順を最後まで見る"
      steps={steps}
      goal="/training/ch3"
      goalLabel="第3章をやる"
      board={(i) => {
        const st = steps[i];
        return st.view === "plan" ? (
          <div className="h-full p-2">
            <Plan done={st.state.hiuchi} cur={null} />
          </div>
        ) : (
          <DemoSheet s={st.state} />
        );
      }}
    />
  );
}
