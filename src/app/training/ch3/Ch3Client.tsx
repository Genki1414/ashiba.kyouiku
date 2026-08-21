"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CORNERS, type CornerId } from "@/training/ch3/layout";
import { initialState, isComplete, type Ch3State } from "@/training/ch3/state";
import { hint as hintOf, judge, progress, type Action, type Scene } from "@/training/ch3/rules";
import { CORNER_XY, HiuchiZoom, Oyakata, Plan, SheetPart } from "@/components/training/ch3/Parts";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { Hud } from "@/components/training/Hud";
import { ResumeGate } from "@/components/training/ResumeGate";
import { useBoot } from "@/components/training/useBoot";
import { clearSaved, writeSaved } from "@/lib/resumeStore";
import { beforeSheet } from "@/training/ch3/state";
import type { Saved } from "@/training/resume";
import { SoundToggle } from "@/components/training/SoundToggle";
import { SFX } from "@/lib/sfx";
import { Result } from "@/components/training/Result";
import { useScore } from "@/components/training/useScore";

/* 第3章のゲーム画面。判定は src/training/ch3/rules.ts に任せる。 */

/* 章を開いたときの殻。途中まで残っていたら、続きからやるか聞く */
export function Ch3Client({ tutorial }: { tutorial: boolean }) {
  const { ask, boot, begin } = useBoot<Ch3State>("ch3", { tutorial, sk: false });

  if (ask) {
    return (
      <ResumeGate
        ch="ch3"
        saved={ask}
        where={`${progress(ask.s).done}/${progress(ask.s).total}`}
        note="シートは途中から作り直せないので、シートの手前まで戻します。火打はそのままです。"
        onResume={() => begin(ask)}
        onFresh={() => begin(null)}
      />
    );
  }
  if (!boot) return null;

  return <Ch3Game key={boot.n} tutorial={tutorial} init={boot.saved} onRestart={() => begin(null)} />;
}

