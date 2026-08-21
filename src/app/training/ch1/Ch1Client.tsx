"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { POSTS, type PostId, type SpanId } from "@/training/ch1/layout";
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
import { Boss, type Mood } from "@/components/training/Characters";
import { JackScene } from "@/components/training/scenes/JackScene";
import { HanareScene } from "@/components/training/scenes/HanareScene";
import {
  Choice,
  InnerArt,
  LevelZoom,
  RailAnim,
  Scold,
  type ChoiceOpt,
} from "@/components/training/scenes/Prototype";
import { flipOf, innerPos } from "@/components/training/geometry";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";

/* 第1章のゲーム画面。判定は src/training/ch1/rules.ts に任せ、
   ここは「見せ方」だけを持つ。 */

type Err = { tag: string; message: string; why: string };

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

export function Ch1Client({ tutorial }: { tutorial: boolean }) {
  const [s, setS] = useState<Ch1State>(initialState);
  const [tool, setTool] = useState<Tool>("ledger");
  const [msg, setMsg] = useState(
    "よし、段取りからいくぞ。まず割り付けどおりに根がらみ手摺を並べろ。",
  );
  const [mood, setMood] = useState<Mood>("normal");
  const [scold, setScold] = useState<string | null>(null);      // 親方の横に出す（プロトタイプの bad）
  const [scoldModal, setScoldModal] = useState<string | null>(null); // 怒りの画面（プロトタイプの foul）
  const [skill, setSkill] = useState(100);
  const [errs, setErrs] = useState<Err[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [asks, setAsks] = useState(0);

  const pg = progress(s);
  const done = isComplete(s);

  /* 作業員の位置 */
  const at = useMemo(() => {
    if (!s.at) return { x: 3, y: -0.6 };
    const p = POSTS[s.at];
    return { x: p.x, y: p.y - 0.6 };
  }, [s.at]);

  const run = useCallback(
    (a: Action) => {
      const v = judge(s, a);
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        setMood("good");
        setTimeout(() => setMood("normal"), 800);
        setScold(null);
        if (v.scene) setScene(v.scene);
        return;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        setScold(null);
        return;
      }
      /* ファール：怒り顔＋なぜ駄目かを必ず添える */
      setMood("bad");
      setScold(`${v.message}\n${v.why}`);
      setSkill((x) => Math.max(0, x - v.penalty));
      setErrs((e) => [...e, { tag: v.tag, message: v.message, why: v.why }]);
    },
    [s],
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
        return;
      }
      setMsg(v.message);
    },
    [s, scene],
  );

  /* 場面の中で起きたファール。状態は進めず技能点だけ引く */
  const sceneFoul = useCallback(
    (tag: string, message: string, why: string) => {
      const v = judge(s, { type: "sceneFoul", tag, message, why });
      if (v.kind !== "foul") return;
      setMood("bad");
      /* 場面でのファールはプロトタイプと同じく −10 */
      setSkill((x) => Math.max(0, x - 10));
      setErrs((e) => [...e, { tag: v.tag, message: v.message, why: v.why }]);
      setScoldModal(`${v.message}\n${v.why}`);
    },
    [s],
  );

  const tools = s.phase === "dan" ? DAN_TOOLS : TATE_TOOLS;
  const ghost = tutorial ? 1 : 0.35; // 本番は設置箇所のゴーストを薄く

  if (done) {
    return (
      <main className="px-5 py-10">
        <div className="rounded-xl border border-grn bg-panel p-6 text-center">
          <div className="text-[11px] tracking-[3px] text-dim">第1章</div>
          <div className="mt-1 text-[20px] font-black text-grn">組み上がった</div>
          <div className="mt-4 font-mono text-[44px] font-bold leading-none text-yel">
            {skill}
            <span className="text-[18px] text-dim">/100</span>
          </div>
          <div className="mt-2 text-[12px] text-dim">技能点</div>
        </div>

        {errs.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[11px] tracking-[2px] text-yel">親方に言われたこと</div>
            {errs.map((e, i) => (
              <div key={i} className="mb-2 rounded-lg border border-line bg-panel px-3.5 py-3">
                <div className="text-[11px] text-red">{e.tag}</div>
                <div className="mt-1 text-[13.5px] font-bold leading-snug">{e.message}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-dim">{e.why}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-2">
          <Btn tone="y" onClick={() => window.location.reload()}>
            もう一度やる
          </Btn>
          <Link href="/training" className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline">
            章の一覧へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative pb-6">
      {/* 上のバー */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="p-1 text-[16px] text-dim no-underline">
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
        <div className="font-mono text-[12px] text-yel">技能 {skill}</div>
      </div>
      <Bar v={pg.done} max={pg.total} />

      {/* 盤面 */}
      <div className="border-b border-line bg-[#10151B]">
        <Board
          s={s}
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
              <div key={c.t} className="mb-1.5 flex items-center gap-2 text-[12.5px]">
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
              setAsks((v) => v + 1);
              setScold(null);
              setMood("normal");
              setMsg(hintOf(s));
            }}
            className="text-[12.5px] font-normal text-cyan"
          >
            親方に聞く{asks > 0 ? `（${asks}回）` : ""}
          </Btn>
        ) : (
          <div className="text-center text-[11.5px] text-dim2">
            本番だ。手順書も無いし、親方にも聞けん。
          </div>
        )}
      </div>

      {/* 場面。すべてプロトタイプの overlay をそのまま使う */}
      {scene?.type === "jackAdjust" && (
        <JackScene post={scene.post} onDone={(value) => closeScene(value)} />
      )}

      {scene?.type === "hanare" && (
        <HanareScene label={scene.label} onDone={() => closeScene()} />
      )}

      {/* 外柱の水平：置き場所を選んでから気泡を合わせる */}
      {scene?.type === "level" && (
        <LevelZoom
          baseN={POSTS[scene.a].n}
          tgtN={POSTS[scene.b].n}
          aId={scene.a}
          bId={scene.b}
          flip={flipOf(POSTS[scene.a], POSTS[scene.b])}
          onClear={() => closeScene()}
          onFoul={() =>
            sceneFoul(
              "基準柱のジャッキを操作",
              "そこは基準の柱じゃ！　基準を動かしたら全部狂うぞ！",
              "基準の柱を動かすと、そこまでに出した水平が全部やり直しになる。",
            )
          }
        />
      )}

      {/* 内柱：立てた直後 → 600手摺 → 水平器をどこに当てるか → 内柱の水平 */}
      {scene?.type === "innerChoiceA" && (
        <Choice
          title="内柱を立てた"
          q="次にどうする？"
          art={<InnerArt flip={flipOf(POSTS[scene.post], innerPos(scene.post))} ghost />}
          opts={[
            { t: "内柱に水平器を当てて水平を見る", ok: false },
            { t: "踏板高さの手摺を付ける", ok: true },
          ]}
          onPick={(o: ChoiceOpt) => {
            if (!o.ok) {
              return sceneFoul(
                "内柱の水平を先に見た",
                "順番が逆じゃ！　手摺で外柱とつないでから見んかい！",
                "つないでいない内柱は動く。動くものに水平器を当てても意味がない。",
              );
            }
            closeScene();
          }}
        />
      )}

      {scene?.type === "railAnim" && (
        <RailAnim
          flip={flipOf(POSTS[scene.post], innerPos(scene.post))}
          onDone={() => closeScene()}
        />
      )}

      {scene?.type === "innerChoiceB" && (
        <Choice
          title="水平を見る"
          q="水平器はどこに当てる？"
          art={<InnerArt flip={flipOf(POSTS[scene.post], innerPos(scene.post))} rail />}
          opts={[
            { t: "支柱（内柱）に当てる", ok: true },
            { t: "取り付けた手摺に当てる", ok: false },
          ]}
          onPick={(o: ChoiceOpt) => {
            if (!o.ok) {
              return sceneFoul(
                "水平器を当てる箇所の誤り",
                "手摺で見るな！　柱で見るんじゃ！",
                "手摺は差し込みに遊びがある。柱に当てんと本当の垂直は分からん。",
              );
            }
            closeScene();
          }}
        />
      )}

      {scene?.type === "levelInner" && (
        <LevelZoom
          vertical
          baseN="外柱"
          tgtN="内柱"
          aId={scene.post}
          flip={flipOf(POSTS[scene.post], innerPos(scene.post))}
          onClear={() => closeScene()}
          onFoul={() =>
            sceneFoul(
              "外柱のジャッキを操作",
              "外柱を動かすな！　もう水平は出とるじゃろが！",
              "外柱はもう決まっとる。動かせば、そこまでの離れも水平もやり直しだ。",
            )
          }
        />
      )}

      {/* ファールのとき、親方が怒る */}
      {scoldModal && <Scold line={scoldModal} onClose={() => { setScoldModal(null); setMood("normal"); }} />}

    </main>
  );
}
