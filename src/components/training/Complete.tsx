"use client";

import { Btn } from "@/components/ui/Btn";

/* プロトタイプの Complete。結果を見る前に「何を組んだか」を見せる画面 */

export type Stat = [label: string, value: string, color: string];

export function Complete({
  chapter,
  title,
  svg,
  stats,
  lesson,
  onResult,
}: {
  chapter: string;
  title: string;
  svg?: React.ReactNode;
  stats: Stat[];
  lesson: React.ReactNode;
  onResult: () => void;
}) {
  return (
    <main className="p-4" data-testid="complete">
      <div className="mb-3 text-center">
        <div className="text-[11px] font-extrabold tracking-[3px] text-grn">{chapter}</div>
        <div className="mt-1 text-[20px] font-black">{title}</div>
      </div>

      {svg && (
        <div className="mb-3.5 overflow-hidden rounded-lg border border-line bg-[#0F1318]">{svg}</div>
      )}

      <div className="mb-2 text-[10px] tracking-[2px] text-dim">この現場で入れたもの</div>
      <div className="mb-3.5 rounded-lg border border-line bg-panel px-3.5 py-3">
        {stats.map(([k, v, c], i) => (
          <div key={i} className="flex py-[5px] text-[12.5px]">
            <span
              className="mr-2 mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-[3px]"
              style={{ background: c }}
            />
            <span className="flex-1 text-dim">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-line bg-panel px-3.5 py-3 text-[12px] leading-[1.95] text-dim">
        {lesson}
      </div>

      <Btn tone="y" onClick={onResult} testid="to-result">
        結果を見る
      </Btn>
    </main>
  );
}
