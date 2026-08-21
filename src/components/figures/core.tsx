"use client";

import { useState } from "react";
import type { Figure, Task } from "@/types/curriculum";
import { Btn } from "@/components/ui/Btn";

/* 図解の共通枠。
   「タップして開く → 全部開くと task に答える → 次へ」という進み方は
   8種すべて共通で、種類ごとの違いは中身の描き方だけにする。 */

export type FigItem = { n: string; d: string };

export function figureItems(fig: Figure): FigItem[] {
  if (fig.parts) return fig.parts;
  if (fig.faults) return fig.faults;
  if (fig.points) return fig.points;
  if (fig.dims) return fig.dims.map((d) => ({ n: d.label, d: d.v }));
  if (fig.content) {
    return Object.entries(fig.content).flatMap(([cat, xs]) => xs.map((x) => ({ n: x, d: cat })));
  }
  return [];
}

export function FigureFrame({
  fig,
  items,
  accent = "var(--color-cyan)",
  hint = "タップして開く",
  renderOpen,
  before,
  onDone,
}: {
  fig: Figure;
  items: FigItem[];
  accent?: string;
  hint?: string;
  renderOpen?: (it: FigItem, i: number) => React.ReactNode;
  /** 一覧の上に置く種類ごとの図（任意） */
  before?: React.ReactNode;
  onDone: () => void;
}) {
  const [open, setOpen] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const allOpen = open.length >= items.length;
  const q = fig.task;
  const hasChoices = !!q.a?.length;
  const solved = hasChoices ? pick === q.ok : allOpen;

  return (
    <div className="px-4 py-4">
      {before}
      <div className="grid gap-2">
        {items.map((it, i) => {
          const isOpen = open.includes(i);
          return (
            <button
              key={i}
              data-fig-item={isOpen ? "open" : "closed"}
              onClick={() => !isOpen && setOpen((v) => [...v, i])}
              className={`rounded-lg border p-3 text-left ${
                isOpen ? "bg-panel cursor-default" : "border-line bg-panel2 cursor-pointer"
              }`}
              style={isOpen ? { borderColor: accent } : undefined}
            >
              {isOpen ? (
                <div className="fade">
                  {renderOpen ? (
                    renderOpen(it, i)
                  ) : (
                    <>
                      <div className="text-[14px] font-extrabold" style={{ color: accent }}>
                        {it.n}
                      </div>
                      <div className="mt-1 text-[13px] leading-relaxed text-dim">{it.d}</div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-[14px] text-dim2">
                  <span className="mr-2 font-mono">{String(i + 1).padStart(2, "0")}</span>
                  {hint}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {allOpen && hasChoices && <TaskQuiz q={q} pick={pick} onPick={setPick} />}

      <Btn tone={solved ? "y" : undefined} dis={!solved} onClick={onDone} className="mt-4" testid="fig-next">
        {solved
          ? "次へ"
          : allOpen
            ? "答えを選んでください"
            : `あと${items.length - open.length}か所`}
      </Btn>
    </div>
  );
}

/* 確認（task）。正解を選ぶまで「次へ」が出ない */
function TaskQuiz({
  q,
  pick,
  onPick,
}: {
  q: Task;
  pick: number | null;
  onPick: (i: number) => void;
}) {
  if (!q.a) return null;
  return (
    <div className="fade mt-4 rounded-xl border border-line bg-panel p-4">
      <div className="mb-2 text-[11px] font-bold tracking-[2px] text-yel">確認</div>
      <div className="mb-3 text-[15px] font-extrabold leading-snug">{q.q}</div>
      <div className="grid gap-2">
        {q.a.map((a, i) => {
          const right = pick === q.ok && i === q.ok;
          const wrong = pick === i && i !== q.ok;
          return (
            <button
              key={i}
              data-task-opt
              onClick={() => onPick(i)}
              className={`rounded-lg border p-3 text-left text-[14px] font-bold ${
                right
                  ? "border-grn bg-ok-bg text-ok-tx"
                  : wrong
                    ? "border-red bg-ng-bg text-ng-tx"
                    : "border-line bg-panel2 text-txt"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>
    </div>
  );
}
