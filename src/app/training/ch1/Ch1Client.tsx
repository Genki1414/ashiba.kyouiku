"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  post600,
  postsFor,
  span600,
  type PostId,
  type SpanId,
} from "@/training/ch1/layout";
import {
  danChecklist,
  danDone,
  initialState,
  isComplete,
  progress,
  type Ch1State,
} from "@/training/ch1/state";
import {
  hint as hintOf,
  judge,
  type Action,
  type Scene,
  type Tool,
} from "@/training/ch1/rules";
import { Board } from "@/components/training/Board";
import { Ch1Scene } from "@/components/training/ch1/Scene";
import { Boss, type Mood } from "@/components/training/Characters";
import {
  Choice,
  CornerArt,
  Scold,
  type ChoiceOpt,
} from "@/components/training/scenes/Prototype";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { Hud, PopText } from "@/components/training/Hud";
import { ResumeGate } from "@/components/training/ResumeGate";
import { useBoot } from "@/components/training/useBoot";
import { clearSaved, writeSaved } from "@/lib/resumeStore";
import type { Saved } from "@/training/resume";
import { SoundToggle } from "@/components/training/SoundToggle";
import { SFX } from "@/lib/sfx";
import { Result } from "@/components/training/Result";
import { useScore } from "@/components/training/useScore";

/* 第1章のゲーム画面。判定は src/training/ch1/rules.ts に任せ、
   ここは「見せ方」だけを持つ。 */

const DAN_TOOLS: { k: Tool; t: string }[] = [
  { k: "ledger", t: "根がらみ手摺" },
  { k: "rail6", t: "600手摺" },
  { k: "jack", t: "ジャッキ" },
  { k: "move", t: "移動" },
];
const TATE_TOOLS: { k: Tool; t: string }[] = [
  { k: "post", t: "支柱" },
  { k: "ledger", t: "手摺" },
  { k: "inner", t: "内柱" },
  { k: "brk", t: "ブラケット" },
  { k: "deck", t: "踏板" },
  { k: "move", t: "移動" },
];

/** 手摺先行工法のときだけ増える道具（プロトタイプと同じ並び） */
const SK_TOOLS: { k: Tool; t: string }[] = [
  { k: "rail6", t: "600手摺" },
  { k: "sgake", t: "先行手摺" },
];

/* 章を開いたときの殻。途中まで残っていたら、続きからやるか聞く */
export function Ch1Client({ tutorial, sk = false }: { tutorial: boolean; sk?: boolean }) {
  const { ask, boot, begin } = useBoot<Ch1State>("ch1", { tutorial, sk });

  if (ask) {
    return (
      <ResumeGate
        ch="ch1"
        saved={ask}
        where={ask.s.phase === "dan" ? "段取り" : `${progress(ask.s).done}/${progress(ask.s).total}`}
        onResume={() => begin(ask)}
        onFresh={() => begin(null)}
      />
    );
  }
  if (!boot) return null; // 調べているあいだは何も出さない

  return <Ch1Game key={boot.n} tutorial={tutorial} sk={sk} init={boot.saved} onRestart={() => begin(null)} />;
}