function Ch3Game({
  tutorial,
  init,
  onRestart,
}: {
  tutorial: boolean;
  init: Saved<Ch3State> | null;
  onRestart: () => void;
}) {
  const [s, setS] = useState<Ch3State>(() => init?.s ?? initialState());
  const [msg, setMsg] = useState(
    init?.msg ??
      "4面が組み上がった。まず出隅4箇所に火打を掛ける。足場と二等辺三角形になるようにな。",
  );
  const [angry, setAngry] = useState<string>("");
  const [scene, setScene] = useState<Scene | null>((init?.scene as Scene) ?? null);
  /* 平面図をひし形に傾ける量。0のときは傾けない */
  const [skew, setSkew] = useState(0);
  const sc = useScore(init?.score);

  /* 火打が無いとどうなるか。平面図の上辺だけ横へ揺らして見せる
     （プロトタイプ ashiba-ch3-v13.tsx の demo と同じ動き） */
  const showCollapse = useCallback(() => {
    setMsg("火打が無ければ、この通り。上から見てひし形に崩れる。");
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      setSkew(Math.sin(t / 6) * 26);
      if (t > 38) {
        clearInterval(id);
        setSkew(0);
      }
    }, 45);
  }, []);

  const pg = progress(s);
  const done = isComplete(s);

  /* 手を打つたびに、続きを端末に残す。通し終えたら消す。
     シートは部品が自分の中に状態を持っていて途中から作り直せないので、
     シートに入ったら「シートの手前」として残す（火打はそのまま） */
  const scoreRef = useRef(sc.result);
  scoreRef.current = sc.result;
  useEffect(() => {
    if (done) {
      clearSaved("ch3");
      return;
    }
    writeSaved<Ch3State>("ch3", {
      s: beforeSheet(s),
      score: scoreRef.current,
      tutorial,
      msg,
      scene: scene ?? undefined,
    });
  }, [s, msg, scene, done, tutorial]);

  /* 手を打つ。良手なら true。第3章はここが唯一の判定の入口 */
  const act = useCallback(
    (a: Action): boolean => {
      const v = judge(s, a);
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        setAngry("");
        setScene(v.scene ?? null);
        /* 火打からシートへの切り替えは作業ではないので点は付けない。
           音は場面の部品（HiuchiZoom / SheetPart）が自分で鳴らすので、ここでは鳴らさない */
        if (a.type !== "toSheet") sc.good("none");
        return true;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        sc.miss();
        return false;
      }
      SFX.shout();
      setAngry(v.message);
      sc.bad(v.penalty, { tag: v.tag, message: v.message, why: v.why });
      return false;
    },
    [s, sc],
  );

  if (done) {
    return (
      <Result
        ch="ch3"
        tutorial={tutorial}
        r={sc.result}
        onRetry={onRestart}
        extra={
          <div className="mt-4 rounded-lg border border-line bg-panel px-3.5 py-3 text-[12px] leading-[1.9] text-dim">
            出隅4箇所の火打と、最上段のシート。
            <br />
            指摘された回数　
            <span className={`font-extrabold ${sc.errs.length ? "text-red" : "text-grn"}`}>
              {sc.errs.length}回
            </span>
          </div>
        }
      />
    );
  }

  /* いま火打を入れる出隅 */
  const nextCorner = CORNERS.find((c) => !s.hiuchi.includes(c.id));

  return (
    <main className="relative pb-6">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/training" className="p-1 text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">
            第3章　{s.phase === "hiuchi" || s.phase === "hiuchiDone" ? "火打" : "シート"}
            <span className="ml-2 rounded border border-line px-1 text-[10px]">
              {tutorial ? "チュートリアル" : "本番"}
            </span>
          </div>
          <div className="truncate text-[14px] font-extrabold">火打とシート</div>
        </div>
        <SoundToggle />
      </div>
      <Bar v={pg.done} max={pg.total} />
      <Hud score={sc.score} combo={sc.combo} mult={sc.mult} skill={sc.skill} sec={sc.sec} />

      {/* 親方の指示。プロトタイプと同じく、画面の上にずっと出しておく */}
      <div
        className="border-b border-line bg-panel px-3.5 py-2.5 text-[12.5px] leading-[1.75]"
        data-testid="ch3-msg"
      >
        {angry ? <span className="text-ng-tx">{angry}</span> : msg}
      </div>

      {/* 火打：平面図。シート：立面 */}
      {s.phase === "hiuchi" || s.phase === "hiuchiDone" ? (
        <>
          <div className="border-b border-line bg-[#0F1318]">
            <Plan
              done={s.hiuchi}
              cur={
                s.phase === "hiuchi" && nextCorner
                  ? { id: nextCorner.id, ...CORNER_XY[nextCorner.id] }
                  : null
              }
              onTap={() =>
                s.phase === "hiuchi" && nextCorner && act({ type: "tapCorner", corner: nextCorner.id })
              }
              skew={skew}
            />
          </div>
          <div className="px-4 py-3">
            <Oyakata show={!!angry} text={angry || msg} />

            {/* 4隅とも入ったら、何のために入れたかを見せてから次へ */}
            {s.phase === "hiuchiDone" && (
              <div className="mt-3">
                <div className="text-[16px] font-black">火打が入った</div>
                <div className="my-2 text-[12.5px] leading-[1.9] text-dim">
                  4つの出隅に三角形ができた。これで平面がねじれない。
                  <br />
                  火打が無いと、足場は上から見てひし形に崩れていく。
                </div>
                <Btn onClick={showCollapse} dis={skew !== 0} className="mb-2.5" testid="see-collapse">
                  火打が無いとどうなるか見る
                </Btn>
                <Btn
                  tone="y"
                  onClick={() => act({ type: "toSheet" })}
                  className="mb-2.5"
                  testid="to-sheet"
                >
                  シートへ進む
                </Btn>
                <div className="rounded-lg border border-line bg-panel px-3.5 py-3 text-[12px] leading-[1.9] text-dim">
                  この現場で入れた火打　
                  <span className="font-extrabold text-txt">{s.hiuchi.length}箇所</span>
                  <br />
                  指摘された回数　
                  <span className={`font-extrabold ${sc.errs.length ? "text-red" : "text-grn"}`}>
                    {sc.errs.length}回
                  </span>
                </div>
              </div>
            )}

            {s.phase === "hiuchi" && tutorial ? (
              <Btn
                onClick={() => {
                  sc.countAsk();
                  setAngry("");
                  setMsg(hintOf(s));
                }}
                className="text-[12.5px] font-normal text-cyan"
              >
                親方に聞く{sc.asks > 0 ? `（${sc.asks}回）` : ""}
              </Btn>
            ) : s.phase === "hiuchi" ? (
              <div className="text-center text-[11.5px] text-dim2">
                本番だ。親方にも聞けん。
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <SheetPart act={act} angryMsg={angry} onDone={() => setS({ ...s, phase: "done" })} say={setMsg} />
      )}

      {/* 火打の場面 */}
      {scene?.type === "hiuchi" && (
        <HiuchiZoom
          corner={{
            ...CORNERS.find((c) => c.id === scene.corner)!,
            ...CORNER_XY[scene.corner],
          }}
          onClear={(a, b) => {
            act({ type: "hiuchiPick", corner: scene.corner as CornerId, a, b });
            setScene(null);
          }}
          onFoul={(a, b) => act({ type: "hiuchiPick", corner: scene.corner as CornerId, a, b })}
        />
      )}
    </main>
  );
}
