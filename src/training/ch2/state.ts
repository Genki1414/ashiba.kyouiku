/* 第2章の状態。JSON にそのまま落とせる形。 */

import { SPAN_IDS, type PostId, type SpanId } from "./layout";
import { buildSteps, type Step } from "./queue";

/** 盤面に置いた物の鍵 */
export type PlacedKey =
  | `R1:${SpanId}`   // 1段目の手摺
  | `R2:${SpanId}`   // 2段目の手摺
  | `P2:${PostId}`   // 継いだ支柱
  | `PI:${PostId}`   // 継いだ内柱
  | `BRK:${PostId}`  // ブラケット
  | `R6:${PostId}`   // 踏板高さの手摺
  | `WJ:${PostId}`   // 壁当てジャッキ
  | `D2:${SpanId}`   // 2段目の踏板
  | `BR:${1 | 2 | 3}:${SpanId}` // 筋交
  | `FL:${"M" | "U"}:${SpanId}`; // 転落防止手摺

/** 安全帯の掛け先 */
export type Belt = "none" | "post" | "rail";

/** いま立っている高さ。0=地上 / 1=1段目 / 2=2段目 / 3=屋根 */
export type Level = 0 | 1 | 2 | 3;

export type Ch2State = {
  qi: number;
  placed: string[];
  belt: Belt;
  lv: Level;
  /** 作業員が立っている柱 */
  at: PostId;
  /** 筋交の入れ方を一度教えたか（1本目だけ図解を出す） */
  braceTaught: boolean;
};

export const initialState = (): Ch2State => ({
  qi: 0,
  placed: [],
  belt: "none",
  lv: 0,
  at: "P0",
  braceTaught: false,
});

export const STEPS: Step[] = buildSteps();

export const has = (s: Ch2State, k: string) => s.placed.includes(k);
export const current = (s: Ch2State): Step | null => STEPS[s.qi] ?? null;
export const isComplete = (s: Ch2State) => s.qi >= STEPS.length;

export const progress = (s: Ch2State) => ({ done: s.qi, total: STEPS.length });

/** 2段目の踏板が全部入ったか */
export const allDecked = (s: Ch2State) => SPAN_IDS.every((id) => has(s, `D2:${id}`));
/** 2段目の手摺が全部入ったか */
export const allRail2 = (s: Ch2State) => SPAN_IDS.every((id) => has(s, `R2:${id}`));
