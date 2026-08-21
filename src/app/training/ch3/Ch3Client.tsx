"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CORNERS, type CornerId } from "@/training/ch3/layout";
import { initialState, isComplete, type Ch3State } from "@/training/ch3/state";
import { hint as hintOf, judge, progress, type Action, type Scene } from "@/training/ch3/rules";
import { CORNER_XY, HiuchiZoom, Oyakata, Plan, SheetPart } from "@/components/training/ch3/Parts";
import { Bar } from "@/components/ui/Bar";
import { Btn } from "@/components/ui/Btn";

/* 第3章のゲーム画面。判定は src/training/ch3/rules.ts に任せる。 */

type Err = { tag: string; message: string; why: string };

export function Ch3Client({ tutorial }: { tutorial: boolean }) {
  const [s, setS] = useState<Ch3State>(initialState);
  const [msg, setMsg] = useState(
    "4面が組み上がった。まず出隅4箇所に火打を掛ける。足場と二等辺三角形になるようにな。",
  );
  const [angry, setAngry] = useState<string>("");
  const [skill, setSkill] = useState(100);
  const [errs, setErrs] = useState<Err[]>([]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [asks, setAsks] = useState(0);

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
        return true;
      }
      if (v.kind === "note") {
        setMsg(v.message);
        return false;
      }
      setAngry(v.message);
      setSkill((x) => Math.max(0, x - v.penalty));
      setErrs((e) => [...e, { tag: v.tag, message: v.message, why: v.why }]);
      return false;
    },
    [s],
  );

  if (done) {
    return (
      <main className="px-5 py-10">
        <div className="rounded-xl border border-grn bg-panel p-6 text-center">
          <div className="text-[11px] tracking-[3px] text-dim">第3章</div>
          <div className="mt-1 text-[20px] font-black text-grn">火打とシートが入った</div>
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
          <Link
            href="/training"
            className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
          >
            章の一覧へ
          </Link>
        </div>
      </main>
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
        <div className="font-mono text-[12px] text-yel">技能 {skill}</div>
      </div>
      <Bar v={pg.done} max={pg.total} />

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
                  setAsks((v) => v + 1);
                  setAngry("");
                  setMsg(hintOf(s));
                }}
                className="text-[12.5px] font-normal text-cyan"
              >
                親方に聞く{asks > 0 ? `（${asks}回）` : ""}
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
