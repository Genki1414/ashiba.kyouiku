"use client";
import type { Figure } from "@/types/curriculum";
import { FigureRenderer } from "@/components/figures";

/* 図解の1枚。ヘッダ＋種類別レンダラ */
export function FigureView({ fig, index, total, onDone }: { fig: Figure; index: number; total: number; onDone: () => void }) {
  return (
    <div>
      <div className="border-b border-line bg-[#10151B] px-4 py-3.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] tracking-widest text-cyan">図解 {fig.id}</span>
          <span className="font-mono text-[11px] text-dim2">{index + 1}/{total}</span>
        </div>
        <div className="text-[16px] font-black">{fig.t}</div>
        <div className="mt-1.5 text-[13px] leading-relaxed text-dim">{fig.lead}</div>
      </div>
      <FigureRenderer fig={fig} onDone={onDone} />
    </div>
  );
}
