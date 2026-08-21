"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* findfault：不備を探す（7枚）。task は type:"multi"（全部見つけたら完了） */
export function FigureFindFault({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  const items = figureItems(fig);
  return (
    <FigureFrame
      fig={fig}
      items={items}
      accent="var(--color-red)"
      hint="危ないと思う箇所をタップ"
      renderOpen={(it) => (
        <div className="flex gap-3">
          <span className="mt-0.5 shrink-0 rounded border border-red px-1.5 py-0.5 text-[10px] font-black text-red">
            不備
          </span>
          <div>
            <div className="text-[14px] font-extrabold text-ng-tx">{it.n}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-dim">{it.d}</div>
          </div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
