"use client";

import { useMemo, useRef, useState } from "react";
import { buildDemo } from "@/training/ch3/demo";
import { CORNERS } from "@/training/ch3/layout";
import type { Pitch, PostKey } from "@/training/ch3/layout";
import { judge, type Action } from "@/training/ch3/rules";
import type { Ch3State } from "@/training/ch3/state";
import {
  CORNER_XY,
  HiuchiZoom,
  Oyakata,
  Plan,
  SpreadAsk,
  TieZoom,
} from "@/components/training/ch3/Parts";
import { DemoSheet } from "@/components/training/DemoSheet";
import { DemoShell } from "@/components/training/DemoShell";

/* 第3章の通し見学。
   火打は平面図（遊ぶときと同じもの）、シートは見学用の立面で見せる。

   操作してもらう場面（火打・シートの広げ方・結ぶ位置）は、見学でも
   遊ぶときと同じ部品を出す。見ているだけでは身につかないため。
   判定も遊ぶときと同じ judge() を通す。ただし減点はしない。 */

/** その場面のあいだだけ、判定を通して盤面を進める入れもの */
function useLocalAct(from: Ch3State) {
  const cur = useRef(from);
  const [angry, setAngry] = useState("");
  const act = (a: Action): boolean => {
    const v = judge(cur.current, a);
    if (v.kind === "good") {
      cur.current = v.state;
      setAngry("");
      return true;
    }
    /* 見学なので点は引かない。理由だけ出す */
    setAngry(v.message);
    return false;
  };
  return { act, angry };
}

/* シートを広げるときの問い。遊ぶときは下の帯に出るものを、
   見学では全画面にして、そこだけに集中してもらう */
function SpreadScene({ s, span, onClear }: { s: Ch3State; span: number; onClear: () => void }) {
  const { act, angry } = useLocalAct(s);
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]">
      <div className="flex-none border-b border-line px-4 py-3">
        <span className="text-[12.5px] font-extrabold text-yel">シートを広げる</span>
        <span className="ml-2 text-[11px] text-dim">{span + 1}スパン目</span>
      </div>
      {/* 遊ぶときと同じで、立面を見ながら選ぶ */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <DemoSheet s={s} />
      </div>
      <div className="flex-none px-4 pb-5 pt-3">
        <SpreadAsk
          onPick={(foot) => {
            if (act({ type: "spreadPick", span, foot })) onClear();
          }}
        />
      </div>
      <Oyakata show={!!angry} text={angry} />
    </div>
  );
}

/* 結ぶ位置。遊ぶときと同じ全画面 */
function TieScene({ s, post, onClear }: { s: Ch3State; post: PostKey; onClear: () => void }) {
  const { act, angry } = useLocalAct(s);
  return (
    <TieZoom
      post={post}
      bandIdx={s.band}
      pitch={(s.pitch ?? 900) as Pitch}
      act={act}
      angryMsg={angry}
      onDone={onClear}
    />
  );
}

export function Demo3Client() {
  const steps = useMemo(() => buildDemo(), []);

  return (
    <DemoShell
      sub="組立の通し見学"
      title="第3章の手順を最後まで見る"
      steps={steps}
      goal="/training/ch3"
      goalLabel="第3章をやる"
      hasScene={(i) => !!steps[i].scene}
      overlay={(i, done) => {
        const st = steps[i];
        const sc = st.scene;
        /* 場面は、開いたときの盤面（1手前）から判定を通す */
        const from = st.sceneFrom;
        if (!sc || !from) return null;
        if (sc.type === "hiuchi") {
          const c = CORNERS.find((x) => x.id === sc.corner)!;
          /* 見学なので、間違えても減点しない。部品が自分で理由を出す */
          return (
            <HiuchiZoom corner={{ ...c, ...CORNER_XY[sc.corner] }} onClear={done} onFoul={() => {}} />
          );
        }
        if (sc.type === "spread") return <SpreadScene s={from} span={sc.span} onClear={done} />;
        return <TieScene s={from} post={sc.post} onClear={done} />;
      }}
      board={(i, before) => {
        /* その手の場面をまだやっていない間は、手を打つ前の姿を出す */
        const st = before && i > 0 ? steps[i - 1] : steps[i];
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
