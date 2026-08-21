"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* flow：手順。番号と縦のつながりを見せる（10枚）
   順序には理由がある——開いたときに「なぜその順か」を読ませる */
export function FigureFlow({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  const items = figureItems(fig);
  return (
    <FigureFrame
      fig={fig}
      items={items}
      accent="var(--color-yel)"
      hint="タップして手順を開く"
      renderOpen={(it, i) => (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yel font-mono text-[12px] font-black text-bg">
              {i + 1}
            </span>
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
          </div>
          <div>
            <div className="text-[14px] font-extrabold text-yel">{it.n}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-dim">{it.d}</div>
          </div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