function Ch1Game({
  tutorial,
  sk,
  init,
  onRestart,
}: {
  tutorial: boolean;
  sk: boolean;
  init: Saved<Ch1State> | null;
  onRestart: () => void;
}) {
  const [s, setS] = useState<Ch1State>(() => init?.s ?? initialState(sk));
  const [tool, setTool] = useState<Tool>((init?.tool as Tool) ?? "ledger");
  const [msg, setMsg] = useState(
    init?.msg ?? "よし、段取りからいくぞ。まず割り付けどおりに根がらみ手摺を並べろ。",
  );
  const [mood, setMood] = useState<Mood>("normal");
  const [scold, setScold] = useState<string | null>(null);      // 親方の横に出す（プロトタイプの bad）
  const [scoldModal, setScoldModal] = useState<string | null>(null); // 怒りの画面（プロトタイプの foul）
  const [scene, setScene] = useState<Scene | null>((init?.scene as Scene) ?? null);
  const sc = useScore(init?.score);

  const pg = progress(s);
  const done = isComplete(s);

  /* 手を打つたびに、続きを端末に残す。通し終えたら消す。
     時間だけは書いた時点のものなので、置いたまま離れた分は数えない */
  const scoreRef = useRef(sc.result);
  scoreRef.current = sc.result;
  useEffect(() => {
    if (done) {
      clearSaved("ch1");
      return;
    }
    writeSaved<Ch1State>("ch1", {
      s,
      score: scoreRef.current,
      tutorial,
      sk,
      tool,
      msg,
      scene: scene ?? undefined,
    });
  }, [s, tool, msg, scene, done, tutorial, sk]);

  /* 手摺先行工法では出隅の片側が600スパンになり、柱の位置がずれる */
  const posts = useMemo(() => postsFor(s.side), [s.side]);
  const p600 = s.sk ? post600(s.side) : null;
  const sp600 = s.sk ? span600(s.side) : null;

  /* 作業員の位置 */
  const at = useMemo(() => {
    if (!s.at) return { x: 3, y: -0.6 };
    const p = posts[s.at];
    return { x: p.x, y: p.y - 0.6 };
  }, [s.at, posts]);

  const run = useCallback(
    (a: Action) => {
      const v = judge(s, a);
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        setMood("good");
        setTimeout(() => setMood("normal"), 800);
        setScold(null);
        /* 段取りから建方への切り替えと、600にする側を決めるのは
           作業ではないので点は付けない */
        if (a.type === "pickSide") SFX.tick();
        else if (a.type !== "toTate") sc.good(s.phase === "dan" ? "place" : "hammer");
        if (v.scene) setScene(v.scene);
        return;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        setScold(null);
        sc.miss();
        return;
      }
      /* ファール：怒り顔＋なぜ駄目かを必ず添える */
      setMood("bad");
      setScold(`${v.message}\n${v.why}`);
      sc.bad(v.penalty, { tag: v.tag, message: v.message, why: v.why });
    },
    [s, sc],
  );

  /* 場面を閉じる */
  const closeScene = useCallback(
    (value?: number) => {
      if (!scene) return;
      const v = judge(s, { type: "sceneDone", scene, value });
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        /* 次の場面が続くなら差し替え、無ければ閉じる */
        setScene(v.scene ?? null);
        setMood("good");
        setTimeout(() => setMood("normal"), 800);
        /* 場面が自分で音を鳴らしているので、ここでは鳴らさない */
        sc.good("none");
        return;
      }
      setMsg(v.message);
    },
    [s, scene, sc],
  );

  /* 場面の中で叱りを出しきっているとき。点と記録だけ足す */
  const scenePenalty = useCallback(
    (tag: string, message: string, why: string) => {
      setMood("bad");
      sc.bad(8, { tag, message, why });
    },
    [sc],
  );

  /* 場面の中で起きたファール。状態は進めず技能点だけ引く */
  const sceneFoul = useCallback(
    (tag: string, message: string, why: string) => {
      const v = judge(s, { type: "sceneFoul", tag, message, why });
      if (v.kind !== "foul") return;
      setMood("bad");
      /* 場面でのファールはプロトタイプと同じく −10 */
      SFX.shout();
      sc.bad(10, { tag: v.tag, message: v.message, why: v.why });
      setScoldModal(`${v.message}\n${v.why}`);
    },
    [s, sc],
  );

  const tools =
    s.phase === "dan"
      ? DAN_TOOLS
      : [
          ...TATE_TOOLS.slice(0, 5),
          ...(sp600 ? [SK_TOOLS[0]] : []),
          ...(s.sk ? [SK_TOOLS[1]] : []),
          TATE_TOOLS[5],
        ];
  const ghost = tutorial ? 1 : 0.35; // 本番は設置箇所のゴーストを薄く

  if (done) {
    return (
      <Result
        ch="ch1"
        tutorial={tutorial}
        sk={s.sk}
        r={sc.result}
        onRetry={onRestart}
      />
    );
  }

  return (
    <main className="relative pb-6">
      {/* 上のバー */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="backlink-bar text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">
            第1章　{s.phase === "dan" ? "段取り" : "建方"}
            <span className="ml-2 rounded border border-line px-1 text-[10px]">
              {tutorial ? "チュートリアル" : "本番"}
            </span>
          </div>
          <div className="truncate text-[14px] font-extrabold">段取りと根がらみ</div>
        </div>
        <Link
          href={`/training/catalog?back=/training/ch1${tutorial ? "" : "?mode=honban"}`}
          className="rounded border border-line px-2 py-1 text-[11.5px] text-cyan no-underline"
        >
          資材
        </Link>
        <SoundToggle />
      </div>
      <Bar v={pg.done} max={pg.total} />
      <Hud score={sc.score} combo={sc.combo} mult={sc.mult} skill={sc.skill} sec={sc.sec} />

      {/* 盤面 */}
      <div className="relative border-b border-line bg-[#10151B]">
        <PopText pop={sc.pop} />
        <Board
          s={s}
          tool={tool}
          mood={mood}
          at={at}
          ghost={ghost}
          onTapPost={(id: PostId) => run({ type: "tapPost", tool, id })}
          onTapInner={(id: PostId) => run({ type: "tapInner", tool, id })}
          onTapSpan={(id: SpanId) => run({ type: "tapSpan", tool, id })}
        />
      </div>

      {/* 親方 */}
      <div className="flex items-start gap-3 border-b border-line bg-panel px-4 py-3">
        <Boss size={44} angry={mood === "bad"} />
        <div className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-relaxed">
          {scold ? <span className="text-ng-tx">{scold}</span> : msg}
        </div>
      </div>

      {/* 道具 */}
      <div className="px-4 py-3">
        <div className="mb-2 grid grid-cols-3 gap-2">
          {tools.map((t) => (
            <button
              key={t.k}
              onClick={() => setTool(t.k)}
              className={`rounded-lg border p-2.5 text-[12.5px] font-bold ${
                tool === t.k ? "border-yel bg-yel text-bg" : "border-line bg-panel2 text-txt"
              }`}
            >
              {t.t}
            </button>
          ))}
        </div>

        {/* 測る道具は建方でだけ使う */}
        {s.phase === "tate" && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Btn onClick={() => run({ type: "useHanare" })}>離れを見る</Btn>
            <Btn onClick={() => run({ type: "useLevel" })}>水平を見る</Btn>
          </div>
        )}

        {/* 段取りのチェック欄 */}
        {s.phase === "dan" && (
          <div className="mb-2 rounded-xl border border-line bg-panel p-3.5">
            <div className="mb-2 text-[11px] tracking-[2px] text-dim">段取りの残り</div>
            {danChecklist(s).map((c) => (
              <div
                key={c.t}
                data-check={c.t}
                data-now={c.now}
                data-need={c.need}
                className="mb-1.5 flex items-center gap-2 text-[12.5px]"
              >
                <span className={c.now >= c.need && c.need > 0 ? "text-grn" : "text-dim2"}>
                  {c.now >= c.need && c.need > 0 ? "✓" : "□"}
                </span>
                <span className="flex-1">{c.t}</span>
                <span className="font-mono text-[11.5px] text-dim">
                  {c.now}/{c.need}
                </span>
              </div>
            ))}
            <Btn
              tone={danDone(s) ? "y" : undefined}
              dis={!danDone(s)}
              onClick={() => run({ type: "toTate" })}
              className="mt-2"
            >
              {danDone(s) ? "建方へ進む" : "段取りが残っとる"}
            </Btn>
          </div>
        )}

        {/* 親方に聞く。本番では聞けない（HANDOFF.md 2章） */}
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

      {/* 場面。すべてプロトタイプの overlay をそのまま使う（通し見学と同じ部品） */}
      <Ch1Scene
        scene={scene}
        posts={posts}
        onDone={closeScene}
        onFoul={sceneFoul}
        onPenalty={scenePenalty}
      />

      {/* 出隅のどちら側を600スパンにするか。先行手摺を使うときだけ、はじめに決める */}
      {s.sk && !s.side && (
        <Choice
          title="先行手摺を使う"
          q="出隅のどちら側を600にする？"
          art={<CornerArt />}
          opts={[
            { t: "南面側を600にする", v: "S" },
            { t: "東面側を600にする", v: "E" },
          ]}
          onPick={(o: ChoiceOpt) => run({ type: "pickSide", side: o.v === "E" ? "E" : "S" })}
        />
      )}

      {/* ファールのとき、親方が怒る */}
      {scoldModal && <Scold line={scoldModal} onClose={() => { setScoldModal(null); setMood("normal"); }} />}

    </main>
  );
}
