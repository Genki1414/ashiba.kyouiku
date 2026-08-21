"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* compare：方式の比較（4枚） */
export function FigureCompare({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  return (
    <FigureFrame
      fig={fig}
      items={figureItems(fig)}
      accent="var(--color-cyan)"
      hint="タップして方式を開く"
      renderOpen={(it) => (
        <div>
          <div className="inline-block rounded bg-panel2 px-2 py-0.5 text-[13px] font-extrabold text-cyan">
            {it.n}
          </div>
          <div className="mt-1.5 text-[13px] leading-relaxed text-dim">{it.d}</div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
