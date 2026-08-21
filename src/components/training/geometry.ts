/* 盤面の図法。プロトタイプの投影をそのまま使う。
   斜め上から見た平行投影で、x は南面方向、y は東面方向、z は高さ（1＝1段＝1,800mm）。
   縮尺は HANDOFF.md 4章のとおり。1コマ＝450mm なので z は 0.25 刻みでコマ1つ。 */

import { POSTS, SPANS, type PostId } from "@/training/ch1/layout";

export const SX = 62;
export const SY = 31;
export const DX = 44;
export const DY = -22;
export const LV = 74; // 1段（1,800mm）ぶんの高さ

export type Pt = [number, number];

export const P = (x: number, y: number, z = 0): Pt => [
  x * SX + y * DX,
  x * SY + y * DY - z * LV,
];

export const pts = (...a: Pt[]) => a.map((p) => p.join(",")).join(" ");

/** 内柱は外柱から建物側へ600mm（1スパン1,800mmの 0.42 ≒ 600/1,800 のかわりに実寸比） */
export const INNER_OFFSET = 600 / 1800;

export const innerPos = (id: PostId) =>
  POSTS[id].face === "E"
    ? { x: POSTS[id].x - INNER_OFFSET, y: POSTS[id].y }
    : { x: POSTS[id].x, y: POSTS[id].y + INNER_OFFSET };

/** スパンの中点（作業員が立つ場所） */
export const spanMid = (a: PostId, b: PostId) => ({
  x: (POSTS[a].x + POSTS[b].x) / 2,
  y: (POSTS[a].y + POSTS[b].y) / 2,
});

/** 盤面が見切れないように viewBox を作る（HANDOFF.md 4章：縦横比を保って縮小し、見切れさせない） */
export function viewBox(zTop: number): string {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const x of [-1.15, 4.15]) {
    for (const y of [-1.15, 3.15]) {
      for (const z of [0, zTop]) {
        const [a, b] = P(x, y, z);
        xs.push(a);
        ys.push(b);
      }
    }
  }
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return `${x0} ${y0} ${Math.max(...xs) - x0} ${Math.max(...ys) - y0}`;
}

/** 俯瞰したときに、進行方向が画面の左に来るか。
    プロトタイプと同じ判定（南面＝基準右・進行左／東面＝基準左・進行右） */
export const flipOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (b.x - a.x) * SX + (b.y - a.y) * DX < 0;

/** 段取り中は地面だけなので寄せる／建方は柱の高さぶん引く */
export const VB_DAN = viewBox(0.75);
export const VB_TATE = viewBox(2.5);

/** 段取りで資材を寝かせる位置（足場の外側） */
export const laidOffset = (a: PostId, b: PostId) =>
  (POSTS[a].face ?? POSTS[b].face) === "E" ? { x: 0.34, y: 0 } : { x: 0, y: -0.34 };

/** ブラケットは外柱から建物側へ張り出す */
export const brkOffset = (face: "S" | "E") => (face === "E" ? { x: 0.3, y: 0 } : { x: 0, y: -0.3 });

export { POSTS, SPANS };
