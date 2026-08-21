"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CORNERS, type CornerId } from "@/training/ch3/layout";
import { initialState, isComplete, type Ch3State } from "@/training/ch3/state";
import { hint as hintOf, judge, progress, type Action, type Scene } from "@/training/ch3/rules";
import { CORNER_XY, HiuchiZoom, Oyakata, Plan, SheetPart } from "@/components/training/ch3/Parts";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";
import { Hud } from "@/components/training/Hud";
import { Result } from "@/components/training/Result";
import { useScore } from "@/components/training/useScore";

/* 第3章のゲーム画面。判定は src/training/ch3/rules.ts に任せる。 */

export function Ch3Client({ tutorial }: { tutorial: boolean }) {
  const [s, setS] = useState<Ch3State>(initialState);
  const [msg, setMsg] = useState(
    "4面が組み上がった。まず出隅4箇所に火打を掛ける。足場と二等辺三角形になるようにな。",
  );
  const [angry, setAngry] = useState<string>("");
  const [scene, setScene] = useState<Scene | null>(null);
  const sc = useScore();

  const pg = progress(s);
  const done = isComplete(s);

  /* 手を打つ。良手なら true。第3章はここが唯一の判定の入口 */
  const act = useCallback(
    (a: Action): boolean => {
      const v = judge(s, a);
      if (v.kind === "good") {
        setS(v.state);
        setMsg(v.message);
        setAngry("");
        setScene(v.scene ?? null);
        sc.good();
        return true;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        sc.miss();
        return false;
      }
      setAngry(v.message);
      sc.bad(v.penalty, { tag: v.tag, message: v.message, why: v.why });
      return false;
    },
    [s, sc],
  );

  if (done) {
    return (
      <Result
        chapter="第3章 火打とシート"
        lowText="まだ任せられん"
        r={sc.result}
        onRetry={() => window.location.reload()}
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
            第3章　{s.phase === "hiuchi" ? "火打" : "シート"}
            <span className="ml-2 rounded border border-line px-1 text-[10px]">
              {tutorial ? "チュートリアル" : "本番"}
            </span>
          </div>
          <div className="truncate text-[14px] font-extrabold">火打とシート</div>
        </div>
      </div>
      <Bar v={pg.done} max={pg.total} />
      <Hud score={sc.score} combo={sc.combo} mult={sc.mult} skill={sc.skill} sec={sc.sec} />

      {/* 火打：平面図。シート：立面 */}
      {s.phase === "hiuchi" ? (
        <>
          <div className="border-b border-line bg-[#0F1318]">
            <Plan
              done={s.hiuchi}
              cur={nextCorner ? { id: nextCorner.id, ...CORNER_XY[nextCorner.id] } : null}
              onTap={() => nextCorner && act({ type: "tapCorner", corner: nextCorner.id })}
            />
          </div>
          <div className="px-4 py-3">
            <Oyakata show={!!angry} text={angry || msg} />
            {tutorial ? (
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
            ) : (
              <div className="text-center text-[11.5px] text-dim2">
                本番だ。親方にも聞けん。
              </div>
            )}
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
