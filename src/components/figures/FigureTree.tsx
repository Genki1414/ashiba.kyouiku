"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* tree：分類（1枚）。開くと所属する枝（分類名）が付く */
export function FigureTree({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  const cats = Object.keys(fig.content ?? {});
  return (
    <FigureFrame
      fig={fig}
      items={figureItems(fig)}
      accent="var(--color-cyan)"
      hint="タップして分類を確認"
      before={
        <div className="mb-3 flex gap-2">
          {cats.map((c) => (
            <div
              key={c}
              className="flex-1 rounded-lg border border-line bg-panel py-2 text-center text-[12px] font-extrabold text-steel-lt"
            >
              {c}
            </div>
          ))}
        </div>
      }
      renderOpen={(it) => (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-extrabold text-txt">{it.n}</div>
          <span className="shrink-0 rounded border border-cyan px-2 py-0.5 text-[11px] font-bold text-cyan">
            {it.d}
          </span>
        </div>
      )}
      onDone={onDone}
    />
  );
}
