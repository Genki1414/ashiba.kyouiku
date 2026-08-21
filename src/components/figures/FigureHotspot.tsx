"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* hotspot：各部名称（2枚）。番号札を打った盤面のように見せる */
export function FigureHotspot({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  const items = figureItems(fig);
  return (
    <FigureFrame
      fig={fig}
      items={items}
      accent="var(--color-cyan)"
      hint="番号をタップして名称を確認"
      renderOpen={(it, i) => (
        <div className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan font-mono text-[12px] font-black text-cyan">
            {i + 1}
          </span>
          <div>
            <div className="text-[14px] font-extrabold text-cyan">{it.n}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-dim">{it.d}</div>
          </div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
