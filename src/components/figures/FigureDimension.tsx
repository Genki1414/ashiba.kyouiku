"use client";
import type { Figure } from "@/types/curriculum";
import { FigureFrame, figureItems } from "./core";

/* dimension：寸法基準。数値を大きく見せる（11枚） */
const NUM = /(\d[\d,.]*\s*(?:cm|mm|m|度|kg|kN|N)?(?:以上|以下|未満|以内)?)/g;

function emphasize(text: string) {
  // split の捕捉グループにより、奇数番目が数値部分になる
  const parts = text.split(NUM);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-mono text-[15px] font-black text-yel">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function FigureDimension({ fig, onDone }: { fig: Figure; onDone: () => void }) {
  return (
    <FigureFrame
      fig={fig}
      items={figureItems(fig)}
      accent="var(--color-yel)"
      hint="タップして基準を開く"
      renderOpen={(it) => (
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[14px] font-extrabold text-txt">{it.n}</div>
          <div className="shrink-0 text-right text-[13px] leading-relaxed text-dim">
            {emphasize(it.d)}
          </div>
        </div>
      )}
      onDone={onDone}
    />
  );
}
