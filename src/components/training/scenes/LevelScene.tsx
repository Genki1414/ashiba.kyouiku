"use client";

import { useState } from "react";
import { POSTS, type PostId } from "@/training/ch1/layout";
import { LEVEL_SPOT_NAME, type LevelSpot } from "@/training/ch1/rules";
import { Btn } from "@/components/ui/Btn";
import { WorkerSide } from "../Characters";

/* 水平器の置き場所（HANDOFF.md 3章 ルール6）
   根がらみ手摺の端から少し中。
   端は差し込みの都合で凹んでいて面が出ない。中ほどはジャッキから遠い。
   候補と作業員は進行方向側に出す。 */

export function LevelScene({
  a,
  b,
  dir,
  spots,
  wrong,
  onPick,
}: {
  a: PostId;
  b: PostId;
  dir: "south" | "east";
  spots: LevelSpot[];
  /** 外したときの理由。出たままにして、なぜ駄目かを読ませる */
  wrong: { spot: LevelSpot; why: string } | null;
  onPick: (spot: LevelSpot) => void;
}) {
  const [sel, setSel] = useState<LevelSpot | null>(null);

  /* 断面図。左が今立てた柱（b）、右が基準側（a）。
     進行方向側＝b の側に候補と作業員を出す */
  const GY = 250;
  const RAIL_Y = GY - 46; // 根がらみ手摺の高さ（450mm＝1コマ）
  const L = 62;
  const R = 300;
  const X: Record<LevelSpot, number> = { end: L + 16, in: L + 54, mid: (L + R) / 2 };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]">
      <div className="flex-none border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-extrabold text-yel">水平を出す</span>
          <span className="text-[11px] text-dim">{POSTS[b].n}</span>
        </div>
        <div className="mt-1 text-[16px] font-black leading-snug">水平器はどこに置く？</div>
      </div>

      <div className="min-h-0 flex-1">
          <svg viewBox="0 0 360 290" preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
            <rect y={GY} width="360" height="40" fill="#1A2027" />

            {/* 柱2本。左＝いま立てた柱（進行方向側） */}
            {[L, R].map((x) => (
              <g key={x}>
                <line x1={x} y1={GY} x2={x} y2={GY - 190} stroke="var(--color-steel)" strokeWidth="8" />
                <polygon
                  points={`${x - 12},${GY} ${x},${GY - 6} ${x + 12},${GY} ${x},${GY + 6}`}
                  fill="var(--color-steel-dk)"
                />
                <ellipse cx={x} cy={GY - 12} rx="9" ry="3.5" fill="var(--color-steel)" />
              </g>
            ))}

            {/* 根がらみ手摺。両端は差し込みのため凹んでいる */}
            <line x1={L} y1={RAIL_Y} x2={R} y2={RAIL_Y} stroke="var(--color-yel)" strokeWidth="7" />
            <rect x={L - 2} y={RAIL_Y - 5} width="16" height="4" fill="#8A7700" />
            <rect x={R - 14} y={RAIL_Y - 5} width="16" height="4" fill="#8A7700" />

            {/* 凹みの注記。候補のラベルと重ならないよう手摺の下に出す */}
            <line x1={L + 6} y1={RAIL_Y + 6} x2={L + 6} y2={RAIL_Y + 30} stroke="var(--color-red)" strokeWidth="1" />
            <text x={L + 10} y={RAIL_Y + 34} fontSize="10.5" fill="var(--color-red)">
              端は差し込みで凹んどる
            </text>

            {/* 候補。進行方向側から並べる */}
            {spots.map((k) => {
              const picked = sel === k;
              const isWrong = wrong?.spot === k;
              return (
                <g
                  key={k}
                  onClick={() => {
                    setSel(k);
                    onPick(k);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={X[k] - 17}
                    y={RAIL_Y - 20}
                    width="34"
                    height="15"
                    rx="3"
                    fill={isWrong ? "var(--color-red)" : picked ? "var(--color-grn)" : "var(--color-panel2)"}
                    stroke={isWrong ? "var(--color-red)" : picked ? "var(--color-grn)" : "var(--color-line)"}
                    strokeWidth="1.5"
                  />
                  {/* 気泡管 */}
                  <rect x={X[k] - 12} y={RAIL_Y - 16} width="24" height="7" rx="3.5" fill="#0F1318" />
                  <circle cx={X[k]} cy={RAIL_Y - 12.5} r="2.6" fill="var(--color-grn)" />
                  <text
                    x={X[k]}
                    y={RAIL_Y - 26}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={isWrong ? "var(--color-red)" : "var(--color-dim)"}
                    className="pointer-events-none"
                  >
                    {"①②③"[spots.indexOf(k)]}
                  </text>
                </g>
              );
            })}

            {/* 作業員も進行方向側に出す。ジャッキを回しながら気泡を見る */}
            <g transform={`translate(${L - 34},${GY})scale(.72)`}>
              <WorkerSide />
            </g>

            <text x="12" y="22" fontSize="11" fill="var(--color-dim2)">
              {dir === "south" ? "南面（進行方向は左）" : "東面（進行方向は左）"}
            </text>
            <text x={R} y={GY + 26} textAnchor="middle" fontSize="11" fill="var(--color-dim2)">
              {POSTS[a].n}
            </text>
            <text x={L} y={GY + 26} textAnchor="middle" fontSize="11" fill="var(--color-dim2)">
              {POSTS[b].n}（いま立てた柱）
            </text>
          </svg>
        </div>

      <div className="flex-none px-4 pb-4 pt-3">
        {wrong && (
          <div className="fade mb-3 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx">
            {wrong.why}
          </div>
        )}

        <div className="grid gap-2">
          {spots.map((k, i) => (
            <Btn key={k} onClick={() => { setSel(k); onPick(k); }}>
              {"①②③"[i]}　{LEVEL_SPOT_NAME[k]}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}
