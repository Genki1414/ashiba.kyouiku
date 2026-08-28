"use client";
import type { Figure } from "@/types/curriculum";

/* ナレーションの横に出す図解。

   これが無いと、50分のあいだ字幕を1行ずつ見ているだけになる。
   聞いている内容の絵が出ていれば、目のやり場ができる。

   どの図解を出すかは、
   ・図解に at（ナレーションの何行目あたりか）があればそれを使う
   ・無ければ、図解の並び順で均等に割り当てる
   図解は解説の順に並べてあるので、均等割りでもだいたい合う。
   ずれが気になるところだけ、あとから at を入れれば直る。

   ここでは **中身をそのまま見せる**。
   「図解」の段で使っている部品（タップして開く・間違い探し）は使わない。
   聞きながら11回タップさせるのは仕事が増えるだけだし、
   そこで答えを見てしまうと、あとの図解の段が答え合わせにならない。
   ここは「見えている」だけでよい。 */

/** いま何行目かに対して、出す図解の番号。図解が無ければ null */
export function figureAt(figures: Figure[], line: number, lines: number): number | null {
  if (!figures.length || lines <= 0) return null;
  /* 手で置いた at があるものは、それを使う。
     無いものは、並び順で均等に割り当てた位置とみなす */
  const at = (i: number) => figures[i].at ?? Math.floor((lines * i) / figures.length);
  let hit = 0;
  for (let i = 0; i < figures.length; i++) if (line >= at(i)) hit = i;
  return hit;
}

/** 図解の中身を、種類によらず「名前と説明」の並びに直す */
function rowsOf(fig: Figure): { n: string; d: string }[] {
  const list = fig.parts ?? fig.faults ?? fig.points;
  if (list?.length) return list.map((x) => ({ n: x.n, d: x.d }));
  if (fig.dims?.length) return fig.dims.map((x) => ({ n: x.label, d: x.v }));
  if (fig.content) {
    return Object.entries(fig.content).map(([k, v]) => ({ n: k, d: v.join("・") }));
  }
  return [];
}

export function NarrationFigure({
  fig,
  index,
  total,
}: {
  fig: Figure;
  index: number;
  total: number;
}) {
  const rows = rowsOf(fig);
  /* 手順（flow）は番号が意味を持つ。それ以外は付けない */
  const numbered = fig.type === "flow";

  return (
    <div className="rounded-xl border border-line bg-panel" data-testid="narr-figure">
      <div className="flex items-baseline gap-2 border-b border-line px-3.5 py-2.5">
        <span className="text-[10.5px] tracking-widest text-cyan">いま話しているところ</span>
        <span className="ml-auto font-mono text-[10.5px] text-dim2">
          図解 {index + 1}/{total}
        </span>
      </div>

      <div className="px-3.5 py-3">
        <div className="text-[14.5px] font-black leading-snug">{fig.t}</div>
        <div className="mt-1 text-[12px] leading-relaxed text-dim">{fig.lead}</div>

        {!!rows.length && (
          <div className="mt-2.5 grid gap-1.5">
            {rows.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-line bg-bg px-3 py-2"
                data-testid="narr-figure-row"
              >
                <div className="flex items-baseline gap-2">
                  {numbered && (
                    <span className="shrink-0 font-mono text-[11px] text-yel">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                  <span className="text-[13px] font-bold leading-snug text-txt">{r.n}</span>
                </div>
                {r.d && (
                  <div className="mt-0.5 text-[12px] leading-relaxed text-dim">{r.d}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-2.5 text-[10.5px] leading-relaxed text-dim2">
          このあと「図解」で、同じところをもう一度やります。
        </div>
      </div>
    </div>
  );
}
