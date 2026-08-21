/* 第1章の工程キュー。
   「何を、どの順で、どこに置くか」をデータとして持つ。判定はここから導く
   （PROMPT.md 2章：工程キュー → 判定 → 描画 の順で作る）。

   建方は 共通ステージ（出隅まわり）→ 面ごとのキュー の2段構え。
   南面と東面は独立して進められる。どちらから進めても自由。 */

import { EAST, SOUTH, type Face, type PostId, type SpanId } from "./layout";

/** 共通ステージ：出隅 → 2方向の根がらみ → 両隣の柱 → 柱ごとに 離れ→水平→ブラケット
    （HANDOFF.md 3章 第1章 ルール4・5） */
export type StageA =
  | { k: "post"; t: PostId; d: string }
  | { k: "ledger2"; ts: SpanId[]; d: string }
  | { k: "post2"; ts: PostId[]; d: string }
  | { k: "adjust"; ts: PostId[]; d: string };

export const STAGE_A: StageA[] = [
  { k: "post", t: "C", d: "基準となる1本目（出隅）を立てる" },
  {
    k: "ledger2",
    ts: ["C-S1", "C-E1"],
    d: "基準柱の2方向のコマに根がらみ手摺を入れる（順不同）",
  },
  { k: "post2", ts: ["S1", "E1"], d: "両側の柱を立てる（どちらからでもよい）" },
  { k: "adjust", ts: ["S1", "E1"], d: "柱ごとに 離れ → 水平 → ブラケット" },
];

/** 面ごとの工程 */
export type FaceStep =
  | { k: "brk"; t: PostId; face: Face; d: string }
  | { k: "deck"; t: SpanId; face: Face; d: string }
  | { k: "ledger"; t: SpanId; face: Face; d: string }
  | { k: "post"; t: PostId; face: Face; d: string }
  | { k: "hanare"; t: PostId; face: Face; d: string }
  | { k: "level"; a: PostId; b: PostId; face: Face; d: string }
  | { k: "inner"; t: PostId; face: Face; d: string };

/**
 * 面ごとのキューを組み立てる。
 * 根がらみ手摺は「立っとる柱のコマへ先に入れる」（柱 → 手摺 → 次の柱）。
 * 柱ごとの順序は 離れ → 水平 → ブラケット で全箇所固定。
 * 内柱の箇所だけはブラケットの代わりに内柱を立てる。
 */
export function buildFace(face: Face, inner: PostId[]): FaceStep[] {
  const list = face === "S" ? SOUTH : EAST;
  const fn = face === "S" ? "南面" : "東面";
  const q: FaceStep[] = [];

  q.push({ k: "brk", t: "C", face, d: `出隅に${fn}の踏板を受けるブラケットを掛ける` });
  q.push({ k: "deck", t: `${list[0]}-${list[1]}` as SpanId, face, d: "踏板を敷く" });

  for (let i = 2; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    q.push({ k: "ledger", t: `${a}-${b}` as SpanId, face, d: "立っとる柱のコマへ根がらみ手摺を入れる" });
    q.push({ k: "post", t: b, face, d: "次の柱を立てる" });
    q.push({ k: "hanare", t: b, face, d: "建物からの離れを測る" });
    if (inner.includes(b)) {
      q.push({ k: "level", a, b, face, d: "外柱の水平を調整する" });
      q.push({ k: "inner", t: b, face, d: "内柱の箇所。内柱を立てる" });
    } else {
      q.push({ k: "level", a, b, face, d: "水平を調整する" });
      q.push({ k: "brk", t: b, face, d: "外柱にブラケットを掛ける" });
    }
    q.push({ k: "deck", t: `${a}-${b}` as SpanId, face, d: "踏板を敷く" });
  }
  return q;
}
