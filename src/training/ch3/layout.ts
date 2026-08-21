/* 第3章の割り付け。4面が組み上がった状態を平面図で見る。
   プロトタイプ（handoff/prototypes/ashiba-ch3-v13.tsx）の定数をそのまま写したもの。

   南面・北面＝3スパン、東面・西面＝2スパン。 */

export type CornerId = "SE" | "SW" | "NW" | "NE";

export type Corner = {
  id: CornerId;
  nm: string;
  /** その出隅で交わる2面 */
  fa: string;
  fb: string;
  /** その出隅から各面が伸びる向き */
  dx: number;
  dy: number;
};

/* 火打は出隅4箇所（HANDOFF.md 3章 第3章） */
export const CORNERS: Corner[] = [
  { id: "SE", nm: "南東の出隅", fa: "南面", fb: "東面", dx: -1, dy: -1 },
  { id: "SW", nm: "南西の出隅", fa: "南面", fb: "西面", dx: 1, dy: -1 },
  { id: "NW", nm: "北西の出隅", fa: "北面", fb: "西面", dx: 1, dy: 1 },
  { id: "NE", nm: "北東の出隅", fa: "北面", fb: "東面", dx: -1, dy: 1 },
];

/* ── シートを結ぶ支柱（南面と西面の一部を出す）── */
export type PostKey = "corner" | "s1" | "s2" | "s3" | "w1" | "w2";

export const POSTS: { k: PostKey; nm: string }[] = [
  { k: "corner", nm: "出隅" },
  { k: "s1", nm: "南①" },
  { k: "s2", nm: "南②" },
  { k: "s3", nm: "南端" },
  { k: "w1", nm: "西①" },
  { k: "w2", nm: "西②" },
];

export const postName = (k: PostKey) => POSTS.find((p) => p.k === k)!.nm;

/** 出隅の両隣。ここを結んでからでないと出隅は結べない（HANDOFF.md 3章） */
export const NEXT_TO_CORNER: PostKey[] = ["s1", "w1"];

/** シートは1スパンに1枚、縦張り、重ねしろ無し。南面3スパン */
export const SHEET_SPANS = [0, 1, 2];

/** 緊結ピッチ。450 か 900（戸建は900でよい） */
export const PITCHES = [450, 900, 1800] as const;
export type Pitch = (typeof PITCHES)[number];
export const PITCH_OK: Pitch[] = [450, 900];

/** 1段＝1,800mm ÷ 450mm＝4コマ */
export const KOMA_PER_LEVEL = 4;

/** 結ぶ順。上（4コマ目）から下へ。900なら4コマ目・2コマ目 */
export const tieOrder = (pitch: Pitch): number[] =>
  [4, 3, 2, 1].filter((i) => (pitch === 450 ? true : i % 2 === 0));

/** 段。ゲームでは2段目まで（以降は同じ繰り返しなので省略） */
export const BANDS = [
  { nm: "2段目", top: "最上段" },
  { nm: "1段目", top: "2段目" },
  { nm: "地上", top: "1段目" },
];
