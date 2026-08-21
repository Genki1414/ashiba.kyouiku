"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { POSTS, SPAN_IDS, isInner } from "@/training/ch2/layout";
import {
  current,
  initialState,
  isComplete,
  progress,
  type Ch2State,
} from "@/training/ch2/state";
import {
  TOOL_NAME,
  hint as hintOf,
  judge,
  usableTools,
  type Action,
  type Scene,
  type Tool,
} from "@/training/ch2/rules";
import { Board } from "@/components/training/ch2/Board";
import {
  BeltZoom,
  Boss,
  BraceZoom,
  RailZoom,
  Scold,
  WJackZoom,
} from "@/components/training/ch2/Parts";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { Complete } from "@/components/training/Complete";
import { Hud, PopText } from "@/components/training/Hud";
import { SoundToggle } from "@/components/training/SoundToggle";
import { SFX } from "@/lib/sfx";
import { Result } from "@/components/training/Result";
import { useScore } from "@/components/training/useScore";

/* 第2章のゲーム画面。判定は src/training/ch2/rules.ts に任せる。 */

const ALL_TOOLS: Tool[] = [
  "move",
  "brace",
  "rail",
  "post",
  "wjack",
  "brk",
  "rail6",
  "deck",
  "fall",
];

export function Ch2Client({ tutorial }: { tutorial: boolean }) {
  const [s, setS] = useState<Ch2State>(initialState);
  const [tool, setTool] = useState<Tool>("brace");
  const [msg, setMsg] = useState("まず地上から筋交を入れろ。南端から出隅へ、一直線に上げていく。");
  const [mood, setMood] = useState<"normal" | "good" | "bad">("normal");
  const [walking, setWalking] = useState(false);
  const [scold, setScold] = useState<string | null>(null);
  const [scoldModal, setScoldModal] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [view, setView] = useState<"play" | "result">("play");
  const sc = useScore();

  const cur = current(s);
  const pg = progress(s);
  const done = isComplete(s);

  const run = useCallback(
    (a: Action) => {
      const v = judge(s, a);
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        setMood("good");
        setTimeout(() => setMood("normal"), 800);
        setScold(null);
        if (a.type === "tapPost" && a.tool === "move") {
          setWalking(true);
          setTimeout(() => setWalking(false), 320);
        }
        sc.good();
        if (v.scene) setScene(v.scene);
        return;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        setScold(null);
        sc.miss();
        return;
      }
      /* 盤面のファールは親方の横に文字（第1章と同じ扱い） */
      setMood("bad");
      setScold(`${v.message}\n${v.why}`);
      sc.bad(v.penalty, { tag: v.tag, message: v.message, why: v.why });
    },
    [s, sc],
  );

  const closeScene = useCallback(() => {
    if (!scene) return;
    const v = judge(s, { type: "sceneDone", scene });
    if (v.kind === "good") {
      setS(v.state);
      setMsg(v.message);
      setScene(v.scene ?? null);
      setMood("good");
      setTimeout(() => setMood("normal"), 800);
      /* 場面が自分で音を鳴らしているので、ここでは鳴らさない */
      sc.good("none");
      return;
    }
    setMsg(v.message);
    setScene(null);
  }, [s, scene, sc]);

  /* 場面の中のファール（安全帯の掛け先など）は怒りの画面 */
  const sceneFoul = useCallback(
    (tag: string, line: string) => {
      setMood("bad");
      SFX.shout();
      sc.bad(10, { tag, message: line, why: "" });
      setScoldModal(line);
    },
    [sc],
  );

  const tools = tutorial ? usableTools(s) : ALL_TOOLS;

  if (done && view === "result") {
    return (
      <Result
        ch="ch2"
        tutorial={tutorial}
        r={sc.result}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (done) {
    const nInner = POSTS.filter(isInner).length;
    return (
      <Complete
        chapter="第2章 高所作業"
        title="2段目まで組み上がった"
        svg={
          <Board
            s={s}
            cur={null}
            mood="normal"
            tuto={false}
            still
            onTapPost={() => {}}
            onTapSpan={() => {}}
          />
        }
        stats={[
          ["継いだ支柱", `${POSTS.length}本`, "#93A0AD"],
          ["継いだ内柱", `${nInner}本`, "#7E8A96"],
          ["ブラケット", `${POSTS.length - nInner}箇所`, "#5F6B78"],
          ["踏板高さの手摺", `${nInner}箇所`, "#4FC3D9"],
          ["2段目の踏板", `${SPAN_IDS.length}枚`, "#7B8895"],
          ["2段目の手摺", `${SPAN_IDS.length}スパン`, "#F5D400"],
          ["筋交", "3本（南端から出隅へ一直線）", "#B9C4CE"],
          ["壁当てジャッキ", `${nInner}箇所`, "#D98B2B"],
          ["墜落防止の手摺", `${SPAN_IDS.length}スパン`, "#F5D400"],
        ]}
        lesson={
          <>
            床に乗る前に囲いを作る。手摺は低い方から。
            <br />
            支柱・受け材・踏板は奥から手前へ。手摺は荷揚げ側から。
            <br />
            この2つの向きが、材料を運ぶ距離を決めます。
          </>
        }
        onResult={() => setView("result")}
      />
    );
  }

  return (
    <main className="relative pb-6">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="p-1 text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">
            第2章　{s.lv === 0 ? "地上" : s.lv === 3 ? "屋根" : `${s.lv}段目`}
            <span className="ml-2 rounded border border-line px-1 text-[10px]">
              {tutorial ? "チュートリアル" : "本番"}
            </span>
          </div>
          <div className="truncate text-[14px] font-extrabold">高所作業</div>
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10.5px] ${
            s.belt === "none" ? "border-red text-ng-tx" : "border-grn text-grn"
          }`}
        >
          安全帯 {s.belt === "none" ? "未" : s.belt === "post" ? "支柱" : "手摺"}
        </span>
        <SoundToggle />
      </div>
      <Bar v={pg.done} max={pg.total} />
      <Hud score={sc.score} combo={sc.combo} mult={sc.mult} skill={sc.skill} sec={sc.sec} />

      <div className="relative border-b border-line bg-[#0F1318]">
        <PopText pop={sc.pop} />
        {tutorial && cur && (
          <div className="absolute inset-x-2 top-2 z-[4] flex items-center gap-2 rounded-lg border border-yel bg-[#0F1318ee] px-3 py-2">
            <span className="rounded bg-yel px-1.5 py-0.5 text-[9px] font-black text-bg">次</span>
            <span className="text-[12.5px] font-bold leading-snug">{cur.d}</span>
          </div>
        )}
        <Board
          s={s}
          cur={cur}
          mood={mood}
          walking={walking}
          tuto={tutorial}
          onTapPost={(i) => run({ type: "tapPost", tool, post: POSTS[i] })}
          onTapSpan={(i) => run({ type: "tapSpan", tool, span: SPAN_IDS[i] })}
        />
      </div>

      {/* 親方 */}
      <div className="flex items-start gap-3 border-b border-line bg-panel px-4 py-3">
        <Boss size={44} angry={mood === "bad"} />
        <div className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-relaxed">
          {scold ? <span className="text-ng-tx">{scold}</span> : msg}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 grid grid-cols-3 gap-2">
          {tools.map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`rounded-lg border p-2.5 text-[12.5px] font-bold ${
                tool === t ? "border-yel bg-yel text-bg" : "border-line bg-panel2 text-txt"
              }`}
            >
              {TOOL_NAME[t]}
            </button>
          ))}
        </div>

        <Btn onClick={() => run({ type: "climb" })} className="mb-2">
          {s.lv === 0 ? "昇降階段で上がる" : s.lv >= 2 ? "屋根に上がる" : "次の段へ上がる"}
        </Btn>

        {tutorial ? (
          <Btn
            onClick={() => {
              sc.countAsk();
              setScold(null);
              setMood("normal");
              setMsg(hintOf(s));
            }}
            className="text-[12.5px] font-normal text-cyan"
          >
            親方に聞く{sc.asks > 0 ? `（${sc.asks}回）` : ""}
          </Btn>
        ) : (
          <div className="text-center text-[11.5px] text-dim2">
            本番だ。手順書も無いし、親方にも聞けん。
          </div>
        )}
      </div>

      {/* 場面 */}
      {scene?.type === "belt" && (
        <BeltZoom
          mode={scene.mode}
          onClear={closeScene}
          onFoul={(fb) => sceneFoul("安全帯の取り付け位置の誤り", fb)}
        />
      )}
      {scene?.type === "rail" && (
        <RailZoom onClear={closeScene} onFoul={(fb) => sceneFoul("手摺を入れるコマの誤り", fb)} />
      )}
      {scene?.type === "brace" && (
        <BraceZoom onClear={closeScene} onFoul={(fb) => sceneFoul("筋交の入れ方", fb)} />
      )}
      {scene?.type === "wjack" && (
        <WJackZoom onClear={closeScene} onFoul={(fb) => sceneFoul("壁当てジャッキの位置", fb)} />
      )}

      {scoldModal && (
        <Scold
          line={scoldModal}
          onClose={() => {
            setScoldModal(null);
            setMood("normal");
          }}
        />
      )}
    </main>
  );
}
