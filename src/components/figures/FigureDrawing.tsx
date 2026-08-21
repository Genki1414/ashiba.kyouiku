"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* drawing：組立図の読み方（1枚） */
export function FigureDrawing({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  return (
    <FigureFrame
      fig={fig}
      items={figureItems(fig)}
      accent="var(--color-org)"
      hint="タップして読み方を開く"
      renderOpen={(it) => (
        <div>
          <div className="text-[14px] font-extrabold text-org">{it.n}</div>
          <div className="mt-1 text-[13px] leading-relaxed text-dim">{it.d}</div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
