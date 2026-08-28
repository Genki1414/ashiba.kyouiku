"use client";
import { useEffect, useRef } from "react";
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

/* いま読んでいる行が、図解のどの行の話かを当てる。

   当てられるのは、台本がその名前をそのまま言っているときだけ。
   ゆるく切って当てにいくと、「建地の間隔は」が
   「床材と建地とのすき間」に当たってしまう。違う所が光るのは、
   光らないより悪い。だから **名前まるごと**（と、（）や・で
   区切られた言い換え）でしか当てない。

   実際に当たるのは台本の4%ほど。残りは光らない。
   台本と図解は別々に書いてあるので、機械にはここまでしか分からない。
   全部の行で光らせたいなら、教材の側に「この行はこの部材の話」と
   書いていくしかない。 */

/* 「〜の◯◯」の◯◯が、どこにでも付く言葉のとき。
   「離隔距離の確保」は、台本では「離隔距離を確保します」と言う。
   まるごとでは当たらないので、頭（離隔距離）でも当てにいく。

   「作業床の幅」の『幅』のような、その行の中身そのものを指す言葉では
   切らない。切ると「作業床が昇り降りする」という別の話の行が、
   幅の行に当たってしまう。 */
const TAIL =
  /^(.+)の(確保|設置|移設|依頼|使用|着用|装着|防止|点検|確認|徹底|実施|周知|選定|管理|判断|報告|措置|保管|整理|固定|養生|準備|取扱い|取り扱い|方法|手順|注意)$/;

/** 名前から、当てにいく語を作る。短すぎるものは拾わない（誤爆する） */
function termsOf(name: string): string[] {
  const out = new Set<string>();
  const add = (t: string) => {
    const v = t.trim();
    if (v.length >= 2) out.add(v);
  };
  add(name);
  for (const part of name.split(/[（）()・／/、,]/)) add(part);
  for (const part of [...out]) {
    const m = TAIL.exec(part);
    /* 頭が3文字に満たないものは、よその行にも当たるので拾わない。
       「〜と」で終わる頭は、まだ言い切っていないので使わない */
    if (m && m[1].length >= 3 && !/[とやおよびまたは]$/.test(m[1])) add(m[1]);
  }
  /* 長いものから見る。「支柱（建地）」なら、まず名前まるごと */
  return [...out].sort((a, b) => b.length - a.length);
}

/* 名前で当たらないときの、二の矢。

   図解の説明文は、台本を言い換えて書いてある所が多い。
   　台本 「三つ目は、悪天候のため作業の実施について危険が予想されるとき」
   　図解 「悪天候時の作業中止」
   名前は出てこないが、言っていることは同じ。
   そこで、助詞や送り仮名を落として2文字ずつの並びにし、
   どれだけ重なるかで見る。

   重なりが少ないものは通さない（TH）。
   いちばん重なった行が2番目と同点なら、決められないので通さない。
   「どちらとも取れる」ときに光らせると、違う所が光ることになる。 */
const TH = 5;
const STOP = /[、。・（）()「」\s　をにはがのでとやもかなますでしたているれるられあるこそのれどこ]/g;
function gramsOf(s: string): Set<string> {
  const t = s.replace(STOP, "");
  const g = new Set<string>();
  for (let i = 0; i + 2 <= t.length; i++) g.add(t.slice(i, i + 2));
  return g;
}

/** 名前がそのまま出ている行。無ければ null（字幕で光らせる語は、これがあるときだけ） */
export function hitByName(rows: { n: string }[], line: string): number | null {
  if (!line) return null;
  let best: { i: number; len: number } | null = null;
  for (let i = 0; i < rows.length; i++) {
    for (const t of termsOf(rows[i].n)) {
      if (!line.includes(t)) continue;
      /* 同じ行に2つ出てきたら、長い方の話とみなす */
      if (!best || t.length > best.len) best = { i, len: t.length };
      break;
    }
  }
  return best?.i ?? null;
}

/** その行が言っている図解の行。当たらなければ null */
export function hitRow(rows: { n: string; d?: string }[], line: string): number | null {
  if (!line) return null;
  /* まず名前で。いちばん確かなので、こちらを優先する */
  const byName = hitByName(rows, line);
  if (byName !== null) return byName;

  /* 名前が出てこなくても、言っていることが同じなら当てる */
  const g = gramsOf(line);
  let bi = -1;
  let best = 0;
  let second = 0;
  rows.forEach((r, k) => {
    let c = 0;
    for (const x of gramsOf(r.n + (r.d ?? ""))) if (g.has(x)) c++;
    if (c > best) {
      second = best;
      best = c;
      bi = k;
    } else if (c > second) second = c;
  });
  return best >= TH && best > second ? bi : null;
}

/* 字幕の中で光らせる語。

   名前がそのまま出ているときだけ。言い換えで当てたぶんは、
   字幕のどこを光らせればよいか決められないので、行だけ光らせる。 */
export function hitTerm(rows: { n: string }[], line: string): string | null {
  const i = hitByName(rows, line);
  if (i === null) return null;
  for (const t of termsOf(rows[i].n)) if (line.includes(t)) return t;
  return null;
}

/** 図解の中身を、種類によらず「名前と説明」の並びに直す */
export function rowsOf(fig: Figure): { n: string; d: string }[] {
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
  line,
}: {
  fig: Figure;
  index: number;
  total: number;
  /** いま読んでいる台本の1行。その話をしている行があれば光らせる */
  line?: string;
}) {
  const rows = rowsOf(fig);
  const hit = line ? hitRow(rows, line) : null;

  /* 光った行を、画面の中に入れる。
     入れないと、図解が長いときに「どこが光ったのか」を探すことになる。
     nearest にしてあるので、もう見えているときは動かない
     （読んでいる途中で画面が飛ぶ方が困る） */
  const onRow = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (hit === null) return;
    onRow.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hit]);
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
                ref={i === hit ? onRow : undefined}
                className={
                  i === hit
                    ? "rounded-lg border border-yel bg-[#1A1F14] px-3 py-2"
                    : "rounded-lg border border-line bg-bg px-3 py-2"
                }
                data-testid={i === hit ? "narr-figure-row-on" : "narr-figure-row"}
              >
                <div className="flex items-baseline gap-2">
                  {numbered && (
                    <span className="shrink-0 font-mono text-[11px] text-yel">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                  <span
                    className={`text-[13px] font-bold leading-snug ${
                      i === hit ? "text-yel" : "text-txt"
                    }`}
                  >
                    {r.n}
                  </span>
                  {i === hit && (
                    <span className="ml-auto shrink-0 text-[10px] text-yel">いまここ</span>
                  )}
                </div>
                {r.d && (
                  <div
                    className={`mt-0.5 text-[12px] leading-relaxed ${
                      i === hit ? "text-txt" : "text-dim"
                    }`}
                  >
                    {r.d}
                  </div>
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
