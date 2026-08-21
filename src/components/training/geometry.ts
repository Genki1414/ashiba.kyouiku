/* 盤面の図法。プロトタイプの投影をそのまま使う。
   斜め上から見た平行投影で、x は南面方向、y は東面方向、z は高さ（1＝1段＝1,800mm）。
   縮尺は HANDOFF.md 4章のとおり。1コマ＝450mm なので z は 0.25 刻みでコマ1つ。 */

import { POSTS, SPANS, type Post, type PostId } from "@/training/ch1/layout";

/** 柱の位置。手摺先行工法では出隅の片側が600スパンになるので、
    そのときだけ postsFor(side) で作った表を渡す */
export type PostMap = Record<PostId, Post>;

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

export const innerPos = (id: PostId, posts: PostMap = POSTS) =>
  posts[id].face === "E"
    ? { x: posts[id].x - INNER_OFFSET, y: posts[id].y }
    : { x: posts[id].x, y: posts[id].y + INNER_OFFSET };

/** スパンの中点（作業員が立つ場所） */
export const spanMid = (a: PostId, b: PostId, posts: PostMap = POSTS) => ({
  x: (posts[a].x + posts[b].x) / 2,
  y: (posts[a].y + posts[b].y) / 2,
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

/** 段取りで資材を寝かせる位置（足場の外側） */
export const laidOffset = (a: PostId, b: PostId) =>
  (POSTS[a].face ?? POSTS[b].face) === "E" ? { x: 0.34, y: 0 } : { x: 0, y: -0.34 };

/* ── 盤面の寄せ方 ──────────────────────
   地面の四隅まで入れると、足場のまわりに広い余白ができる。
   スマホでは節点が小さくなって隣を押してしまうので、
   実際に物が置かれる範囲だけを枠に入れる。 */

/** 物が置かれる範囲。柱・内柱・寝かせた資材・作業員のぶん */
function contentBounds(zTop: number) {
  const pts: Pt[] = [];
  const push = (x: number, y: number, z = 0) => pts.push(P(x, y, z));
  for (const id of Object.keys(POSTS) as PostId[]) {
    const p = POSTS[id];
    push(p.x, p.y, 0);
    push(p.x, p.y, zTop);
    const ip = innerPos(id);
    push(ip.x, ip.y, 0);
    push(ip.x, ip.y, Math.min(zTop, 1));
  }
  /* 段取りで寝かせた資材は足場の外側 */
  for (const sp of SPANS) {
    const o = laidOffset(sp.a, sp.b);
    push(POSTS[sp.a].x + o.x, POSTS[sp.a].y + o.y, 0);
    push(POSTS[sp.b].x + o.x, POSTS[sp.b].y + o.y, 0);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  /* 作業員は地面を歩く。頭の高さぶんだけ上に見ておく */
  const feet = (Object.keys(POSTS) as PostId[]).map((id) => P(POSTS[id].x, POSTS[id].y, 0));
  feet.push(P(3, -0.6, 0)); // 荷揚げ側の立ち位置
  for (const f of feet) {
    xs.push(f[0] - WORKER.half, f[0] + WORKER.half);
    ys.push(f[1] - WORKER.tall, f[1]);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** 作業員の見かけの大きさ（身長1,700mm） */
const WORKER = { tall: 58, half: 15 };

/** 柱の名前は足元の下に出る。そのぶんだけ下に余白を取る */
const MARGIN = { top: 18, bottom: 32, side: 18 };

/** 物が置かれる範囲に寄せた viewBox */
export function viewBoxFit(zTop: number): string {
  const b = contentBounds(zTop);
  const x0 = b.x0 - MARGIN.side;
  const y0 = b.y0 - MARGIN.top;
  const w = b.x1 - b.x0 + MARGIN.side * 2;
  const h = b.y1 - b.y0 + MARGIN.top + MARGIN.bottom;
  return `${x0} ${y0} ${w} ${h}`;
}

/** 俯瞰したときに、進行方向が画面の左に来るか。
    プロトタイプと同じ判定（南面＝基準右・進行左／東面＝基準左・進行右） */
export const flipOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (b.x - a.x) * SX + (b.y - a.y) * DX < 0;

/** 段取り中は地面に置くだけ／建方は柱の高さぶん上を見る */
export const VB_DAN = viewBoxFit(0);
export const VB_TATE = viewBoxFit(2);


/** ブラケットは外柱から建物側へ張り出す */
export const brkOffset = (face: "S" | "E") => (face === "E" ? { x: 0.3, y: 0 } : { x: 0, y: -0.3 });

export { POSTS, SPANS };
