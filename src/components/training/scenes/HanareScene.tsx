"use client";

import { useState } from "react";
import { HANARE } from "@/training/ch1/layout";
import { Btn } from "@/components/ui/Btn";

/* 離れを測る。プロトタイプの HanareZoom をそのまま移植。
   離れが決まらんうちに水平を出しても、柱ごと動かせば狂う。
   だから 離れ → 水平 → ブラケットの順になる。 */

export function HanareScene({ label, onDone }: { label: string; onDone: () => void }) {
  /* ずれた状態から始める。どちらへずれるかは毎回変える */
  const [v, setV] = useState(
    () => HANARE + (Math.random() < 0.5 ? -1 : 1) * (100 + Math.floor(Math.random() * 4) * 50),
  );
  const done = v === HANARE;
  const move = (d: number) => {
    const n = v + d;
    setV(n);
    if (n === HANARE) setTimeout(onDone, 480);
  };
  const px = 62 + (v / 900) * 118;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]">
      <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-[12px] font-extrabold text-yel">離れを測る</span>
        <span className="text-[11px] text-dim">{label}</span>
        <span data-testid="hanare-now" data-value={v} className={`ml-auto font-mono text-[12px] ${done ? "text-grn" : "text-txt"}`}>{v} mm</span>
      </div>

      <svg
        viewBox="0 0 340 200"
        preserveAspectRatio="xMidYMid meet"
        className="block min-h-0 w-full flex-1"
      >
        <rect y="176" width="340" height="24" fill="#1A2027" />
        {/* 躯体 */}
        <rect x="0" y="18" width="62" height="158" fill="#2A323A" stroke="#39434D" />
        <text x="31" y="100" textAnchor="middle" fontSize="12" fill="#5A6570">
          躯体
        </text>

        {/* 支柱 */}
        <g style={{ transition: "transform .2s" }} transform={`translate(${px - 180},0)`}>
          <line x1="180" y1="176" x2="180" y2="42" stroke="var(--color-steel)" strokeWidth="11" />
          <ellipse cx="180" cy="174" rx="17" ry="6" fill="var(--color-steel-dk)" />
          {[0.25, 0.5, 0.75].map((k, i) => (
            <polygon
              key={i}
              points={`172,${176 - k * 134} 180,${172 - k * 134} 188,${176 - k * 134} 180,${180 - k * 134}`}
              fill="var(--color-steel-lt)"
            />
          ))}
        </g>

        {/* 寸法 */}
        <line x1="62" y1="150" x2={px} y2="150" stroke="var(--color-yel)" strokeWidth="4" />
        <line x1="62" y1="140" x2="62" y2="160" stroke="var(--color-yel)" strokeWidth="2" />
        <line x1={px} y1="140" x2={px} y2="160" stroke="var(--color-yel)" strokeWidth="2" />
        <rect
          x={(62 + px) / 2 - 28}
          y="120"
          width="56"
          height="20"
          rx="4"
          fill="#14171B"
          stroke="var(--color-yel)"
        />
        <text
          x={(62 + px) / 2}
          y="134"
          textAnchor="middle"
          fontSize="12"
          fill="var(--color-yel)"
          className="font-mono"
        >
          {v}
        </text>
      </svg>

      <div className="flex-none px-4 pb-4 pt-3">
        <div className="mb-1 text-[13px]">
          指示された離れ <b className="font-mono text-yel">{HANARE}mm</b>
        </div>
        <div className={`mb-3.5 text-[12.5px] leading-relaxed ${done ? "text-grn" : "text-dim"}`}>
          {done
            ? "離れが合った。この離れが全周に効く。"
            : v > HANARE
              ? "離れすぎ。躯体側へ押す。"
              : "近すぎ。外へ引く。"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn tone="y" onClick={() => move(-50)}>← 押す（50）</Btn>
          <Btn tone="y" onClick={() => move(50)}>引く（50）→</Btn>
        </div>
      </div>
    </div>
  );
}
