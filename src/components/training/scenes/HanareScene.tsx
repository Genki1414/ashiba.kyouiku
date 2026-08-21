"use client";

import { useState } from "react";
import { HANARE } from "@/training/ch1/layout";
import { Btn } from "@/components/ui/Btn";

/* 建物からの離れを測る。離れが決まらんうちに水平を出しても、
   柱ごと動かせば狂う（柱ごとの順序：離れ → 水平 → ブラケット）。 */

const MIN = 700;
const MAX = 1100;
const STEP = 25;
const TOL = 25;

export function HanareScene({
  label,
  onDone,
}: {
  label: string;
  onDone: () => void;
}) {
  const [v, setV] = useState(MIN);
  const ok = Math.abs(v - HANARE) <= TOL;

  const wallX = 40;
  const postX = wallX + ((v - MIN) / (MAX - MIN)) * 180 + 60;
  const targetX = wallX + ((HANARE - MIN) / (MAX - MIN)) * 180 + 60;
  const GY = 180;

  return (
    <div className="fixed inset-0 z-30 flex items-center bg-[#0C1015ee] p-5">
      <div className="w-full">
        <div className="mb-1 text-[11px] font-extrabold tracking-widest text-yel">
          離れを測る　{label}
        </div>
        <div className="mb-3 text-[17px] font-black leading-snug">
          建物から {HANARE.toLocaleString()}mm に合わせろ。
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-[#10151B]">
          <svg viewBox="0 0 340 220" preserveAspectRatio="xMidYMid meet" className="block w-full">
            <rect y={GY} width="340" height="40" fill="#1A2027" />
            {/* 建物 */}
            <rect x="0" y="30" width={wallX} height={GY - 30} fill="#2A3038" />
            <text x="6" y="24" fontSize="11" fill="var(--color-dim)">建物</text>

            {/* 目標 */}
            <line x1={targetX} y1="40" x2={targetX} y2={GY} stroke="var(--color-grn)" strokeWidth="1.5" strokeDasharray="5 5" />

            {/* 柱 */}
            <g style={{ transition: "transform .15s" }} transform={`translate(${postX - targetX},0)`}>
              <line x1={targetX} y1={GY} x2={targetX} y2="50" stroke="var(--color-steel)" strokeWidth="8" />
              <polygon
                points={`${targetX - 12},${GY} ${targetX},${GY - 6} ${targetX + 12},${GY} ${targetX},${GY + 6}`}
                fill="var(--color-steel-dk)"
              />
            </g>

            {/* 寸法線 */}
            <line x1={wallX} y1={GY - 120} x2={postX} y2={GY - 120} stroke={ok ? "var(--color-grn)" : "var(--color-yel)"} strokeWidth="1.5" />
            <line x1={wallX} y1={GY - 126} x2={wallX} y2={GY - 114} stroke={ok ? "var(--color-grn)" : "var(--color-yel)"} strokeWidth="1.5" />
            <line x1={postX} y1={GY - 126} x2={postX} y2={GY - 114} stroke={ok ? "var(--color-grn)" : "var(--color-yel)"} strokeWidth="1.5" />
            <text
              x={(wallX + postX) / 2}
              y={GY - 130}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill={ok ? "var(--color-grn)" : "var(--color-yel)"}
            >
              {v.toLocaleString()}
            </text>
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn onClick={() => setV((x) => Math.max(MIN, x - STEP))}>◀ 建物へ寄せる</Btn>
          <Btn onClick={() => setV((x) => Math.min(MAX, x + STEP))}>離す ▶</Btn>
        </div>

        <div className="mt-3 text-[12px] leading-relaxed text-dim">
          離れが決まらんうちに水平を出しても、あとで柱ごと動かすことになる。
          だから 離れ → 水平 → ブラケットの順だ。
        </div>

        <Btn tone={ok ? "y" : undefined} dis={!ok} onClick={onDone} className="mt-3">
          {ok ? "離れが合った" : "まだ合っとらん"}
        </Btn>
      </div>
    </div>
  );
}
